/**
 * POST /api/erp-calendar
 * Body: { token, persistentToken?, researchId?, consentedAt? }
 *
 * The day-wise attendance register (chalkpadpro getAttendanceRegister), parsed
 * into { calendar, subjects, marks, latestDate }. The session lifecycle lives in
 * api/_data-session.js. Raw ERP HTML never leaves the server.
 */

const { setCorsHeaders, isSessionDead, ERP_BASE } = require('./_session-utils');
const { openSession, fetchWithLiveSession } = require('./_data-session');
const { saveResearch, RESEARCH_ID } = require('./_research');
const { fetchRegisterLegacy } = require('./_erp-provider');

// ─── HTML PARSING ────────────────────────────────────────────────────

function parseRegisterHTML(htmlContent) {
    const calendar = {}; // { 'YYYY-MM-DD': { subjectName: { status, period, code, erpSubjectId, units } } }
    const subjects = []; // { name, code, erpSubjectId, total, attended, percentage }
    // Flat per-period marks, one entry per register cell. `calendar` collapses a
    // subject's periods into one entry per day (the app's math depends on that);
    // this keeps which period was actually missed. Additive — nothing reads it
    // except the research upload.
    const marks = []; // { d: 'YYYY-MM-DD', s: code, p: period, a: 1|0 }
    let latestDateStr = null;
    const stripTags = (html) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;?/gi, ' ').replace(/\s+/g, ' ').trim();

    // ── Step 1: Build erpSubjectId → { name, code } map ──────────────
    // The register HTML has one <thead> row with subject-name <th> cells interleaved
    // with date-column <th> cells. Subject-name cells look like:
    //   "Subject Name<br>(CODE)"  where CODE is e.g. 24CSE0212
    // Date-column cells look like:
    //   "1<br>20-01<br>1"  (column number, date, period)
    //
    // Strategy: extract ALL <th> contents individually (no cross-tag matching),
    // then filter for the ones that contain a real subject code.

    // Extract all <th> inner contents without crossing </th> boundaries
    const allThContents = [];
    const thExtractRegex = /<th(?:\s[^>]*)?>([^]*?)<\/th>/gi;
    let thExtractMatch;
    while ((thExtractMatch = thExtractRegex.exec(htmlContent)) !== null) {
        allThContents.push(thExtractMatch[1]);
    }

    // Filter for subject-name <th> cells: must contain a real subject code like (24CSE0212).
    // Real codes: optional leading digits, then 2+ uppercase letters, then 4+ digits.
    // Date-column headers like "1<br>20-01<br>1" contain no uppercase letters in parens.
    const subjectCodePattern = /\(\d*[A-Z]{2,}\d{4,}[^)]*\)/;
    const subjectHeaders = []; // [{ name, code }] in document order
    for (const thContent of allThContents) {
        if (!subjectCodePattern.test(thContent)) continue;
        const text = stripTags(thContent);
        // text looks like "Subject Name (CODE)" after stripTags replaces <br> with space
        const codeMatch = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (codeMatch) {
            subjectHeaders.push({ name: codeMatch[1].trim(), code: codeMatch[2].trim() });
        }
    }

    // Extract data rows: <tr id="subject_{erpSubjectId}">
    const rowRegex = /<tr[^>]*id=['"]subject_(\d+)['"][^>]*>([\s\S]*?)<\/tr>/gi;
    const dataRows = []; // [{ erpSubjectId, trContent }] in document order
    let rowMatch;
    while ((rowMatch = rowRegex.exec(htmlContent)) !== null) {
        dataRows.push({ erpSubjectId: rowMatch[1], trContent: rowMatch[2] });
    }

    // Correlate: subjectHeaders[i] ↔ dataRows[i]
    const subjectMap = {}; // erpSubjectId → { name, code }
    for (let i = 0; i < Math.min(subjectHeaders.length, dataRows.length); i++) {
        subjectMap[dataRows[i].erpSubjectId] = subjectHeaders[i];
    }

    // ── Step 2: Parse each data row ──────────────────────────────────
    for (const { erpSubjectId, trContent } of dataRows) {
        const subjectInfo = subjectMap[erpSubjectId];
        if (!subjectInfo) continue;
        const { name, code } = subjectInfo;

        const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
        let tdMatch;
        let attended = 0;
        let total = 0;
        let percentage = 0;

        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
            const tdAttrs = tdMatch[1];
            const tdVal = stripTags(tdMatch[2]);
            const idMatch = tdAttrs.match(/id=['"]subject_\d+_(\d{4})_(\d{2})_(\d{2})_(\d+)['"]/i);

            if (idMatch) {
                const year   = idMatch[1];
                const month  = idMatch[2];
                const day    = idMatch[3];
                const period = parseInt(idMatch[4], 10);
                const dateStr = `${year}-${month}-${day}`;
                const status  = tdVal.toUpperCase() === 'X' ? 'absent' : 'present';

                marks.push({ d: dateStr, s: code, p: period, a: status === 'present' ? 1 : 0 });

                if (!latestDateStr || dateStr > latestDateStr) latestDateStr = dateStr;
                if (!calendar[dateStr]) calendar[dateStr] = {};

                // One entry per subject per day, carrying how many periods were
                // marked and how many were attended. Those periods are not
                // always one block (e.g. period 1 and period 5), so collapsing
                // them to a single present/absent used to drop real attendance
                // and drift away from the portal's own totals.
                if (!calendar[dateStr][name]) {
                    calendar[dateStr][name] = {
                        status,
                        code,
                        erpSubjectId,
                        period,
                        units: 1,
                        attendedUnits: status === 'present' ? 1 : 0,
                    };
                } else {
                    const entry = calendar[dateStr][name];
                    entry.units += 1;
                    if (status === 'present') entry.attendedUnits += 1;
                    // status stays as a summary for display only — attendedUnits is the truth
                    entry.status = entry.attendedUnits === entry.units ? 'present'
                        : entry.attendedUnits === 0 ? 'absent'
                        : 'partial';
                }
            } else if (tdAttrs.toLowerCase().includes('class=') && tdAttrs.toLowerCase().includes('total_')) {
                const parts = tdVal.split('/');
                if (parts.length === 2) {
                    attended = parseInt(parts[0], 10) || 0;
                    total    = parseInt(parts[1], 10) || 0;
                }
            } else if (tdAttrs.toLowerCase().includes('class=') && tdAttrs.toLowerCase().includes('percent_')) {
                percentage = parseFloat(tdVal.replace('%', '')) || 0;
            }
        }

        subjects.push({ name, code, erpSubjectId, attended, total, percentage });
    }

    return { calendar, subjects, marks, latestDate: latestDateStr };
}

// ─── HANDLER ─────────────────────────────────────────────────────────

function mockCalendar() {
    const subjects = [
        { name: 'Database Management Systems', code: 'CS201', erpSubjectId: '101', attended: 24, total: 30, percentage: 80, teacher: 'Dr. John Doe', absent: 6 },
        { name: 'Data Structures & Algorithms', code: 'CS202', erpSubjectId: '102', attended: 22, total: 32, percentage: 68.8, teacher: 'Prof. Jane Smith', absent: 10 },
        { name: 'Discrete Mathematics', code: 'MA201', erpSubjectId: '103', attended: 21, total: 28, percentage: 75, teacher: 'Dr. Alan Turing', absent: 7 },
        { name: 'Computer Networks', code: 'CS203', erpSubjectId: '104', attended: 31, total: 35, percentage: 88.6, teacher: 'Prof. Grace Hopper', absent: 4 },
        { name: 'Web Development', code: 'CS204', erpSubjectId: '105', attended: 22, total: 24, percentage: 91.7, teacher: 'Dr. Tim Berners-Lee', absent: 2 },
    ];
    const dailySchedule = {
        1: [{ name: 'Database Management Systems', code: 'CS201', id: '101', period: 1 }, { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 2 }, { name: 'Computer Networks', code: 'CS203', id: '104', period: 4 }],
        2: [{ name: 'Discrete Mathematics', code: 'MA201', id: '103', period: 1 }, { name: 'Web Development', code: 'CS204', id: '105', period: 3 }],
        3: [{ name: 'Database Management Systems', code: 'CS201', id: '101', period: 1 }, { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 2 }, { name: 'Computer Networks', code: 'CS203', id: '104', period: 4 }],
        4: [{ name: 'Discrete Mathematics', code: 'MA201', id: '103', period: 1 }, { name: 'Web Development', code: 'CS204', id: '105', period: 3 }],
        5: [{ name: 'Database Management Systems', code: 'CS201', id: '101', period: 2 }, { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 3 }, { name: 'Web Development', code: 'CS204', id: '105', period: 5 }],
        6: [],
    };
    const calendar = {};
    const today = new Date();
    let latestDateStr = null;
    for (let i = 40; i >= 1; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) continue;
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!latestDateStr || dateStr > latestDateStr) latestDateStr = dateStr;
        const classesToday = dailySchedule[dayOfWeek] || [];
        if (classesToday.length === 0) continue;
        calendar[dateStr] = {};
        const dateVal = date.getDate() + date.getMonth() * 31 + date.getFullYear();
        for (const cls of classesToday) {
            const absentEvery = { CS201: 5, CS202: 3, MA201: 4, CS203: 9, CS204: 12 }[cls.code];
            const status = dateVal % absentEvery === 0 ? 'absent' : 'present';
            calendar[dateStr][cls.name] = { status, code: cls.code, erpSubjectId: cls.id, period: cls.period, units: 1, attendedUnits: status === 'present' ? 1 : 0 };
        }
    }
    return { calendar, subjects, latestDate: latestDateStr };
}

async function fetchCalendar(sess) {
    const register = await fetchRegisterLegacy(sess);
    return { response: register.response, payload: register.payload, htmlBody: register.payload?.content || '' };
}

const calendarIsDead = (r) => !r.response.ok || isSessionDead(r.payload, r.htmlBody);

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    const opened = await openSession(req, res);
    if (!opened) return;
    const { session, persistentToken } = opened;
    const body = req.body || {};
    const researchId = RESEARCH_ID.test(body.researchId || '') ? body.researchId : null;
    const consentedAt = typeof body.consentedAt === 'string' ? body.consentedAt.slice(0, 40) : undefined;

    if (session.isMock) {
        return res.status(200).json({ success: true, ...mockCalendar(), fetchedAt: new Date().toISOString() });
    }

    try {
        const live = await fetchWithLiveSession(res, session, persistentToken, fetchCalendar, calendarIsDead);
        if (!live) return;
        if (live.transient) return res.status(200).json({ success: true, calendar: {}, transient: true });
        const { result, refreshedToken } = live;
        const withToken = refreshedToken ? { token: refreshedToken } : {};

        const htmlContent = result.htmlBody;
        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no calendar data.' });
        }

        const { calendar, subjects, marks, latestDate } = parseRegisterHTML(htmlContent);
        console.log('[CAL-SERVER]', JSON.stringify({
            htmlLength: htmlContent.length, days: Object.keys(calendar).length, subjects: subjects.length,
            hasRegisterRows: /id=['"]subject_\d+['"]/.test(htmlContent),
        }));

        // Research dataset (opt-in). `subjects` carries the ERP's own per-subject
        // totals, which is what the dataset build validates the marks against.
        await saveResearch(researchId, { marks, subjects }, consentedAt);

        return res.status(200).json({
            success: true,
            calendar,
            subjects,
            latestDate,
            fetchedAt: new Date().toISOString(),
            ...withToken,
        });

    } catch (err) {
        console.error('ERP calendar fetch error:', err.message);
        return res.status(502).json({ error: 'Fetch failed', message: 'Could not retrieve calendar. Please try again.' });
    }
};

module.exports.parseRegisterHTML = parseRegisterHTML;
