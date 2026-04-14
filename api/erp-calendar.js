/**
 * Vercel Serverless Function: ERP Calendar Fetch
 *
 * POST /api/erp-calendar
 * Body: { token, persistentToken? }
 *
 * Discovered endpoint:
 * POST /mobile/commonPage with commonPageId: 85
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

// ─── HTML PARSING ────────────────────────────────────────────────────

function parseCalendarHTML(htmlContent) {
    const calendar = {}; // { 'YYYY-MM-DD': { subjectName: { status, period, code } } }
    const subjects = []; // { name, code, erpSubjectId, total, attended, percentage }
    let latestDateStr = null;

    // Use regex to parse out each subject block
    // A subject block consists of a <thead>...</thead> pair and its following <tbody>...</tbody> pair
    const theadRegex = /<thead[^>]*>([\s\S]*?)<\/thead>/gi;
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
    
    // We expect the same number of theads and tbodys
    const theads = [];
    const tbodys = [];
    
    let match;
    while ((match = theadRegex.exec(htmlContent)) !== null) {
        theads.push(match[1]);
    }
    while ((match = tbodyRegex.exec(htmlContent)) !== null) {
        tbodys.push(match[1]);
    }

    const stripTags = (html) => html.replace(/<[^>]+>/g, '').trim();

    // Iterate over each subject block
    for (let i = 0; i < Math.min(theads.length, tbodys.length); i++) {
        const thead = theads[i];
        const tbody = tbodys[i];

        // 1. Parse subject info from thead
        // Look for the first <th> in the second <tr> which contains "Subject Name\n(Code)"
        const trs = thead.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        if (trs.length < 2) continue; // second tr holds the info
        
        const ths = trs[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
        if (ths.length === 0) continue;
        
        const rawSubjectText = stripTags(ths[0]);
        // Extract Name and Code (e.g., "Data Structures using Object Oriented Programming-II(24CSE0212)")
        // Sometimes separated by <br>, which becomes space or just concatenated
        let name = rawSubjectText;
        let code = '';
        const codeMatch = rawSubjectText.match(/(.+?)\(([^)]+)\)$/i);
        if (codeMatch) {
            name = codeMatch[1].trim();
            code = codeMatch[2].trim();
        }

        // 2. Parse attendance from tbody
        // Get the first <tr>, its ID contains the erpSubjectId (e.g. <tr id='subject_10755'>)
        const trMatch = /<tr[^>]*id=['"]subject_(\d+)['"][^>]*>([\s\S]*?)<\/tr>/i.exec(tbody);
        if (!trMatch) continue;
        
        const erpSubjectId = trMatch[1];
        const trContent = trMatch[2];

        // Match all tds: <td id='...'> or <td class='...'>
        const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
        let tdMatch;
        let attended = 0;
        let total = 0;
        let percentage = 0;

        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
            const tdAttrs = tdMatch[1];
            const tdVal = stripTags(tdMatch[2]);

            // Check if it's a calendar cell (id="subject_XXXX_YYYY_MM_DD_Period")
            const idMatch = tdAttrs.match(/id=['"]subject_\d+_(\d{4})_(\d{2})_(\d{2})_(\d+)['"]/i);
            if (idMatch) {
                const year = idMatch[1];
                const month = idMatch[2];
                const day = idMatch[3];
                const period = parseInt(idMatch[4], 10);
                
                const dateStr = `${year}-${month}-${day}`;
                
                // Track latest date
                if (!latestDateStr || dateStr > latestDateStr) {
                    latestDateStr = dateStr;
                }

                // Initialize calendar entry for this date
                if (!calendar[dateStr]) calendar[dateStr] = {};

                // Determine present or absent
                const status = (tdVal.toUpperCase() === 'X') ? 'absent' : 'present';

                // We might have multiple periods for the same subject on the same day.
                // But the AppContext only stores ONE record per subject per day, with a `units` field.
                // We'll group them into arrays first, then aggregate below.
                if (!calendar[dateStr][name]) {
                    calendar[dateStr][name] = {
                        status: status, // Assume first encountered status
                        code: code,
                        units: 1, // Start with 1 unit
                        // Internal tracker for averaging if mixed (rare but possible)
                        _att: status === 'present' ? 1 : 0
                    };
                } else {
                    // Accumulate units
                    calendar[dateStr][name].units += 1;
                    if (status === 'present') calendar[dateStr][name]._att += 1;
                    
                    // Final status logic: if majority present -> present, else absent
                    // (Actually if they marked present for ANY period, we'll call it present, since partial absences aren't natively supported, but normally it's homogeneous)
                    const totalUnits = calendar[dateStr][name].units;
                    const presentUnits = calendar[dateStr][name]._att;
                    calendar[dateStr][name].status = (presentUnits > totalUnits / 2) ? 'present' : 'absent';
                }
            } 
            // Check if it's the totals cell
            else if (tdAttrs.toLowerCase().includes('class=') && tdAttrs.toLowerCase().includes('total_')) {
                // e.g. "73/89"
                const parts = tdVal.split('/');
                if (parts.length === 2) {
                    attended = parseInt(parts[0], 10) || 0;
                    total = parseInt(parts[1], 10) || 0;
                }
            }
            // Check if it's the percentage cell
            else if (tdAttrs.toLowerCase().includes('class=') && tdAttrs.toLowerCase().includes('percent_')) {
                // e.g. "82.02%"
                percentage = parseFloat(tdVal.replace('%', '')) || 0;
            }
        }

        // Add to subjects list
        subjects.push({
            name,
            code,
            erpSubjectId,
            attended,
            total,
            percentage
        });
    }

    // Clean up temporary `_att` field
    Object.keys(calendar).forEach(date => {
        Object.keys(calendar[date]).forEach(sub => {
            delete calendar[date][sub]._att;
        });
    });

    return { calendar, subjects, latestDate: latestDateStr };
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

    async function fetchCalendar(sess) {
        return await fetch(`${ERP_BASE}/mobilev2/commonPage`, {
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

    try {
        let erpRes = await fetchCalendar(session);

        const erpResClone = erpRes.clone();
        const erpJson = await erpResClone.json().catch(() => null);
        
        if (!erpRes.ok || isSessionDead(erpJson)) {
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

        const attendanceData = erpJson || await erpRes.json();
        const htmlContent    = attendanceData.content || attendanceData.data?.content || '';

        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no calendar data.' });
        }

        const { calendar, subjects, latestDate } = parseCalendarHTML(htmlContent);

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
