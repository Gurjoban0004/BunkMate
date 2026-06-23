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
    isSessionDead,
    setCorsHeaders,
    ERP_BASE,
} = require('./_session-utils');
const {
    fetchTimetableLegacy,
    readErpPayload,
} = require('./_erp-provider');

// ─── HTML PARSING ────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

// Standard period times for CU (used when no explicit times found in HTML)
const DEFAULT_PERIODS = [
    { number: 1, start: '09:00', end: '09:50' },
    { number: 2, start: '10:00', end: '10:50' },
    { number: 3, start: '11:00', end: '11:50' },
    { number: 4, start: '12:00', end: '12:50' },
    { number: 5, start: '13:40', end: '14:30' },
    { number: 6, start: '14:30', end: '15:20' },
    { number: 7, start: '15:20', end: '16:10' },
    { number: 8, start: '16:10', end: '17:00' },
];

function stripTags(html) {
    return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;?/gi, ' ').replace(/\s+/g, ' ').trim();
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
        const info = extractSubjectInfo(text);
        if (!info) continue;
        if (info.subjectCode && seenCodes.has(info.subjectCode)) continue;
        if (info.subjectCode) seenCodes.add(info.subjectCode);
        results.push(info);
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
function parseTimetableHTML(htmlContent) {
    const timetable = {};
    DAY_NAMES.forEach(d => { timetable[d] = []; });
    let periods = [];
    let timesAreInferred = false;

    if (!htmlContent || htmlContent.length < 100) {
        return { timetable, periods, timesAreInferred: true, found: false };
    }

    // Try to isolate the timetable section if embedded in a larger page
    let timetableHtml = htmlContent;
    const sectionMarkers = [
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
        periods = periodHeaders.map((hdr, idx) => {
            const timeRange = extractTimeRange(hdr);
            if (timeRange) return { number: idx + 1, ...timeRange };
            return DEFAULT_PERIODS[idx] || { number: idx + 1, start: `${9 + idx}:00`, end: `${9 + idx}:50` };
        });
        timesAreInferred = !periodHeaders.some(h => extractTimeRange(h) !== null);

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
                    subjectName: candidates[0].subjectName,
                    subjectCode: candidates[0].subjectCode,
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
                    subjectName: candidates[0].subjectName,
                    subjectCode: candidates[0].subjectCode,
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

// ─── HANDLER ─────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const { token, persistentToken } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Session token is required' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    let session;
    try {
        session = decryptSession(token);
    } catch {
        return res.status(401).json({ error: 'Invalid session', sessionExpired: true });
    }

    try {
        const erpResult = await fetchTimetableLegacy(session);
        const diag = erpResult._diag || {};

        // Session dead check
        if (!erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.payload?.content || '')) {
            if (!persistentToken) {
                return res.status(401).json({ error: 'Session expired', sessionExpired: true, _diag: diag });
            }

            let creds;
            try { creds = decryptPersistent(persistentToken); } catch {
                return res.status(401).json({ error: 'Invalid persistent token', sessionExpired: true });
            }

            const reloginResult = await reloginERP(creds.username, creds.password);
            return res.status(200).json({
                sessionExpired: true,
                needsOtp:       true,
                authUserId:     reloginResult.authUserId,
                studentName:    creds.studentName || '',
            });
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
            });
        }

        const parsed = parseTimetableHTML(htmlContent);

        if (!parsed.found) {
            return res.status(200).json({
                success: true,
                timetable: {},
                timeSlots: [],
                source: 'empty',
                timesAreInferred: true,
                fetchedAt: new Date().toISOString(),
                _diag: { ...htmlDiag, parserResult: 'no_timetable_found' },
            });
        }

        // Convert periods to timeSlots format
        const timeSlots = parsed.periods.map(p => ({
            id: `erp-period-${p.number}`,
            start: p.start,
            end: p.end,
        }));

        return res.status(200).json({
            success: true,
            timetable: parsed.timetable,
            timeSlots,
            source: diag.source || 'chalkpadpro',
            timesAreInferred: parsed.timesAreInferred,
            fetchedAt: new Date().toISOString(),
            _diag: htmlDiag,
        });

    } catch (err) {
        console.error('ERP timetable fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve timetable. Please try again.' });
    }
};

module.exports.parseTimetableHTML = parseTimetableHTML;
