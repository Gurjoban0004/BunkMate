import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Request permission for local notifications.
 * Returns true if granted.
 */
export async function requestNotificationPermission() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

/**
 * Schedule a daily attendance reminder at the given time.
 * @param {string} time24 - Time in "HH:MM" format (e.g. "18:00")
 * @returns {string|null} notification identifier, or null if failed
 */
export async function scheduleDailyReminder(time24 = '18:00') {
    await cancelAllReminders();

    const granted = await requestNotificationPermission();
    if (!granted) {
        console.warn('Notification permission not granted');
        return null;
    }

    const [hours, minutes] = time24.split(':').map(Number);

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Presence Reminder',
            body: "Don't forget to mark today's attendance!",
            sound: true,
        },
        trigger: {
            type: 'daily',
            hour: hours,
            minute: minutes,
        },
    });

    return id;
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all currently scheduled notifications (for debugging).
 */
export async function getScheduledReminders() {
    return await Notifications.getAllScheduledNotificationsAsync();
}

// ========== SMART WARNING NOTIFICATIONS ==========

/**
 * Check attendance thresholds and send warning notifications.
 * Called after marking attendance.
 *
 * @param {object} state - full app state
 * @param {function} dispatch - dispatch function
 * @param {function} getSubjectAttendance - the attendance calculator
 */
export async function checkSmartAlerts(state, dispatch, getSubjectAttendance) {
    if (!state.settings?.smartAlertsEnabled) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    for (const subject of state.subjects) {
        const stats = getSubjectAttendance(subject.id, state);
        if (!stats || stats.totalUnits === 0) continue;

        const pct = stats.percentage;
        const nState = state.notificationState?.[subject.id] || {};
        const today = new Date().toISOString().split('T')[0];

        // Skip if already notified today
        if (nState.lastNotifiedDate === today) continue;

        let shouldNotify = false;
        let title = '';
        let body = '';

        if (pct < 75 && !nState.belowThresholdNotified) {
            // Below 75% warning
            shouldNotify = true;
            title = `${subject.name} below 75%!`;
            body = `Your attendance is at ${pct}%. Attend more classes to recover!`;
            dispatch({
                type: 'UPDATE_NOTIFICATION_STATE',
                payload: {
                    subjectId: subject.id,
                    data: { ...nState, belowThresholdNotified: true, lastNotifiedDate: today },
                },
            });
        } else if (pct >= 75 && pct <= 77 && !nState.dangerZoneNotified) {
            // Danger zone warning (close to dropping below 75%)
            shouldNotify = true;
            title = `😰 ${subject.name} in danger zone!`;
            body = `Your attendance is at ${pct}%. One bunk could drop you below 75%!`;
            dispatch({
                type: 'UPDATE_NOTIFICATION_STATE',
                payload: {
                    subjectId: subject.id,
                    data: { ...nState, dangerZoneNotified: true, lastNotifiedDate: today },
                },
            });
        }

        // Reset flags when attendance recovers above thresholds
        if (pct >= 80 && (nState.belowThresholdNotified || nState.dangerZoneNotified)) {
            dispatch({
                type: 'UPDATE_NOTIFICATION_STATE',
                payload: {
                    subjectId: subject.id,
                    data: { belowThresholdNotified: false, dangerZoneNotified: false, lastNotifiedDate: null },
                },
            });
        }

        if (shouldNotify) {
            await Notifications.scheduleNotificationAsync({
                content: { title, body, sound: true },
                trigger: null, // Send immediately
            });
        }
    }
}
