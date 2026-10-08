import { downloadAttendanceBackup } from '../attendanceBackup.web';

test('backup downloads existing records and settings without credentials or mutating state', () => {
    jest.useFakeTimers();
    const originalBlob = global.Blob;
    global.Blob = class { constructor(parts) { this.payload = JSON.parse(parts[0]); } };
    const create = jest.fn(() => 'blob:local-backup');
    const revoke = jest.fn();
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    const originalDocument = global.document;
    const link = { click: jest.fn(), remove: jest.fn() };
    global.document = { createElement: jest.fn(() => link), body: { appendChild: jest.fn() } };
    const state = { subjects: [{ id: 'math', initialAttended: 4, initialTotal: 6 }], attendanceRecords: { '2026-10-08': { math: { status: 'present', units: 2 } } }, settings: { dangerThreshold: 80 }, token: 'private-session', persistentToken: 'private-credentials' };
    const before = JSON.stringify(state);
    try {
        downloadAttendanceBackup(state);
        expect(create.mock.calls[0][0].payload.data).toEqual({ subjects: state.subjects, attendanceRecords: state.attendanceRecords, settings: state.settings });
        expect(JSON.stringify(state)).toBe(before);
        expect(link.click).toHaveBeenCalledTimes(1);
        expect(link.download).toMatch(/^presence-attendance-\d{4}-\d{2}-\d{2}\.json$/);
        jest.runAllTimers();
        expect(revoke).toHaveBeenCalledWith('blob:local-backup');
    } finally { global.document = originalDocument; global.Blob = originalBlob; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; jest.useRealTimers(); }
});
