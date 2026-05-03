import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { getTodayKey } from '../utils/dateHelpers';
import { getUnmarkedClasses } from '../utils/backlog';
import { initNetworkListener, onNetworkStatusChange } from '../utils/firebaseHelpers';
import { loadAppState, saveAppState, migrateToFirestore } from '../storage/storage';
import { logger } from '../utils/logger';
import { COLORS as THEME_COLORS } from '../theme/theme';
import { useErpAutoSync } from '../hooks/useErpAutoSync';
import { getErpToken } from '../storage/erpTokenStorage';
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
        erpConnected: false,
        lastErpSync: null,
    },

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

    // Latest date for which ERP register data exists — drives CalendarView auto-jump
    latestErpDate: null,
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
            const existingRecord = state.attendanceRecords[date]?.[subjectId];
            const wasAutoPrediction = existingRecord?.autoMarked && !autoMarked;

            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...(state.attendanceRecords[date] || {}),
                        [subjectId]: {
                            status,
                            units: units || 1,
                            source: autoMarked ? 'prediction' : 'manual',
                            ...(isExtra ? { isExtra: true } : {}),
                            ...(autoMarked ? { autoMarked: true } : {}),
                        },
                    },
                },
                // If user manually overwrites an autopilot prediction, dismiss the slot
                ...(wasAutoPrediction ? {
                    autopilotDismissed: {
                        ...(state.autopilotDismissed || {}),
                        [`${date}:${subjectId}`]: true,
                    },
                } : {}),
            };
        }

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

        case 'DISMISS_AUTOPILOT_REVIEW':
            return {
                ...state,
                autopilotReview: state.autopilotReview
                    ? { ...state.autopilotReview, dismissed: true }
                    : null,
            };

        case 'SET_AUTOPILOT_REVIEW':
            return {
                ...state,
                autopilotReview: action.payload,
            };

        case 'REMOVE_ATTENDANCE': {
            const { date: removeDate, subjectId: removeSubjectId } = action.payload;
            const removedRecord = state.attendanceRecords[removeDate]?.[removeSubjectId];
            const wasPrediction = removedRecord?.autoMarked;
            const newDayRecord = { ...(state.attendanceRecords[removeDate] || {}) };
            delete newDayRecord[removeSubjectId];
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [removeDate]: newDayRecord,
                },
                // If user removes an autopilot prediction, dismiss the slot
                ...(wasPrediction ? {
                    autopilotDismissed: {
                        ...(state.autopilotDismissed || {}),
                        [`${removeDate}:${removeSubjectId}`]: true,
                    },
                } : {}),
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
            // ERP calendar correctly replaces attendance records where ERP has data.
            // Holidays are preserved.
            const { records: erpRecords, trackingStartDate: newTrackingStart, lastSubjectSyncDates, erpSubjectIdStamps = {}, latestErpDate } = action.payload;

            const nextRecords = { ...state.attendanceRecords };

            // Stamp numeric portal ID onto subjects
            const nextSubjects = state.subjects.map(sub => {
                if (erpSubjectIdStamps[sub.id] && !sub.erpSubjectId) {
                    return { ...sub, erpSubjectId: erpSubjectIdStamps[sub.id] };
                }
                return sub;
            });

            // Merge ERP records into state
            for (const [dateKey, dayData] of Object.entries(erpRecords)) {
                if (!nextRecords[dateKey]) nextRecords[dateKey] = {};
                
                for (const [subjectId, erpInfo] of Object.entries(dayData)) {
                    nextRecords[dateKey][subjectId] = { ...erpInfo }; // status, units, source: 'erp'
                }
            }

            // Garbage Collection: Delete old invalid predictions (Cancelled/skipped classes)
            const newLastSyncDates = {
                ...(state.settings?.lastSubjectSyncDates || {}),
                ...lastSubjectSyncDates
            };

            for (const [dateKey, dayData] of Object.entries(nextRecords)) {
                let modified = false;
                const newDayData = { ...dayData };
                
                for (const [subjectId, record] of Object.entries(newDayData)) {
                    if (record.source === 'prediction') {
                        const syncDateForSubject = newLastSyncDates[subjectId];
                        // If the prediction date is older than or equal to the last sync date,
                        // and it wasn't overwritten by ERP above, it means the class was cancelled/skipped.
                        // We must delete it.
                        if (syncDateForSubject && dateKey <= syncDateForSubject) {
                            delete newDayData[subjectId];
                            modified = true;
                        }
                    }
                }
                if (modified) {
                    nextRecords[dateKey] = newDayData;
                }
            }

            return {
                ...state,
                subjects: nextSubjects,
                attendanceRecords: nextRecords,
                trackingStartDate: newTrackingStart || state.trackingStartDate,
                latestErpDate: latestErpDate || state.latestErpDate,
                settings: {
                    ...state.settings,
                    lastSubjectSyncDates: newLastSyncDates
                }
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

            // Merge settings with defaults
            const settings = { ...initialState.settings, ...(loaded.settings || {}) };
            if (settings.dangerThreshold === undefined) settings.dangerThreshold = 75;
            // Clean out legacy autopilot/mode settings that may exist in saved state
            delete settings.autopilotEnabled;
            delete settings.autopilotTime;
            delete settings.autopilotDefault;
            delete settings.attendanceMode;

            return {
                ...initialState,
                ...loaded,
                settings,
                timetable: { ...initialState.timetable, ...(loaded.timetable || {}) },
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

                    // ── ERP local session check ──────────────────
                    // Never contact ERP login on startup; data sync validates the session.
                    if (saved.settings?.erpConnected) {
                        const erpToken = await getErpToken();
                        if (erpToken) {
                            try {
                                const result = await erpCheckSession(erpToken);
                                if (!result.valid && result.reason !== 'no_token') {
                                    safeDispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
                                }
                            } catch (e) {
                                logger.warn('⚠️ ERP session check failed:', e.message);
                            }
                        } else {
                            safeDispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
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

    // ─── AUTOPILOT LOGIC ──────────────────────────────────────────
    const runAutopilotCheck = React.useCallback(() => {
        const currentState = stateRef.current;
        if (!currentState.settings?.erpConnected || !currentState.isAuthenticated) return;

        // getUnmarkedClasses returns an array of unmarked classes up to "now" (or devDate)
        const unmarkedClasses = getUnmarkedClasses(currentState, false);
        if (!unmarkedClasses || unmarkedClasses.length === 0) return;

        const lastSyncDates = currentState.settings?.lastSubjectSyncDates || {};
        const dismissed = currentState.autopilotDismissed || {};

        let autoMarkedCount = 0;
        let reviewDate = null;

        unmarkedClasses.forEach((classItem) => {
            // ── PING-PONG GUARD ──────────────────────────────────
            // If the ERP has already synced past this date for this subject,
            // the teacher confirmed this class didn't happen. Do NOT predict it.
            const syncDate = lastSyncDates[classItem.subjectId];
            if (syncDate && classItem.date <= syncDate) return;

            // ── IDEMPOTENCY GUARD ────────────────────────────────
            // If the user previously dismissed/corrected this prediction,
            // do not resurrect it.
            const dismissKey = `${classItem.date}:${classItem.subjectId}`;
            if (dismissed[dismissKey]) return;

            safeDispatch({
                type: 'MARK_ATTENDANCE',
                payload: {
                    date: classItem.date,
                    subjectId: classItem.subjectId,
                    status: 'present',
                    units: classItem.units,
                    autoMarked: true,
                },
            });
            autoMarkedCount++;
            if (!reviewDate || classItem.date > reviewDate) {
                reviewDate = classItem.date;
            }
        });

        if (autoMarkedCount > 0 && reviewDate) {
            const existingReview = currentState.autopilotReview;
            if (existingReview?.date !== reviewDate || existingReview?.dismissed) {
                safeDispatch({
                    type: 'SET_AUTOPILOT_REVIEW',
                    payload: { date: reviewDate, count: autoMarkedCount, dismissed: false },
                });
            }
        }
    }, [safeDispatch]);

    // Run Autopilot check on startup and after ERP sync finishes
    useEffect(() => {
        if (!isLoading && state.isAuthenticated && state.settings?.erpConnected) {
            // run after a small delay to let state settle
            const timer = setTimeout(() => runAutopilotCheck(), 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, state.isAuthenticated, state.settings?.erpConnected, erpLastSynced, state.devDate, runAutopilotCheck]);

    // ──────────────────────────────────────────────────────────────

    return (
        <AppContext.Provider
            value={{
                state,
                dispatch: safeDispatch,
                isLoading,
                userId: state.userId,

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
