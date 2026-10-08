const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');
const { studentPhotoUrl } = require('../api/_student-photo');
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const LIMIT = 4 * 1024 * 1024;

async function cachedPhoto(roll, value, directory) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(roll)) throw new Error('Invalid student');
    const source = studentPhotoUrl(value);
    if (!source) throw new Error('College photo unavailable');
    const url = new URL(source);
    // Only the verified college image store or configured ERP; never arbitrary URLs.
    const collegeAsset = url.origin === 'https://s3.amazonaws.com' && url.pathname.startsWith('/cbrig-assets/cuiet/resources/Student/');
    if (!collegeAsset && url.origin !== process.env.ERP_BASE_URL?.replace(/\/$/, '')) throw new Error('Unsupported college photo host');
    const file = path.join(directory, `${roll}-${createHash('sha256').update(source).digest('hex').slice(0, 16)}.json`);
    try {
        const saved = JSON.parse(await fs.readFile(file, 'utf8'));
        if (IMAGE_TYPES.has(saved.type)) return { type: saved.type, bytes: Buffer.from(saved.data, 'base64') };
    } catch { /* Fetch the original when not cached. */ }
    const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !IMAGE_TYPES.has(type)) throw new Error('College photo unavailable');
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            length += chunk.length;
            if (length > LIMIT) throw new Error('College image too large');
            chunks.push(Buffer.from(chunk));
        }
    } finally { await reader.cancel(); }
    if (!length) throw new Error('Empty college photo');
    const bytes = Buffer.concat(chunks);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(file, JSON.stringify({ type, data: bytes.toString('base64') }), { mode: 0o600 });
    return { type, bytes };
}
module.exports = { cachedPhoto };
