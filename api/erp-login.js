/**
 * Vercel Serverless Function: ERP Login
 *
 * POST /api/erp-login
 * Body: { username, password }
 *
 * 1. Authenticates with the captured legacy mobile endpoint
 * 2. Returns { success, authUserId } for OTP step
 *
 * SECURITY: ERP base URL and school code are server-side only (env vars).
 *           Credentials are forwarded once and never stored or logged.
 */

const {
    setCorsHeaders,
    ERP_BASE,
} = require('./_session-utils');
const { loginLegacy } = require('./_erp-provider');


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

    if (!ERP_BASE) {
        console.error('ERP_BASE_URL environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const login = await loginLegacy(username, password);

        return res.status(200).json({
            success:  true,
            authUserId: login.authUserId,
            message:  login.otpHint || 'OTP sent to your registered mobile/email',
        });

    } catch (err) {
        if (err.code === 'ERP_REJECTED') {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: err.message || 'Username or password is incorrect',
            });
        }
        console.error('ERP login error:', err.message);
        return res.status(500).json({
            error:   'Connection failed',
            message: 'Could not reach the college portal. Please try again.',
        });
    }
};
