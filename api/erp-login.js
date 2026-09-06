/**
 * POST /api/erp-login
 * Body: { username, password, deviceId? }
 *
 * The APK login: appLoginAuthV2 is sent WITH the install's device id. A device
 * that has verified OTP once is trusted and the ERP returns status==1 (full
 * session, no OTP). Only a new/unknown device gets status==4 (OTP).
 *
 *   trusted device → { trusted, token, persistentToken, isAdmin }
 *   new device     → { needsOtp, authUserId } where authUserId is an opaque
 *                    sealed ticket carrying authUserId + username + password +
 *                    deviceId; the client hands it back to /api/erp-verify-otp.
 *
 * Rate limited per IP and per username (audit C4): this endpoint replays
 * credentials to the university, so it must never be a free credential oracle.
 * Credentials are forwarded once and never stored or logged in plaintext.
 */

const {
    setCorsHeaders,
    reloginERP,
    mintSessionToken,
    mintPersistentToken,
    sealOtpTicket,
    resolveDeviceId,
    cleanString,
    getClientIp,
    ERP_BASE,
} = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { isAdminRoll } = require('./_firebase-admin');

const IP_POLICY   = { max: 10, windowMs: 15 * 60 * 1000 };
const USER_POLICY = { max: 5,  windowMs: 15 * 60 * 1000 };

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};
    const username = cleanString(body.username, 64);
    const password = typeof body.password === 'string' && body.password.length <= 128 ? body.password : '';

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!ERP_BASE) {
        console.error('ERP_BASE_URL is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (await tooManyAttempts(res, 'erp-login-ip', getClientIp(req), IP_POLICY)) return;
    if (await tooManyAttempts(res, 'erp-login-user', username.toLowerCase(), USER_POLICY)) return;

    const deviceId = resolveDeviceId(body.deviceId);

    try {
        const result = await reloginERP(username, password, null, deviceId);

        if (result.session && result.session.sessionId && result.session.apiKey) {
            return res.status(200).json({
                success:         true,
                trusted:         true,
                token:           mintSessionToken(result.session, { username }),
                persistentToken: mintPersistentToken({
                    username, password, deviceId,
                    studentName: result.session.studentName,
                    isMock: result.session.isMock,
                }),
                studentName:  result.session.studentName || '',
                studentPhoto: result.session.studentPhoto || '',
                isAdmin:      isAdminRoll(username),
            });
        }

        return res.status(200).json({
            success:    true,
            needsOtp:   true,
            authUserId: sealOtpTicket(result.authUserId, username, { password, deviceId }),
            message:    'OTP sent to your registered mobile/email',
        });

    } catch (err) {
        if (err.code === 'ERP_REJECTED') {
            // Log what the ERP actually said — never the username or password.
            console.error('[LOGIN-REJECTED]', JSON.stringify({ erpMessage: err.message, ...(err.erpShape || {}) }));
            return res.status(401).json({
                error: 'Invalid credentials',
                message: err.message || 'Username or password is incorrect',
            });
        }
        console.error('ERP login error:', err.message);
        return res.status(502).json({
            error:   'Connection failed',
            message: 'Could not reach the college portal. Please try again.',
        });
    }
};
