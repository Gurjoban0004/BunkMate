/**
 * ALLOW_MOCK_LOGIN must not be able to open the door in production.
 *
 * With the bypass on, any roll number — including an admin's — gets a full
 * session from the password 'presence-mock-bypass' and no ERP call at all. The
 * failure mode nobody would notice is the variable getting set on the Vercel
 * production environment: everything keeps working perfectly while the door
 * stands open. So production is checked in code, not only in the dashboard.
 */

const ENV_KEYS = ['ALLOW_MOCK_LOGIN', 'VERCEL_ENV', 'NODE_ENV'];
const saved = {};

/** Load a fresh copy of the provider under the given environment. */
function providerWith(env) {
    jest.resetModules();
    for (const key of ENV_KEYS) {
        if (env[key] === undefined) delete process.env[key];
        else process.env[key] = env[key];
    }
    return require('../_erp-provider');
}

beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
afterAll(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    jest.resetModules();
});

beforeEach(() => { global.fetch = jest.fn(() => Promise.reject(new Error('no ERP in tests'))); });
afterEach(() => { delete global.fetch; });

test('the bypass works in development, where it is meant to', async () => {
    const { loginLegacy } = providerWith({ ALLOW_MOCK_LOGIN: '1', VERCEL_ENV: 'development', NODE_ENV: 'test' });
    const result = await loginLegacy('mockstudent', 'anything', 'device-1');
    expect(result.session).toBeTruthy();
    expect(result.session.isMock).toBe(true);
});

test('a production deployment refuses it even with ALLOW_MOCK_LOGIN=1', async () => {
    const { loginLegacy } = providerWith({ ALLOW_MOCK_LOGIN: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' });
    // No mock session: it falls through to the real ERP, which is not reachable here.
    await expect(loginLegacy('mockstudent', 'presence-mock-bypass', 'device-1')).rejects.toThrow();
});

test('the bypass password is refused in production too', async () => {
    const { loginLegacy } = providerWith({ ALLOW_MOCK_LOGIN: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' });
    await expect(loginLegacy('2410990296', 'presence-mock-bypass', 'device-1')).rejects.toThrow();
});

test('NODE_ENV=production alone is enough to close it', async () => {
    const { loginLegacy } = providerWith({ ALLOW_MOCK_LOGIN: '1', VERCEL_ENV: undefined, NODE_ENV: 'production' });
    await expect(loginLegacy('mockstudent', 'anything', 'device-1')).rejects.toThrow();
});

test('without ALLOW_MOCK_LOGIN it is off everywhere', async () => {
    const { loginLegacy } = providerWith({ ALLOW_MOCK_LOGIN: undefined, VERCEL_ENV: 'development', NODE_ENV: 'test' });
    await expect(loginLegacy('mockstudent', 'anything', 'device-1')).rejects.toThrow();
});
