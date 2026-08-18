/**
 * Vercel Serverless Function: ERP Calendar Fetch
 *
 * POST /api/erp-calendar
 * Body: { token, persistentToken? }
 *
 * Primary endpoint:
 * POST /chalkpadpro/studentDetails/getAttendanceRegister
 *
 * Fallback endpoint:
 * POST /mobilev2/commonPage with commonPageId: 85
 */

const {
    decryptSession,
    decryptPersistent,
    reloginERP,
    mintSessionToken,
    isSessionDead,
    checkSessionAlive,
    setCorsHeaders,
    encodeForm,
    MOBILE_HEADERS,
    ERP_BASE,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');
const {
    fetchRegisterLegacy,
    readErpPayload,
} = require('./_erp-provider');

// ─── HTML PARSING ────────────────────────────────────────────────────

/**
 * Parse tt-box-new cards from commonPageId 28 (attendance summary).
 * Extracts per-subject totals: name, code, teacher, delivered, attended, absent, percentage.
 * This is the fallback when the register table (chalkpadpro) isn't available.
 */
function parseSummaryCards(htmlContent) {
    const subjects = [];
    const plainText = htmlContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;?/gi, ' ')
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const regex = /(.+?)\s+(?:\d{2}[A-Z]{2,4}\d{4}\S*)\s+Teacher\s*:\s*(.+?)\s+From\s*:\s*.+?\s+Delivered\s*:\s*(\d+)\s+Attended\s*:\s*(\d+)\s+Absent\s*:\s*(\d+)[\s\S]*?Total Percentage\s*:\s*([\d.]+)%/gi;

    // Also try a simpler per-block approach
    const blockRegex = /class=['"]tt-box-new['"][^>]*>([\s\S]*?)(?=class=['"]tt-box-new['"]|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$)/gi;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(htmlContent)) !== null) {
        const block = blockMatch[1];
        const clean = block.replace(/<[^>]+>/g, ' ').replace(/&nbsp;?/gi, ' ').replace(/\\n/g, ' ').replace(/\\t/g, ' ').replace(/\s+/g, ' ').trim();

        // Extract subject name and code from tt-period-number span pair
        const nameCodeMatch = clean.match(/^\s*(.+?)\s+(\d{2}[A-Z]{2,4}\d{4}\S*)/);
        if (!nameCodeMatch) continue;

        const name = nameCodeMatch[1].trim();
        const code = nameCodeMatch[2].trim();

        const deliveredMatch = clean.match(/Delivered\s*:\s*(\d+)/i);
        const attendedMatch = clean.match(/Attended\s*:\s*(\d+)/i);
        const absentMatch = clean.match(/Absent\s*:\s*(\d+)/i);
        const percentMatch = clean.match(/Total Percentage\s*:\s*([\d.]+)%/i);
        const teacherMatch = clean.match(/Teacher\s*:\s*(.+?)\s+From/i);

        const delivered = deliveredMatch ? parseInt(deliveredMatch[1], 10) : 0;
        const attended = attendedMatch ? parseInt(attendedMatch[1], 10) : 0;
        const absent = absentMatch ? parseInt(absentMatch[1], 10) : 0;
        const percentage = percentMatch ? parseFloat(percentMatch[1]) : (delivered > 0 ? Math.round((attended / delivered) * 1000) / 10 : 0);
        const teacher = teacherMatch ? teacherMatch[1].trim() : '';

        if (name && (delivered > 0 || attended > 0)) {
            subjects.push({ name, code, teacher, delivered, attended, absent, percentage });
        }
    }

    return subjects;
}

function parseRegisterHTML(htmlContent) {
    const calendar = {}; // { 'YYYY-MM-DD': { subjectName: { status, period, code, erpSubjectId, units } } }
    const subjects = []; // { name, code, erpSubjectId, total, attended, percentage }
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

    return { calendar, subjects, latestDate: latestDateStr };
}

const parseCalendarHTML = parseRegisterHTML;

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

    if (await blockIfRevoked(res, session.rollNumber)) return;

    if (session.isMock) {
        const calendar = {};
        const subjects = [
            { name: 'Database Management Systems', code: 'CS201', erpSubjectId: '101', attended: 24, total: 30, percentage: 80, teacher: 'Dr. John Doe', absent: 6 },
            { name: 'Data Structures & Algorithms', code: 'CS202', erpSubjectId: '102', attended: 22, total: 32, percentage: 68.8, teacher: 'Prof. Jane Smith', absent: 10 },
            { name: 'Discrete Mathematics', code: 'MA201', erpSubjectId: '103', attended: 21, total: 28, percentage: 75, teacher: 'Dr. Alan Turing', absent: 7 },
            { name: 'Computer Networks', code: 'CS203', erpSubjectId: '104', attended: 31, total: 35, percentage: 88.6, teacher: 'Prof. Grace Hopper', absent: 4 },
            { name: 'Web Development', code: 'CS204', erpSubjectId: '105', attended: 22, total: 24, percentage: 91.7, teacher: 'Dr. Tim Berners-Lee', absent: 2 }
        ];

        const dailySchedule = {
            1: [ // Monday
                { name: 'Database Management Systems', code: 'CS201', id: '101', period: 1 },
                { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 2 },
                { name: 'Computer Networks', code: 'CS203', id: '104', period: 4 }
            ],
            2: [ // Tuesday
                { name: 'Discrete Mathematics', code: 'MA201', id: '103', period: 1 },
                { name: 'Web Development', code: 'CS204', id: '105', period: 3 }
            ],
            3: [ // Wednesday
                { name: 'Database Management Systems', code: 'CS201', id: '101', period: 1 },
                { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 2 },
                { name: 'Computer Networks', code: 'CS203', id: '104', period: 4 }
            ],
            4: [ // Thursday
                { name: 'Discrete Mathematics', code: 'MA201', id: '103', period: 1 },
                { name: 'Web Development', code: 'CS204', id: '105', period: 3 }
            ],
            5: [ // Friday
                { name: 'Database Management Systems', code: 'CS201', id: '101', period: 2 },
                { name: 'Data Structures & Algorithms', code: 'CS202', id: '102', period: 3 },
                { name: 'Web Development', code: 'CS204', id: '105', period: 5 }
            ],
            6: [] // Saturday
        };

        const today = new Date();
        let latestDateStr = null;

        for (let i = 40; i >= 1; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0) continue;

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const dayNum = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayNum}`;
            if (!latestDateStr || dateStr > latestDateStr) latestDateStr = dateStr;

            const classesToday = dailySchedule[dayOfWeek] || [];
            if (classesToday.length === 0) continue;

            calendar[dateStr] = {};
            for (const cls of classesToday) {
                let status = 'present';
                const dateVal = date.getDate() + date.getMonth() * 31 + date.getFullYear();
                if (cls.code === 'CS201' && dateVal % 5 === 0) status = 'absent';
                else if (cls.code === 'CS202' && dateVal % 3 === 0) status = 'absent';
                else if (cls.code === 'MA201' && dateVal % 4 === 0) status = 'absent';
                else if (cls.code === 'CS203' && dateVal % 9 === 0) status = 'absent';
                else if (cls.code === 'CS204' && dateVal % 12 === 0) status = 'absent';

                calendar[dateStr][cls.name] = {
                    status,
                    code: cls.code,
                    erpSubjectId: cls.id,
                    period: cls.period,
                    units: 1,
                    attendedUnits: status === 'present' ? 1 : 0
                };
            }
        }

        return res.status(200).json({
            success: true,
            calendar,
            subjects,
            latestDate: latestDateStr,
            fetchedAt: new Date().toISOString()
        });
    }

    async function fetchCalendarV2(sess) {
        return fetch(`${ERP_BASE}/mobilev2/commonPage`, {
            method: 'POST',
            headers: MOBILE_HEADERS,
            body: encodeForm({
                commonPageId:  '85',
                deviceIdUUID:  sess.deviceIdUUID || '',
                userId:        sess.userId,
                sessionId:     sess.sessionId,
                roleId:        sess.roleId,
                appKey:        sess.apiKey || '',
            }),
        });
    }

    async function fetchCalendar(sess) {
        const _diag = { source: null, payloadKeys: null, payloadType: null, registerOk: false };

        const register = await fetchRegisterLegacy(sess);
        _diag.registerOk = register.response.ok;
        _diag.payloadType = typeof register.payload;
        _diag.payloadKeys = register.payload ? Object.keys(register.payload).slice(0, 10) : [];
        
        const registerHtml = register.payload?.content || register.payload?.data?.content || '';
        if (register.response.ok && registerHtml) {
            _diag.source = register._source || 'chalkpadpro';
            _diag.regSteps = register._regDiag?.steps || [];
            return { response: register.response, payload: register.payload, htmlBody: registerHtml, _diag };
        }

        _diag.source = 'mobilev2-fallback';
        const fallbackResponse = await fetchCalendarV2(sess);
        const fallbackPayload = await readErpPayload(fallbackResponse);
        _diag.fallbackPayloadKeys = fallbackPayload ? Object.keys(fallbackPayload).slice(0, 10) : [];
        _diag.fallbackPayloadType = typeof fallbackPayload;

        return {
            response: fallbackResponse,
            payload: fallbackPayload,
            htmlBody: fallbackPayload.content || fallbackPayload.data?.content || '',
            _diag,
        };
    }

    try {
        // Log session fields being used (redacted for security)
        const sessionDiag = {
            hasUserId: !!session.userId,
            hasSessionId: !!session.sessionId,
            hasRoleId: !!session.roleId,
            hasApiKey: !!session.apiKey,
            hasStudentId: !!session.studentId,
            studentIdValue: session.studentId ? `${String(session.studentId).slice(0, 3)}...` : 'MISSING',
        };
        console.log('[CAL-SERVER] Session fields:', JSON.stringify(sessionDiag));

        let erpResult = await fetchCalendar(session);
        let refreshedToken = null;
        let diag = erpResult._diag || {};

        if (!erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
            // Confirm with the ERP's own liveness probe before re-login (→ OTP email). See
            // checkSessionAlive: only re-auth on a genuine death, never on a transient false-positive.
            const liveness = await checkSessionAlive(session);
            if (liveness !== false) {
                return res.status(200).json({ success: true, calendar: {}, transient: true });
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
                erpResult = await fetchCalendar(session);
                diag = erpResult._diag || {};
            }

            if (reloginResult.needsOtp
                || !erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
                return res.status(200).json({
                    sessionExpired: true,
                    needsOtp:       true,
                    authUserId:     reloginResult.authUserId,
                    studentName:    creds.studentName || '',
                });
            }
        }

        const htmlContent = erpResult.htmlBody;

        // Diagnostic info about the HTML we got
        const tableStart = htmlContent ? htmlContent.indexOf('<table') : -1;
        const tablePreview = tableStart >= 0 ? htmlContent.slice(tableStart, tableStart + 3000) : 'NO TABLE FOUND';
        
        // Search for subject codes like 24CSE0212
        const codePattern = /\d{2}[A-Z]{2,4}\d{4}/g;
        const foundCodes = htmlContent ? [...new Set((htmlContent.match(codePattern) || []).slice(0, 10))] : [];
        
        // Extract first 5 <tr> rows to understand structure
        const trSamples = [];
        if (htmlContent) {
            const trRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
            let trMatch;
            let trCount = 0;
            while ((trMatch = trRegex.exec(htmlContent)) !== null && trCount < 5) {
                trSamples.push(trMatch[0].slice(0, 500));
                trCount++;
            }
        }

        const htmlDiag = {
            ...diag,
            ...sessionDiag,
            htmlLength: htmlContent ? htmlContent.length : 0,
            htmlPreview: htmlContent ? htmlContent.slice(0, 500) : 'EMPTY',
            tablePreview,
            foundCodes,
            trSamples,
            hasTable: htmlContent ? htmlContent.includes('<table') : false,
            hasThead: htmlContent ? htmlContent.includes('<thead') : false,
            hasSubjectTr: htmlContent ? /id=['"]subject_\d+['"]/.test(htmlContent) : false,
            hasTdWithSubjectId: htmlContent ? /id=['"]subject_\d+_\d{4}/.test(htmlContent) : false,
        };

        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no calendar data.', _diag: htmlDiag });
        }

        console.log('[CAL-SERVER] HTML diag:', JSON.stringify(htmlDiag));

        let { calendar, subjects, latestDate } = parseRegisterHTML(htmlContent);

        console.log('[CAL-SERVER] Register parse: days=' + Object.keys(calendar).length + ' subjects=' + subjects.length);

        // If register parser found nothing, try the summary card parser (tt-box-new format)
        if (subjects.length === 0 && htmlContent.includes('tt-box-new')) {
            const summarySubjects = parseSummaryCards(htmlContent);
            console.log('[CAL-SERVER] Summary card parse: subjects=' + summarySubjects.length);
            if (summarySubjects.length > 0) {
                subjects = summarySubjects.map(s => ({
                    name: s.name,
                    code: s.code,
                    erpSubjectId: s.code, // Use code as ID since we don't have ERP subject IDs
                    total: s.delivered,
                    attended: s.attended,
                    percentage: s.percentage,
                    teacher: s.teacher,
                    absent: s.absent,
                }));
                htmlDiag.parsedViaSummaryCards = true;
                htmlDiag.summarySubjectCount = summarySubjects.length;
            }
        }

        return res.status(200).json({
            success: true,
            calendar,
            subjects,
            latestDate,
            fetchedAt: new Date().toISOString(),
            _diag: htmlDiag,
            ...(refreshedToken && { token: refreshedToken }),
        });

    } catch (err) {
        console.error('ERP calendar fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve calendar. Please try again.' });
    }
};

module.exports.parseCalendarHTML = parseCalendarHTML;
module.exports.parseRegisterHTML = parseRegisterHTML;
