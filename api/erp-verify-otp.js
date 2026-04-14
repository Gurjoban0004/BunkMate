/**
 * Vercel Serverless Function: ERP OTP Verification
 *
 * POST /api/erp-verify-otp
 * Body: { authUserId, otp, username, password }
 *
 * 1. Verifies OTP with ERP (via shared verifyOtpWithERP helper)
 * 2. Encrypts session (userId, sessionId, roleId, apiKey) — NO expiry
 * 3. Encrypts credentials (username, password) into a persistent token
 * 4. Returns both tokens to client
 *
 * Session is refreshed automatically on failure, not on a timer.
 *
 * SECURITY: Raw session data and credentials never reach the client as plaintext.
 *           Passwords are never logged.
 */

const {
    encryptSession,
    encryptPersistent,
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

    const { authUserId, otp, username, password } = req.body || {};

    if (!authUserId || !otp) {
        return res.status(400).json({ error: 'authUserId and OTP are required' });
    }

    if (!ERP_BASE || !process.env.ENCRYPTION_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Generate deterministic device UUID from username (if provided)
        const deviceIdUUID = username ? generateDeviceUUID(username) : '';

        const session = await verifyOtpWithERP(authUserId, otp, deviceIdUUID);

        if (!session.userId || !session.sessionId) {
            return res.status(502).json({ error: 'Could not retrieve session details' });
        }

        // Session token — includes deviceIdUUID so data endpoints can pass it to ERP
        const token = encryptSession({
            userId:       session.userId,
            sessionId:    session.sessionId,
            roleId:       session.roleId,
            apiKey:       session.apiKey,
            studentId:    session.studentId,
            deviceIdUUID: deviceIdUUID,
        });

        // Persistent token — stores credentials for auto re-login, no expiry
        const persistentToken = (username && password)
            ? encryptPersistent({ username, password, studentName: session.studentName })
            : null;

        return res.status(200).json({
            success:      true,
            token,
            persistentToken,
            studentName:  session.studentName,
            studentPhoto: session.studentPhoto,
        });

    } catch (err) {
        // Return generic message — never expose internal ERP error details to client
        if (err.code === 'INVALID_OTP') {
            return res.status(401).json({ error: 'Invalid OTP', message: 'The OTP you entered is incorrect' });
        }
        console.error('ERP OTP verification error:', err.message);
        return res.status(500).json({ error: 'Verification failed', message: 'Could not verify OTP. Please try again.' });
    }
};
