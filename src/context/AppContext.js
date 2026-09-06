import React, { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback } from 'react';
import { initNetworkListener, onNetworkStatusChange } from '../utils/firebaseHelpers';
import { loadLocalState, loadCloudState, saveAppState, migrateToFirestore } from '../storage/storage';
import { logger } from '../utils/logger';
import { COLORS as THEME_COLORS } from '../theme/theme';
import { useErpAutoSync } from '../hooks/useErpAutoSync';
import { getErpToken } from '../storage/erpTokenStorage';
import { erpCheckSession } from '../services/erpService';

const AppContext = createContext();

function maxDateKey(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
}

const EMPTY_WEEK = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };

const initialState = {
    setupComplete: false,
    isAuthenticated: false,

    userName: '',
    userId: null,

    timeSlots: [],
    subjects: [],          // { id, name, code, color, target, initialAttended, initialTotal, erpSubjectId } — totals ARE the college's
    timetable: { ...EMPTY_WEEK },

    // "YYYY-MM-DD" → { subjectId: { status, units, attendedUnits, source: 'erp' }, _holiday? }
    // Only the college register lives here. See utils/attendance.js.
    attendanceRecords: {},
    holidays: [],

    settings: {
        dangerThreshold: 75,
        notificationEnabled: true,
        notificationTime: '07:30',
        smartAlertsEnabled: true,
        erpConnected: false,
        lastErpSync: null,
        uiPalette: 'chalkpad',
        isAdmin: false,               // decided by the server at sign-in, never by the client
    },

    notificationState: {},

    setupDate: null,
    trackingStartDate: null,

    erpRollNumber: null,
    devDate: null,

    // The college signed this session out. Nothing is sent until the student
    // taps "Sign in again" — see hooks/useErpAutoSync and components/erp/ReconnectSheet.
    erpSessionExpired: null,      // { reason } | null
    erpReconnectOpen: false,      // transient: the sheet is on screen

    accessRevoked: null,          // { reason } | null — server verdict, never cached
    isOnline: true,

    erpSync: {
        status:             'idle',  // 'idle' | 'syncing' | 'error'
        lastGlobalSyncAt:   null,
        lastSyncAttemptAt:  null,
        syncDuration:       null,
        calendarSyncStatus: 'idle',
        changedSubjectIds:  [],
    },

    latestErpDate: null,

    timetableMeta: {
        source: 'none',          // 'erp' | 'portal-web' | 'register-derived' | 'derived' | 'manual' | 'none'
        fetchedAt: null,
        derivedAt: null,
        erpEndpoint: null,
        isEmpty: false,
        timesAreInferred: false,
        periodDefinitions: [],
    },
};

// Actions that only touch transient UI state. They neither persist nor mark
// the state "dirty" for the cloud-vs-local comparison at startup.
const TRANSIENT_ACTIONS = new Set([
    'ERP_SYNC_STATE', 'SET_ONLINE', 'ERP_RECONNECT_OPEN', 'ERP_RECONNECT_CLOSE',
    'ERP_SESSION_EXPIRED', 'ACCESS_REVOKED', 'SET_DEV_DATE',
]);

/**
 * Keep only what the college register wrote (plus holiday markers). Runs on
 * every load, so every existing install sheds its old manual/predicted marks
 * the first time it opens after this version.
 */
export function keepOnlyErpRecords(records) {
    const out = {};
    for (const [dateKey, day] of Object.entries(records || {})) {
        if (!day || typeof day !== 'object') continue;
        const kept = {};
        for (const [key, rec] of Object.entries(day)) {
            if (key === '_holiday') { if (rec) kept._holiday = true; continue; }
            if (rec && typeof rec === 'object' && rec.source === 'erp') kept[key] = rec;
        }
        if (Object.keys(kept).length > 0) out[dateKey] = kept;
    }
    return out;
}

/**
 * Guess a weekly timetable from register history when the college has not
 * published one: a subject is "on" a weekday if it appears on >30% of that
 * weekday's register days. Times are unknown, so every entry gets 09:00.
 */
function deriveTimetableFromRecords(erpRecords, existingTimeSlots) {
    const DAY_OF_WEEK = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const subjectDayCount = {};
    const dayOccurrences = {};

    for (const [dateKey, dayData] of Object.entries(erpRecords)) {
        const [y, m, d] = dateKey.split('-').map(Number);
        const dayName = DAY_OF_WEEK[new Date(y, m - 1, d, 12).getDay()];
        if (!dayName) continue;
        dayOccurrences[dayName] = (dayOccurrences[dayName] || 0) + 1;
        for (const subjectId of Object.keys(dayData)) {
            if (subjectId === '_holiday') continue;
            subjectDayCount[subjectId] = subjectDayCount[subjectId] || {};
            subjectDayCount[subjectId][dayName] = (subjectDayCount[subjectId][dayName] || 0) + 1;
        }
    }

    const timetable = { ...EMPTY_WEEK };
    Object.keys(timetable).forEach((d) => { timetable[d] = []; });
    const timeSlots = [...(existingTimeSlots || [])];

    for (const [subjectId, dayCounts] of Object.entries(subjectDayCount)) {
        for (const [dayName, count] of Object.entries(dayCounts)) {
            if (count / (dayOccurrences[dayName] || 1) < 0.3) continue;
            const slotId = `erp-slot-${subjectId}-${dayName}`;
            if (!timeSlots.find((ts) => ts.id === slotId)) {
                timeSlots.push({ id: slotId, start: '09:00', end: '10:00', label: dayName });
            }
            if (!timetable[dayName].some((s) => s.subjectId === subjectId)) {
                timetable[dayName].push({ slotId, subjectId });
            }
        }
    }

    const found = Object.values(timetable).some((slots) => slots.length > 0);
    return found ? { timetable, timeSlots } : null;
}

export function appReducer(state, action) {
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
                timetable: { ...state.timetable, [action.payload.day]: action.payload.slots },
                timetableMeta: { ...state.timetableMeta, source: 'manual' },
            };

        case 'ERP_SET_TIMETABLE': {
            const { timetable, timeSlots, fetchedAt, periodDefinitions, timesAreInferred, erpEndpoint } = action.payload;
            return {
                ...state,
                timetable,
                timeSlots,
                timetableMeta: {
                    source: 'erp',
                    fetchedAt,
                    derivedAt: state.timetableMeta?.derivedAt || null,
                    erpEndpoint: erpEndpoint || null,
                    isEmpty: false,
                    timesAreInferred: timesAreInferred || false,
                    periodDefinitions: periodDefinitions || [],
                },
            };
        }

        case 'ERP_TIMETABLE_EMPTY':
            return {
                ...state,
                timetableMeta: { ...state.timetableMeta, fetchedAt: action.payload.fetchedAt, isEmpty: true },
            };

        case 'SET_INITIAL_ATTENDANCE':
            return {
                ...state,
                subjects: state.subjects.map((sub) => {
                    const update = action.payload.find((u) => u.id === sub.id);
                    return update
                        ? { ...sub, initialTotal: update.initialTotal, initialAttended: update.initialAttended }
                        : sub;
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
                    sub.id === action.payload.subjectId ? { ...sub, target: action.payload.target } : sub
                ),
            };

        case 'DELETE_SUBJECT':
        case 'PRUNE_UNMATCHED_EMPTY_ERP_SUBJECTS': {
            const ids = new Set(action.type === 'DELETE_SUBJECT' ? [action.payload] : (action.payload || []));
            if (!ids.size) return state;
            const attendanceRecords = Object.fromEntries(
                Object.entries(state.attendanceRecords).map(([date, dayData]) => {
                    const nextDay = { ...dayData };
                    ids.forEach((id) => delete nextDay[id]);
                    return [date, nextDay];
                })
            );
            const timetable = Object.fromEntries(
                Object.entries(state.timetable).map(([day, slots]) => [day, (slots || []).filter((s) => !ids.has(s.subjectId))])
            );
            return {
                ...state,
                subjects: state.subjects.filter((s) => !ids.has(s.id)),
                attendanceRecords,
                timetable,
            };
        }

        // Holidays are a planning input (the day's classes are not expected),
        // never an attendance mark. They live in both `holidays` and as a
        // `_holiday` marker on the day so calendars can render them.
        case 'MARK_HOLIDAY': {
            const dateKey = action.payload;
            if ((state.holidays || []).includes(dateKey)) return state;
            return {
                ...state,
                holidays: [...(state.holidays || []), dateKey],
                attendanceRecords: {
                    ...state.attendanceRecords,
                    [dateKey]: { ...(state.attendanceRecords[dateKey] || {}), _holiday: true },
                },
            };
        }

        case 'UNDO_HOLIDAY':
        case 'REMOVE_HOLIDAY': {
            const dateKey = action.payload;
            const { _holiday, ...rest } = state.attendanceRecords[dateKey] || {};
            const attendanceRecords = { ...state.attendanceRecords };
            if (Object.keys(rest).length) attendanceRecords[dateKey] = rest;
            else delete attendanceRecords[dateKey];
            return {
                ...state,
                holidays: (state.holidays || []).filter((d) => d !== dateKey),
                attendanceRecords,
            };
        }

        case 'COMPLETE_SETUP':
            return { ...state, setupComplete: true, isAuthenticated: true, ...(action.payload || {}) };

        case 'SET_TRACKING_CONFIG':
            return {
                ...state,
                setupDate: action.payload.setupDate,
                trackingStartDate: action.payload.trackingStartDate,
            };

        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };

        case 'UPDATE_NOTIFICATION_STATE':
            return {
                ...state,
                notificationState: { ...state.notificationState, [action.payload.subjectId]: action.payload.data },
            };

        case 'SET_USER_NAME':
            return { ...state, userName: action.payload };

        // The college's per-subject totals. Applied as-is — including downward
        // corrections, because the college is the truth even when it changes
        // its mind. Partial/failed parses are filtered before dispatch.
        case 'ERP_OVERWRITE_ATTENDANCE': {
            const { updates } = action.payload;
            const now = new Date().toISOString();
            return {
                ...state,
                subjects: state.subjects.map((sub) => {
                    const update = updates.find((u) => u.subjectId === sub.id);
                    if (!update) return sub;
                    return {
                        ...sub,
                        initialAttended: update.newAttended,
                        initialTotal:    update.newTotal,
                        source:          'erp',
                        lastUpdated:     now,
                        ...(update.erpSubjectId && !sub.erpSubjectId ? { erpSubjectId: update.erpSubjectId } : {}),
                    };
                }),
            };
        }

        // The day-by-day register. The college sends the whole semester each
        // time, so when it covers every subject we already had, it REPLACES
        // history (a class the college removed disappears here too). A partial
        // register (fewer subjects than before) only merges, so a truncated
        // page can never wipe months of history.
        case 'ERP_OVERWRITE_CALENDAR': {
            const {
                records: erpRecords = {},
                trackingStartDate: newTrackingStart,
                lastSubjectSyncDates = {},
                erpSubjectIdStamps = {},
                latestErpDate,
            } = action.payload;

            const subjects = state.subjects.map((sub) =>
                erpSubjectIdStamps[sub.id] && !sub.erpSubjectId ? { ...sub, erpSubjectId: erpSubjectIdStamps[sub.id] } : sub
            );

            const subjectsIn = (records) => {
                const ids = new Set();
                Object.values(records).forEach((day) => Object.keys(day || {}).forEach((k) => { if (k !== '_holiday') ids.add(k); }));
                return ids;
            };
            const before = subjectsIn(state.attendanceRecords);
            const after = subjectsIn(erpRecords);
            const coversEverything = [...before].every((id) => after.has(id));

            const nextRecords = {};
            for (const [dateKey, day] of Object.entries(state.attendanceRecords)) {
                if (day?._holiday) nextRecords[dateKey] = { _holiday: true };
                else if (!coversEverything) nextRecords[dateKey] = { ...day };
            }
            for (const [dateKey, dayData] of Object.entries(erpRecords)) {
                nextRecords[dateKey] = { ...(nextRecords[dateKey] || {}), ...dayData };
            }

            // Guess a timetable from history only while there is no real one.
            const timetableIsEmpty = Object.values(state.timetable).every((slots) => !slots || slots.length === 0);
            const source = state.timetableMeta?.source || 'none';
            let timetable = state.timetable;
            let timeSlots = state.timeSlots;
            let timetableMeta = state.timetableMeta || initialState.timetableMeta;
            if ((timetableIsEmpty || source === 'derived' || source === 'none') && source !== 'erp' && source !== 'manual') {
                const derived = deriveTimetableFromRecords(erpRecords, state.timeSlots);
                if (derived) {
                    timetable = derived.timetable;
                    timeSlots = derived.timeSlots;
                    timetableMeta = { ...timetableMeta, source: 'derived', derivedAt: new Date().toISOString() };
                }
            }

            const nextLatestErpDate = maxDateKey(state.latestErpDate, latestErpDate);
            return {
                ...state,
                subjects,
                attendanceRecords: nextRecords,
                timetable,
                timeSlots,
                timetableMeta,
                trackingStartDate: newTrackingStart || state.trackingStartDate,
                latestErpDate: nextLatestErpDate,
                settings: {
                    ...state.settings,
                    lastSubjectSyncDates: { ...(state.settings?.lastSubjectSyncDates || {}), ...lastSubjectSyncDates },
                    latestErpDate: nextLatestErpDate,
                },
            };
        }

        case 'RESET_STATE':
            return { ...initialState };

        case 'LOAD_STATE': {
            const loaded = { ...action.payload };

            if (Array.isArray(loaded.subjects)) {
                loaded.subjects = loaded.subjects.map((sub, i) => {
                    const total = Number(sub.initialTotal);
                    const attended = Number(sub.initialAttended);
                    const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;
                    const safeAttended = Number.isFinite(attended) && attended >= 0 ? Math.min(attended, safeTotal) : 0;
                    const color = THEME_COLORS.subjectPalette.includes(sub.color)
                        ? sub.color
                        : THEME_COLORS.subjectPalette[i % THEME_COLORS.subjectPalette.length];
                    return { ...sub, initialTotal: safeTotal, initialAttended: safeAttended, color };
                });
            }

            const settings = { ...initialState.settings, ...(loaded.settings || {}) };
            if (settings.dangerThreshold === undefined) settings.dangerThreshold = 75;
            // Legacy keys from removed features.
            ['autopilotEnabled', 'autopilotTime', 'autopilotDefault', 'attendanceMode', 'weeklySummaryEnabled']
                .forEach((k) => delete settings[k]);
            // The reminder used to be an evening "mark your attendance" nudge.
            // Now it is the morning plan; carry the old evening time over once.
            if (settings.notificationTime === '18:00') settings.notificationTime = '07:30';

            // Removed state from the manual-marking era.
            ['autopilotReview', 'autopilotDismissed', 'erpReauthSnoozeUntil', 'todayIncludedInSetup', 'erpReconnectOpen']
                .forEach((k) => delete loaded[k]);

            return {
                ...initialState,
                ...loaded,
                settings,
                attendanceRecords: keepOnlyErpRecords(loaded.attendanceRecords),
                timetable: { ...EMPTY_WEEK, ...(loaded.timetable || {}) },
                timetableMeta: { ...initialState.timetableMeta, ...(loaded.timetableMeta || {}) },
                erpSync: { ...initialState.erpSync, lastGlobalSyncAt: loaded.erpSync?.lastGlobalSyncAt || null },
                erpSessionExpired: null,
                erpReconnectOpen: false,
                accessRevoked: null,
                isAuthenticated: !!loaded.userId,
            };
        }

        case 'SET_ERP_ROLL_NUMBER':
            return { ...state, erpRollNumber: action.payload };

        case 'SET_ONLINE':
            return { ...state, isOnline: action.payload };

        case 'SET_DEV_DATE':
            return { ...state, devDate: action.payload };

        case 'SET_USER_ID':
            return { ...state, userId: action.payload };

        case 'SET_AUTHENTICATED':
            return { ...state, isAuthenticated: action.payload };

        case 'ACCESS_REVOKED':
            return { ...state, accessRevoked: { reason: action.payload?.reason || null } };

        case 'ERP_SESSION_EXPIRED':
            return { ...state, erpSessionExpired: { reason: action.payload?.reason || 'expired' } };

        case 'ERP_RECONNECT_OPEN':
            return { ...state, erpReconnectOpen: true };

        case 'ERP_RECONNECT_CLOSE':
            return { ...state, erpReconnectOpen: false };

        case 'ERP_SESSION_RESTORED':
            return { ...state, erpSessionExpired: null, erpReconnectOpen: false };

        case 'ERP_SYNC_STATE':
            return { ...state, erpSync: { ...state.erpSync, ...action.payload } };

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isLoading, setIsLoading] = useState(true);
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const justResetRef = useRef(false);
    const lastActionTypeRef = useRef(null);
    // Set once the student changes anything after boot. The background cloud
    // comparison then leaves local state alone: it is already the newest copy
    // and the save that follows every change pushes it up.
    const dirtyRef = useRef(false);

    const safeDispatch = useCallback((action) => {
        if (action.type === 'RESET_STATE') justResetRef.current = true;
        if (action.type !== 'LOAD_STATE' && !TRANSIENT_ACTIONS.has(action.type)) dirtyRef.current = true;
        lastActionTypeRef.current = action.type;
        dispatch(action);
    }, []);

    // ─── STARTUP ─────────────────────────────────────────────────
    // Paint from local storage immediately. Everything that needs the network
    // (Firebase sign-in, cloud comparison, the college session check) happens
    // after first paint and updates the screen if it has news. This used to be
    // four sequential network calls before the first frame.
    useEffect(() => {
        let cancelled = false;
        const bailout = setTimeout(() => {
            logger.warn('⚠️ Local load exceeded 4s — painting anyway');
            setIsLoading(false);
        }, 4000);

        const boot = async () => {
            let local = null;
            try {
                initNetworkListener();
                local = await loadLocalState();
                if (local && local.userId) safeDispatch({ type: 'LOAD_STATE', payload: local });
            } catch (e) {
                logger.error('❌ Failed to load local state:', e);
            } finally {
                clearTimeout(bailout);
                setIsLoading(false);
            }
            if (!local || !local.userId || cancelled) return;

            // Background: newer copy on another device?
            loadCloudState(local.userId).then((cloud) => {
                if (cancelled || !cloud || dirtyRef.current) return;
                const localTime = local._lastModified ? new Date(local._lastModified).getTime() : 0;
                const cloudTime = cloud._lastModified ? new Date(cloud._lastModified).getTime() : 0;
                if (cloudTime > localTime) {
                    logger.info('🔄', 'Cloud copy is newer — applying');
                    safeDispatch({ type: 'LOAD_STATE', payload: cloud });
                }
            }).catch((e) => logger.warn('⚠️ Cloud check failed:', e.message));

            migrateToFirestore(local).catch((e) => logger.warn('⚠️ Migration failed:', e));

            // Background: is the stored college session still usable / revoked / admin?
            if (local.settings?.erpConnected) {
                try {
                    const token = await getErpToken();
                    if (!token) {
                        safeDispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
                        return;
                    }
                    const result = await erpCheckSession(token);
                    if (cancelled) return;
                    if (!result.valid && result.reason !== 'no_token') {
                        safeDispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
                    } else if (result.valid) {
                        safeDispatch({ type: 'UPDATE_SETTINGS', payload: { isAdmin: !!result.isAdmin } });
                        if (result.revoked) {
                            safeDispatch({ type: 'ACCESS_REVOKED', payload: { reason: result.revoked.reason } });
                        }
                    }
                } catch (e) {
                    logger.warn('⚠️ Session check failed:', e.message);
                }
            }
        };
        boot();

        const unsubscribe = onNetworkStatusChange((isOnline) => {
            safeDispatch({ type: 'SET_ONLINE', payload: isOnline });
        });

        return () => {
            cancelled = true;
            clearTimeout(bailout);
            unsubscribe();
        };
    }, [safeDispatch]);

    // ─── AUTO-SAVE ───────────────────────────────────────────────
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        if (justResetRef.current) { justResetRef.current = false; return; }
        if (TRANSIENT_ACTIONS.has(lastActionTypeRef.current)) return;
        if (!isLoading && state.userId && state.isAuthenticated) saveAppState(state);
    }, [state, isLoading]);

    // ─── COLLEGE SYNC ────────────────────────────────────────────
    const { isSyncing: isErpSyncing, lastSyncedAt: erpLastSynced, syncError: erpSyncError, triggerSync: triggerErpSync } = useErpAutoSync(state, safeDispatch);

    useEffect(() => {
        if (!isLoading && state.isAuthenticated && state.settings?.erpConnected) {
            const timer = setTimeout(() => triggerErpSync(), 800);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isLoading, state.isAuthenticated, state.settings?.erpConnected, triggerErpSync]);

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
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}
