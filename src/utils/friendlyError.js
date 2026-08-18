/**
 * friendlyError — turn a thrown API error into copy a student can act on.
 *
 * The setup flow used to render `err.message` verbatim, which meant students
 * saw `FUNCTION_INVOCATION_FAILED`, `HTTP 500` and Vercel request IDs. Those
 * say nothing about what to do next and read as "this app is broken".
 *
 * Everything here is deliberately calm: it states what happened and what to
 * try, and never blames the student for a server problem.
 */

const GENERIC = {
    title: 'Something went wrong',
    message: 'That did not go through. Give it another try in a moment.',
};

/** Infrastructure noise that must never reach a student. */
const INFRA = /FUNCTION_INVOCATION|NON_JSON_RESPONSE|HTTP \d{3}|<!DOCTYPE|Deployment Protection|vercel|request id/i;

/**
 * @param {Error} err   the thrown error (may carry .code / .status from erpService)
 * @param {'signin'|'otp'|'import'|'code'} context which step failed
 * @returns {{ title: string, message: string, detail?: string }}
 */
export function friendlyError(err, context = 'signin') {
    if (!err) return GENERIC;

    const code = err.code || '';
    const status = err.status || 0;
    const raw = String(err.message || '');
    // Only trust the server's own wording when it is a real sentence, not a
    // machine code — server copy is written for the student, infra codes aren't.
    const serverSaid = raw && !INFRA.test(raw) && /\s/.test(raw) ? raw : '';

    const detail = raw && raw !== serverSaid ? raw : undefined;
    const withDetail = (result) => (detail ? { ...result, detail } : result);

    if (code === 'NETWORK_ERROR') {
        return withDetail({
            title: 'No connection',
            message: 'Presence could not reach the internet. Check your Wi-Fi or mobile data, then try again.',
        });
    }

    if (code === 'TIMEOUT') {
        return withDetail({
            title: 'This is taking too long',
            message: 'Your university servers are slow right now. Nothing was lost — try again in a moment.',
        });
    }

    // Auth failures. 401/403 on sign-in means the credentials were rejected;
    // on the OTP step it means the code was wrong or has already expired.
    if (status === 401 || status === 403 || /invalid|incorrect|wrong|mismatch|expired/i.test(raw)) {
        if (context === 'otp') {
            return withDetail({
                title: 'That code did not work',
                message: 'Check the most recent code you were sent, or request a new one.',
            });
        }
        if (context === 'code') {
            return withDetail({
                title: 'That login code did not work',
                message: 'Codes look like PRES-XXXXXXX. Check it against the one on your other device.',
            });
        }
        return withDetail({
            title: 'Those details did not match',
            message: 'Double-check your university ID and password, then try again.',
        });
    }

    if (status >= 500 || code === 'NON_JSON_RESPONSE') {
        return withDetail({
            title: 'Your university portal is not responding',
            message: 'This is on their side, not yours. It usually clears within a few minutes.',
        });
    }

    if (context === 'import') {
        return withDetail({
            title: 'Setup did not finish',
            message: serverSaid || 'Your account is fine — nothing was saved yet. Try setting up again.',
        });
    }

    return withDetail(serverSaid ? { title: 'Something went wrong', message: serverSaid } : GENERIC);
}

export default friendlyError;
