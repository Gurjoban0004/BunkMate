/**
 * Sync telemetry — one doc per sync cycle at telemetry/{userId}/syncs/{autoId}.
 *
 * This is the ONLY writer for the data behind the Admin panel's Endpoint Health,
 * Parser Failures and Rate Limit cards (api/admin-analytics.js reads it via a
 * collectionGroup('syncs') query). Without it those three cards are always empty.
 *
 * Fire-and-forget: telemetry must never break or slow down a sync.
 */

import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ensureAuthenticated } from '../utils/firebaseHelpers';
import { logger } from '../utils/logger';

const SYNC_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @param {string} userId       login code — also the Firebase uid (rules require the match)
 * @param {Object} sync
 * @param {Array}  sync.endpoints    [{ name, status: 'ok'|'fail', durationMs, error? }]
 * @param {Array}  sync.parserErrors [{ endpoint, message }]
 * @param {Object} sync.sessionEvent { type: 'needsOtp'|'needsLogin', reason } when the college signed us out
 * @param {string} sync.rollNumber   roll number, for the admin failure list
 */
export async function logSync(userId, { endpoints = [], parserErrors = [], sessionEvent = null, rollNumber = null }) {
    if (!userId || endpoints.length === 0) return;
    try {
        if (!(await ensureAuthenticated(userId))) return;
        // `expiresAt` is the field a Firestore TTL policy reaps on (see
        // docs/HARDENING-2026-09-06.md §H3 for the one-line gcloud command).
        // The admin panel only ever looks at the last 7 days.
        await addDoc(collection(db, 'telemetry', userId, 'syncs'), {
            timestamp: serverTimestamp(),
            expiresAt: new Date(Date.now() + SYNC_LOG_RETENTION_MS),
            endpoints,
            parserErrors,
            ...(sessionEvent ? { sessionEvent } : {}),
            rollNumber,
        });
    } catch (err) {
        logger.warn('⚠️ Telemetry write failed (non-critical):', err.message);
    }
}

/**
 * Store one current, aggregate-only attendance snapshot per student per day.
 * This deliberately excludes dates, class-level marks, names, and login codes
 * from the document body. A trusted server can later aggregate these records by
 * course code for the teacher-facing AIML work without reading a student's full
 * attendance history.
 */
export async function logAttendanceSnapshot(userId, rollNumber, subjects) {
    if (!userId || !Array.isArray(subjects) || subjects.length === 0) return;
    try {
        if (!(await ensureAuthenticated(userId))) return;
        const dayKey = new Date().toISOString().slice(0, 10);
        const cohort = /^\d{2}/.test(rollNumber || '') ? rollNumber.slice(0, 2) : null;
        const safeSubjects = subjects.map(subject => ({
            courseCode: String(subject.code || subject.erpSubjectId || '').trim(),
            courseName: String(subject.name || '').trim().slice(0, 120),
            attended: subject.attended,
            total: subject.delivered,
            absent: subject.absent,
            percentage: subject.percentage,
        })).filter(subject => subject.courseCode && Number.isFinite(subject.total) && subject.total >= 0);
        if (!safeSubjects.length) return;

        await setDoc(doc(db, 'telemetry', userId, 'attendanceSnapshots', dayKey), {
            schemaVersion: 1,
            cohort,
            source: 'erp',
            subjects: safeSubjects,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    } catch (err) {
        logger.warn('⚠️ Attendance research snapshot failed (non-critical):', err.message);
    }
}

/**
 * Times an endpoint call and appends the outcome to `endpoints`.
 * Re-throws so callers keep their existing error handling.
 */
export async function trackEndpoint(endpoints, name, fn) {
    const startedAt = Date.now();
    try {
        const result = await fn();
        endpoints.push({ name, status: 'ok', durationMs: Date.now() - startedAt });
        return result;
    } catch (err) {
        endpoints.push({
            name,
            status: 'fail',
            durationMs: Date.now() - startedAt,
            error: String(err?.message || err).slice(0, 200),
        });
        throw err;
    }
}
