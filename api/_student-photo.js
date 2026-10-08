/** College-supplied image URL; relative paths use the configured ERP origin. */
function studentPhotoUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
    try {
        const url = new URL(value.trim(), process.env.ERP_BASE_URL);
        if (url.protocol !== 'https:' || url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}

module.exports = { studentPhotoUrl };
