/** Local export before reinstalling a Home Screen app; auth tokens are never included. */
export function downloadAttendanceBackup(state) {
    const keys = ['userName', 'erpRollNumber', 'subjects', 'attendanceRecords', 'holidays', 'trackingStartDate', 'setupDate', 'timetable', 'timeSlots', 'timetableMeta', 'latestErpDate', 'settings'];
    const data = Object.fromEntries(keys.filter((key) => state[key] !== undefined).map((key) => [key, state[key]]));
    const blob = new Blob([JSON.stringify({ app: 'Presence', format: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presence-attendance-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
