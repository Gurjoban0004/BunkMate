import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { getTodayKey, getNextDay, parseDate, isPastTime, subtractDays, getTodayDayName } from '../utils/dateHelpers';
import { initNetworkListener, getUserId, onNetworkStatusChange } from '../utils/firebaseHelpers';
import { loadAppState, saveAppState, migrateToFirestore } from '../storage/storage';
import { logger } from '../utils/logger';

const AppContext = createContext();

const initialState = {
    setupComplete: false,

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
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...(state.attendanceRecords[date] || {}),
                        [subjectId]: {
                            status,
                            units: units || 1,
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
            return { ...state, setupComplete: true, ...(action.payload || {}) };

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

        case 'RESYNC_ATTENDANCE': {
            // Portal re-sync: update initial values and clear tracked records for each subject
            const { updates } = action.payload;
            const updatedSubjectIds = new Set(updates.map(u => u.subjectId));
            const today = new Date().toISOString().split('T')[0];

            // Clear attendance records for synced subjects
            const cleanedRecords = { ...state.attendanceRecords };
            Object.keys(cleanedRecords).forEach(dateKey => {
                const dayRecord = { ...cleanedRecords[dateKey] };
                updatedSubjectIds.forEach(sid => {
                    delete dayRecord[sid];
                });
                cleanedRecords[dateKey] = dayRecord;
            });

            return {
                ...state,
                subjects: state.subjects.map(sub => {
                    const update = updates.find(u => u.subjectId === sub.id);
                    if (update) {
                        return {
                            ...sub,
                            initialAttended: update.newAttended,
                            initialTotal: update.newTotal,
                        };
                    }
                    return sub;
                }),
                attendanceRecords: cleanedRecords,
                trackingStartDate: today,
            };
        }

        case 'RESET_STATE':
            return { ...initialState };

        case 'LOAD_STATE': {
            // Never mutate action.payload — work on a shallow copy
            const loaded = { ...action.payload };

            // Migrate old hardcoded colors to the new theme palette
            if (loaded.subjects && loaded.subjects.length > 0) {
                const { COLORS } = require('../theme/theme');
                loaded.subjects = loaded.subjects.map((sub, i) => {
                    if (!COLORS.subjectPalette.includes(sub.color)) {
                        return { ...sub, color: COLORS.subjectPalette[i % COLORS.subjectPalette.length] };
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

            return {
                ...initialState,
                ...loaded,
                settings,
                timetable: { ...initialState.timetable, ...(loaded.timetable || {}) },
                autopilotReview: loaded.autopilotReview !== undefined ? loaded.autopilotReview : null,
                autopilotDiscoveryDismissed: loaded.autopilotDiscoveryDismissed !== undefined ? loaded.autopilotDiscoveryDismissed : false,
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

    // Wrap dispatch to intercept RESET_STATE
    const safeDispatch = React.useCallback((action) => {
        if (action.type === 'RESET_STATE') {
            justResetRef.current = true;
        }
        dispatch(action);
    }, []);

    // ─── INITIALIZATION ──────────────────────────────────────────

    useEffect(() => {
        const initialize = async () => {
            try {
                logger.info('🚀', 'Initializing app context...');
                
                // 1. Setup network listener
                initNetworkListener();

                // 2. Get/create userId
                const uid = await getUserId();
                safeDispatch({ type: 'SET_USER_ID', payload: uid });

                // 3. Load state from hybrid storage
                const saved = await loadAppState();
                if (saved && saved.setupComplete !== undefined) {
                    safeDispatch({ type: 'LOAD_STATE', payload: saved });
                    
                    // 4. Migrate to Firestore if needed
                    await migrateToFirestore(saved);
                }
                
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
            if (isOnline) {
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
        if (!isLoading && state.userId) {
            saveAppState(state);
        }
    }, [state, isLoading]);

    // ─── AUTOPILOT LOGIC ──────────────────────────────────────────

    const runAutopilotCheck = useCallback(() => {
        // Always read from ref to avoid stale closure
        const currentState = stateRef.current;
        if (!currentState.settings.autopilotEnabled) return;

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
            const unmarked = [];
            dayClasses.forEach(({ slotId, subjectId }) => {
                const slot = currentState.timeSlots.find((s) => s.id === slotId);
                if (!slot) return;
                if (!recordsForDate[subjectId]) {
                    // Count consecutive slots for this subject to get real units
                    const daySlots = dayClasses.filter(s => s.subjectId === subjectId);
                    unmarked.push({
                        subjectId,
                        slotId,
                        startTime: slot.start,
                        endTime: slot.end,
                        units: daySlots.length || 1,
                    });
                }
            });
            // Deduplicate by subjectId (multiple slots same subject = 1 entry with correct units)
            const seen = new Set();
            return unmarked.filter(c => {
                if (seen.has(c.subjectId)) return false;
                seen.add(c.subjectId);
                return true;
            });
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

    // ──────────────────────────────────────────────────────────────

    return (
        <AppContext.Provider
            value={{
                state,
                dispatch: safeDispatch,
                isLoading,
                userId: state.userId,
                runAutopilotCheck,
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
