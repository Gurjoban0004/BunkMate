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

const CHANNEL_ID = 'daily-plan';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PLAN_DAYS = 7;

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
export function buildDayPlan(state, date) {
    const dayName = DAY_NAMES[date.getDay()];
    const holidays = state.holidays || [];
    if (holidays.includes(getDateKey(date))) return null;
    const classes = getClassesForDay(state, dayName);
    if (classes.length === 0) return null;

    const verdicts = classes.map((cls) => {
        const b = getSubjectSkipBudget(cls.subjectId, state);
        const safe = !!b && b.onTrack && b.skipUnits >= cls.units;
        return { name: shortSubjectName(cls.subjectName), safe, pct: b ? roundPct(b.percentage) : null };
    });
    const safe = verdicts.filter((v) => v.safe);
    const attend = verdicts.filter((v) => !v.safe);
    const n = classes.length;
    const title = `${dayName}: ${n} ${n === 1 ? 'class' : 'classes'}`;

    let body;
    if (attend.length === 0) body = n === 1 ? `${safe[0].name} is safe to skip if you need the morning.` : 'Every class today is safe to skip — your call.';
    else if (safe.length === 0) body = n === 1
        ? `Attend ${attend[0].name}${attend[0].pct != null ? ` (${attend[0].pct}%)` : ''}.`
        : `Attend everything: ${attend.map((v) => v.name).join(', ')}.`;
    else body = `Skip ${safe.map((v) => v.name).join(', ')} if you must. Attend ${attend.map((v) => v.name).join(', ')}.`;

    return { title, body };
}

/**
 * (Re)schedule the morning plan for the next 7 days. Idempotent: clears the
 * previous plan first. Returns the number scheduled, or null without permission.
 */
export async function syncDailyPlanNotifications(state) {
    if (Platform.OS === 'web') return null;
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    await ensureChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hour, minute] = String(state.settings?.notificationTime || '07:30').split(':').map(Number);
    const now = new Date();
    let scheduled = 0;

    for (let i = 0; i < PLAN_DAYS; i++) {
        const day = new Date(now);
        day.setDate(now.getDate() + i);
        day.setHours(hour, minute, 0, 0);
        if (day <= now) continue; // this morning already passed
        const plan = buildDayPlan(state, day);
        if (!plan) continue;
        await Notifications.scheduleNotificationAsync({
            content: { title: plan.title, body: plan.body, sound: 'default', ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: day },
        });
        scheduled++;
    }
    return scheduled;
}

/** Cancel everything scheduled. */
export async function cancelAllReminders() {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledReminders() {
    return Notifications.getAllScheduledNotificationsAsync();
}

// ─── Smart alerts ─────────────────────────────────────────────────────

/**
 * After a sync: warn once when a subject has dropped below its goal, or sits
 * within 2% of it. Once per subject per day; flags reset when it recovers.
 */
export async function checkSmartAlerts(state, dispatch, getSubjectAttendance) {
    if (Platform.OS === 'web' || !state.settings?.smartAlertsEnabled) return;
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await ensureChannel();

    const today = new Date().toISOString().split('T')[0];
    for (const subject of state.subjects || []) {
        const stats = getSubjectAttendance(subject.id, state);
        if (!stats || stats.totalUnits === 0) continue;

        const target = subject.target || state.settings?.dangerThreshold || 75;
        const pct = stats.percentage;
        const nState = state.notificationState?.[subject.id] || {};
        if (nState.lastNotifiedDate === today) continue;

        let title = null;
        let body = null;
        let patch = null;

        if (pct < target && !nState.belowThresholdNotified) {
            const budget = getSubjectSkipBudget(subject.id, state);
            title = `${shortSubjectName(subject.name)} is below ${target}%`;
            body = Number.isFinite(budget?.needClasses) && budget.needClasses > 0
                ? `You're at ${roundPct(pct)}%. Attend the next ${budget.needClasses} ${budget.needClasses === 1 ? 'class' : 'classes'} to get back.`
                : `You're at ${roundPct(pct)}%.`;
            patch = { ...nState, belowThresholdNotified: true, lastNotifiedDate: today };
        } else if (pct >= target && pct < target + 2 && !nState.dangerZoneNotified) {
            title = `${shortSubjectName(subject.name)} is on the line`;
            body = `You're at ${roundPct(pct)}%. One more miss puts you under ${target}%.`;
            patch = { ...nState, dangerZoneNotified: true, lastNotifiedDate: today };
        } else if (pct >= target + 5 && (nState.belowThresholdNotified || nState.dangerZoneNotified)) {
            patch = { ...nState, belowThresholdNotified: false, dangerZoneNotified: false };
        }

        if (patch) dispatch({ type: 'UPDATE_NOTIFICATION_STATE', payload: { subjectId: subject.id, data: patch } });
        if (title) {
            await Notifications.scheduleNotificationAsync({
                content: { title, body, sound: 'default', ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
                trigger: null,
            });
        }
    }
}
