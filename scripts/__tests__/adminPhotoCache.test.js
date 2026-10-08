/** @jest-environment node */
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { cachedPhoto } = require('../admin-photo-cache');
const source = 'https://s3.amazonaws.com/cbrig-assets/cuiet/resources/Student/verified.jpg';
let directory;
const originalFetch = global.fetch;
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-photo-test-')); });
afterEach(async () => { global.fetch = originalFetch; await fs.rm(directory, { recursive: true, force: true }); });
test('saves original bytes privately and serves the saved photo without another request', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff]);
    global.fetch = jest.fn().mockResolvedValue(new Response(bytes, { headers: { 'content-type': 'image/jpeg' } }));
    expect(await cachedPhoto('student', source, directory)).toEqual({ type: 'image/jpeg', bytes });
    expect(await cachedPhoto('student', source, directory)).toEqual({ type: 'image/jpeg', bytes });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [file] = await fs.readdir(directory);
    expect((await fs.stat(path.join(directory, file))).mode & 0o777).toBe(0o600);
});
test('never proxies arbitrary hosts, redirects, or active content', async () => {
    global.fetch = jest.fn();
    await expect(cachedPhoto('student', 'https://localhost/private', directory)).rejects.toThrow('Unsupported');
    await expect(cachedPhoto('../student', source, directory)).rejects.toThrow('Invalid');
    expect(global.fetch).not.toHaveBeenCalled();
    global.fetch.mockResolvedValue(new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }));
    await expect(cachedPhoto('student', source, directory)).rejects.toThrow('unavailable');
    expect(await fs.readdir(directory)).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(source, expect.objectContaining({ redirect: 'error' }));
});
