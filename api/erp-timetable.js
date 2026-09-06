/**
 * Vercel Serverless Function: ERP Timetable Fetch
 *
 * POST /api/erp-timetable
 * Body: { token, persistentToken? }
 *
 * Fetches the student's weekly timetable from the ERP.
 * Tries multiple endpoint candidates (dedicated timetable pages, commonPageIds,
 * the full student display page) and parses the timetable table from the HTML.
 *
 * Returns the parsed timetable with real days and period times.
 */

const {
    decryptSession,
    decryptPersistent,
    reloginERP,
    mintSessionToken,
    isSessionDead,
    checkSessionAlive,
    setCorsHeaders,
    ERP_BASE,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');
const { saveResearch } = require('./_research');
const {
    fetchTimetableV2,
    fetchTimetableLegacy,
    fetchRegisterLegacy,
    readErpPayload,
} = require('./_erp-provider');
const { parseRegisterHTML } = require('./erp-calendar');

// ─── HTML PARSING ────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

// CU CSE bell schedule: 1-hour periods on the hour from 9am. A 2-hour class occupies two
// consecutive periods (two register cells, same subject) → renders as two back-to-back hours.
// ponytail: period-number → clock-time is a fixed semester map; calibrate against real register
// data if an afternoon slot shows the wrong hour (the ERP's period numbering across the daily
// break is the only unknown — adjust the after-break entries here, one place).
const DEFAULT_PERIODS = [
    { number: 1, start: '09:00', end: '10:00' },
    { number: 2, start: '10:00', end: '11:00' },
    { number: 3, start: '11:00', end: '12:00' },
    { number: 4, start: '12:00', end: '13:00' },
    { number: 5, start: '13:00', end: '14:00' },
    { number: 6, start: '14:00', end: '15:00' },
    { number: 7, start: '15:00', end: '16:00' },
    { number: 8, start: '16:00', end: '17:00' },
];

function decodeEntities(s) {
    return s
        .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&nbsp;?/gi, ' ');
}

function stripTags(html) {
    return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function normalizeDayName(text) {
    const lower = text.toLowerCase().trim();
    for (const day of DAY_NAMES) {
        if (lower === day.toLowerCase() || lower === day.toLowerCase().slice(0, 3)) return day;
    }
    if (DAY_ABBREVS[lower]) return DAY_ABBREVS[lower];
    return null;
}

function extractTimeRange(text) {
    const match = text.match(/(\d{1,2})[:.h](\d{2})?\s*[-–to]+\s*(\d{1,2})[:.h](\d{2})?/);
    if (match) {
        const startH = match[1].padStart(2, '0');
        const startM = (match[2] || '00').padStart(2, '0');
        const endH = match[3].padStart(2, '0');
        const endM = (match[4] || '00').padStart(2, '0');
        return { start: `${startH}:${startM}`, end: `${endH}:${endM}` };
    }
    return null;
}

function extractSubjectInfo(cellText) {
    const text = cellText.trim();
    if (!text || text === '-' || text.toLowerCase() === 'free' || text.toLowerCase() === 'break' || text.toLowerCase() === 'lunch') {
        return null;
    }

    let subjectName = text;
    let subjectCode = '';

    // Pattern 1: "Subject Name (CODE)"
    const codeMatch = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (codeMatch) {
        subjectName = codeMatch[1].trim();
        subjectCode = codeMatch[2].trim();
    } else {
        // Pattern 2: code at end separated by space/newline
        const tailCode = text.match(/^(.+?)\s+(\d{2}[A-Z]{2,}\d{4}\S*)$/);
        if (tailCode) {
            subjectName = tailCode[1].trim();
            subjectCode = tailCode[2].trim();
        } else {
            // Pattern 3: code anywhere in text (handles fragments from multi-class cells
            // where stripping tags leaves "24CSE0222 Room-210 DR.YOGESH")
            const anyCode = text.match(/(\d{2}[A-Z]{2,}\d{3,})/);
            if (anyCode) {
                subjectCode = anyCode[1];
                const before = text.slice(0, text.indexOf(subjectCode)).replace(/[()]/g, '').trim();
                subjectName = before || subjectCode;
            }
        }
    }

    return { subjectName, subjectCode };
}

// A live grid cell reads:
//   <span title="Algorithm Design & Implementation (24CSE0317)">24CSE0317</span>
//   <br>TG312<br>24CSE-G04<br>DIYA GARG
// i.e. code, room, group, faculty on <br>-separated lines. The group code is the
// section the student sits in — printed, not inferred. Tolerant of missing lines:
// the group is matched by shape, then the leftovers are room-then-faculty.
function extractCellMeta(rawFrag) {
    const lines = rawFrag
        .split(/<br\s*\/?>/i)
        .map(stripTags)
        .filter(Boolean)
        .slice(1); // line 0 is the subject code span
    const meta = {};
    const rest = [];
    for (const line of lines) {
        if (!meta.group && /^\d{2}[A-Z]{2,}-\w+$/i.test(line)) meta.group = line;
        else rest.push(line);
    }
    // Older /display cells put both on one line: "Room-210 DR.YOGESH".
    if (rest.length === 1) {
        const m = rest[0].match(/^(Room[-\s]?\S+)\s+(.+)$/i);
        if (m) { meta.room = m[1]; meta.faculty = m[2]; return meta; }
    }
    if (rest[0]) meta.room = rest[0];
    if (rest[1]) meta.faculty = rest[1];
    return meta;
}

function extractSubjectsFromCellHtml(rawHtml) {
    if (!rawHtml || !rawHtml.trim()) return [];

    // Split by <hr> (separates different class options in multi-group cells)
    let parts = rawHtml.split(/<hr[^>]*\/?>/gi);
    // Also try double <br> if no <hr> produced a split
    if (parts.length <= 1) {
        parts = rawHtml.split(/<br\s*\/?>\s*<br\s*\/?>/gi);
    }

    const results = [];
    const seenCodes = new Set();

    for (const frag of parts) {
        const text = stripTags(frag);
        if (!text) continue;
        // The full subject name lives in the cell's title attr ("Algorithm Design & Implementation
        // (24CSE0317)"); the visible text is just the code. Prefer the title when present.
        const titleMatch = frag.match(/title=["']([^"']+)["']/i);
        const info = extractSubjectInfo(titleMatch ? decodeEntities(titleMatch[1]).trim() : text) || extractSubjectInfo(text);
        if (!info) continue;
        if (info.subjectCode && seenCodes.has(info.subjectCode)) continue;
        if (info.subjectCode) seenCodes.add(info.subjectCode);
        results.push({ ...info, ...extractCellMeta(frag) });
    }

    return results;
}

/**
 * Parse timetable from HTML content.
 * Handles multiple table orientations:
 *   - Days as rows with period columns
 *   - Days as columns with period rows
 *   - Embedded in a larger page (searches for timetable section)
 */
// Isolate the innermost <table> enclosing the "Days/Periods" grid header, with balanced
// <table>/</table> matching (the page nests tables). Returns null if the anchor isn't present.
function isolateGridByAnchor(html) {
    const anchor = html.search(/Days\s*\/\s*Periods/i);
    if (anchor < 0) return null;
    const start = html.lastIndexOf('<table', anchor);
    if (start < 0) return null;
    const tagRe = /<\/?table\b/gi;
    tagRe.lastIndex = start;
    let depth = 0, m;
    while ((m = tagRe.exec(html)) !== null) {
        depth += m[0][1] === '/' ? -1 : 1;
        if (depth === 0) {
            const end = html.indexOf('>', m.index);
            return html.slice(start, end < 0 ? m.index : end + 1);
        }
    }
    return null;
}

// Parse "1 09:00 AM 10:00 AM" style period headers (two clock times, no dash separator) → 24h range.
function extractAmPmRange(text) {
    const times = text.match(/\d{1,2}:\d{2}\s*[AP]M/gi);
    if (!times || times.length < 2) return null;
    const to24 = (t) => {
        const [, h, mm, ap] = t.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
        let hr = parseInt(h, 10) % 12;
        if (/PM/i.test(ap)) hr += 12;
        return `${String(hr).padStart(2, '0')}:${mm}`;
    };
    return { start: to24(times[0]), end: to24(times[times.length - 1]) };
}

function parseTimetableHTML(htmlContent) {
    const timetable = {};
    DAY_NAMES.forEach(d => { timetable[d] = []; });
    let periods = [];
    let timesAreInferred = false;

    if (!htmlContent || htmlContent.length < 100) {
        return { timetable, periods, timesAreInferred: true, found: false };
    }

    // Try to isolate the timetable section if embedded in a larger page.
    // Preferred: anchor on the grid's own header cell ("Days/Periods") and extract the
    // innermost enclosing <table> with balanced tag matching (the page nests tables, so a
    // non-greedy /<table>...<\/table>/ would close on the wrong tag). Verified against the
    // live My-Info page (chalkpadpro/studentDetails/display) captured 2026-07-18.
    let timetableHtml = isolateGridByAnchor(htmlContent) || htmlContent;
    const sectionMarkers = timetableHtml !== htmlContent ? [] : [
        /time\s*table/i, /timetable/i, /class\s*schedule/i, /weekly\s*schedule/i,
    ];
    for (const marker of sectionMarkers) {
        const markerIdx = htmlContent.search(marker);
        if (markerIdx >= 0) {
            // Find the nearest <table> after the marker
            const afterMarker = htmlContent.slice(Math.max(0, markerIdx - 200));
            const tableStart = afterMarker.indexOf('<table');
            if (tableStart >= 0) {
                const tableEnd = afterMarker.indexOf('</table>', tableStart);
                if (tableEnd >= 0) {
                    timetableHtml = afterMarker.slice(tableStart, tableEnd + 8);
                    break;
                }
            }
        }
    }

    // If no isolated section, try to find any table that contains day names
    if (timetableHtml === htmlContent) {
        const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
        let tableMatch;
        while ((tableMatch = tableRegex.exec(htmlContent)) !== null) {
            const tableContent = tableMatch[0];
            const hasDays = DAY_NAMES.some(d => tableContent.toLowerCase().includes(d.toLowerCase()));
            const hasPeriodHint = /period|slot|lecture|\d{1,2}[:.]\d{2}/i.test(tableContent);
            // Exclude the attendance register table
            const isRegister = /id=['"]subject_\d+['"]/.test(tableContent);
            if (hasDays && hasPeriodHint && !isRegister) {
                timetableHtml = tableContent;
                break;
            }
        }
    }

    // Extract all rows (keep both stripped text for header detection and raw HTML for subject extraction)
    const rows = [];
    const rawRows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(timetableHtml)) !== null) {
        const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
        const cells = [];
        const rawCells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
            rawCells.push(cellMatch[1]);
            cells.push(stripTags(cellMatch[1]));
        }
        if (cells.length > 0) {
            rows.push(cells);
            rawRows.push(rawCells);
        }
    }

    if (rows.length < 2) {
        return { timetable, periods, timesAreInferred: true, found: false };
    }

    // Detect orientation: are days in first column (days-as-rows) or in header row (days-as-columns)?
    const headerRow = rows[0];
    const firstColumn = rows.map(r => r[0] || '');

    const daysInHeader = headerRow.filter(cell => normalizeDayName(cell) !== null).length;
    const daysInColumn = firstColumn.filter(cell => normalizeDayName(cell) !== null).length;

    if (daysInColumn >= 3) {
        // ── Orientation A: Days as rows ──────────────────────────
        // Header row has period/time info, subsequent rows have day + subjects
        // Extract period times from header
        const periodHeaders = headerRow.slice(1); // skip first cell (usually "Day" label)
        const rangeOf = (hdr) => extractTimeRange(hdr) || extractAmPmRange(hdr);
        periods = periodHeaders.map((hdr, idx) => {
            const timeRange = rangeOf(hdr);
            if (timeRange) return { number: idx + 1, ...timeRange };
            return DEFAULT_PERIODS[idx] || { number: idx + 1, start: `${9 + idx}:00`, end: `${9 + idx}:50` };
        });
        timesAreInferred = !periodHeaders.some(h => rangeOf(h) !== null);

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const dayName = normalizeDayName(row[0] || '');
            if (!dayName) continue;

            for (let c = 1; c < row.length; c++) {
                const candidates = extractSubjectsFromCellHtml(rawRows[r]?.[c] || '');
                if (candidates.length === 0) continue;
                const period = periods[c - 1] || DEFAULT_PERIODS[c - 1];
                if (!period) continue;
                const entry = {
                    ...candidates[0],
                    period: period.number,
                    startTime: period.start,
                    endTime: period.end,
                };
                if (candidates.length > 1) entry.classes = candidates;
                timetable[dayName].push(entry);
            }
        }
    } else if (daysInHeader >= 3) {
        // ── Orientation B: Days as columns ───────────────────────
        // First column has period/time info, header has day names
        const dayColumns = headerRow.map(cell => normalizeDayName(cell));

        // Extract period times from first column of each data row
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const periodCell = row[0] || '';
            const timeRange = extractTimeRange(periodCell);
            const periodNum = r;
            const period = timeRange
                ? { number: periodNum, ...timeRange }
                : (DEFAULT_PERIODS[r - 1] || { number: periodNum, start: `${8 + r}:00`, end: `${8 + r}:50` });

            if (r === 1) timesAreInferred = !timeRange;
            if (!periods.find(p => p.number === periodNum)) periods.push(period);

            for (let c = 1; c < row.length; c++) {
                const dayName = dayColumns[c];
                if (!dayName) continue;
                const candidates = extractSubjectsFromCellHtml(rawRows[r]?.[c] || '');
                if (candidates.length === 0) continue;
                const entry = {
                    ...candidates[0],
                    period: period.number,
                    startTime: period.start,
                    endTime: period.end,
                };
                if (candidates.length > 1) entry.classes = candidates;
                timetable[dayName].push(entry);
            }
        }
    } else {
        // Couldn't determine orientation
        return { timetable, periods, timesAreInferred: true, found: false };
    }

    // Check if we actually found any data
    const totalEntries = Object.values(timetable).reduce((sum, day) => sum + day.length, 0);
    if (totalEntries === 0) {
        return { timetable, periods, timesAreInferred: true, found: false };
    }

    // Fill in periods from defaults if none extracted
    if (periods.length === 0) {
        const maxPeriod = Math.max(...Object.values(timetable).flat().map(e => e.period || 0));
        periods = DEFAULT_PERIODS.slice(0, maxPeriod);
        timesAreInferred = true;
    }

    return { timetable, periods, timesAreInferred, found: true };
}

/**
 * Derive the recurring weekly timetable from the attendance register.
 *
 * The register (getAttendanceRegister) reliably returns every class instance as a cell
 * id `subject_{erpSubjectId}_{YYYY}_{MM}_{DD}_{period}`. The dedicated timetable endpoints
 * all return empty for this ERP (HANDOFF-erp-mobile.md OPEN #1), so instead we map each
 * instance's date → weekday and tally which subject occupies each (weekday, period) slot.
 * The most-frequent subject per slot wins, which is robust to one-off substitutions and
 * mid-semester changes. Times are always inferred (the register carries no clock times).
 */
function deriveTimetableFromRegister(htmlContent) {
    const { subjects } = parseRegisterHTML(htmlContent);
    const byId = {};
    for (const s of subjects) byId[s.erpSubjectId] = s;

    // getDay(): 0=Sun … 6=Sat. Sunday has no classes → dropped.
    const dayIndexToName = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

    // slots[dayName][period] = Map(subjectKey → { count, name, code })
    const slots = {};
    const cellRegex = /id=['"]subject_(\d+)_(\d{4})_(\d{2})_(\d{2})_(\d+)['"]/gi;
    let m;
    while ((m = cellRegex.exec(htmlContent)) !== null) {
        const [, id, y, mo, d, p] = m;
        const subj = byId[id];
        if (!subj) continue;
        const dayName = dayIndexToName[new Date(Number(y), Number(mo) - 1, Number(d)).getDay()];
        if (!dayName) continue;
        const period = parseInt(p, 10);
        slots[dayName] = slots[dayName] || {};
        slots[dayName][period] = slots[dayName][period] || new Map();
        const key = subj.code || subj.name;
        const cur = slots[dayName][period].get(key) || { count: 0, name: subj.name, code: subj.code };
        cur.count += 1;
        slots[dayName][period].set(key, cur);
    }

    const timetable = {};
    DAY_NAMES.forEach(d => { timetable[d] = []; });
    let maxPeriod = 0;
    for (const dayName of Object.keys(slots)) {
        for (const period of Object.keys(slots[dayName]).map(Number)) {
            const winner = [...slots[dayName][period].values()].sort((a, b) => b.count - a.count)[0];
            if (!winner) continue;
            const times = DEFAULT_PERIODS[period - 1] || { start: `${8 + period}:00`, end: `${8 + period}:50` };
            timetable[dayName].push({
                subjectName: winner.name,
                subjectCode: winner.code,
                period,
                startTime: times.start,
                endTime: times.end,
            });
            if (period > maxPeriod) maxPeriod = period;
        }
    }
    DAY_NAMES.forEach(d => timetable[d].sort((a, b) => a.period - b.period));

    const totalEntries = Object.values(timetable).reduce((sum, day) => sum + day.length, 0);
    return {
        timetable,
        periods: DEFAULT_PERIODS.slice(0, maxPeriod),
        timesAreInferred: true,
        found: totalEntries > 0,
    };
}

// ─── HANDLER ─────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const { token, persistentToken, researchId, consentedAt } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Session token is required' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    let session;
    try {
        session = decryptSession(token);
    } catch {
        return res.status(401).json({ error: 'Invalid session', sessionExpired: true });
    }

    if (await blockIfRevoked(res, session.rollNumber)) return;

    if (session.isMock) {
        const timetable = {
            Monday: [
                { subjectName: 'Database Management Systems', subjectCode: 'CS201', period: 1, startTime: '09:00', endTime: '09:50' },
                { subjectName: 'Data Structures & Algorithms', subjectCode: 'CS202', period: 2, startTime: '10:00', endTime: '10:50' },
                { subjectName: 'Computer Networks', subjectCode: 'CS203', period: 4, startTime: '12:00', endTime: '12:50' }
            ],
            Tuesday: [
                { subjectName: 'Discrete Mathematics', subjectCode: 'MA201', period: 1, startTime: '09:00', endTime: '09:50' },
                { subjectName: 'Web Development', subjectCode: 'CS204', period: 3, startTime: '11:00', endTime: '11:50' }
            ],
            Wednesday: [
                { subjectName: 'Database Management Systems', subjectCode: 'CS201', period: 1, startTime: '09:00', endTime: '09:50' },
                { subjectName: 'Data Structures & Algorithms', subjectCode: 'CS202', period: 2, startTime: '10:00', endTime: '10:50' },
                { subjectName: 'Computer Networks', subjectCode: 'CS203', period: 4, startTime: '12:00', endTime: '12:50' }
            ],
            Thursday: [
                { subjectName: 'Discrete Mathematics', subjectCode: 'MA201', period: 1, startTime: '09:00', endTime: '09:50' },
                { subjectName: 'Web Development', subjectCode: 'CS204', period: 3, startTime: '11:00', endTime: '11:50' }
            ],
            Friday: [
                { subjectName: 'Database Management Systems', subjectCode: 'CS201', period: 2, startTime: '10:00', endTime: '10:50' },
                { subjectName: 'Data Structures & Algorithms', subjectCode: 'CS202', period: 3, startTime: '11:00', endTime: '11:50' },
                { subjectName: 'Web Development', subjectCode: 'CS204', period: 5, startTime: '13:40', endTime: '14:30' }
            ],
            Saturday: []
        };
        const timeSlots = [
            { id: 'erp-period-1', start: '09:00', end: '09:50' },
            { id: 'erp-period-2', start: '10:00', end: '10:50' },
            { id: 'erp-period-3', start: '11:00', end: '11:50' },
            { id: 'erp-period-4', start: '12:00', end: '12:50' },
            { id: 'erp-period-5', start: '13:40', end: '14:30' }
        ];
        return res.status(200).json({
            success: true,
            timetable,
            timeSlots,
            source: 'mock-erp-provider',
            timesAreInferred: false,
            fetchedAt: new Date().toISOString()
        });
    }

    // Primary timetable source: mobilev2 commonPage id 99 — the full published weekly grid (all
    // subjects, real times), served over the plain mobile session. This is the SAME grid the web
    // /display page shows, but with no Turnstile / web login / capture (verified live via the
    // official app's own traffic, 2026-07-20). Falls back to register-derived if it's ever empty.
    async function fetchTimetableData(sess) {
        try {
            const v2 = await fetchTimetableV2(sess);
            const v2Html = v2.payload?.content || v2.payload?.data?.content || '';
            if (v2Html) {
                const parsed = parseTimetableHTML(v2Html);
                if (parsed.found) {
                    return { response: v2.response, payload: v2.payload, parsed, source: 'portal-web' };
                }
            }
        } catch (e) { /* fall through to register-derived */ }

        // Fallback: derive the recurring grid from the attendance register (live but sparse early
        // in the semester). Used if commonPage/99 is empty (timetable not yet published to mobile).
        const reg = await fetchRegisterLegacy(sess);
        const html = reg.payload?.content || reg.payload?.data?.content || '';
        if (html) {
            const derived = deriveTimetableFromRegister(html);
            if (derived.found) {
                return { response: reg.response, payload: reg.payload, parsed: derived, source: 'register-derived' };
            }
        }
        // Last resort: legacy dedicated timetable endpoints (kept for other colleges).
        const tt = await fetchTimetableLegacy(sess);
        const ttHtml = tt.payload?.content || '';
        return {
            response: tt.response,
            payload: tt.payload,
            parsed: parseTimetableHTML(ttHtml),
            source: tt._diag?.source || 'chalkpadpro',
            _diag: tt._diag,
        };
    }

    try {
        // Derive the timetable from the attendance register.
        let erpResult = await fetchTimetableData(session);
        let refreshedToken = null;
        let diag = erpResult._diag || {};

        // Session dead check.
        // NOTE: a missing/empty timetable is NOT a dead session. The mobile API never serves the
        // real timetable (see memory erp-web-login-turnstile), so fetchTimetableLegacy returns
        // response.ok=false as its normal "not found" outcome. Re-logging in on that fired an OTP
        // email on every app open. Only re-auth on a genuine session-death signal — never on
        // absent data (attendance/calendar on the same open detect a real dead session).
        if (isSessionDead(erpResult.payload, erpResult.payload?.content || '')) {
            // Confirm genuine death via the ERP's own liveness probe before re-login (→ OTP email).
            const liveness = await checkSessionAlive(session);
            if (liveness !== false) {
                // No `success`/`source` → client leaves the existing timetable untouched (a transient
                // blip must not be mistaken for an empty/vacation timetable).
                return res.status(200).json({ transient: true });
            }

            if (!persistentToken) {
                return res.status(401).json({ error: 'Session expired', sessionExpired: true, _diag: diag });
            }

            let creds;
            try { creds = decryptPersistent(persistentToken); } catch {
                return res.status(401).json({ error: 'Invalid persistent token', sessionExpired: true });
            }

            const reloginResult = await reloginERP(creds.username, creds.password);

            // Silent refresh: trusted device got a full session with no OTP — retry once.
            if (reloginResult.session) {
                session = reloginResult.session;
                refreshedToken = mintSessionToken(session, creds);
                erpResult = await fetchTimetableData(session);
                diag = erpResult._diag || {};
            }

            if (reloginResult.needsOtp
                || isSessionDead(erpResult.payload, erpResult.payload?.content || '')) {
                return res.status(200).json({
                    sessionExpired: true,
                    needsOtp:       true,
                    authUserId:     reloginResult.authUserId,
                    studentName:    creds.studentName || '',
                });
            }
        }

        const htmlContent = erpResult.payload?.content || '';

        // Diagnostic info
        const htmlDiag = {
            ...diag,
            htmlLength: htmlContent.length,
            htmlPreview: htmlContent.slice(0, 500),
            hasTimetableKeyword: /time\s*table|timetable|class\s*schedule/i.test(htmlContent),
            hasDayNames: DAY_NAMES.some(d => htmlContent.toLowerCase().includes(d.toLowerCase())),
            hasPeriodHint: /period|slot|\d{1,2}[:.]\d{2}\s*[-–]/i.test(htmlContent),
            foundCodes: [...new Set((htmlContent.match(/\d{2}[A-Z]{2,4}\d{4}/g) || []).slice(0, 10))],
            tableCount: (htmlContent.match(/<table/gi) || []).length,
        };

        if (!htmlContent || htmlContent.length < 100) {
            return res.status(200).json({
                success: true,
                timetable: {},
                timeSlots: [],
                source: 'empty',
                timesAreInferred: true,
                fetchedAt: new Date().toISOString(),
                _diag: htmlDiag,
                ...(refreshedToken && { token: refreshedToken }),
            });
        }

        // fetchTimetableData already derives from the register as the primary source
        // (source 'register-derived'); the real full grid arrives via the WebView /display path.
        const parsed = erpResult.parsed || parseTimetableHTML(htmlContent);
        const source = erpResult.source || diag.source || 'chalkpadpro';

        if (!parsed.found) {
            return res.status(200).json({
                success: true,
                timetable: {},
                timeSlots: [],
                source: 'empty',
                timesAreInferred: true,
                fetchedAt: new Date().toISOString(),
                _diag: { ...htmlDiag, parserResult: 'no_timetable_found' },
                ...(refreshedToken && { token: refreshedToken }),
            });
        }

        // Convert periods to timeSlots format
        const timeSlots = parsed.periods.map(p => ({
            id: `erp-period-${p.number}`,
            start: p.start,
            end: p.end,
        }));

        // Research dataset (opt-in). The portal grid prints the student's section
        // in every cell ("24CSE-G04") — that is the group id, not a derived hash.
        // Register-derived grids carry no room/faculty/group; those keys just stay off.
        const slots = Object.entries(parsed.timetable).flatMap(([day, entries]) =>
            entries.map(e => ({
                day,
                p: e.period,
                s: e.subjectCode,
                name: e.subjectName,
                ...(e.faculty && { faculty: e.faculty }),
                ...(e.room && { room: e.room }),
            })));
        const group = Object.values(parsed.timetable).flat().find(e => e.group)?.group;
        await saveResearch(researchId, { slots, source, ...(group && { group }) }, consentedAt);

        return res.status(200).json({
            success: true,
            timetable: parsed.timetable,
            timeSlots,
            source,
            timesAreInferred: parsed.timesAreInferred,
            fetchedAt: new Date().toISOString(),
            _diag: htmlDiag,
            ...(refreshedToken && { token: refreshedToken }),
        });

    } catch (err) {
        console.error('ERP timetable fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve timetable. Please try again.' });
    }
};

module.exports.parseTimetableHTML = parseTimetableHTML;
module.exports.deriveTimetableFromRegister = deriveTimetableFromRegister;
