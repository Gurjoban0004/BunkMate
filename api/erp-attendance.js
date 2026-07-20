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
    mintSessionToken,
    isSessionDead,
    setCorsHeaders,
    encodeForm,
    MOBILE_HEADERS,
    ERP_BASE,
} = require('./_session-utils');
const {
    fetchSummaryLegacy,
    fetchSummaryV2,
    fetchRegisterLegacy,
    readErpPayload,
} = require('./_erp-provider');
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

    if (session.isMock) {
        if (keepAlive) {
            return res.status(200).json({ success: true, alive: true });
        }
        return res.status(200).json({
            success: true,
            subjects: [
                { name: 'Database Management Systems', code: 'CS201', teacher: 'Dr. John Doe', delivered: 30, attended: 24, absent: 6, percentage: 80 },
                { name: 'Data Structures & Algorithms', code: 'CS202', teacher: 'Prof. Jane Smith', delivered: 32, attended: 22, absent: 10, percentage: 68.8 },
                { name: 'Discrete Mathematics', code: 'MA201', teacher: 'Dr. Alan Turing', delivered: 28, attended: 21, absent: 7, percentage: 75 },
                { name: 'Computer Networks', code: 'CS203', teacher: 'Prof. Grace Hopper', delivered: 35, attended: 31, absent: 4, percentage: 88.6 },
                { name: 'Web Development', code: 'CS204', teacher: 'Dr. Tim Berners-Lee', delivered: 24, attended: 22, absent: 2, percentage: 91.7 }
            ],
            fetchedAt: new Date().toISOString()
        });
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
        // PRIMARY: the attendance register (chalkpadpro) via the showAttendance warmup + cookies.
        // This is the source proven to work for this college — the SAME path the calendar and
        // timetable already use. The mobile commonPage/28 summary (below) is a dead end for CUIET
        // (it reads as a dead session → "Session expired"); it's kept only as a fallback for
        // colleges where the mobile summary works.
        const register = await fetchRegisterLegacy(sess);
        const registerHtml = register.payload?.content || register.payload?.data?.content || '';
        const isRegister = /id=['"]subject_\d+/.test(registerHtml);
        if (register.response.ok && registerHtml && isRegister) {
            return { response: register.response, payload: register.payload, htmlBody: registerHtml, source: 'register' };
        }

        // FALLBACK 1: mobilev2 commonPage/28 summary WITH the warmup + cookies.
        const v2 = await fetchSummaryV2(sess);
        const v2Content = v2.payload?.content || v2.payload?.data?.content || '';
        if (v2.response.ok && v2Content) {
            return { response: v2.response, payload: v2.payload, htmlBody: v2Content, source: 'summary' };
        }

        // FALLBACK 2: legacy /mobile/commonPage (older colleges).
        const legacy = await fetchSummaryLegacy(sess);
        const legacyContent = legacy.payload?.content || legacy.payload?.data?.content || '';
        if (legacy.response.ok && legacyContent) {
            return { response: legacy.response, payload: legacy.payload, htmlBody: legacyContent, source: 'summary' };
        }

        // FALLBACK 3: cookie-less mobilev2 (prior behavior). If everything is empty, attach _diag
        // so a still-failing real login reveals exactly what each ERP endpoint returned.
        const fallbackResponse = await fetchAttendanceV2(sess);
        const fallbackPayload = await readErpPayload(fallbackResponse);
        const fallbackContent = fallbackPayload.content || fallbackPayload.data?.content || '';
        if (fallbackResponse.ok && fallbackContent) {
            return { response: fallbackResponse, payload: fallbackPayload, htmlBody: fallbackContent, source: 'summary' };
        }
        return {
            response: register.response.ok ? register.response : v2.response,
            payload: register.response.ok ? register.payload : v2.payload,
            htmlBody: registerHtml || v2Content,
            source: isRegister ? 'register' : 'summary',
            _diag: {
                registerStatus: register.response.status, registerLen: registerHtml.length, registerHasTable: isRegister,
                v2Status: v2.response.status, v2Body: JSON.stringify(v2.payload).slice(0, 200),
                legacyStatus: legacy.response.status,
                fallbackStatus: fallbackResponse.status, fallbackBody: JSON.stringify(fallbackPayload).slice(0, 200),
                sessionFields: {
                    userId: !!sess.userId, sessionId: !!sess.sessionId, roleId: !!sess.roleId, apiKey: !!sess.apiKey,
                    securityToken: !!sess.securityToken, deviceIdUUID: !!sess.deviceIdUUID, studentId: !!sess.studentId,
                },
            },
        };
    }

    try {
        let erpResult = await fetchAttendance(session);
        let refreshedToken = null;

        // ── Session dead? ─────────────────────────────────────────
        if (!erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
            if (!persistentToken) {
                // _diag is temporary — remove once the real OTP path is confirmed working.
                return res.status(401).json({ error: 'Session expired', sessionExpired: true, _diag: erpResult._diag });
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
                erpResult = await fetchAttendance(session);
            }

            if (reloginResult.needsOtp
                || !erpResult.response.ok || isSessionDead(erpResult.payload, erpResult.htmlBody)) {
                // ERP demands OTP (or even a fresh session failed) — hand off to OTP flow
                return res.status(200).json({
                    sessionExpired: true,
                    needsOtp:       true,
                    authUserId:     reloginResult.authUserId,
                    studentName:    creds.studentName || '',
                });
            }
        }

        // ── keepAlive short-circuit — session is valid, skip parsing ──
        if (keepAlive) {
            return res.status(200).json({ success: true, alive: true, ...(refreshedToken && { token: refreshedToken }) });
        }

        const htmlContent = erpResult.htmlBody;

        if (!htmlContent) {
            return res.status(502).json({ error: 'Empty response', message: 'The portal returned no attendance data.' });
        }

        // Register HTML → per-subject totals from the register table (proven source, no teacher
        // field). Summary HTML → the commonPage/28 tt-box-new cards (has teacher). Same output shape.
        const subjects = erpResult.source === 'register'
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
            // Only warn when the HTML actually carries data-bearing structure we failed to read.
            const isEmptyState = /not uploaded|no records?\s*found|no data|attendance not/i.test(htmlContent);
            const hasDataStructure = /tt-box-new|id=['"]subject_\d+['"]|delivered\s*:/i.test(htmlContent);

            if (isEmptyState && !hasDataStructure) {
                return res.status(200).json({
                    success: true, subjects: [], empty: true,
                    message: 'Attendance has not been uploaded yet for this session.',
                    fetchedAt: new Date().toISOString(),
                    ...(refreshedToken && { token: refreshedToken }),
                });
            }

            return res.status(200).json({
                success: true, subjects: [],
                warning: 'Could not parse attendance data. The portal layout may have changed.',
                ...(refreshedToken && { token: refreshedToken }),
            });
        }

        return res.status(200).json({
            success: true, subjects, fetchedAt: new Date().toISOString(),
            ...(refreshedToken && { token: refreshedToken }),
        });

    } catch (err) {
        console.error('ERP attendance fetch error:', err.message);
        return res.status(500).json({ error: 'Fetch failed', message: 'Could not retrieve attendance. Please try again.' });
    }
};

module.exports.parseAttendanceHTML = parseAttendanceHTML;
