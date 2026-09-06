/**
 * Vercel Serverless Function: ERP OTP Verification
 *
 * POST /api/erp-verify-otp
 * Body: { authUserId, otp, password }
 *   authUserId — the opaque ticket returned by /api/erp-login, which seals the
 *                ERP authUserId together with the username it was issued for.
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
    openOtpTicket,
    setCorsHeaders,
    ERP_BASE,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    // `username` is deliberately NOT read from the body. It arrives sealed inside the
    // ticket instead — see below.
    const { authUserId: ticket, otp, password } = req.body || {};

    if (!ticket || !otp) {
        return res.status(400).json({ error: 'authUserId and OTP are required' });
    }

    if (!ERP_BASE || !process.env.ENCRYPTION_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // The roll number sealed into the session token below is what admin.js and
    // admin-analytics.js authorize on, so it must be the identity the ERP actually
    // issued this OTP for — not a string the caller chose. The ticket carries both
    // halves, sealed together at login, so they cannot be mixed and matched.
    const bound = openOtpTicket(ticket);
    if (!bound) {
        return res.status(401).json({
            error:   'Login expired',
            message: 'Your login session expired. Please enter your credentials again.',
        });
    }
    const { authUserId, username } = bound;

    // Block before burning an OTP — a revoked user gets the reason, not a dead session.
    if (await blockIfRevoked(res, username)) return;

    try {
        // Generate deterministic device UUID from the ticket's username
        const deviceIdUUID = generateDeviceUUID(username);

        const session = await verifyOtpWithERP(authUserId, otp, deviceIdUUID);

        if (!session.userId || !session.sessionId) {
            return res.status(502).json({ error: 'Could not retrieve session details' });
        }

        // Session token — persists securityToken + deviceIdUUID so /mobilev2/* data calls
        // are authenticated and the device stays bound (audit Bug 1 & 2).
        const token = encryptSession({
            // Roll number is the ERP login username, taken from the sealed ticket —
            // never from the request body. This is the trust anchor for admin
            // authorization, so a caller must not be able to choose it.
            rollNumber:    username,
            userId:        session.userId,
            sessionId:     session.sessionId,
            roleId:        session.roleId,
            apiKey:        session.apiKey,
            securityToken: session.securityToken || '',
            deviceIdUUID:  session.deviceIdUUID || deviceIdUUID,
            studentId:     session.studentId,
            studentName:   session.studentName,
            studentPhoto:  session.studentPhoto,
            isMock:        session.isMock || false,
        });

        // Persistent token — stores credentials for auto re-login, no expiry
        const persistentToken = password
            ? encryptPersistent({ username, password, studentName: session.studentName, isMock: session.isMock || false })
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
