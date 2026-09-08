/**
 * Guards the Android "app isn't responding" fix.
 *
 * React Native's fetch has no default timeout. authenticateWithErp is awaited by
 * ensureAuthenticated -> loadAppState -> AppProvider init, and init only calls
 * setIsLoading(false) once that resolves. So a request that never settles used to
 * leave the app on the splash screen forever. It must now reject, not hang.
 */

jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signInWithCustomToken: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../../storage/erpTokenStorage', () => ({
    getErpToken: jest.fn(async () => 'erp-session-token'),
}));

const { authenticateWithErp, ensureAuthenticated } = require('../firebaseHelpers');

afterEach(() => { global.fetch = undefined; jest.useRealTimers(); });

test('a never-settling request rejects instead of hanging forever', async () => {
    jest.useFakeTimers();
    // A fetch that never resolves, but honours the abort signal like RN's does.
    global.fetch = jest.fn((_url, opts) => new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        });
    }));

    const pending = authenticateWithErp('erp-session-token');
    const assertion = expect(pending).rejects.toThrow(/check your connection/i);

    jest.advanceTimersByTime(15000); // trip the abort timeout
    await assertion;
});

test('ensureAuthenticated fails open (false) rather than propagating a stall', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, opts) => new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        });
    }));

    const pending = ensureAuthenticated('23BCS1234');
    // Async: the ERP token is read first, so the abort timer does not exist yet
    // on the tick this test starts. advanceTimersByTimeAsync flushes microtasks
    // between ticks, which the synchronous version does not.
    await jest.advanceTimersByTimeAsync(15000);
    // Fail-open keeps the app usable local-only; crucially it RESOLVES.
    await expect(pending).resolves.toBe(false);
});
