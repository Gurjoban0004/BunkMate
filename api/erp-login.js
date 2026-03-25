/**
 * Vercel Serverless Function: ERP Login
 *
 * POST /api/erp-login
 * Body: { username, password }
 *
 * 1. Initializes client with schoolCode
 * 2. Authenticates with ERP
 * 3. Returns { success, authUserId } for OTP step
 *
 * SECURITY: ERP base URL and school code are server-side only (env vars).
 *           Credentials are forwarded once and never stored or logged.
 */

const {
    setCorsHeaders,
    encodeForm,
    MOBILE_HEADERS,
    ERP_BASE,
} = require('./_session-utils');

const SCHOOL_CODE = process.env.ERP_SCHOOL_CODE || '800002';

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
        // Step 1: Initialize client details
        const clientRes = await fetch(`${ERP_BASE}/mobile/getClientDetails`, {
            method: 'POST',
            headers: MOBILE_HEADERS,
            body: encodeForm({ schoolCode: SCHOOL_CODE }),
        });

        if (!clientRes.ok) {
            return res.status(502).json({ error: 'Failed to connect to college portal' });
        }

        // Step 2: Authenticate
        const loginRes = await fetch(`${ERP_BASE}/mobile/appLoginAuthV2`, {
            method: 'POST',
            headers: MOBILE_HEADERS,
            body: encodeForm({ txtUsername: username, txtPassword: password }),
        });

        if (!loginRes.ok) {
            return res.status(502).json({ error: 'Authentication request failed' });
        }

        const loginData = await loginRes.json();

        // Check for login failure — ERP uses numeric status strings
        // status "4" = success, status "0"/"1"/"2" = various failures
        if (loginData.error || loginData.status === '0' || loginData.status === 'error' || loginData.status === 'fail') {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: loginData.message || loginData.mobileString || 'Username or password is incorrect',
            });
        }

        // ERP response: { status, mobileString, data: [{ userId, ... }] }
        const firstUser  = Array.isArray(loginData.data) ? loginData.data[0] : loginData.data;
        const authUserId = loginData.authUserId || firstUser?.userId || loginData.userId;

        if (!authUserId) {
            return res.status(502).json({
                error: 'Unexpected response from portal',
                message: 'Could not retrieve authentication ID',
            });
        }

        const otpHint = loginData.mobileString || '';

        return res.status(200).json({
            success:  true,
            authUserId: String(authUserId),
            message:  otpHint || 'OTP sent to your registered mobile/email',
        });

    } catch (err) {
        console.error('ERP login error:', err.message);
        return res.status(500).json({
            error:   'Connection failed',
            message: 'Could not reach the college portal. Please try again.',
        });
    }
};
