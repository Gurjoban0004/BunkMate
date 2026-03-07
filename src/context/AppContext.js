import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { getTodayKey, getNextDay, parseDate, isPastTime, subtractDays, getTodayDayName } from '../utils/dateHelpers';

const AppContext = createContext();

const initialState = {
    setupComplete: false,

    // User Info
    userName: '',

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
            const { date, subjectId } = action.payload;
            const newDayRecord = { ...(state.attendanceRecords[date] || {}) };
            delete newDayRecord[subjectId];
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: newDayRecord,
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
            const today = new Date().toISOString().split('T')[0];
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
            const loaded = action.payload;

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

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isLoading, setIsLoading] = useState(true);

    // Load persisted state on mount
    useEffect(() => {
        const load = async () => {
            try {
                const { loadAppState } = await import('../storage/storage');
                const saved = await loadAppState();
                if (saved && saved.setupComplete !== undefined) {
                    dispatch({ type: 'LOAD_STATE', payload: saved });
                }
            } catch (e) {
                console.error('Failed to load state:', e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // Auto-save state on every change (skip initial load)
    const isFirstRender = React.useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (!isLoading) {
            const save = async () => {
                const { saveAppState } = await import('../storage/storage');
                await saveAppState(state);
            };
            save();
        }
    }, [state, isLoading]);

    // ─── AUTOPILOT LOGIC ──────────────────────────────────────────

    const getUnmarkedClassesForDate = (dateStr) => {
        // Skip days before tracking started
        if (state.trackingStartDate && dateStr < state.trackingStartDate && !state.devDate) return [];

        // Parse the target date properly to get the correct day name (Mon, Tue, etc.)
        const parsedDate = parseDate(dateStr);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[parsedDate.getDay()];

        const dayClasses = state.timetable[dayName] || [];
        const recordsForDate = state.attendanceRecords[dateStr] || {};

        if (recordsForDate._holiday) return []; // Skip holidays

        const unmarked = [];

        dayClasses.forEach(({ slotId, subjectId }) => {
            const slot = state.timeSlots.find((s) => s.id === slotId);
            if (!slot) return;

            if (!recordsForDate[subjectId]) {
                unmarked.push({
                    subjectId,
                    slotId,
                    startTime: slot.start,
                    endTime: slot.end,
                });
            }
        });

        return unmarked;
    };

    const shouldAutoMarkClass = (classItem, dateStr) => {
        const autopilotTime = state.settings.autopilotTime || '20:00';
        const classEndTime = classItem.endTime;

        const [autopilotHour, autopilotMin] = autopilotTime.split(':').map(Number);
        const [classEndHour, classEndMin] = classEndTime.split(':').map(Number);

        let triggerTime;
        if (
            classEndHour < autopilotHour ||
            (classEndHour === autopilotHour && classEndMin <= autopilotMin)
        ) {
            triggerTime = autopilotTime;
        } else {
            let triggerHour = classEndHour + 2;
            let triggerMin = classEndMin;
            if (triggerHour >= 24) triggerHour -= 24;
            triggerTime = `${String(triggerHour).padStart(2, '0')}:${String(triggerMin).padStart(2, '0')}`;
        }

        return isPastTime(dateStr, triggerTime, state.devDate);
    };

    const runAutopilotCheck = () => {
        if (!state.settings.autopilotEnabled) return;

        const nowObj = state.devDate ? new Date(state.devDate) : new Date();
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

        // Pre-check for duplicate review cards
        const existingReview = state.autopilotReview;

        // Check yesterday
        const yesterdayUnmarked = getUnmarkedClassesForDate(yesterdayStr);
        yesterdayUnmarked.forEach((classItem) => {
            if (shouldAutoMarkClass(classItem, yesterdayStr)) {
                dispatch({
                    type: 'MARK_ATTENDANCE',
                    payload: {
                        date: yesterdayStr,
                        subjectId: classItem.subjectId,
                        status: state.settings.autopilotDefault,
                        units: 1, // Assume 1 unit for auto-mark unless calculated differently
                        autoMarked: true,
                    },
                });
                autoMarkedCount++;
                reviewDate = yesterdayStr;
            }
        });

        // Check today
        const todayUnmarked = getUnmarkedClassesForDate(todayStr);
        todayUnmarked.forEach((classItem) => {
            if (shouldAutoMarkClass(classItem, todayStr)) {
                dispatch({
                    type: 'MARK_ATTENDANCE',
                    payload: {
                        date: todayStr,
                        subjectId: classItem.subjectId,
                        status: state.settings.autopilotDefault,
                        units: 1,
                        autoMarked: true,
                    },
                });
                autoMarkedCount++;
                reviewDate = reviewDate || todayStr;
            }
        });

        // If we marked new stuff, create/update review card
        if (autoMarkedCount > 0 && reviewDate) {
            // Check if we already have a review card for this exact date to prevent infinite loop of overriding
            if (existingReview?.date !== reviewDate || existingReview?.dismissed) {
                dispatch({
                    type: 'SET_AUTOPILOT_REVIEW',
                    payload: {
                        date: reviewDate,
                        count: autoMarkedCount,
                        dismissed: false,
                    },
                });
            }
        }
    };

    // ──────────────────────────────────────────────────────────────

    return (
        <AppContext.Provider value={{ state, dispatch, isLoading, runAutopilotCheck }}>
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
