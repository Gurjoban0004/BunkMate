/**
 * The one session lifecycle every data endpoint shares:
 *
 *   open token → revoked? → fetch → looks dead? → confirm with the college's
 *   own liveness probe, twice → tell the app to reconnect
 *
 * What it deliberately does NOT do: log in again on its own. On this college's
 * ERP every login sends the student an OTP — there is no silent trusted-device
 * refresh — so an automatic re-login is an unsolicited OTP email. Instead the
 * app shows a quiet "Sign in again" card, and only a tap on it asks
 * /api/erp-session `requestOtp` to send the code. Nothing here ever emails.
 *
 * The answer shapes the app understands:
 *   { sessionExpired: true, needsOtp: true, reason }   → show the card
 *   { sessionExpired: true, needsLogin: true }         → forget tokens, reconnect from Settings
 *   401 { sessionExpired: true }                       → no stored sign-in at all; same as needsLogin
 */

const {
    decryptSession,
    decryptPersistent,
    isSessionStale,
    checkSessionAlive,
    cleanString,
    ticketFingerprint,
} = require('./_session-utils');
const { blockIfRevoked } = require('./_revocation');
const { tooManyAttempts } = require('./_rate-limit');

// A phone syncs three endpoints every three minutes plus a few manual pulls;
// 150 per ten minutes is far above any real use and stops a leaked token from
// hammering the college through us.
const SESSION_POLICY = { max: 150, windowMs: 10 * 60 * 1000 };

const RECONFIRM_DELAY_MS = 1500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function needsReconnect(res, reason) {
    res.status(200).json({ sessionExpired: true, needsOtp: true, reason });
    return null;
}

/**
 * Whether the stored sign-in (persistent token) is still usable.
 * @returns {'ok' | 'expired' | 'invalid' | 'missing'}
 */
function persistentState(persistentToken) {
    if (!persistentToken) return 'missing';
    try {
        decryptPersistent(persistentToken);
        return 'ok';
    } catch (err) {
        return err.code === 'PERSISTENT_EXPIRED' ? 'expired' : 'invalid';
    }
}

/** Answer for a session that cannot be used, based on what the app still holds. */
function answerForDeadSession(res, persistentToken, reason) {
    const state = persistentState(persistentToken);
    if (state === 'ok') return needsReconnect(res, reason);
    if (state === 'expired') {
        res.status(200).json({ sessionExpired: true, needsLogin: true });
        return null;
    }
    res.status(401).json({ error: 'Session expired', sessionExpired: true });
    return null;
}

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
        // A token this server cannot open (rotated secret, older format). The
        // stored sign-in decides what the app does next — never a bare 401
        // that leaves the student stuck with a permanent sync error.
        return answerForDeadSession(res, persistentToken, 'invalid_token');
    }

    if (await blockIfRevoked(res, session.rollNumber)) return null;
    if (await tooManyAttempts(res, 'data-session', ticketFingerprint(token), SESSION_POLICY)) return null;

    return { session, persistentToken };
}

/**
 * Run `fetchData(session)` against a live session.
 *
 * @returns {{ session, result, refreshedToken: null } | { transient: true } | null}
 *          null → a response was already sent
 */
async function fetchWithLiveSession(res, session, persistentToken, fetchData, isDead) {
    if (isSessionStale(session)) return answerForDeadSession(res, persistentToken, 'stale');

    const result = await fetchData(session);
    if (!isDead(result)) return { session, result, refreshedToken: null };

    // The dead-session heuristics false-positive on partial pages. Only the
    // college's own probe, saying "dead" twice in a row, counts.
    const first = await checkSessionAlive(session);
    if (first !== false) return { transient: true };
    await sleep(RECONFIRM_DELAY_MS);
    const second = await checkSessionAlive(session);
    if (second !== false) return { transient: true };

    return answerForDeadSession(res, persistentToken, 'dead');
}

module.exports = { openSession, fetchWithLiveSession, persistentState };
