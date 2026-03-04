import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';

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
        notificationEnabled: true,
        notificationTime: '18:00',
        smartAlertsEnabled: true,
    },

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
            const { date, subjectId, status, units, isExtra } = action.payload;
            return {
                ...state,
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [date]: {
                        ...(state.attendanceRecords[date] || {}),
                        [subjectId]: { status, units, ...(isExtra ? { isExtra: true } : {}) },
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

            return {
                ...initialState,
                ...loaded,
                settings: { ...initialState.settings, ...(loaded.settings || {}) },
                timetable: { ...initialState.timetable, ...(loaded.timetable || {}) },
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

    return (
        <AppContext.Provider value={{ state, dispatch, isLoading }}>
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
