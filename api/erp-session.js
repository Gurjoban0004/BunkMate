/**
 * Vercel Serverless Function: ERP Session Check / Refresh
 *
 * POST /api/erp-session
 * Body:
 *   check:   { action: 'check', token }
 *   refresh: { action: 'refresh', persistentToken, authUserId, otp }
 *
 * ── action: check ────────────────────────────────────────────────────
 * Called on app start. Decrypts the existing session token locally only.
 * It never contacts ERP login, so startup cannot silently send an OTP.
 *
 * ── action: refresh ──────────────────────────────────────────────────
 * Called after user enters OTP during a session refresh flow.
 * Completes the login, returns a new session token + updated persistent token.
 *
 * SECURITY: Credentials never logged. Client never sees plaintext session data.
 *           Internal error details are never forwarded to the client.
 */

const {
    decryptSession,
    decryptPersistent,
    encryptPersistent,
    encryptSession,
    verifyOtpWithERP,
    generateDeviceUUID,
    setCorsHeaders,
    ERP_BASE,
} = require('./_session-utils');

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    if (!ERP_BASE || !process.env.ENCRYPTION_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const { action, token, persistentToken, authUserId, otp } = req.body || {};

    // ── action: check ─────────────────────────────────────────────────
    if (action === 'check') {
        if (!token) {
            return res.status(200).json({ valid: false, reason: 'no_token' });
        }

        try {
            const session = decryptSession(token);
            if (!session.userId || !session.sessionId || !session.roleId || !session.apiKey || !session.studentId) {
                return res.status(200).json({ valid: false, reason: 'incomplete_session' });
            }
            return res.status(200).json({
                valid: true,
                reason: 'session_available',
                studentId: session.studentId,
                studentName: session.studentName || '',
            });
        } catch {
            return res.status(200).json({ valid: false, reason: 'invalid_token' });
        }
    }

    // ── action: refresh ───────────────────────────────────────────────
    if (action === 'refresh') {
        if (!persistentToken || !authUserId || !otp) {
            return res.status(400).json({ error: 'persistentToken, authUserId and otp are required' });
        }

        let creds;
        try {
            creds = decryptPersistent(persistentToken);
        } catch {
            return res.status(401).json({ error: 'Invalid persistent token' });
        }

        try {
            // Generate deterministic device UUID from stored credentials
            const deviceIdUUID = generateDeviceUUID(creds.username);

            // Use shared OTP verification helper with deviceIdUUID
            const session = await verifyOtpWithERP(authUserId, otp, deviceIdUUID);

            const studentName = creds.studentName || session.studentName || '';

            const newToken = encryptSession({
                userId:       session.userId,
                sessionId:    session.sessionId,
                roleId:       session.roleId,
                apiKey:       session.apiKey,
                studentId:    session.studentId,
                studentName,
                studentPhoto: session.studentPhoto,
            });

            // Re-encrypt persistent token to update studentName if it changed
            const newPersistentToken = encryptPersistent({
                username: creds.username,
                password: creds.password,
                studentName,
            });

            return res.status(200).json({
                success:          true,
                token:            newToken,
                persistentToken:  newPersistentToken,
                studentName,
            });

        } catch (err) {
            if (err.code === 'INVALID_OTP') {
                return res.status(401).json({ error: 'Invalid OTP', message: 'OTP incorrect or expired' });
            }
            // Do NOT forward err.message to client
            console.error('ERP session refresh error:', err.message);
            return res.status(500).json({ error: 'Session refresh failed', message: 'Could not complete session refresh. Please try again.' });
        }
    }

    return res.status(400).json({ error: 'Invalid action. Use "check" or "refresh".' });
};
