/**
 * Vercel Serverless Function: ERP Login
 *
 * POST /api/erp-login
 * Body: { username, password }
 *
 * Mirrors the APK login (index.html:1462): appLoginAuthV2 is sent WITH a stable
 * deviceIdUUID. A device that has verified OTP once is trusted and the ERP returns
 * status==1 (full session, NO OTP). Only a new/unknown device gets status==4 (OTP).
 *
 * The old code called loginLegacy without deviceIdUUID, so the ERP saw a new device
 * on every sign-in and emailed a fresh OTP each time — the "false OTP every login" bug.
 * reloginERP sends generateDeviceUUID(username) and reports which path the ERP chose:
 *   - trusted device → { session } here → mint token, client skips OTP entirely
 *   - new device     → { needsOtp, authUserId } → client shows the OTP screen
 *
 * SECURITY: ERP base URL and school code are server-side only (env vars).
 *           Credentials are forwarded once and never stored or logged.
 */

const {
    setCorsHeaders,
    reloginERP,
    mintSessionToken,
    encryptPersistent,
    sealOtpTicket,
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

    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!ERP_BASE || !process.env.ENCRYPTION_SECRET) {
        console.error('ERP_BASE_URL or ENCRYPTION_SECRET is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const result = await reloginERP(username.trim(), password);

        // Trusted device: full session, no OTP. Mint the same tokens erp-verify-otp
        // would, so the client can go straight to fetching attendance.
        if (result.session && result.session.sessionId && result.session.apiKey) {
            const token = mintSessionToken(result.session, { username });
            const persistentToken = encryptPersistent({
                username, password,
                studentName: result.session.studentName,
                isMock: result.session.isMock || false,
            });
            return res.status(200).json({
                success:      true,
                trusted:      true,
                token,
                persistentToken,
                studentName:  result.session.studentName || '',
                studentPhoto: result.session.studentPhoto || '',
            });
        }

        // New device: ERP emailed an OTP. Hand back a sealed ticket rather than the
        // raw authUserId — this is the only moment the server knows which username
        // that authUserId was issued for, so the pairing is bound here and verified
        // in erp-verify-otp. The client treats it as an opaque string.
        return res.status(200).json({
            success:    true,
            needsOtp:   true,
            authUserId: sealOtpTicket(result.authUserId, username.trim()),
            message:    'OTP sent to your registered mobile/email',
        });

    } catch (err) {
        if (err.code === 'ERP_REJECTED') {
            // Log what the ERP actually said. A 401 with no trace is why a real
            // student's failed login could not be diagnosed from production at all.
            // Never logs the username or password — only the response's own shape.
            console.error('[LOGIN-REJECTED]', JSON.stringify({
                erpMessage: err.message,
                ...(err.erpShape || {}),
            }));
            return res.status(401).json({
                error: 'Invalid credentials',
                message: err.message || 'Username or password is incorrect',
            });
        }
        if (err.code === 'ERP_LOGIN_BLOCKED') {
            return res.status(403).json({ error: 'Login blocked', message: err.message });
        }
        console.error('ERP login error:', err.message);
        return res.status(500).json({
            error:   'Connection failed',
            message: 'Could not reach the college portal. Please try again.',
        });
    }
};
