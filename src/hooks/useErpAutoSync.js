/**
 * useErpAutoSync — production-grade ERP attendance sync hook.
 *
 * ── Session strategy ─────────────────────────────────────────────────
 *   - Session persists indefinitely — no fixed expiry
 *   - Auth failures trigger OTP immediately (not deferred to keep-alive)
 *   - Network errors / timeouts do NOT trigger re-login
 *   - Keep-alive ping every 12 min to warm the session (server short-circuits)
 *
 * ── Sync rules ───────────────────────────────────────────────────────
 *   - ERP data → always overwrites local/manual data
 *   - Partial data: overwrite ONLY subjects present in ERP response
 *   - Per-subject validation before applying
 *   - Change detection: skip subjects with identical data
 *   - Manual grace window: skip subjects manually updated < 2 min ago
 *   - Subject identity: subjectCode (preferred) → normalized name (fallback)
 *
 * ── Timing ───────────────────────────────────────────────────────────
 *   - Debounce: skip if last successful sync < 60s ago
 *   - Foreground throttle: min 10s gap between foreground-triggered syncs
 *   - Periodic: re-sync every 3 minutes while app is active
 *   - Foreground: immediate sync when app returns from background
 *   - lastSyncTimeRef only updated on SUCCESS — failures allow retry
 *
 * ── Global sync state (dispatched to AppContext) ─────────────────────
 *   - status:             'idle' | 'syncing' | 'error'
 *   - lastGlobalSyncAt:   ISO string of last successful sync
 *   - lastSyncAttemptAt:  ISO string of last attempt (success or failure)
 *   - syncDuration:       ms duration of last completed sync
 *   - calendarSyncStatus: 'idle' | 'loading' | 'ok' | 'failed'
 *   - changedSubjectIds:  IDs updated in last cycle (cleared at start of each sync)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { getErpToken, getErpPersistentToken } from '../storage/erpTokenStorage';
import { erpFetchAttendance, erpFetchCalendar, erpKeepAlive } from '../services/erpService';
import { mapErpToAppState, buildResyncPayload, mapCalendarToRecords, validateErpSubject, buildErpNameMap } from '../utils/erpAttendanceMapper';
import { logger } from '../utils/logger';

const MIN_SYNC_INTERVAL_MS       = 60 * 1000;   // 60s debounce (successful syncs)
const FOREGROUND_THROTTLE_MS     = 10 * 1000;   // 10s min gap between foreground syncs
const PERIODIC_INTERVAL_MS       = 3  * 60 * 1000;  // 3 min periodic
const KEEPALIVE_INTERVAL_MS      = 12 * 60 * 1000;  // 12 min keep-alive
const MANUAL_GRACE_MS            = 2  * 60 * 1000;  // 2 min grace for manual entries

export function useErpAutoSync(state, dispatch) {
    // ── Refs ─────────────────────────────────────────────────────
    const isSyncingRef           = useRef(false);
    const lastSyncTimeRef        = useRef(0);   // last SUCCESSFUL sync timestamp
    const lastForegroundSyncRef  = useRef(0);   // last foreground-triggered sync
    const periodicTimerRef       = useRef(null);
    const keepAliveTimerRef      = useRef(null);
    const stateRef               = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // ── Local UI state ───────────────────────────────────────────
    const [isSyncing,    setIsSyncing]    = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [syncError,    setSyncError]    = useState(null);

    // ── Helper: patch erpSync in AppContext ──────────────────────
    const setSyncStatus = useCallback((patch) => {
        dispatch({ type: 'ERP_SYNC_STATE', payload: patch });
    }, [dispatch]);

    // ─────────────────────────────────────────────────────────────
    const triggerSync = useCallback(async (force = false, fromForeground = false) => {
        const currentState = stateRef.current;

        // Pre-flight
        if (!currentState.isAuthenticated || !currentState.settings?.erpConnected) return;
        if (isSyncingRef.current) {
            logger.info('⏭️', 'ERP sync skipped — already in progress');
            return;
        }

        const now = Date.now();

        // Foreground throttle — prevent rapid re-syncs when user switches apps quickly
        if (fromForeground && now - lastForegroundSyncRef.current < FOREGROUND_THROTTLE_MS) {
            logger.info('⏭️', 'ERP foreground sync throttled (< 10s)');
            return;
        }

        // Debounce — skip if last SUCCESSFUL sync was < 60s ago
        if (!force && now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL_MS) {
            logger.info('⏭️', 'ERP sync skipped — too soon (< 60s)');
            return;
        }

        // Fetch tokens before acquiring lock — early exits don't consume cooldown
        const token = await getErpToken();
        if (!token) {
            if (currentState.settings?.erpConnected) {
                dispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
            }
            return;
        }
        const persistentToken = await getErpPersistentToken();

        // Acquire lock
        isSyncingRef.current = true;
        if (fromForeground) lastForegroundSyncRef.current = now;
        setIsSyncing(true);
        setSyncError(null);

        const syncStartMs = Date.now();
        const attemptAt   = new Date().toISOString();

        // Clear changedSubjectIds at the start of every sync cycle
        setSyncStatus({
            status:            'syncing',
            lastSyncAttemptAt: attemptAt,
            changedSubjectIds: [],
        });

        try {
            logger.info('🔄', 'ERP auto-sync starting...');

            // ── Step 1: Attendance summary ────────────────────────
            const attendanceResult = await erpFetchAttendance(token, persistentToken);

            // Auth failure — trigger OTP immediately, do not wait for keep-alive
            if (attendanceResult.sessionExpired) {
                logger.info('🔑', 'ERP session expired — triggering OTP immediately');
                dispatch({
                    type: 'ERP_SESSION_EXPIRED',
                    payload: {
                        authUserId:      attendanceResult.authUserId,
                        studentName:     attendanceResult.studentName || '',
                        persistentToken,
                    },
                });
                setSyncStatus({ status: 'error' });
                // Do NOT update lastSyncTimeRef — allow retry after OTP
                return;
            }

            // Guard: empty response — keep existing data
            if (!attendanceResult.subjects?.length) {
                logger.warn('⚠️ ERP returned empty subjects — keeping existing data');
                setSyncStatus({ status: 'idle' });
                return;
            }

            // Per-subject validation
            const validErpSubjects = attendanceResult.subjects.filter(sub => {
                if (!validateErpSubject(sub)) {
                    logger.warn(`⚠️ Skipping invalid ERP subject: ${sub?.name || 'unknown'}`);
                    return false;
                }
                return true;
            });

            if (!validErpSubjects.length) {
                logger.warn('⚠️ No valid ERP subjects after validation — keeping existing data');
                setSyncStatus({ status: 'idle' });
                return;
            }

            const mapping = mapErpToAppState(validErpSubjects, currentState.subjects);

            // Build latest subjects array WITH the newly discovered erpSubjectId stamped on them,
            // because mapCalendarToRecords needs these IDs to match register subjects correctly.
            let latestSubjects = currentState.subjects.map(sub => {
                const update = mapping.matchedUpdates.find(u => u.subjectId === sub.id);
                if (update && update.erpSubjectId) {
                    return { ...sub, erpSubjectId: update.erpSubjectId };
                }
                return sub;
            });

            // Build a direct name→id map from Step 1 BEFORE any dispatch.
            // This is the critical link passed to Step 2 (calendar) to avoid re-matching
            // mismatches when mobilev2 and register HTML use different subject name formats.
            const step1NameMap = buildErpNameMap(mapping.matchedUpdates, mapping.newSubjects);

            // Add new subjects from ERP
            if (mapping.newSubjects.length > 0) {
                latestSubjects = [...currentState.subjects, ...mapping.newSubjects];
                dispatch({ type: 'SET_SUBJECTS', payload: latestSubjects });
                logger.info('➕', `Added ${mapping.newSubjects.length} new ERP subjects`);
            }

            // Change detection + manual grace window
            const changedIds = [];
            if (mapping.matchedUpdates.length > 0) {
                const nowMs = Date.now();
                const filteredUpdates = mapping.matchedUpdates.filter(update => {
                    const existing = currentState.subjects.find(s => s.id === update.subjectId);
                    if (!existing) return true;

                    // Skip subjects manually updated within the grace window
                    if (existing.source === 'manual' && existing.lastUpdated) {
                        const age = nowMs - new Date(existing.lastUpdated).getTime();
                        if (age < MANUAL_GRACE_MS) {
                            logger.info('🛡️', `Grace window: skipping ${existing.name} (${Math.round(age / 1000)}s old)`);
                            return false;
                        }
                    }

                    // Skip if data is identical
                    if (
                        existing.initialAttended === update.newAttended &&
                        existing.initialTotal    === update.newTotal
                    ) {
                        logger.info('⏭️', `No change: ${existing.name}`);
                        return false;
                    }

                    changedIds.push(update.subjectId);
                    return true;
                });

                if (filteredUpdates.length > 0) {
                    dispatch({
                        type: 'ERP_OVERWRITE_ATTENDANCE',
                        payload: buildResyncPayload(filteredUpdates),
                    });
                    logger.info('✅', `ERP sync: updated ${filteredUpdates.length} subjects`);
                } else {
                    logger.info('✅', 'ERP sync: no changes detected');
                }
            }

            // ── Step 2: Calendar ──────────────────────────────────
            setSyncStatus({ calendarSyncStatus: 'loading' });
            let registerUnavailable = false;
            try {
                const calData = await erpFetchCalendar(token, persistentToken);
                console.log('[CAL-DEBUG] API response keys:', Object.keys(calData));
                console.log('[CAL-DEBUG] calData.calendar days:', calData.calendar ? Object.keys(calData.calendar).length : 'NO CALENDAR');
                console.log('[CAL-DEBUG] calData.subjects count:', calData.subjects ? calData.subjects.length : 'NO SUBJECTS');
                console.log('[CAL-DEBUG] calData.sessionExpired:', calData.sessionExpired);
                console.log('[CAL-DEBUG] latestSubjects count:', latestSubjects.length);
                console.log('[CAL-DEBUG] latestSubjects sample:', latestSubjects.slice(0, 2).map(s => ({ id: s.id, name: s.name, code: s.code, erpSubjectId: s.erpSubjectId })));

                if (calData.sessionExpired) {
                    logger.warn('⚠️ Calendar sync skipped — session expired');
                    setSyncStatus({ calendarSyncStatus: 'failed' });
                } else if (calData.calendar && Object.keys(calData.calendar).length > 0) {
                    console.log('[CAL-DEBUG] Calendar has data, calling mapCalendarToRecords...');
                    console.log('[CAL-DEBUG] Sample calendar day:', Object.entries(calData.calendar)[0]);
                    if (calData.subjects?.length > 0) {
                        console.log('[CAL-DEBUG] API subjects:', calData.subjects.map(s => ({ name: s.name, code: s.code, erpSubjectId: s.erpSubjectId })));
                    }
                    const result = mapCalendarToRecords(calData.calendar, calData.subjects, latestSubjects, step1NameMap);

                    if (result.newSubjects.length > 0) {
                        const withNew = [...latestSubjects, ...result.newSubjects];
                        dispatch({ type: 'SET_SUBJECTS', payload: withNew });
                        latestSubjects = withNew;
                    }

                    // Stamp numeric portal IDs onto matched subjects so future syncs
                    // use stable ID-based matching instead of fuzzy name matching
                    if (result.erpSubjectIdStamps && Object.keys(result.erpSubjectIdStamps).length > 0) {
                        const stamped = latestSubjects.map(s => {
                            const portalId = result.erpSubjectIdStamps[s.id];
                            if (portalId && !s.erpSubjectId) {
                                return { ...s, erpSubjectId: String(portalId) };
                            }
                            return s;
                        });
                        dispatch({ type: 'SET_SUBJECTS', payload: stamped });
                        latestSubjects = stamped;
                    }

                    console.log('[CAL-DEBUG] mapCalendarToRecords result:', {
                        totalDays: result.totalDays,
                        newSubjects: result.newSubjects.length,
                        mappingKeys: Object.keys(result.subjectMapping),
                        earliestDate: result.earliestDate,
                        latestDate: result.latestDate,
                        sampleRecord: Object.entries(result.records)[0],
                        erpSubjectIdStamps: result.erpSubjectIdStamps,
                    });

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
                    setSyncStatus({ calendarSyncStatus: 'ok' });
                    logger.info('✅', `ERP calendar sync: ${result.totalDays} days, ${Object.keys(result.subjectMapping).length} subjects mapped`);
                } else {
                    console.log('[CAL-DEBUG] Calendar empty or missing — skipping. calData:', JSON.stringify(calData).slice(0, 500));
                    setSyncStatus({ calendarSyncStatus: 'ok' });
                }
            } catch (calErr) {
                console.error('[CAL-DEBUG] Calendar sync EXCEPTION:', calErr.message, calErr.stack);
                logger.warn('⚠️ Calendar sync failed (non-critical):', calErr.message);
                registerUnavailable = true;
                setSyncError('Totals synced, attendance register unavailable.');
                setSyncStatus({ calendarSyncStatus: 'failed' });
            }

            // ── Commit success ────────────────────────────────────
            const syncedAt      = new Date().toISOString();
            const syncDuration  = Date.now() - syncStartMs;
            lastSyncTimeRef.current = Date.now();

            dispatch({ type: 'UPDATE_SETTINGS', payload: { lastErpSync: syncedAt } });
            setSyncStatus({
                status:            registerUnavailable ? 'error' : 'idle',
                lastGlobalSyncAt:  syncedAt,
                syncDuration,
                changedSubjectIds: changedIds,
            });
            setLastSyncedAt(new Date());
            if (!registerUnavailable) setSyncError(null);
            logger.info('✅', `ERP auto-sync complete (${syncDuration}ms)`);

        } catch (err) {
            // Network error / timeout — keep existing data, allow immediate retry
            logger.error('❌ ERP auto-sync failed:', err.message);
            setSyncError(err.message);
            setSyncStatus({ status: 'error' });
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [dispatch, setSyncStatus]);

    // ── Keep-alive: ping ERP every 12 min to warm the session ────
    // Server short-circuits on keepAlive=true — no HTML parsing overhead.
    const runKeepAlive = useCallback(async () => {
        const currentState = stateRef.current;
        if (!currentState.isAuthenticated || !currentState.settings?.erpConnected) return;
        if (isSyncingRef.current) return; // full sync already running

        const token = await getErpToken();
        const persistentToken = await getErpPersistentToken();
        if (!token) return;

        logger.info('💓', 'ERP keep-alive ping...');
        const result = await erpKeepAlive(token, persistentToken);

        // If keep-alive reveals session is dead, trigger OTP immediately
        if (result?.sessionExpired) {
            logger.info('🔑', 'Keep-alive: session expired — triggering OTP immediately');
            dispatch({
                type: 'ERP_SESSION_EXPIRED',
                payload: {
                    authUserId:      result.authUserId,
                    studentName:     result.studentName || '',
                    persistentToken,
                },
            });
        }
    }, [dispatch]);

    // ── Periodic sync + foreground sync + keep-alive ─────────────
    useEffect(() => {
        const startTimers = () => {
            if (!periodicTimerRef.current) {
                periodicTimerRef.current = setInterval(() => triggerSync(false, false), PERIODIC_INTERVAL_MS);
            }
            if (!keepAliveTimerRef.current) {
                keepAliveTimerRef.current = setInterval(runKeepAlive, KEEPALIVE_INTERVAL_MS);
            }
        };

        const stopTimers = () => {
            if (periodicTimerRef.current) {
                clearInterval(periodicTimerRef.current);
                periodicTimerRef.current = null;
            }
            if (keepAliveTimerRef.current) {
                clearInterval(keepAliveTimerRef.current);
                keepAliveTimerRef.current = null;
            }
        };

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                startTimers();
                triggerSync(false, true); // foreground sync — subject to 10s throttle
            } else {
                stopTimers(); // pause while backgrounded
            }
        });

        startTimers(); // start on mount

        return () => {
            stopTimers();
            subscription.remove();
        };
    }, [triggerSync, runKeepAlive]);

    return { isSyncing, lastSyncedAt, syncError, triggerSync };
}
