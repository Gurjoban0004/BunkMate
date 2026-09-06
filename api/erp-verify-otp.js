/**
 * POST /api/erp-verify-otp
 * Body: { authUserId, otp }
 *   authUserId — the opaque ticket from /api/erp-login. It seals the ERP
 *                authUserId with the username, password and device id the
 *                challenge was issued for, so none of them can be swapped.
 *
 * Brute-force defence (audit C2): the OTP is four digits. Each ticket gets
 * OTP_ATTEMPTS tries, counted server-side and keyed on the ticket itself so
 * rotating IPs does not help; after that the ticket is dead and the student
 * signs in again (which mints a new ticket and a new OTP).
 */

const {
    mintSessionToken,
    mintPersistentToken,
    verifyOtpWithERP,
    openOtpTicket,
    ticketFingerprint,
    setCorsHeaders,
    cleanString,
    ERP_BASE,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');
const { tooManyAttempts } = require('./_rate-limit');
const { isAdminRoll } = require('./_firebase-admin');

const OTP_ATTEMPTS = { max: 5, windowMs: 15 * 60 * 1000 };   // window == ticket lifetime
const OTP_RE = /^\d{4,6}$/;

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};
    const ticket = cleanString(body.authUserId, 4096);
    const otp    = cleanString(body.otp, 8);

    if (!ticket || !otp) return res.status(400).json({ error: 'authUserId and OTP are required' });
    if (!OTP_RE.test(otp)) return res.status(400).json({ error: 'OTP must be 4–6 digits' });
    if (!ERP_BASE) return res.status(500).json({ error: 'Server configuration error' });

    const bound = openOtpTicket(ticket);
    if (!bound) {
        return res.status(401).json({
            error:   'Login expired',
            message: 'Your login session expired. Please enter your credentials again.',
        });
    }
    const { authUserId, username, password, deviceId } = bound;

    // Count before contacting the ERP so a wrong guess costs an attempt.
    if (await tooManyAttempts(res, 'otp-ticket', ticketFingerprint(ticket), OTP_ATTEMPTS)) return;

    // Block before burning an OTP — a revoked user gets the reason, not a dead session.
    if (await blockIfRevoked(res, username)) return;

    try {
        const session = await verifyOtpWithERP(authUserId, otp, deviceId);
        if (!session.userId || !session.sessionId) {
            return res.status(502).json({ error: 'Could not retrieve session details' });
        }

        return res.status(200).json({
            success:         true,
            token:           mintSessionToken(session, { username }),
            persistentToken: password
                ? mintPersistentToken({ username, password, deviceId, studentName: session.studentName, isMock: session.isMock })
                : null,
            studentName:  session.studentName,
            studentPhoto: session.studentPhoto,
            isAdmin:      isAdminRoll(username),
        });

    } catch (err) {
        if (err.code === 'INVALID_OTP' || err.code === 'ERP_REJECTED') {
            return res.status(401).json({ error: 'Invalid OTP', message: 'The OTP you entered is incorrect' });
        }
        console.error('ERP OTP verification error:', err.message);
        return res.status(502).json({ error: 'Verification failed', message: 'Could not verify OTP. Please try again.' });
    }
};
