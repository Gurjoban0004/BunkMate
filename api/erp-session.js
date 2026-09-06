/**
 * POST /api/erp-session
 * Body:
 *   check:      { action: 'check', token }
 *   requestOtp: { action: 'requestOtp', persistentToken, deviceId? }
 *   refresh:    { action: 'refresh', persistentToken, authUserId, otp, deviceId? }
 *
 * check      — app start. Opens the session token locally, never contacts the
 *              college, and reports revoked / admin so the client needs no
 *              Firestore reads.
 * requestOtp — the ONLY place a re-login (and therefore an OTP email) happens
 *              after onboarding, and only because the student tapped
 *              "Sign in again". Trusted device → fresh tokens straight back.
 *              Otherwise → a sealed ticket for `refresh`.
 * refresh    — completes the OTP with that ticket.
 */

const {
    decryptSession,
    decryptPersistent,
    mintSessionToken,
    mintPersistentToken,
    verifyOtpWithERP,
    reloginERP,
    sealOtpTicket,
    openOtpTicket,
    resolveDeviceId,
    setCorsHeaders,
    cleanString,
    getClientIp,
    ERP_BASE,
} = require('./_session-utils');
const { getRevocation, blockIfRevoked } = require('./_revocation');
const { tooManyAttempts } = require('./_rate-limit');
const { isAdminRoll } = require('./_firebase-admin');

const REFRESH_POLICY    = { max: 10, windowMs: 15 * 60 * 1000 };
// One tap = one email. Three per quarter hour per student is generous for a
// human and a hard ceiling for anything else.
const REQUEST_OTP_USER  = { max: 3,  windowMs: 15 * 60 * 1000 };
const REQUEST_OTP_IP    = { max: 10, windowMs: 15 * 60 * 1000 };
const OTP_RE = /^\d{4,6}$/;

function openPersistent(res, persistentToken) {
    try {
        return decryptPersistent(persistentToken);
    } catch (err) {
        if (err.code === 'PERSISTENT_EXPIRED') {
            res.status(401).json({ error: 'Sign-in expired', needsLogin: true });
        } else {
            res.status(401).json({ error: 'Invalid persistent token', needsLogin: true });
        }
        return null;
    }
}

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

    if (action === 'requestOtp') {
        const persistentToken = cleanString(body.persistentToken, 16384);
        if (!persistentToken) return res.status(400).json({ error: 'persistentToken is required', needsLogin: true });

        const creds = openPersistent(res, persistentToken);
        if (!creds) return;

        if (await blockIfRevoked(res, creds.username)) return;
        if (await tooManyAttempts(res, 'otp-request-ip', getClientIp(req), REQUEST_OTP_IP)) return;
        if (await tooManyAttempts(res, 'otp-request-user', String(creds.username).toLowerCase(), REQUEST_OTP_USER)) return;

        const deviceId = resolveDeviceId(creds.deviceId, body.deviceId);

        try {
            const result = await reloginERP(creds.username, creds.password, null, deviceId);
            const studentName = creds.studentName || result.session?.studentName || '';

            if (result.session && result.session.sessionId && result.session.apiKey) {
                return res.status(200).json({
                    success: true,
                    trusted: true,
                    token: mintSessionToken({ ...result.session, studentName, isMock: creds.isMock }, { username: creds.username }),
                    persistentToken: mintPersistentToken({
                        username: creds.username, password: creds.password, deviceId, studentName, isMock: creds.isMock,
                    }),
                    studentName,
                    isAdmin: isAdminRoll(creds.username),
                });
            }

            return res.status(200).json({
                success: true,
                needsOtp: true,
                authUserId: sealOtpTicket(result.authUserId, creds.username, { password: creds.password, deviceId }),
                studentName,
            });
        } catch (err) {
            if (err.code === 'ERP_REJECTED') {
                // The password changed since it was stored: the student has to
                // sign in properly. Tokens are forgotten client-side on needsLogin.
                return res.status(401).json({ error: 'Sign-in rejected', message: err.message || 'Your college did not accept the saved sign-in.', needsLogin: true });
            }
            console.error('ERP requestOtp error:', err.message);
            return res.status(502).json({ error: 'Connection failed', message: 'Could not reach your college. Please try again.' });
        }
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

        const creds = openPersistent(res, persistentToken);
        if (!creds) return;

        // The ticket is what requestOtp minted; its device id is the one the
        // college has already seen for this challenge. The roll number comes
        // from the sealed persistent token — the ticket grants nothing alone.
        const bound = openOtpTicket(ticket);
        if (!bound) return res.status(401).json({ error: 'Code expired', message: 'That code has expired. Tap "Sign in again" to get a new one.' });
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
                return res.status(401).json({ error: 'Invalid OTP', message: 'That code did not work. Check the latest message and try again.' });
            }
            console.error('ERP session refresh error:', err.message);
            return res.status(502).json({ error: 'Session refresh failed', message: 'Could not finish signing in. Please try again.' });
        }
    }

    return res.status(400).json({ error: 'Invalid action. Use "check", "requestOtp" or "refresh".' });
};
