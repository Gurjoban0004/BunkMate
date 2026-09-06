/**
 * POST /api/erp-attendance
 * Body: { token, persistentToken?, keepAlive? }
 *
 * keepAlive=true: only probes session liveness (one ERP round-trip), no parsing.
 *   → { success: true, alive: true } | the shared sessionExpired/needsOtp shape
 *
 * Normal flow: register table (primary, proven for this college) → mobile
 * summary cards (fallback). The session lifecycle — stale/dead detection, silent
 * re-login on the sealed device id, OTP hand-off — lives in api/_data-session.js.
 *
 * SECURITY: all ERP communication and HTML parsing is server-side. The client
 * receives clean JSON only; nothing about the ERP's raw responses leaks out.
 */

const { setCorsHeaders, isSessionDead, checkSessionAlive, ERP_BASE } = require('./_session-utils');
const { openSession, fetchWithLiveSession } = require('./_data-session');
const { fetchSummaryV2, fetchRegisterLegacy, isRegisterTable } = require('./_erp-provider');
const { parseRegisterHTML } = require('./erp-calendar');

// ─── HTML PARSING ────────────────────────────────────────────────────

function parseAttendanceHTML(htmlContent) {
    const subjects = [];
    const blockRegex = /class=["']tt-box-new["'][^>]*>([\s\S]*?)(?=class=["']tt-box-new["']|$)/gi;
    const cellRegex  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const stripTags  = (html) => html.replace(/<[^>]+>/g, '').trim();

    const blocks = htmlContent.match(blockRegex);
    if (blocks && blocks.length > 0) {
        for (const block of blocks) {
            cellRegex.lastIndex = 0;
            const cells    = block.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
            let textParts  = cells.map(c => stripTags(c)).filter(Boolean);

            if (textParts.length === 0) {
                const spans = block.match(/<(?:span|div|p)[^>]*>([^<]+)<\/(?:span|div|p)>/gi) || [];
                textParts   = spans.map(s => stripTags(s)).filter(Boolean);
            }

            const subject = extractSubjectFromParts(textParts, block);
            if (subject) subjects.push(subject);
        }
    }

    if (subjects.length === 0) {
        const allRows = htmlContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const row of allRows) {
            const cells     = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
            const textParts = cells.map(c => stripTags(c)).filter(Boolean);
            const subject   = extractSubjectFromParts(textParts, row);
            if (subject) subjects.push(subject);
        }
    }

    if (subjects.length === 0) {
        subjects.push(...extractFromGenericHTML(htmlContent));
    }

    return subjects;
}

function extractSubjectFromParts(textParts, rawBlock) {
    if (textParts.length < 3) return null;

    let name = '', code = '', teacher = '', delivered = 0, attended = 0, absent = 0, percentage = 0;
    const numericParts = [];

    for (let i = 0; i < textParts.length; i++) {
        const part = textParts[i];
        if (part.includes('%') || (i === textParts.length - 1 && /^\d+\.?\d*$/.test(part))) {
            percentage = parseFloat(part.replace('%', '')) || 0;
            continue;
        }
        if (/^\d+$/.test(part)) { numericParts.push(parseInt(part)); continue; }
        if (/^[A-Z]{2,}\s*[-]?\s*\d{2,}/.test(part) && !code) { code = part; continue; }
        if (!name && part.length > 2 && !/^\d/.test(part) && !/^(from|to|date)/i.test(part)) { name = part; continue; }
        if (name && !teacher && part.length > 2 && !/^\d/.test(part) && !/^(from|to|date)/i.test(part)) { teacher = part; continue; }
    }

    if (numericParts.length >= 3) {
        let anchorIdx = -1;
        for (let i = 0; i < numericParts.length - 1; i++) {
            if (numericParts[i] >= numericParts[i + 1] && numericParts[i] <= 500) { anchorIdx = i; break; }
        }
        if (anchorIdx >= 0) {
            delivered = numericParts[anchorIdx];
            attended  = numericParts[anchorIdx + 1];
            absent    = numericParts[anchorIdx + 2] !== undefined ? numericParts[anchorIdx + 2] : delivered - attended;
        }
    }

    if (percentage === 0) {
        const m = rawBlock.match(/(\d+\.?\d*)\s*%/);
        if (m) percentage = parseFloat(m[1]);
    }

    if (!name || (delivered === 0 && attended === 0)) return null;
    if (absent === 0 && delivered > attended) absent = delivered - attended;

    return {
        name, code: code || '', teacher: teacher || '',
        delivered, attended, absent,
        percentage: percentage || (delivered > 0 ? Math.round((attended / delivered) * 1000) / 10 : 0),
    };
}

function extractFromGenericHTML(html) {
    const subjects  = [];
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;?/gi, ' ').replace(/\s+/g, ' ').trim();
    const regex     = /(.+?)\s+Teacher\s*:\s*(.+?)\s+From[\s\S]*?Delivered\s*:\s*(\d+)\s+Attended\s*:\s*(\d+)\s+Absent\s*:\s*(\d+)[\s\S]*?Total Percentage\s*:\s*([\d.]+)%/gi;

    let match;
    while ((match = regex.exec(plainText)) !== null) {
        let rawName    = match[1].replace(/Total Approved (?:DL|ML)\s*:\s*\d+/gi, '').replace(/\b(?:DL|ML)\s*:\s*\d+/gi, '').trim();
        const teacher  = match[2].trim();
        const delivered = parseInt(match[3], 10);
        const attended  = parseInt(match[4], 10);
        const absent    = parseInt(match[5], 10);
        const percentage = parseFloat(match[6]);

        let name = rawName, code = '';
        const codeMatch = rawName.match(/(.+?)\s+([A-Z0-9-]{5,})$/i);
        if (codeMatch && /\d/.test(codeMatch[2])) { name = codeMatch[1].trim(); code = codeMatch[2].trim(); }

        subjects.push({ name, code, teacher, delivered, attended, absent, percentage });
    }
    return subjects;
}

// ─── HANDLER ─────────────────────────────────────────────────────────

const MOCK_SUBJECTS = [
    { name: 'Database Management Systems', code: 'CS201', teacher: 'Dr. John Doe', delivered: 30, attended: 24, absent: 6, percentage: 80 },
    { name: 'Data Structures & Algorithms', code: 'CS202', teacher: 'Prof. Jane Smith', delivered: 32, attended: 22, absent: 10, percentage: 68.8 },
    { name: 'Discrete Mathematics', code: 'MA201', teacher: 'Dr. Alan Turing', delivered: 28, attended: 21, absent: 7, percentage: 75 },
    { name: 'Computer Networks', code: 'CS203', teacher: 'Prof. Grace Hopper', delivered: 35, attended: 31, absent: 4, percentage: 88.6 },
    { name: 'Web Development', code: 'CS204', teacher: 'Dr. Tim Berners-Lee', delivered: 24, attended: 22, absent: 2, percentage: 91.7 },
];

async function fetchAttendance(sess) {
    // PRIMARY: the register (chalkpadpro) via the showAttendance warm-up + cookies —
    // the same path the calendar and timetable use.
    const register = await fetchRegisterLegacy(sess);
    const registerHtml = register.payload?.content || '';
    if (register.response.ok && isRegisterTable(registerHtml)) {
        return { response: register.response, payload: register.payload, htmlBody: registerHtml, source: 'register' };
    }

    // FALLBACK: mobilev2 commonPage/28 summary cards.
    const v2 = await fetchSummaryV2(sess);
    const v2Content = v2.payload?.content || v2.payload?.data?.content || '';
    if (v2.response.ok && v2Content) {
        return { response: v2.response, payload: v2.payload, htmlBody: v2Content, source: 'summary' };
    }

    return {
        response: register.response.ok ? register.response : v2.response,
        payload:  register.response.ok ? register.payload  : v2.payload,
        htmlBody: registerHtml || v2Content,
        source:   'summary',
    };
}

const attendanceIsDead = (r) => !r.response.ok || isSessionDead(r.payload, r.htmlBody);

// keepAlive: the ERP's own liveness probe, nothing else.
const probeSession = async (sess) => ({ alive: await checkSessionAlive(sess) });
const probeIsDead = (r) => r.alive === false;

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    const opened = await openSession(req, res);
    if (!opened) return;
    const { session, persistentToken } = opened;
    const keepAlive = req.body?.keepAlive === true;

    if (session.isMock) {
        if (keepAlive) return res.status(200).json({ success: true, alive: true });
        return res.status(200).json({ success: true, subjects: MOCK_SUBJECTS, fetchedAt: new Date().toISOString() });
    }

    try {
        const live = await fetchWithLiveSession(
            res, session, persistentToken,
            keepAlive ? probeSession : fetchAttendance,
            keepAlive ? probeIsDead : attendanceIsDead,
        );
        if (!live) return;
        if (live.transient) {
            return res.status(200).json({ success: true, subjects: [], transient: true, fetchedAt: new Date().toISOString() });
        }
        const { result, refreshedToken } = live;
        const withToken = refreshedToken ? { token: refreshedToken } : {};

        if (keepAlive) return res.status(200).json({ success: true, alive: true, ...withToken });

        const htmlContent = result.htmlBody;
        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no attendance data.' });
        }

        const subjects = result.source === 'register'
            ? (parseRegisterHTML(htmlContent).subjects || []).map(s => ({
                name: s.name,
                code: s.code,
                teacher: s.teacher || '',
                delivered: s.total,
                attended: s.attended,
                absent: Math.max(0, (s.total || 0) - (s.attended || 0)),
                percentage: s.percentage,
            }))
            : parseAttendanceHTML(htmlContent);

        if (subjects.length === 0) {
            // Distinguish "not uploaded yet" (a valid empty state) from a real parse failure.
            const isEmptyState = /not uploaded|no records?\s*found|no data|attendance not/i.test(htmlContent);
            const hasDataStructure = /tt-box-new|id=['"]subject_\d+['"]|delivered\s*:/i.test(htmlContent);
            if (isEmptyState && !hasDataStructure) {
                return res.status(200).json({
                    success: true, subjects: [], empty: true,
                    message: 'Attendance has not been uploaded yet for this session.',
                    fetchedAt: new Date().toISOString(),
                    ...withToken,
                });
            }
            console.warn('[ATTENDANCE] parse produced no subjects', JSON.stringify({ source: result.source, length: htmlContent.length }));
            return res.status(200).json({
                success: true, subjects: [],
                warning: 'Could not parse attendance data. The portal layout may have changed.',
                ...withToken,
            });
        }

        return res.status(200).json({ success: true, subjects, fetchedAt: new Date().toISOString(), ...withToken });

    } catch (err) {
        console.error('ERP attendance fetch error:', err.message);
        return res.status(502).json({ error: 'Fetch failed', message: 'Could not retrieve attendance. Please try again.' });
    }
};

module.exports.parseAttendanceHTML = parseAttendanceHTML;
