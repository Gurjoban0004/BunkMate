jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), signInWithCustomToken: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
import { appReducer } from '../../context/AppContext';
import { activateG4Timetable, suppliedG4Timetable } from '../cohortTimetable';
import { getClassesForDay } from '../attendance';
const base = () => ({ subjects: ['ADI', 'System Design', 'AIML', 'BEE-II', 'NALR-I'].map((name, i) => ({ id: String(i), name, initialAttended: 40, initialTotal: 50 })), timetable: {}, timeSlots: [], settings: {}, attendanceRecords: { '2026-10-12': { 0: { source: 'erp', status: 'present', units: 2 } } }, timetableMeta: { source: 'derived' } });
const cohort = { branch: 'CSE', semester: 5, group: 'G4' };
test('only confirmed CSE semester 5 G4 receives all 15 full pairs and no attendance changes', () => {
    const state = base(), before = JSON.stringify(state);
    for (const wrong of [{ ...cohort, group: 'G3' }, { ...cohort, semester: 3 }, { ...cohort, branch: 'ECE' }]) expect(activateG4Timetable(state, wrong)).toBe(state);
    const next = activateG4Timetable(state, cohort);
    expect(next.subjects).toBe(state.subjects); expect(next.attendanceRecords).toBe(state.attendanceRecords);
    expect(JSON.stringify(state)).toBe(before);
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) expect(getClassesForDay(next, day).map(c => [c.startTime, c.endTime, c.units])).toEqual([['09:00', '11:00', 2], ['11:00', '13:00', 2], ['14:00', '16:00', 2]]);
    expect(getClassesForDay(next, 'Tuesday').map(c => c.subjectName)).toEqual(['ADI', 'BEE-II', 'NALR-I']);
});
test('missing or ambiguous real subjects cannot generate timetable-only attendance stubs', () => {
    expect(suppliedG4Timetable(base().subjects.slice(0, 4))).toBe(null);
    expect(suppliedG4Timetable([...base().subjects, { id: 'duplicate', name: 'ADI' }])).toBe(null);
});
test('old portal and sparse register responses retain the supplied schedule; a changed published grid wins immediately', () => {
    const state = base(); state.timetableMeta.source = 'portal-web';
    state.timetable = { Monday: [{ slotId: '1', subjectId: '0' }, { slotId: '2', subjectId: '0' }] };
    state.timeSlots = [{ id: '1', start: '09:00', end: '10:00' }, { id: '2', start: '10:00', end: '11:00' }];
    const active = activateG4Timetable(state, cohort);
    const same = appReducer(active, { type: 'ERP_SET_TIMETABLE', payload: { timetable: state.timetable, timeSlots: state.timeSlots, source: 'portal-web', fetchedAt: 'today' } });
    expect(same.timetable).toBe(active.timetable);
    const sparse = appReducer(active, { type: 'ERP_SET_TIMETABLE', payload: { timetable: { Monday: [{ slotId: '1', subjectId: '0' }] }, timeSlots: [{ id: '1', start: '09:00', end: '10:00' }], source: 'register-derived' } });
    expect(sparse.timetable).toBe(active.timetable);
    const changed = { Monday: [{ slotId: '1', subjectId: '0' }, { slotId: '2', subjectId: '0' }] };
    const fresh = appReducer(same, { type: 'ERP_SET_TIMETABLE', payload: { timetable: changed, timeSlots: [{ id: '1', start: '10:00', end: '11:00' }, { id: '2', start: '11:00', end: '12:00' }], source: 'portal-web' } });
    expect(fresh.timetable).toBe(changed); expect(fresh.timetableMeta.cohortRetired).toBe(true);
    expect(fresh.attendanceRecords).toBe(state.attendanceRecords);
    const confirmedAgain = appReducer(fresh, { type: 'ERP_SET_TIMETABLE', payload: { timetable: changed, timeSlots: fresh.timeSlots, source: 'portal-web' } });
    expect(confirmedAgain.timetableMeta.cohortRetired).toBe(true);
    const retry = appReducer(confirmedAgain, { type: 'ERP_SET_TIMETABLE', payload: { timetable: {}, timeSlots: [], source: 'register-derived' } });
    expect(retry.timetable).toBe(changed);
});

test('a known published baseline is compared immediately; an unknown first published grid replaces the override', () => {
    const state = base(); state.timetableMeta.source = 'portal-web';
    const active = activateG4Timetable(state, cohort);
    expect(active.timetableMeta.portalBaseline).not.toBe(null);
    const unknown = activateG4Timetable(base(), cohort);
    expect(unknown.timetableMeta.portalBaseline).toBe(null);
    const first = appReducer(unknown, { type: 'ERP_SET_TIMETABLE', payload: { timetable: active.timetable, timeSlots: active.timeSlots, source: 'portal-web' } });
    expect(first.timetable).toBe(active.timetable);
    expect(first.timetableMeta).toMatchObject({ source: 'portal-web', cohortRetired: true });
});

test('a verified different group blocks confirmation and supersedes an active G4 override', () => {
    const other = base(); other.timetableMeta.group = '24CSE-G03';
    expect(activateG4Timetable(other, cohort)).toBe(other);
    const active = activateG4Timetable(base(), cohort);
    const changed = appReducer(active, { type: 'ERP_SET_TIMETABLE', payload: { timetable: other.timetable, timeSlots: [], source: 'portal-web', group: '24CSE-G03' } });
    expect(changed.timetableMeta).toMatchObject({ source: 'portal-web', group: '24CSE-G03', cohortRetired: true });
    const inferred = appReducer(active, { type: 'ERP_SET_TIMETABLE', payload: { timetable: other.timetable, timeSlots: [], source: 'portal-web', group: '24CSE-G03', timesAreInferred: true } });
    expect(inferred.timetable).toBe(other.timetable);
    expect(inferred.timetableMeta.cohortRetired).toBe(true);
});
test('inferred legacy grids do not count as a known published baseline and cannot replace verified times', () => {
    const legacy = base(); legacy.timetableMeta = { source: 'erp', timesAreInferred: true };
    const active = activateG4Timetable(legacy, cohort);
    expect(active.timetableMeta.portalBaseline).toBe(null);
    const response = appReducer(active, { type: 'ERP_SET_TIMETABLE', payload: { timetable: {}, timeSlots: [], source: 'portal-web', timesAreInferred: true } });
    expect(response.timetable).toBe(active.timetable);
});
test('parenthetical course labels match the real subject while opposite course parts cannot be substituted', () => {
    const subjects = base().subjects;
    subjects[3] = { ...subjects[3], name: 'Business Ethics and Entrepreneurship - II (BEE-II)' };
    expect(suppliedG4Timetable(subjects)).not.toBe(null);
    subjects[3].name = 'Business Ethics and Entrepreneurship - I (BEE-I)';
    expect(suppliedG4Timetable(subjects)).toBe(null);
});
