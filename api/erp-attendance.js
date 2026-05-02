/**
 * Vercel Serverless Function: ERP Attendance Fetch
 *
 * POST /api/erp-attendance
 * Body: { token, persistentToken?, keepAlive? }
 *
 * keepAlive=true: short-circuit — only validates session, skips HTML parsing.
 *   Returns { success: true, alive: true } or { sessionExpired: true, ... }
 *
 * Flow (normal):
 * 1. Decrypt session token
 * 2. Fetch attendance from ERP
 * 3. If ERP signals dead session AND persistentToken provided:
 *    → Re-login (triggers OTP), return { sessionExpired: true, authUserId }
 * 4. Parse HTML → clean JSON
 *
 * SECURITY: All ERP communication and HTML parsing is server-side.
 *           Client receives only clean JSON. Passwords never logged.
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
    fetchSummaryLegacy,
    readErpPayload,
} = require('./_erp-provider');

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

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const { token, persistentToken, keepAlive } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Session token is required' });
    if (!ERP_BASE || !process.env.ENCRYPTION_SECRET) return res.status(500).json({ error: 'Server configuration error' });

    let session;
    try {
        session = decryptSession(token);
    } catch {
        return res.status(401).json({ error: 'Invalid session', sessionExpired: true });
    }

    // ── Attempt ERP fetch ─────────────────────────────────────────
    async function fetchAttendanceV2(sess) {
        return fetch(`${ERP_BASE}/mobilev2/commonPage`, {
            method: 'POST',
            headers: MOBILE_HEADERS,
            body: encodeForm({
                commonPageId:  '28',
                deviceIdUUID:  sess.deviceIdUUID || '',
                userId:        sess.userId,
                sessionId:     sess.sessionId,
                roleId:        sess.roleId,
                appKey:        sess.apiKey || '',
            }),
        });
    }

    async function fetchAttendance(sess) {
        const legacy = await fetchSummaryLegacy(sess);
        const legacyContent = legacy.payload?.content || legacy.payload?.data?.content || '';
        if (legacy.response.ok && legacyContent) {
            return { response: legacy.response, payload: legacy.payload, htmlBody: legacyContent };
        }

        const fallbackResponse = await fetchAttendanceV2(sess);
        const fallbackPayload = await readErpPayload(fallbackResponse);
        return {
            response: fallbackResponse,
            payload: fallbackPayload,
            htmlBody: fallbackPayload.content || fallbackPayload.data?.content || '',
        };
    }

    try {
        const erpResult = await fetchAttendance(session);

        // ── Session dead? ─────────────────────────────────────────
        if (!erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
            if (!persistentToken) {
                return res.status(401).json({ error: 'Session expired', sessionExpired: true });
            }

            let creds;
            try { creds = decryptPersistent(persistentToken); } catch {
                return res.status(401).json({ error: 'Invalid persistent token', sessionExpired: true });
            }

            // Initiate re-login — ERP will send OTP to student
            const reloginResult = await reloginERP(creds.username, creds.password);
            return res.status(200).json({
                sessionExpired: true,
                needsOtp:       true,
                authUserId:     reloginResult.authUserId,
                studentName:    creds.studentName || '',
            });
        }

        // ── keepAlive short-circuit — session is valid, skip parsing ──
        if (keepAlive) {
            return res.status(200).json({ success: true, alive: true });
        }

        const htmlContent = erpResult.htmlBody;

        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no attendance data.' });
        }

        const subjects = parseAttendanceHTML(htmlContent);

        if (subjects.length === 0) {
            return res.status(200).json({
                success: true, subjects: [],
                warning: 'Could not parse attendance data. The portal layout may have changed.',
            });
        }

        return res.status(200).json({ success: true, subjects, fetchedAt: new Date().toISOString() });

    } catch (err) {
        console.error('ERP attendance fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve attendance. Please try again.' });
    }
};

module.exports.parseAttendanceHTML = parseAttendanceHTML;
