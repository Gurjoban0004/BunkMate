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
    isSessionDead,
    setCorsHeaders,
    encodeForm,
    MOBILE_HEADERS,
    ERP_BASE,
} = require('./_session-utils');
const {
    fetchRegisterLegacy,
    readErpPayload,
} = require('./_erp-provider');

// ─── HTML PARSING ────────────────────────────────────────────────────

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

                if (!calendar[dateStr][name]) {
                    calendar[dateStr][name] = {
                        status,
                        code,
                        erpSubjectId,
                        period,
                        units: 1,
                        _att: status === 'present' ? 1 : 0,
                    };
                } else {
                    calendar[dateStr][name].units += 1;
                    if (status === 'present') calendar[dateStr][name]._att += 1;
                    const totalUnits   = calendar[dateStr][name].units;
                    const presentUnits = calendar[dateStr][name]._att;
                    calendar[dateStr][name].status = presentUnits > totalUnits / 2 ? 'present' : 'absent';
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

    // Clean up internal _att tracker
    Object.keys(calendar).forEach(date => {
        Object.keys(calendar[date]).forEach(sub => {
            delete calendar[date][sub]._att;
        });
    });

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
        const register = await fetchRegisterLegacy(sess);
        const registerHtml = register.payload?.content || register.payload?.data?.content || '';
        if (register.response.ok && registerHtml) {
            return { response: register.response, payload: register.payload, htmlBody: registerHtml };
        }

        const fallbackResponse = await fetchCalendarV2(sess);
        const fallbackPayload = await readErpPayload(fallbackResponse);
        return {
            response: fallbackResponse,
            payload: fallbackPayload,
            htmlBody: fallbackPayload.content || fallbackPayload.data?.content || '',
        };
    }

    try {
        const erpResult = await fetchCalendar(session);
        
        if (!erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
            if (!persistentToken) {
                return res.status(401).json({ error: 'Session expired', sessionExpired: true });
            }

            let creds;
            try { creds = decryptPersistent(persistentToken); } catch {
                return res.status(401).json({ error: 'Invalid persistent token', sessionExpired: true });
            }

            // Initiate re-login
            const reloginResult = await reloginERP(creds.username, creds.password);
            return res.status(200).json({
                sessionExpired: true,
                needsOtp:       true,
                authUserId:     reloginResult.authUserId,
                studentName:    creds.studentName || '',
            });
        }

        const htmlContent = erpResult.htmlBody;

        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no calendar data.' });
        }

        const { calendar, subjects, latestDate } = parseRegisterHTML(htmlContent);

        return res.status(200).json({ 
            success: true, 
            calendar, 
            subjects,
            latestDate,
            fetchedAt: new Date().toISOString() 
        });

    } catch (err) {
        console.error('ERP calendar fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve calendar. Please try again.' });
    }
};

module.exports.parseCalendarHTML = parseCalendarHTML;
module.exports.parseRegisterHTML = parseRegisterHTML;
