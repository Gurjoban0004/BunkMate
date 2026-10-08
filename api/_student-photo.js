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

/** Backfill old sign-ins during an authenticated sync, without logging in again. */
async function saveStudentPhoto(session) {
    if (session?.isMock || !/^[A-Za-z0-9_-]{1,64}$/.test(session?.rollNumber || '')) return;
    try {
        const { adminDb } = require('./_firebase-admin');
        const ref = adminDb.doc(`admin/activity/students/${session.rollNumber}`);
        const saved = (await ref.get()).data() || {};
        if (studentPhotoUrl(saved.studentPhoto)) return;
        const supplied = studentPhotoUrl(session.studentPhoto);
        // A missing/unavailable college photo gets one attempt per day, not per sync.
        if (!supplied && Date.now() - (saved.studentPhotoCheckedAt || 0) < 86400000) return;
        const { fetchStudentPhotoV2 } = require('./_erp-provider');
        let photo = supplied;
        try { photo ||= studentPhotoUrl(await fetchStudentPhotoV2(session)); } catch { /* retry next day */ }
        await ref.set({
            studentPhotoCheckedAt: Date.now(),
            ...(photo ? { studentPhoto: photo } : {}),
        }, { merge: true });
    } catch { /* Portrait retrieval must never fail attendance sync. */ }
}

module.exports = { studentPhotoUrl, saveStudentPhoto };
