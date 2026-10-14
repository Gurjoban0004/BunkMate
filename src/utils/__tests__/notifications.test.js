import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { buildDayPlan, requestNotificationPermission, syncDailyPlanNotifications, checkSmartAlerts } from '../notifications';
import { getSavedSkipPlan } from '../planner/combinedSkipPlan';
import { getSubjectAttendance } from '../attendance';

const state = () => ({
    subjects: [{ id: 'a', name: 'Algorithms', initialAttended: 94, initialTotal: 100, target: 75 }],
    timeSlots: [{ id: '1', start: '09:00', end: '10:00' }, { id: '2', start: '10:00', end: '11:00' }],
    timetable: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => [day, [{ subjectId: 'a', slotId: '1' }, { subjectId: 'a', slotId: '2' }]])),
    attendanceRecords: {}, holidays: [], latestErpDate: '2026-10-11', devDate: '2026-10-12T07:00:00',
    settings: { skipPlan: { pairsPerWeek: 2, weeks: 4, skipIds: null }, notificationTime: '07:30', smartAlertsEnabled: true },
});

let originalPlatform;
beforeEach(() => {
    originalPlatform = Platform.OS; Platform.OS = 'android';
    jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-10-12T07:00:00'));
});
afterEach(() => { Platform.OS = originalPlatform; jest.useRealTimers(); });

test('creates the Android channel before requesting notification permission', async () => {
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    expect(await requestNotificationPermission()).toBe(true);
    expect(Notifications.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(Notifications.requestPermissionsAsync.mock.invocationCallOrder[0]);
});

test('schedules on the correct Android channel, follows the calendar, and preserves records', async () => {
    const input = state(), original = JSON.stringify(input);
    expect(await syncDailyPlanNotifications(input)).toBe(5);
    const calls = Notifications.scheduleNotificationAsync.mock.calls.map(([value]) => value);
    calls.forEach((value) => {
        expect(value.trigger.channelId).toBe('daily-plan');
        expect(value.content.channelId).toBeUndefined();
        expect(value.trigger.date > new Date()).toBe(true);
    });
    const plan = getSavedSkipPlan(input);
    const skippedDays = plan.weeks[0].classes.filter((cls) => cls.action === 'skip').map((cls) => cls.dateKey);
    expect(calls.filter((value) => value.content.body.includes('Planned skip:')).length).toBe(skippedDays.length);
    expect(JSON.stringify(input)).toBe(original);
});

test('denied permission prevents scheduling and retains the existing schedule', async () => {
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await syncDailyPlanNotifications(state())).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
});

test('unsafe manual skips and stale data produce attend guidance', () => {
    const input = state(); input.subjects[0].initialAttended = 75;
    input.settings.skipPlan.skipIds = [getSavedSkipPlan(input).weeks[0].classes[0].id];
    expect(buildDayPlan(input, new Date(input.devDate)).body).toContain('Attend Algorithms');
    expect(buildDayPlan(input, new Date(input.devDate)).body).not.toContain('Planned skip:');
    input.latestErpDate = '2026-08-01';
    expect(buildDayPlan(input, new Date(input.devDate)).body).toContain('Sync your college records');
});

test('skips holiday and cancelled classes, and repairs an invalid reminder time', async () => {
    const input = state(); input.holidays = ['2026-10-12']; input.attendanceRecords['2026-10-13'] = { a: { status: 'cancelled' } };
    input.settings.notificationTime = '99:99';
    expect(await syncDailyPlanNotifications(input)).toBe(3);
    Notifications.scheduleNotificationAsync.mock.calls.forEach(([value]) => { expect(value.trigger.date.getHours()).toBe(7); expect(value.trigger.date.getMinutes()).toBe(30); });
});

test('only marks a goal alert delivered after scheduling succeeds', async () => {
    const input = state(), dispatch = jest.fn(); input.subjects[0].initialAttended = 70;
    Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Scheduling failed'));
    await expect(checkSmartAlerts(input, dispatch, getSubjectAttendance)).rejects.toThrow('Scheduling failed');
    expect(dispatch).not.toHaveBeenCalled();
    await checkSmartAlerts(input, dispatch, getSubjectAttendance);
    expect(Notifications.scheduleNotificationAsync.mock.calls[1][0].trigger).toEqual({ channelId: 'daily-plan' });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_NOTIFICATION_STATE' }));
});
