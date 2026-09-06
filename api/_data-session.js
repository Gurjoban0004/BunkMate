/**
 * The one session lifecycle every data endpoint shares:
 *
 *   open token → revoked? → (stale? skip straight to re-login)
 *   → fetch → dead? → confirm with the ERP's own liveness probe
 *   → silent re-login on the sealed device id → retry once
 *   → still needs OTP? hand the client a sealed ticket for /api/erp-session refresh
 *
 * erp-attendance, erp-calendar and erp-timetable used to carry three diverging
 * copies of this. One copy means one place to get the OTP-spam guards right:
 * a re-login on this ERP emails an OTP, so it only ever runs after the liveness
 * probe returns exactly `false` (or the token is past its 30-day age).
 */

const {
    decryptSession,
    decryptPersistent,
    isSessionStale,
    reloginERP,
    mintSessionToken,
    sealOtpTicket,
    checkSessionAlive,
    cleanString,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');

/**
 * Open and authorize the request's session token.
 * @returns {{ session, persistentToken } | null}  null → a response was already sent
 */
async function openSession(req, res) {
    const body = req.body || {};
    const token = cleanString(body.token, 16384);
    const persistentToken = cleanString(body.persistentToken, 16384) || null;
    if (!token) {
        res.status(400).json({ error: 'Session token is required' });
        return null;
    }

    let session;
    try {
        session = decryptSession(token);
    } catch {
        res.status(401).json({ error: 'Invalid session', sessionExpired: true });
        return null;
    }

    // Revoked users are cut off here, not in the UI — this is the gate that actually works.
    if (await blockIfRevoked(res, session.rollNumber)) return null;

    return { session, persistentToken };
}

/**
 * Run `fetchData(session)` against a live session, transparently re-logging-in
 * when the session is stale or the ERP says it is dead.
 *
 * @param {object} res
 * @param {object} session           decrypted session
 * @param {string|null} persistentToken
 * @param {(session) => Promise<any>} fetchData
 * @param {(result) => boolean} isDead   whether the fetch result means "dead session"
 * @returns {{ session, result, refreshedToken } | { transient: true } | null}
 *          null → a response was already sent
 */
async function fetchWithLiveSession(res, session, persistentToken, fetchData, isDead) {
    let result = null;

    if (!isSessionStale(session)) {
        result = await fetchData(session);
        if (!isDead(result)) return { session, result, refreshedToken: null };

        // Our heuristics false-positive on transient/partial responses. Only a
        // confirmed death may trigger a re-login (→ OTP email).
        const liveness = await checkSessionAlive(session);
        if (liveness !== false) return { transient: true };
    }

    if (!persistentToken) {
        res.status(401).json({ error: 'Session expired', sessionExpired: true });
        return null;
    }

    let creds;
    try {
        creds = decryptPersistent(persistentToken);
    } catch (err) {
        if (err.code === 'PERSISTENT_EXPIRED') {
            // "Remember me" ran out: the app clears its tokens and asks for a sign-in.
            res.status(200).json({ sessionExpired: true, needsLogin: true });
        } else {
            res.status(401).json({ error: 'Invalid persistent token', sessionExpired: true });
        }
        return null;
    }

    const relogin = await reloginERP(creds.username, creds.password, null, creds.deviceId);

    if (relogin.session) {
        const fresh = relogin.session;
        result = await fetchData(fresh);
        if (!isDead(result)) {
            return { session: fresh, result, refreshedToken: mintSessionToken(fresh, creds) };
        }
    }

    res.status(200).json({
        sessionExpired: true,
        needsOtp:       true,
        authUserId:     sealOtpTicket(relogin.authUserId, creds.username, {
            password: creds.password,
            deviceId: relogin.deviceId,
        }),
        studentName:    creds.studentName || '',
    });
    return null;
}

module.exports = { openSession, fetchWithLiveSession };
