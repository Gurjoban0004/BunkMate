/**
 * POST /api/erp-session
 * Body:
 *   check:   { action: 'check', token }
 *   refresh: { action: 'refresh', persistentToken, authUserId, otp, deviceId? }
 *
 * check   — called on app start. Opens the session token locally, never contacts
 *           ERP login (so startup cannot silently send an OTP), and reports whether
 *           the roll is revoked / an admin so the client needs no Firestore reads.
 * refresh — completes an OTP re-auth started by a data endpoint's silent re-login.
 *           `authUserId` is the sealed ticket that endpoint returned; it carries the
 *           device id the ERP just saw, so the verify binds the same device.
 */

const {
    decryptSession,
    decryptPersistent,
    mintSessionToken,
    mintPersistentToken,
    verifyOtpWithERP,
    openOtpTicket,
    resolveDeviceId,
    setCorsHeaders,
    cleanString,
    getClientIp,
    ERP_BASE,
} = require('./_session-utils');
const { getRevocation } = require('./_revocation');
const { tooManyAttempts } = require('./_rate-limit');
const { isAdminRoll } = require('./_firebase-admin');

const REFRESH_POLICY = { max: 10, windowMs: 15 * 60 * 1000 };
const OTP_RE = /^\d{4,6}$/;

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    const body = req.body || {};
    const action = cleanString(body.action, 16);

    if (action === 'check') {
        const token = cleanString(body.token, 16384);
        if (!token) return res.status(200).json({ valid: false, reason: 'no_token' });

        let session;
        try {
            session = decryptSession(token);
        } catch {
            return res.status(200).json({ valid: false, reason: 'invalid_token' });
        }
        if (!session.userId || !session.sessionId || !session.roleId || !session.apiKey || !session.studentId) {
            return res.status(200).json({ valid: false, reason: 'incomplete_session' });
        }

        const revocation = await getRevocation(session.rollNumber);
        return res.status(200).json({
            valid: true,
            reason: 'session_available',
            studentId: session.studentId,
            studentName: session.studentName || '',
            isAdmin: isAdminRoll(session.rollNumber),
            ...(revocation && { revoked: { reason: revocation.reason || 'Your access to Presence has been revoked.' } }),
        });
    }

    if (action === 'refresh') {
        const persistentToken = cleanString(body.persistentToken, 16384);
        const ticket = cleanString(body.authUserId, 4096);
        const otp = cleanString(body.otp, 8);
        if (!persistentToken || !ticket || !otp) {
            return res.status(400).json({ error: 'persistentToken, authUserId and otp are required' });
        }
        if (!OTP_RE.test(otp)) return res.status(400).json({ error: 'OTP must be 4–6 digits' });

        if (await tooManyAttempts(res, 'erp-refresh-ip', getClientIp(req), REFRESH_POLICY)) return;

        let creds;
        try {
            creds = decryptPersistent(persistentToken);
        } catch (err) {
            if (err.code === 'PERSISTENT_EXPIRED') {
                return res.status(401).json({ error: 'Sign-in expired', needsLogin: true });
            }
            return res.status(401).json({ error: 'Invalid persistent token' });
        }

        // The ticket is what the data endpoint minted when the ERP demanded an OTP; its
        // device id is the one the ERP has already seen for this challenge. The roll
        // number, though, comes from the sealed persistent token — the ticket grants
        // nothing on its own here.
        const bound = openOtpTicket(ticket);
        if (!bound) return res.status(401).json({ error: 'Login expired', message: 'Please try syncing again to get a new code.' });
        const deviceId = resolveDeviceId(bound.deviceId, creds.deviceId, body.deviceId);

        try {
            const session = await verifyOtpWithERP(bound.authUserId, otp, deviceId);
            const studentName = creds.studentName || session.studentName || '';
            const isMock = creds.isMock || session.isMock || false;

            return res.status(200).json({
                success:         true,
                token:           mintSessionToken({ ...session, studentName, isMock }, { username: creds.username }),
                persistentToken: mintPersistentToken({ username: creds.username, password: creds.password, deviceId, studentName, isMock }),
                studentName,
                isAdmin:         isAdminRoll(creds.username),
            });
        } catch (err) {
            if (err.code === 'INVALID_OTP' || err.code === 'ERP_REJECTED') {
                return res.status(401).json({ error: 'Invalid OTP', message: 'OTP incorrect or expired' });
            }
            console.error('ERP session refresh error:', err.message);
            return res.status(502).json({ error: 'Session refresh failed', message: 'Could not complete session refresh. Please try again.' });
        }
    }

    return res.status(400).json({ error: 'Invalid action. Use "check" or "refresh".' });
};
