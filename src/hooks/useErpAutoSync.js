/**
 * useErpAutoSync — keeps the app equal to the college.
 *
 * ── Session ──────────────────────────────────────────────────────────
 *   - A session is used until the college itself says it is dead.
 *   - When that happens the app shows a "Sign in again" card and stops
 *     syncing. It never sends a code on its own (every login on this ERP
 *     emails an OTP). See components/erp/ReconnectSheet.
 *   - Network errors / timeouts keep the old data and retry later.
 *
 * ── Data ─────────────────────────────────────────────────────────────
 *   - The college's totals replace ours, always, including downward
 *     corrections. Only a malformed subject (no total, attended > total) is
 *     ignored.
 *   - The day-by-day register replaces history (see ERP_OVERWRITE_CALENDAR).
 *   - The timetable is refreshed once a day, or on a manual refresh.
 *
 * ── Timing ───────────────────────────────────────────────────────────
 *   - Debounce: skip if the last successful sync was < 60s ago
 *   - Foreground throttle: 10s
 *   - Periodic: every 3 minutes while the app is open
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { getErpToken, getErpPersistentToken, clearErpToken } from '../storage/erpTokenStorage';
import { erpFetchAttendance, erpFetchCalendar, erpFetchTimetable } from '../services/erpService';
import {
    mapErpToAppState, buildResyncPayload, mapCalendarToRecords, mapTimetableToState,
    normalizeErpSubject, validateErpSubject, buildErpNameMap,
} from '../utils/erpAttendanceMapper';
import { logger } from '../utils/logger';
import { logAttendanceSnapshot, logSync, trackEndpoint } from '../services/telemetry';
import { getFeatureFlags } from '../services/adminService';

const MIN_SYNC_INTERVAL_MS   = 60 * 1000;
const FOREGROUND_THROTTLE_MS = 10 * 1000;
const PERIODIC_INTERVAL_MS   = 3 * 60 * 1000;
const TIMETABLE_INTERVAL_MS  = 24 * 60 * 60 * 1000;
const REAL_TT_SOURCES = ['erp', 'portal-web', 'register-derived'];

/** Totals worth applying: a real total, attended within it. Nothing else. */
function usableUpdates(matchedUpdates, subjects) {
    return matchedUpdates.filter((u) => {
        if (!(u.newTotal > 0) || u.newAttended < 0 || u.newAttended > u.newTotal) return false;
        const existing = subjects.find((s) => s.id === u.subjectId);
        return !existing || existing.initialAttended !== u.newAttended || existing.initialTotal !== u.newTotal;
    });
}

export function useErpAutoSync(state, dispatch) {
    const isSyncingRef          = useRef(false);
    const lastSyncTimeRef       = useRef(0);
    const lastForegroundSyncRef = useRef(0);
    const periodicTimerRef      = useRef(null);
    const stateRef              = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Remote kill switches. Default on; refreshed in the background.
    const flagsRef = useRef({ autoSync: true, calendarSync: true });
    useEffect(() => {
        let cancelled = false;
        getFeatureFlags().then((flags) => { if (!cancelled) flagsRef.current = flags; });
        return () => { cancelled = true; };
    }, []);

    const [isSyncing,    setIsSyncing]    = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [syncError,    setSyncError]    = useState(null);

    const setSyncStatus = useCallback((patch) => {
        dispatch({ type: 'ERP_SYNC_STATE', payload: patch });
    }, [dispatch]);

    /**
     * The server said the session is unusable.
     *   needsLogin → the saved sign-in is gone: forget tokens, reconnect from Settings
     *   needsOtp   → show the "Sign in again" card; nothing is sent until tapped
     * Returns the telemetry event describing what happened.
     */
    const handleSessionExpired = useCallback(async (result) => {
        if (result.needsLogin) {
            logger.info('🔑', 'Saved sign-in is gone — reconnect from Settings');
            await clearErpToken();
            dispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
            return { type: 'needsLogin', reason: result.reason || 'expired' };
        }
        logger.info('🔑', `College signed us out (${result.reason || 'unknown'}) — showing sign-in card`);
        dispatch({ type: 'ERP_SESSION_EXPIRED', payload: { reason: result.reason || 'expired' } });
        return { type: 'needsOtp', reason: result.reason || 'expired' };
    }, [dispatch]);

    const triggerSync = useCallback(async (force = false, fromForeground = false) => {
        const currentState = stateRef.current;

        if (!currentState.isAuthenticated || !currentState.settings?.erpConnected) return;
        if (!force && flagsRef.current.autoSync === false) return;
        // Signed out by the college: wait for the student, do not poll.
        if (currentState.erpSessionExpired && !force) return;
        if (isSyncingRef.current) return;

        const now = Date.now();
        if (fromForeground && now - lastForegroundSyncRef.current < FOREGROUND_THROTTLE_MS) return;
        if (!force && now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL_MS) return;

        let token = await getErpToken();
        if (!token) {
            dispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
            return;
        }
        const persistentToken = await getErpPersistentToken();

        isSyncingRef.current = true;
        if (fromForeground) lastForegroundSyncRef.current = now;
        setIsSyncing(true);
        setSyncError(null);

        const syncStartMs = Date.now();
        const endpoints = [];
        const parserErrors = [];
        let sessionEvent = null;
        let attendanceSnapshot = null;

        setSyncStatus({ status: 'syncing', lastSyncAttemptAt: new Date().toISOString(), changedSubjectIds: [] });

        try {
            // ── Step 1: totals ────────────────────────────────────
            const attendanceResult = await trackEndpoint(endpoints, 'attendance',
                () => erpFetchAttendance(token, persistentToken));
            if (attendanceResult.token) token = attendanceResult.token;

            if (attendanceResult.sessionExpired) {
                sessionEvent = await handleSessionExpired(attendanceResult);
                setSyncStatus({ status: 'idle' });
                return;
            }

            if (!attendanceResult.subjects?.length) {
                logger.warn('⚠️ College returned no subjects — keeping existing data');
                setSyncStatus({ status: 'idle' });
                return;
            }

            const validErpSubjects = attendanceResult.subjects.map(normalizeErpSubject).filter((sub) => {
                if (!validateErpSubject(sub)) {
                    logger.warn(`⚠️ Skipping malformed subject: ${sub?.name || 'unknown'}`);
                    return false;
                }
                return true;
            });
            if (!validErpSubjects.length) {
                setSyncStatus({ status: 'idle' });
                return;
            }
            attendanceSnapshot = validErpSubjects;

            // Timetable-only stubs (0/0, not in the college's list) are noise.
            const summaryCodes = new Set(validErpSubjects
                .map((s) => String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
                .filter(Boolean));
            const stubs = currentState.subjects
                .filter((s) => s.source === 'erp'
                    && Number(s.initialTotal) === 0 && Number(s.initialAttended) === 0
                    && !summaryCodes.has(String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))
                .map((s) => s.id);
            if (stubs.length) dispatch({ type: 'PRUNE_UNMATCHED_EMPTY_ERP_SUBJECTS', payload: stubs });

            const mapping = mapErpToAppState(validErpSubjects, currentState.subjects);
            let latestSubjects = currentState.subjects
                .filter((s) => !stubs.includes(s.id))
                .map((sub) => {
                    const update = mapping.matchedUpdates.find((u) => u.subjectId === sub.id);
                    return update && update.erpSubjectId ? { ...sub, erpSubjectId: update.erpSubjectId } : sub;
                });
            const step1NameMap = buildErpNameMap(mapping.matchedUpdates, mapping.newSubjects);

            if (mapping.newSubjects.length > 0) {
                latestSubjects = [...latestSubjects, ...mapping.newSubjects];
                dispatch({ type: 'SET_SUBJECTS', payload: latestSubjects });
                logger.info('➕', `Added ${mapping.newSubjects.length} new subject(s)`);
            }

            const changedIds = [];
            const updates = usableUpdates(mapping.matchedUpdates, latestSubjects);
            if (updates.length > 0) {
                updates.forEach((u) => changedIds.push(u.subjectId));
                dispatch({ type: 'ERP_OVERWRITE_ATTENDANCE', payload: buildResyncPayload(updates) });
                latestSubjects = latestSubjects.map((s) => {
                    const u = updates.find((x) => x.subjectId === s.id);
                    return u ? { ...s, initialAttended: u.newAttended, initialTotal: u.newTotal } : s;
                });
            }

            // ── Step 2: the day-by-day register ───────────────────
            let registerUnavailable = false;
            if (flagsRef.current.calendarSync === false) {
                setSyncStatus({ calendarSyncStatus: 'idle' });
            } else {
                setSyncStatus({ calendarSyncStatus: 'loading' });
                try {
                    const calData = await trackEndpoint(endpoints, 'calendar',
                        () => erpFetchCalendar(token, persistentToken));
                    if (calData.token) token = calData.token;

                    if (calData.sessionExpired) {
                        sessionEvent = await handleSessionExpired(calData);
                        setSyncStatus({ calendarSyncStatus: 'failed', status: 'idle' });
                        return;
                    }

                    if (calData.calendar && Object.keys(calData.calendar).length > 0) {
                        const result = mapCalendarToRecords(calData.calendar, calData.subjects, latestSubjects, step1NameMap);

                        if (result.newSubjects.length > 0) {
                            latestSubjects = [...latestSubjects, ...result.newSubjects];
                            dispatch({ type: 'SET_SUBJECTS', payload: latestSubjects });
                        }
                        if (result.erpSubjectIdStamps && Object.keys(result.erpSubjectIdStamps).length > 0) {
                            latestSubjects = latestSubjects.map((s) => {
                                const portalId = result.erpSubjectIdStamps[s.id];
                                return portalId && !s.erpSubjectId ? { ...s, erpSubjectId: String(portalId) } : s;
                            });
                            dispatch({ type: 'SET_SUBJECTS', payload: latestSubjects });
                        }

                        dispatch({
                            type: 'ERP_OVERWRITE_CALENDAR',
                            payload: {
                                records: result.records,
                                trackingStartDate: result.earliestDate,
                                latestErpDate: result.latestDate,
                                lastSubjectSyncDates: result.lastSubjectSyncDates,
                                erpSubjectIdStamps: result.erpSubjectIdStamps,
                            },
                        });

                        // The register carries its own per-subject total, in the
                        // same period basis as the summary. Same source, same truth:
                        // apply whatever differs.
                        const registerTotals = (calData.subjects || [])
                            .map((s) => normalizeErpSubject({
                                name: s.name, code: s.code, erpSubjectId: s.erpSubjectId || s.code,
                                delivered: s.total, attended: s.attended, percentage: s.percentage,
                            }))
                            .filter(validateErpSubject);
                        if (registerTotals.length > 0) {
                            const regUpdates = usableUpdates(mapErpToAppState(registerTotals, latestSubjects).matchedUpdates, latestSubjects);
                            if (regUpdates.length > 0) {
                                regUpdates.forEach((u) => { if (!changedIds.includes(u.subjectId)) changedIds.push(u.subjectId); });
                                dispatch({ type: 'ERP_OVERWRITE_ATTENDANCE', payload: buildResyncPayload(regUpdates) });
                            }
                        }
                        setSyncStatus({ calendarSyncStatus: 'ok' });
                    } else {
                        setSyncStatus({ calendarSyncStatus: 'ok' });
                    }
                } catch (calErr) {
                    logger.warn('⚠️ Register sync failed (non-critical):', calErr.message);
                    parserErrors.push({ endpoint: 'calendar', message: String(calErr?.message || calErr).slice(0, 200) });
                    registerUnavailable = true;
                    setSyncError('Totals updated; the day-by-day register was unavailable.');
                    setSyncStatus({ calendarSyncStatus: 'failed' });
                }
            }

            // ── Step 3: timetable (daily, or on manual refresh) ───
            const lastTtFetch = currentState.timetableMeta?.fetchedAt;
            const ttSource = currentState.timetableMeta?.source;
            const shouldFetchTimetable = ttSource !== 'manual' && (
                force || !lastTtFetch || !REAL_TT_SOURCES.includes(ttSource)
                || (Date.now() - new Date(lastTtFetch).getTime()) > TIMETABLE_INTERVAL_MS
            );

            if (shouldFetchTimetable) {
                try {
                    const ttData = await trackEndpoint(endpoints, 'timetable',
                        () => erpFetchTimetable(token, persistentToken));
                    if (ttData.sessionExpired) {
                        // Steps 1–2 already succeeded on this session; a
                        // timetable-only failure is not worth a sign-in card.
                        logger.warn('⏭️ Timetable: session rejected, retrying next cycle');
                    } else if (ttData.success && ttData.source !== 'empty') {
                        const mapped = mapTimetableToState(ttData.timetable, ttData.timeSlots, latestSubjects);
                        if (mapped.newSubjects.length > 0) {
                            latestSubjects = [...latestSubjects, ...mapped.newSubjects];
                            dispatch({ type: 'SET_SUBJECTS', payload: latestSubjects });
                        }
                        dispatch({
                            type: 'ERP_SET_TIMETABLE',
                            payload: {
                                timetable: mapped.timetable,
                                timeSlots: mapped.timeSlots,
                                source: ttData.source,
                                fetchedAt: ttData.fetchedAt,
                                timesAreInferred: ttData.timesAreInferred || false,
                                periodDefinitions: ttData.timeSlots,
                                erpEndpoint: ttData.source || null,
                            },
                        });
                    } else if (ttData.success && ttData.source === 'empty') {
                        dispatch({ type: 'ERP_TIMETABLE_EMPTY', payload: { fetchedAt: ttData.fetchedAt } });
                    }
                } catch (ttErr) {
                    logger.warn('⚠️ Timetable fetch failed (non-critical):', ttErr.message);
                    parserErrors.push({ endpoint: 'timetable', message: String(ttErr?.message || ttErr).slice(0, 200) });
                }
            }

            // ── Done ──────────────────────────────────────────────
            const syncedAt = new Date().toISOString();
            const syncDuration = Date.now() - syncStartMs;
            lastSyncTimeRef.current = Date.now();

            dispatch({ type: 'UPDATE_SETTINGS', payload: { lastErpSync: syncedAt } });
            setSyncStatus({
                status: registerUnavailable ? 'error' : 'idle',
                lastGlobalSyncAt: syncedAt,
                syncDuration,
                changedSubjectIds: changedIds,
            });
            setLastSyncedAt(new Date());
            if (!registerUnavailable) setSyncError(null);
            logger.info('✅', `Sync complete (${syncDuration}ms)`);
        } catch (err) {
            logger.error('❌ Sync failed:', err.message);
            parserErrors.push({ endpoint: 'sync', message: String(err?.message || err).slice(0, 200) });

            if (err?.status === 403 && err?.data?.revoked) {
                dispatch({ type: 'ACCESS_REVOKED', payload: { reason: err.data.error } });
            } else if (err?.status === 401 && err?.data?.sessionExpired) {
                // No saved sign-in to fall back on: the student reconnects from Settings.
                sessionEvent = await handleSessionExpired({ needsLogin: true, reason: 'no_persistent' });
            }

            setSyncError(err.message);
            setSyncStatus({ status: 'error' });
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
            logSync(currentState.userId, {
                endpoints, parserErrors, sessionEvent,
                rollNumber: currentState.erpRollNumber,
            });
            logAttendanceSnapshot(currentState.userId, currentState.erpRollNumber, attendanceSnapshot);
        }
    }, [dispatch, setSyncStatus, handleSessionExpired]);

    // ── Periodic + foreground ────────────────────────────────────
    useEffect(() => {
        const start = () => {
            if (!periodicTimerRef.current) {
                periodicTimerRef.current = setInterval(() => triggerSync(false, false), PERIODIC_INTERVAL_MS);
            }
        };
        const stop = () => {
            if (periodicTimerRef.current) {
                clearInterval(periodicTimerRef.current);
                periodicTimerRef.current = null;
            }
        };
        const subscription = AppState.addEventListener('change', (next) => {
            if (next === 'active') {
                start();
                triggerSync(false, true);
            } else {
                stop();
            }
        });
        start();
        return () => {
            stop();
            subscription.remove();
        };
    }, [triggerSync]);

    return { isSyncing, lastSyncedAt, syncError, triggerSync };
}
