/**
 * Android notifications (expo-notifications, local).
 *
 * Two things, both written from the college's real numbers:
 *   1. The morning plan — one notification per day for the next week, each
 *      saying what is on and what the numbers allow. Re-planned whenever the
 *      numbers or the timetable change (App.js), so it is never stale.
 *   2. Smart alerts — a one-off warning when a subject crosses the goal line,
 *      fired right after a sync.
 *
 * Nothing here asks the student to "mark attendance": the college does that.
 * Web/PWA reminders are server-pushed instead (utils/webPush.js, api/push-send.js).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from './logger';
import { getClassesForDay, getSubjectSkipBudget, roundPct } from './attendance';
import { shortSubjectName } from './subjectName';
import { getDateKey } from './dateHelpers';
import { getSavedSkipPlan } from './planner/combinedSkipPlan';
import { isWithinPlannerWindow } from './planner/semesterWindow';

const CHANNEL_ID = 'daily-plan';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PLAN_DAYS = 7;
let reminderQueue = Promise.resolve();
let smartAlertRun = null;

function updateReminders(update) {
    const next = reminderQueue.then(update);
    reminderQueue = next.catch(() => {});
    return next;
}

function isDailyPlan(notification) {
    return notification.identifier?.startsWith('daily-plan:') || notification.content?.data?.kind === 'daily-plan'
        // Migrate reminders created before stable identifiers were introduced.
        || /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday): (your calendar plan|\d+ classes?)$/.test(notification.content?.title || '');
}

if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

async function ensureChannel() {
    if (Platform.OS !== 'android') return;
    try {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Daily plan',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 120],
            sound: 'default',
        });
    } catch (e) {
        logger.warn('Notification channel setup failed:', e.message);
    }
}

/** Ask for permission. Returns true if granted. */
export async function requestNotificationPermission() {
    if (Platform.OS === 'web') return false;
    // Android 13 needs a notification channel before the permission prompt.
    await ensureChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
    }
    return final === 'granted';
}

/**
 * The one sentence for a day, from the timetable and the college's numbers.
 * @returns {{ title, body } | null}  null when there is nothing to say
 */
export function buildDayPlan(state, date, savedPlan = getSavedSkipPlan(state)) {
    const dayName = DAY_NAMES[date.getDay()];
    const dateKey = getDateKey(date);
    const holidays = state.holidays || [];
    if (!isWithinPlannerWindow(dateKey, state) || holidays.includes(dateKey) || state.attendanceRecords?.[dateKey]?._holiday) return null;
    const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const classes = getClassesForDay(state, dayName).filter((cls) => cls.endTime > clock && state.attendanceRecords?.[dateKey]?.[cls.subjectId]?.status !== 'cancelled');
    if (classes.length === 0) return null;

    if (savedPlan) {
        const planned = savedPlan.weeks.flatMap((week) => week.classes).filter((cls) => cls.dateKey === dateKey && classes.some((upcoming) => upcoming.subjectId === cls.subjectId && upcoming.startTime === cls.startTime));
        // Daily messages must never hide an unsafe choice elsewhere in the plan.
        const unsafe = savedPlan.subjects.some((subject) => subject.unsafeSkips);
        const skipped = planned.filter((cls) => cls.action === 'skip' && !cls.unsafe && !savedPlan.warnings.length && !unsafe);
        const label = (cls) => `${shortSubjectName(cls.subjectName)} (${cls.startTime})`;
        const attend = classes.filter((cls) => !skipped.some((skip) => skip.subjectId === cls.subjectId && skip.startTime === cls.startTime));
        return { title: `${dayName}: your calendar plan`, body: savedPlan.warnings.length
            ? 'Attend your classes. Sync your college records to review skip suggestions.'
            : unsafe ? 'Your skip plan crosses a subject minimum. Attend today and review your calendar.'
            : `${skipped.length ? `Planned skip: ${skipped.map(label).join(', ')}. ` : ''}${attend.length ? `Attend ${attend.map(label).join(', ')}.` : 'Attend the other classes this week.'}` };
    }

    const remaining = new Map();
    const verdicts = classes.map((cls) => {
        const b = getSubjectSkipBudget(cls.subjectId, state);
        if (!remaining.has(cls.subjectId)) remaining.set(cls.subjectId, b?.skipUnits || 0);
        const safe = !!b && b.onTrack && cls.units >= 2 && cls.units % 2 === 0 && remaining.get(cls.subjectId) >= cls.units;
        if (safe) remaining.set(cls.subjectId, remaining.get(cls.subjectId) - cls.units);
        return { name: shortSubjectName(cls.subjectName), safe, pct: b ? roundPct(b.percentage) : null };
    });
    const safe = verdicts.filter((v) => v.safe);
    const attend = verdicts.filter((v) => !v.safe);
    const n = classes.length;
    const title = `${dayName}: ${n} ${n === 1 ? 'class' : 'classes'}`;

    let body;
    if (attend.length === 0) body = `Today: ${safe.map((v) => v.name).join(', ')}. Open the skip calendar to check a plan against your latest records.`;
    else if (safe.length === 0) body = n === 1
        ? `Attend ${attend[0].name}${attend[0].pct != null ? ` (${attend[0].pct}%)` : ''}.`
        : `Attend everything: ${attend.map((v) => v.name).join(', ')}.`;
    else body = `Attend ${attend.map((v) => v.name).join(', ')}. Check the skip calendar before missing ${safe.map((v) => v.name).join(', ')}.`;

    return { title, body };
}

/**
 * Replace the next week's morning plan by stable ID, then remove obsolete days.
 * Returns the number scheduled, or null without permission.
 */
export function syncDailyPlanNotifications(state) {
    return updateReminders(() => scheduleDailyPlans(state));
}

async function scheduleDailyPlans(state) {
    if (Platform.OS === 'web') return null;
    if (state.settings?.notificationEnabled === false) {
        await cancelDailyPlans();
        return 0;
    }
    // Permission prompts belong to the Settings action, never an automatic sync.
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return null;
    await ensureChannel();
    const previous = await Notifications.getAllScheduledNotificationsAsync();

    const time = String(state.settings?.notificationTime || '07:30');
    const [hour, minute] = (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '07:30').split(':').map(Number);
    const now = new Date();
    const savedPlan = getSavedSkipPlan({ ...state, devDate: now.toISOString() });
    const requests = [];

    for (let i = 0; i < PLAN_DAYS; i++) {
        const day = new Date(now);
        day.setDate(now.getDate() + i);
        day.setHours(hour, minute, 0, 0);
        if (day <= now) continue; // this morning already passed
        const plan = buildDayPlan(state, day, savedPlan);
        if (!plan) continue;
        requests.push({
            identifier: `daily-plan:${getDateKey(day)}`,
            content: { title: plan.title, body: plan.body, sound: 'default', data: { kind: 'daily-plan', date: getDateKey(day), screen: 'SkipPlan' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: day, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
        });
    }
    // Replace by identifier first; a scheduling failure retains the old reminders.
    for (const request of requests) await Notifications.scheduleNotificationAsync(request);
    const desired = new Set(requests.map((request) => request.identifier));
    for (const reminder of previous) {
        if (isDailyPlan(reminder) && !desired.has(reminder.identifier)) await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }
    return requests.length;
}

/** Cancel morning reminders without affecting goal alerts or other notifications. */
export function cancelAllReminders() {
    return updateReminders(cancelDailyPlans);
}

async function cancelDailyPlans() {
    if (Platform.OS === 'web') return;
    const reminders = await Notifications.getAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
        if (isDailyPlan(reminder)) await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }
}

export async function getScheduledReminders() {
    if (Platform.OS === 'web') return [];
    return Notifications.getAllScheduledNotificationsAsync();
}

// ─── Smart alerts ─────────────────────────────────────────────────────

/**
 * After a sync: warn once when a subject has dropped below its goal, or sits
 * within 2% of it. A near-goal warning can escalate below target the same day;
 * flags reset once the subject has recovered above the warning band.
 */
export function checkSmartAlerts(state, dispatch, getSubjectAttendance) {
    if (smartAlertRun) return smartAlertRun;
    smartAlertRun = sendSmartAlerts(state, dispatch, getSubjectAttendance).finally(() => { smartAlertRun = null; });
    return smartAlertRun;
}

async function sendSmartAlerts(state, dispatch, getSubjectAttendance) {
    if (Platform.OS === 'web' || !state.settings?.smartAlertsEnabled) return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    await ensureChannel();

    const today = getDateKey(new Date());
    let failure = null;
    for (const subject of state.subjects || []) {
        const stats = getSubjectAttendance(subject.id, state);
        if (!stats || stats.totalUnits === 0) continue;

        const target = subject.target ?? state.settings?.dangerThreshold ?? 75;
        const pct = stats.percentage;
        const nState = state.notificationState?.[subject.id] || {};

        let title = null;
        let body = null;
        let patch = null;

        if (pct < target && !nState.belowThresholdNotified && nState.lastBelowNotifiedDate !== today) {
            const budget = getSubjectSkipBudget(subject.id, state);
            title = `${shortSubjectName(subject.name)} is below ${target}%`;
            body = Number.isFinite(budget?.needClasses) && budget.needClasses > 0
                ? `You're at ${roundPct(pct)}%. Attend the next ${budget.needClasses} ${budget.needClasses === 1 ? 'class' : 'classes'} to get back.`
                : `You're at ${roundPct(pct)}%.`;
            patch = { ...nState, belowThresholdNotified: true, lastNotifiedDate: today, lastBelowNotifiedDate: today };
        } else if (pct >= target && pct < target + 2 && !nState.dangerZoneNotified && nState.lastNotifiedDate !== today) {
            title = `${shortSubjectName(subject.name)} is on the line`;
            body = `You're at ${roundPct(pct)}%, close to your ${target}% minimum. Check your plan before skipping.`;
            patch = { ...nState, dangerZoneNotified: true, lastNotifiedDate: today };
        } else if (pct >= target + 2 && (nState.belowThresholdNotified || nState.dangerZoneNotified)) {
            patch = { ...nState, belowThresholdNotified: false, dangerZoneNotified: false };
        }

        if (title) {
            try {
                await Notifications.scheduleNotificationAsync({
                    identifier: `goal-alert:${subject.id}:${today}:${pct < target ? 'below' : 'near'}`,
                    content: { title, body, sound: 'default', data: { kind: 'goal-alert', subjectId: subject.id, screen: 'SubjectDetail' } },
                    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
                });
            } catch (error) {
                failure = failure || error;
                continue;
            }
        }
        if (patch) dispatch({ type: 'UPDATE_NOTIFICATION_STATE', payload: { subjectId: subject.id, data: patch } });
    }
    if (failure) throw failure;
}
