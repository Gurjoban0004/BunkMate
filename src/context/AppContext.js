import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { getTodayKey, parseDate, isPastTime, subtractDays } from '../utils/dateHelpers';
import { initNetworkListener, onNetworkStatusChange } from '../utils/firebaseHelpers';
import { loadAppState, saveAppState, migrateToFirestore } from '../storage/storage';
import { logger } from '../utils/logger';
import { COLORS as THEME_COLORS } from '../theme/theme';
import { useErpAutoSync } from '../hooks/useErpAutoSync';
import { getErpPersistentToken } from '../storage/erpTokenStorage';
import { erpCheckSession } from '../services/erpService';

const AppContext = createContext();

const initialState = {
    setupComplete: false,
    isAuthenticated: false, // true once user has logged in or completed setup

    // User Info
    userName: '',
    userId: null,

    // User-defined time slots
    timeSlots: [],

    // All subjects with initial attendance data (now includes color)
    subjects: [],

    // Weekly timetable: day → array of { slotId, subjectId }
    timetable: {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
    },

    // Daily records: "YYYY-MM-DD" → { subjectId: { status, units, isExtra? } }
    attendanceRecords: {},

    // Pre-marked holidays
    holidays: [],

    // App settings
    settings: {
        dangerThreshold: 75,
        notificationEnabled: true,
        notificationTime: '18:00',
        smartAlertsEnabled: true,
        autopilotEnabled: false,
        autopilotTime: '20:00',
        autopilotDefault: 'present',
        erpConnected: false,
        lastErpSync: null,
        attendanceMode: 'erp', // 'erp' | 'manual'
    },

    autopilotReview: null, // { date: 'YYYY-MM-DD', count: >0, dismissed: false }
    autopilotDiscoveryDismissed: false,

    // Track which warning notifications have been sent (avoid spam)
    notificationState: {},

    // Setup tracking fields
    setupDate: null,              // Date when setup was completed
    trackingStartDate: null,      // Date from which to track attendance
    todayIncludedInSetup: false,  // Was today's attendance included in initial numbers?

    // Dev Mode
    devDate: null,                // Simulated date for time travel

    // ERP session expiry — set when ERP rejects session and OTP is needed
    erpSessionExpired: null,      // { authUserId, studentName, persistentToken } | null

    // ERP sync metadata — drives UI freshness indicators
    erpSync: {
        status:             'idle',  // 'idle' | 'syncing' | 'error'
        lastGlobalSyncAt:   null,    // ISO string — last successful full sync
        lastSyncAttemptAt:  null,    // ISO string — last attempt (success or failure)
        syncDuration:       null,    // ms — duration of last completed sync
        calendarSyncStatus: 'idle',  // 'idle' | 'loading' | 'ok' | 'failed'
        changedSubjectIds:  [],      // subject IDs updated in the last sync cycle
    },
};

function appReducer(state, action) {
    switch (action.type) {
        case 'SET_TIME_SLOTS':
            return { ...state, timeSlots: action.payload };

        case 'ADD_SUBJECT':
            return { ...state, subjects: [...state.subjects, action.payload] };

        case 'SET_SUBJECTS':
            return { ...state, subjects: action.payload };

        case 'SET_TIMETABLE':
            return { ...state, timetable: action.payload };

        case 'SET_TIMETABLE_DAY':
            return {
                ...state,
                timetable: {
                    ...state.timetable,
                    [action.payload.day]: action.payload.slots,
                },
            };

        case 'SET_INITIAL_ATTENDANCE':
            return {
                ...state,
                subjects: state.subjects.map((sub) => {
                    const update = action.payload.find((u) => u.id === sub.id);
                    if (update) {
                        return {
                            ...sub,
                            initialTotal: update.initialTotal,
                            initialAttended: update.initialAttended,
                        };
                    }
                    return sub;
                }),
            };

        case 'UPDATE_SUBJECT':
            return {
                ...state,
                subjects: state.subjects.map((sub) =>
                    sub.id === action.payload.id ? { ...sub, ...action.payload } : sub
                ),
            };

        case 'SET_SUBJECT_TARGET':
            return {
                ...state,
                subjects: state.subjects.map((sub) =>
                    sub.id === action.payload.subjectId
                        ? { ...sub, target: action.payload.target }
                        : sub
                ),
            };

        case 'DELETE_SUBJECT': {
            const subjectId = action.payload;
            const newTimetable = { ...state.timetable };
            Object.keys(newTimetable).forEach(day => {
                if (newTimetable[day]) {
                    newTimetable[day] = newTimetable[day].filter(slot => slot.subjectId !== subjectId);
                }
            });
            // Also clean up attendance records for this subject
            const newRecords = { ...state.attendanceRecords };
            Object.keys(newRecords).forEach(date => {
                if (newRecords[date]?.[subjectId]) {
                    delete newRecords[date][subjectId];
                }
            });
            return {
                ...state,
                subjects: state.subjects.filter(s => s.id !== subjectId),
                timetable: newTimetable,
                attendanceRecords: newRecords,
            };
        }

        case 'MARK_ATTENDANCE': {
            const { date, subjectId, status, units, isExtra, autoMarked } = action.payload;
            return {
                ...state,
                // Also mark the subject as manually sourced (will be overwritten on next ERP sync)
                subjects: state.subjects.map(sub =>
                    sub.id === subjectId && sub.source !== 'erp'
                        ? { ...sub, source: 'manual', lastUpdated: new Date().toISOString() }
                        : sub
                ),
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...(state.attendanceRecords[date] || {}),
                        [subjectId]: {
                            status,
                            units: units || 1,
                            source: 'manual',
                            ...(isExtra ? { isExtra: true } : {}),
                            ...(autoMarked ? { autoMarked: true } : {}),
                        },
                    },
                },
            };
        }

        case 'REMOVE_ATTENDANCE': {
            const { date: removeDate, subjectId: removeSubjectId } = action.payload;
            const newDayRecord = { ...(state.attendanceRecords[removeDate] || {}) };
            delete newDayRecord[removeSubjectId];
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [removeDate]: newDayRecord,
                },
            };
        }

        case 'MARK_HOLIDAY': {
            const dateKey = action.payload;
            return {
                ...state,
                holidays: [...(state.holidays || []), dateKey],
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [dateKey]: { _holiday: true },
                },
            };
        }

        case 'UNDO_HOLIDAY': {
            const dateKey = action.payload;
            const newRecords = { ...state.attendanceRecords };
            delete newRecords[dateKey];
            return {
                ...state,
                holidays: (state.holidays || []).filter((d) => d !== dateKey),
                attendanceRecords: newRecords,
            };
        }

        case 'EDIT_ATTENDANCE': {
            const { date, subjectId, newStatus } = action.payload;
            const existing = state.attendanceRecords[date]?.[subjectId];
            if (!existing) return state;
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...state.attendanceRecords[date],
                        [subjectId]: { ...existing, status: newStatus },
                    },
                },
            };
        }

        case 'LOAD_PRESET': {
            const preset = action.payload;
            const today = getTodayKey();
            return {
                ...state,
                setupComplete: true,
                timeSlots: preset.timeSlots,
                subjects: preset.subjects,
                timetable: preset.timetable,
                setupDate: today,
                trackingStartDate: today,
                todayIncludedInSetup: false,
            };
        }

        case 'COMPLETE_SETUP':
            return { ...state, setupComplete: true, isAuthenticated: true, ...(action.payload || {}) };

        case 'SET_TRACKING_CONFIG':
            return {
                ...state,
                setupDate: action.payload.setupDate,
                trackingStartDate: action.payload.trackingStartDate,
                todayIncludedInSetup: action.payload.todayIncludedInSetup,
            };

        case 'UPDATE_SETTINGS':
            return {
                ...state,
                settings: { ...state.settings, ...action.payload },
            };

        case 'UPDATE_AUTOPILOT_SETTINGS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    ...action.payload,
                },
            };

        case 'SET_AUTOPILOT_REVIEW':
            return {
                ...state,
                autopilotReview: action.payload,
            };

        case 'DISMISS_AUTOPILOT_REVIEW':
            return {
                ...state,
                autopilotReview: state.autopilotReview
                    ? { ...state.autopilotReview, dismissed: true }
                    : null,
            };

        case 'DISMISS_AUTOPILOT_DISCOVERY':
            return {
                ...state,
                autopilotDiscoveryDismissed: true,
            };

        case 'CONFIRM_AUTO_MARK': {
            const { date, subjectId } = action.payload;
            const existing = state.attendanceRecords[date]?.[subjectId];
            if (!existing) return state;

            const { autoMarked, ...cleanedRecord } = existing;
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...state.attendanceRecords[date],
                        [subjectId]: cleanedRecord,
                    },
                },
            };
        }

        case 'CONFIRM_ALL_AUTO_MARK': {
            const newRecords = { ...state.attendanceRecords };
            Object.keys(newRecords).forEach(date => {
                const dayRecord = { ...newRecords[date] };
                let modified = false;
                Object.keys(dayRecord).forEach(sid => {
                    if (dayRecord[sid]?.autoMarked) {
                        const { autoMarked, ...cleaned } = dayRecord[sid];
                        dayRecord[sid] = cleaned;
                        modified = true;
                    }
                });
                if (modified) newRecords[date] = dayRecord;
            });
            return {
                ...state,
                attendanceRecords: newRecords,
                autopilotReview: state.autopilotReview ? { ...state.autopilotReview, dismissed: true } : null,
            };
        }

        case 'UPDATE_NOTIFICATION_STATE':
            return {
                ...state,
                notificationState: {
                    ...state.notificationState,
                    [action.payload.subjectId]: action.payload.data,
                },
            };

        case 'SET_USER_NAME':
            return {
                ...state,
                userName: action.payload,
            };

        case 'REMOVE_HOLIDAY': {
            const removeKey = action.payload;
            const existingRecord = state.attendanceRecords[removeKey] || {};
            const { _holiday, ...remainingRecords } = existingRecord;
            return {
                ...state,
                holidays: (state.holidays || []).filter(h => h !== removeKey),
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [removeKey]: remainingRecords,
                },
            };
        }

        case 'ERP_OVERWRITE_ATTENDANCE': {
            // ERP is source of truth — updates subject summary data (initialAttended/initialTotal).
            // Does NOT touch attendanceRecords — ERP_OVERWRITE_CALENDAR handles that separately.
            // Only subjects present in the updates array are modified; others are untouched.
            // Also persists erpSubjectId (subject code) for stable identity on future syncs.
            const { updates } = action.payload;
            const now = new Date().toISOString();

            return {
                ...state,
                subjects: state.subjects.map(sub => {
                    const update = updates.find(u => u.subjectId === sub.id);
                    if (!update) return sub;
                    return {
                        ...sub,
                        initialAttended: update.newAttended,
                        initialTotal:    update.newTotal,
                        source:          'erp',
                        lastUpdated:     now,
                        // Persist stable subject code if ERP provided one and subject doesn't have it yet
                        ...(update.erpSubjectId && !sub.erpSubjectId
                            ? { erpSubjectId: update.erpSubjectId }
                            : {}),
                    };
                }),
            };
        }

        case 'ERP_OVERWRITE_CALENDAR': {
            // ERP calendar completely replaces all attendance records.
            // Manual entries are discarded — ERP is the source of truth.
            // Holidays are preserved — they are user-set and not part of ERP data.
            const { records, trackingStartDate: newTrackingStart } = action.payload;

            // Re-apply holidays on top of ERP records so they aren't lost
            const mergedWithHolidays = { ...records };
            (state.holidays || []).forEach(dateKey => {
                mergedWithHolidays[dateKey] = { _holiday: true };
            });

            return {
                ...state,
                attendanceRecords: mergedWithHolidays,
                trackingStartDate: newTrackingStart || state.trackingStartDate,
            };
        }

        case 'LOAD_CALENDAR_RECORDS': {
            // Import ERP calendar data into attendance records
            // Manual records always take priority over ERP-imported ones
            const { records, trackingStartDate: newTrackingStart } = action.payload;

            // Merge: ERP data first, then overlay existing manual records
            const mergedRecords = {};

            // Add all ERP dates
            for (const [dateKey, dayData] of Object.entries(records)) {
                mergedRecords[dateKey] = { ...dayData };
            }

            // Overlay existing manual records (they take priority)
            for (const [dateKey, dayData] of Object.entries(state.attendanceRecords)) {
                if (!mergedRecords[dateKey]) {
                    mergedRecords[dateKey] = { ...dayData };
                } else {
                    // Merge: existing manual entries override ERP entries
                    mergedRecords[dateKey] = { ...mergedRecords[dateKey], ...dayData };
                }
            }

            return {
                ...state,
                attendanceRecords: mergedRecords,
                trackingStartDate: newTrackingStart || state.trackingStartDate,
            };
        }

        case 'RESET_STATE':
            return { ...initialState };

        case 'LOAD_STATE': {
            // Never mutate action.payload — work on a shallow copy
            const loaded = { ...action.payload };

            // Migrate old hardcoded colors to the new theme palette
            if (loaded.subjects && loaded.subjects.length > 0) {
                loaded.subjects = loaded.subjects.map((sub, i) => {
                    if (!THEME_COLORS.subjectPalette.includes(sub.color)) {
                        return { ...sub, color: THEME_COLORS.subjectPalette[i % THEME_COLORS.subjectPalette.length] };
                    }
                    return sub;
                });
            }

            // Migrate autopilot settings
            const settings = { ...initialState.settings, ...(loaded.settings || {}) };
            if (settings.dangerThreshold === undefined) settings.dangerThreshold = 75;
            if (settings.autopilotEnabled === undefined) settings.autopilotEnabled = false;
            if (!settings.autopilotTime) settings.autopilotTime = '20:00';
            if (!settings.autopilotDefault) settings.autopilotDefault = 'present';
            if (!settings.attendanceMode) settings.attendanceMode = 'erp';

            return {
                ...initialState,
                ...loaded,
                settings,
                timetable: { ...initialState.timetable, ...(loaded.timetable || {}) },
                autopilotReview: loaded.autopilotReview !== undefined ? loaded.autopilotReview : null,
                autopilotDiscoveryDismissed: loaded.autopilotDiscoveryDismissed !== undefined ? loaded.autopilotDiscoveryDismissed : false,
                // Always reset sync status on load — it's transient UI state
                erpSync: { ...initialState.erpSync, lastGlobalSyncAt: loaded.erpSync?.lastGlobalSyncAt || null },
                // Always clear pending OTP state on load — stale authUserId is useless after restart
                erpSessionExpired: null,
                // Always mark as authenticated when loading a saved state with a userId
                isAuthenticated: !!(loaded.userId),
            };
        }

        case 'SET_DEV_DATE':
            return {
                ...state,
                devDate: action.payload,
            };

        case 'SET_USER_ID':
            return {
                ...state,
                userId: action.payload,
            };

        case 'SET_AUTHENTICATED':
            return {
                ...state,
                isAuthenticated: action.payload,
            };

        case 'ERP_SESSION_EXPIRED':
            // Store the pending re-auth info so the UI can show an OTP prompt
            return {
                ...state,
                erpSessionExpired: {
                    authUserId:      action.payload.authUserId,
                    studentName:     action.payload.studentName,
                    persistentToken: action.payload.persistentToken,
                },
            };

        case 'ERP_SESSION_RESTORED':
            return {
                ...state,
                erpSessionExpired: null,
            };

        case 'ERP_SYNC_STATE': {
            // Update ERP sync metadata — drives UI freshness indicators
            return {
                ...state,
                erpSync: { ...state.erpSync, ...action.payload },
            };
        }

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isLoading, setIsLoading] = useState(true);
    // Ref so network listener always sees current state without stale closure
    const stateRef = React.useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    // Track whether a reset was just dispatched to prevent saving empty state
    const justResetRef = React.useRef(false);
    // Track last action type — skip saves for transient-only ERP sync state updates
    const lastActionTypeRef = React.useRef(null);

    // Wrap dispatch to intercept RESET_STATE
    const safeDispatch = React.useCallback((action) => {
        if (action.type === 'RESET_STATE') {
            justResetRef.current = true;
        }
        lastActionTypeRef.current = action.type;
        dispatch(action);
    }, []);

    // ─── INITIALIZATION ──────────────────────────────────────────

    useEffect(() => {
        const initialize = async () => {
            try {
                logger.info('🚀', 'Initializing app context...');
                
                // 1. Setup network listener
                initNetworkListener();

                // 2. Load state from hybrid storage — this is the source of truth
                const saved = await loadAppState();
                if (saved && saved.userId) {
                    // User has a saved session — restore it
                    safeDispatch({ type: 'LOAD_STATE', payload: saved });
                    
                    // Migrate to Firestore in background — do NOT await
                    migrateToFirestore(saved).catch(e => logger.warn('⚠️ Migration failed:', e));

                    // ── ERP persistent session check ──────────────
                    // If ERP was connected, check if we can skip the login screen
                    // by using the stored persistent token to initiate a fresh session.
                    if (saved.settings?.erpConnected) {
                        const persistentToken = await getErpPersistentToken();
                        if (persistentToken) {
                            try {
                                const result = await erpCheckSession(persistentToken);
                                if (result.reason === 'otp_required') {
                                    // Credentials valid — ERP sent OTP to student's phone.
                                    // Store the pending re-auth so UI can show OTP screen only.
                                    safeDispatch({
                                        type: 'ERP_SESSION_EXPIRED',
                                        payload: {
                                            authUserId:   result.authUserId,
                                            studentName:  result.studentName || '',
                                            persistentToken,
                                        },
                                    });
                                } else if (result.reason === 'credentials_rejected') {
                                    // Password changed — mark ERP disconnected
                                    safeDispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
                                }
                                // 'no_token' / 'invalid_token' → do nothing, auto-sync will handle
                            } catch (e) {
                                logger.warn('⚠️ ERP session check failed:', e.message);
                            }
                        }
                    }
                }
                // If no saved state or no userId → stay at initialState (isAuthenticated: false)
                // → AppNavigator will show Login screen
                
                logger.info('✅', 'Initialization complete');
            } catch (e) {
                logger.error('❌ Failed to initialize app:', e);
            } finally {
                setIsLoading(false);
            }
        };
        initialize();

        // Handle network status changes for real-time sync
        const unsubscribe = onNetworkStatusChange((isOnline) => {
            if (isOnline && stateRef.current.isAuthenticated) {
                logger.info('🔄', 'Back online, syncing state...');
                // Sync cloud state first to avoid "last write wins" overwriting fresh cloud data
                loadAppState().then((saved) => {
                    if (saved) safeDispatch({ type: 'LOAD_STATE', payload: saved });
                    saveAppState(stateRef.current);
                });
            }
        });

        return () => unsubscribe();
    }, []);

    // Auto-save state on every change (skip initial load)
    // IMPORTANT: Do NOT auto-save when userId is null (e.g. after RESET_STATE / logout).
    // Saving an empty state would overwrite the cloud data with a newer timestamp,
    // preventing it from being restored on the next login.
    const isFirstRender = React.useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        // If a reset was just dispatched, skip this save cycle and clear the flag
        if (justResetRef.current) {
            justResetRef.current = false;
            return;
        }
        // Skip saves triggered purely by transient ERP sync state — it's stripped
        // from the persisted payload anyway, so writing is wasteful
        if (lastActionTypeRef.current === 'ERP_SYNC_STATE') {
            return;
        }
        if (!isLoading && state.userId && state.isAuthenticated) {
            saveAppState(state);
        }
    }, [state, isLoading]);

    // ─── AUTOPILOT LOGIC ──────────────────────────────────────────

    const runAutopilotCheck = useCallback(() => {
        // Always read from ref to avoid stale closure
        const currentState = stateRef.current;
        if (!currentState.settings.autopilotEnabled) return;
        if (currentState.settings.attendanceMode === 'erp') return; // No autopilot in ERP mode

        const nowObj = currentState.devDate ? new Date(currentState.devDate) : new Date();
        const year = nowObj.getFullYear();
        const month = String(nowObj.getMonth() + 1).padStart(2, '0');
        const day = String(nowObj.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const yesterdayObj = subtractDays(nowObj, 1);
        const yYear = yesterdayObj.getFullYear();
        const yMonth = String(yesterdayObj.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterdayObj.getDate()).padStart(2, '0');
        const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

        let autoMarkedCount = 0;
        let reviewDate = null;

        const existingReview = currentState.autopilotReview;

        const getUnmarkedForDate = (dateStr) => {
            if (currentState.trackingStartDate && dateStr < currentState.trackingStartDate && !currentState.devDate) return [];
            const parsedDate = parseDate(dateStr);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = days[parsedDate.getDay()];
            const dayClasses = currentState.timetable[dayName] || [];
            const recordsForDate = currentState.attendanceRecords[dateStr] || {};
            if (recordsForDate._holiday) return [];
            // BUG-12 fix: Track which subjects are already marked (even partially)
            // and count only unmarked slots per subject
            const subjectSlotCounts = {}; // subjectId -> { total, marked }
            dayClasses.forEach(({ subjectId }) => {
                if (!subjectSlotCounts[subjectId]) {
                    subjectSlotCounts[subjectId] = { total: 0, marked: !!recordsForDate[subjectId] };
                }
                subjectSlotCounts[subjectId].total++;
            });
            const unmarked = [];
            const seen = new Set();
            dayClasses.forEach(({ slotId, subjectId }) => {
                if (seen.has(subjectId)) return;
                const slot = currentState.timeSlots.find((s) => s.id === slotId);
                if (!slot) return;
                if (recordsForDate[subjectId]) return; // Already marked
                seen.add(subjectId);
                unmarked.push({
                    subjectId,
                    slotId,
                    startTime: slot.start,
                    endTime: slot.end,
                    units: subjectSlotCounts[subjectId].total || 1,
                });
            });
            return unmarked;
        };

        const shouldMark = (classItem, dateStr) => {
            const autopilotTime = currentState.settings.autopilotTime || '20:00';
            const classEndTime = classItem.endTime;
            const [autopilotHour, autopilotMin] = autopilotTime.split(':').map(Number);
            const [classEndHour, classEndMin] = classEndTime.split(':').map(Number);
            let triggerTime;
            if (classEndHour < autopilotHour || (classEndHour === autopilotHour && classEndMin <= autopilotMin)) {
                triggerTime = autopilotTime;
            } else {
                let triggerHour = classEndHour + 2;
                let triggerMin = classEndMin;
                if (triggerHour >= 24) triggerHour -= 24;
                triggerTime = `${String(triggerHour).padStart(2, '0')}:${String(triggerMin).padStart(2, '0')}`;
            }
            return isPastTime(dateStr, triggerTime, currentState.devDate);
        };

        [yesterdayStr, todayStr].forEach((dateStr) => {
            getUnmarkedForDate(dateStr).forEach((classItem) => {
                if (shouldMark(classItem, dateStr)) {
                    safeDispatch({
                        type: 'MARK_ATTENDANCE',
                        payload: {
                            date: dateStr,
                            subjectId: classItem.subjectId,
                            status: currentState.settings.autopilotDefault,
                            units: classItem.units,
                            autoMarked: true,
                        },
                    });
                    autoMarkedCount++;
                    if (!reviewDate) reviewDate = dateStr;
                }
            });
        });

        if (autoMarkedCount > 0 && reviewDate) {
            if (existingReview?.date !== reviewDate || existingReview?.dismissed) {
                safeDispatch({
                    type: 'SET_AUTOPILOT_REVIEW',
                    payload: { date: reviewDate, count: autoMarkedCount, dismissed: false },
                });
            }
        }
    }, []); // empty deps — always reads from stateRef

    // ─── ERP AUTO-SYNC ────────────────────────────────────────────
    const { isSyncing: isErpSyncing, lastSyncedAt: erpLastSynced, syncError: erpSyncError, triggerSync: triggerErpSync } = useErpAutoSync(state, safeDispatch);

    // Run ERP auto-sync once the app finishes loading and user is authenticated
    useEffect(() => {
        if (!isLoading && state.isAuthenticated && state.settings?.erpConnected) {
            // Small delay so navigation settles before background work starts
            const timer = setTimeout(() => triggerErpSync(), 1000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, state.isAuthenticated, state.settings?.erpConnected]);

    // ──────────────────────────────────────────────────────────────

    return (
        <AppContext.Provider
            value={{
                state,
                dispatch: safeDispatch,
                isLoading,
                userId: state.userId,
                runAutopilotCheck,
                triggerErpSync,
                isErpSyncing,
                erpLastSynced,
                erpSyncError,
                erpSessionExpired: state.erpSessionExpired,
                // ERP sync metadata for UI freshness indicators
                erpSyncStatus:          state.erpSync?.status          || 'idle',
                erpLastGlobalSyncAt:    state.erpSync?.lastGlobalSyncAt || null,
                erpCalendarSyncStatus:  state.erpSync?.calendarSyncStatus || 'idle',
                erpChangedSubjectIds:   state.erpSync?.changedSubjectIds  || [],
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}
