/**
 * Vercel Serverless Function: ERP Session Check / Refresh
 *
 * POST /api/erp-session
 * Body: { action: 'check' | 'refresh', persistentToken, authUserId?, otp? }
 *
 * ── action: check ────────────────────────────────────────────────────
 * Called on app start. Decrypts the persistent token to verify credentials
 * are stored, then initiates a fresh ERP login to get a new session.
 * Because ERP always requires OTP, this returns { needsOtp, authUserId }
 * so the frontend can show only the OTP screen (skipping username/password).
 *
 * ── action: refresh ──────────────────────────────────────────────────
 * Called after user enters OTP during a session refresh flow.
 * Completes the login, returns a new session token + updated persistent token.
 *
 * SECURITY: Credentials never logged. Client never sees plaintext session data.
 *           Internal error details are never forwarded to the client.
 */

const {
    decryptPersistent,
    encryptPersistent,
    encryptSession,
    reloginERP,
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

    const { action, persistentToken, authUserId, otp } = req.body || {};

    // ── action: check ─────────────────────────────────────────────────
    if (action === 'check') {
        if (!persistentToken) {
            return res.status(200).json({ valid: false, reason: 'no_token' });
        }

        let creds;
        try {
            creds = decryptPersistent(persistentToken);
        } catch {
            return res.status(200).json({ valid: false, reason: 'invalid_token' });
        }

        if (!creds.username || !creds.password) {
            return res.status(200).json({ valid: false, reason: 'incomplete_credentials' });
        }

        // Initiate ERP login — this triggers an OTP to the student's phone/email
        try {
            const result = await reloginERP(creds.username, creds.password);
            return res.status(200).json({
                valid:       false,
                reason:      'otp_required',
                authUserId:  result.authUserId,
                studentName: creds.studentName || '',
            });
        } catch {
            // Credentials rejected — user must re-enter username/password.
            // Do NOT forward err.message — it may contain internal ERP details.
            return res.status(200).json({
                valid:  false,
                reason: 'credentials_rejected',
            });
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
                deviceIdUUID: deviceIdUUID,
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
