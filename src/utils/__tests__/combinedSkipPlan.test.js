import fc from 'fast-check';
import { buildCombinedSkipPlan, projectCombinedSkipPlan, getSavedSkipPlan } from '../planner/combinedSkipPlan';

function input() {
    const timeSlots = Array.from({ length: 4 }, (_, i) => ({ id: String(i), start: `${9 + i}:00`.padStart(5, '0'), end: `${10 + i}:00`.padStart(5, '0') }));
    return {
        subjects: [{ id: 'a', name: 'A', initialAttended: 90, initialTotal: 100, target: 75 }, { id: 'b', name: 'B', initialAttended: 80, initialTotal: 100, target: 75 }],
        timeSlots, timetable: Object.fromEntries(['Monday', 'Wednesday', 'Friday'].map((day) => [day, timeSlots.map((slot, i) => ({ slotId: slot.id, subjectId: i < 2 ? 'a' : 'b' }))])),
        holidays: [], attendanceRecords: {}, latestErpDate: '2026-10-11', devDate: '2026-10-11T20:00:00', settings: {},
    };
}
function checkTrace(state, result) {
    const totals = Object.fromEntries(state.subjects.map((subject) => [subject.id, { a: subject.initialAttended, t: subject.initialTotal + 2 * result.subjects.find((row) => row.id === subject.id).reservedPairs }]));
    for (const week of result.weeks) {
        expect(week.skippedPairs).toBeLessThanOrEqual(result.pairsPerWeek);
        for (const cls of week.classes) {
            const row = totals[cls.subjectId];
            row.t += cls.units;
            if (cls.action === 'attend') row.a += cls.units;
            else expect(100 * row.a).toBeGreaterThanOrEqual(state.subjects.find((s) => s.id === cls.subjectId).target * row.t);
            expect(cls.units % 2).toBe(0);
            expect(cls.attendedAfter).toBe(row.a);
            expect(cls.conductedAfter).toBe(row.t);
            expect(row.a).toBeLessThanOrEqual(row.t);
        }
    }
    for (const row of result.subjects) expect([row.a, row.t]).toEqual([totals[row.id].a, totals[row.id].t]);
}

test('spreads feasible skips across the week and rotates weekdays across weeks', () => {
    const state = input();
    state.subjects.forEach((subject) => { subject.initialAttended = 100; subject.initialTotal = 100; });
    state.timetable = Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => [day, state.timeSlots.map((slot, i) => ({ slotId: slot.id, subjectId: i < 2 ? 'a' : 'b' }))]));
    for (const pairsPerWeek of [1, 2, 3]) {
        const result = buildCombinedSkipPlan(state, { pairsPerWeek, weeks: 4 });
        const days = result.weeks.map((week) => week.classes.filter((cls) => cls.action === 'skip').map((cls) => cls.dayName));
        expect(new Set(days.flat()).size).toBeGreaterThanOrEqual(4);
        days.forEach((week) => { expect(new Set(week).size).toBe(pairsPerWeek); });
        if (pairsPerWeek === 2) days.forEach((week) => { expect(Math.abs(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(week[0]) - ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(week[1]))).toBeGreaterThanOrEqual(2); });
        checkTrace(state, result);
        expect(buildCombinedSkipPlan(state, { pairsPerWeek, weeks: 4 })).toEqual(result);
    }
});

test('spacing never invents another weekday when only one scheduled day is feasible', () => {
    const state = input(); state.timetable = { Friday: state.timetable.Friday };
    const result = buildCombinedSkipPlan(state, { pairsPerWeek: 1, weeks: 4 });
    expect(result.weeks.every((week) => week.skippedPairs === 1)).toBe(true);
    expect(result.weeks.flatMap((week) => week.classes.filter((cls) => cls.action === 'skip')).every((cls) => cls.dayName === 'Friday')).toBe(true);
    checkTrace(state, result);
});

test('pauses inferred times until the timetable has been confirmed', () => {
    const state = input(); state.timetableMeta = { source: 'portal-web', timesAreInferred: true };
    const paused = buildCombinedSkipPlan(state);
    expect(paused.warnings[0]).toContain('Edit timetable');
    expect(paused.weeks.flatMap(w => w.classes).every(c => c.action === 'attend')).toBe(true);
    state.timetableMeta.source = 'manual';
    expect(buildCombinedSkipPlan(state).warnings).toEqual([]);
});

test('protects the weaker subject, provides real times, and leaves every input record unchanged', () => {
    const state = input(), before = JSON.stringify(state);
    state.attendanceRecords['2026-10-10'] = { a: { status: 'present', units: 90, source: 'erp' } };
    const original = JSON.stringify(state);
    const result = buildCombinedSkipPlan(state, { pairsPerWeek: 2, weeks: 1 });
    expect(result.weeks[0].skippedPairs).toBe(2);
    expect(result.weeks[0].classes.filter((cls) => cls.action === 'skip').map((cls) => cls.subjectId)).toEqual(['a', 'a']);
    expect(result.weeks[0].classes[0]).toMatchObject({ dateKey: '2026-10-12', startTime: '09:00', endTime: '11:00', units: 2 });
    expect(result.subjects.find((s) => s.id === 'a').recordedA).toBe(90);
    checkTrace(state, result);
    expect(JSON.stringify(state)).toBe(original);
    expect(before).not.toBe(original);
});

test('finds the maximum feasible weekly count, matching exhaustive enumeration on a small timetable', () => {
    for (const budget of [0, 1, 2, 3, 5, 20]) {
        const state = input();
        const classes = buildCombinedSkipPlan(state, { pairsPerWeek: 0, weeks: 1 }).weeks[0].classes;
        let maximum = 0;
        for (let bits = 0; bits < 2 ** classes.length; bits++) {
            const rows = Object.fromEntries(state.subjects.map((s) => [s.id, { a: s.initialAttended, t: s.initialTotal, target: s.target }]));
            let skipped = 0, feasible = true;
            classes.forEach((cls, index) => {
                const row = rows[cls.subjectId]; row.t += cls.units;
                if (bits & (1 << index)) { skipped += cls.pairs; if (100 * row.a < row.target * row.t) feasible = false; }
                else row.a += cls.units;
            });
            if (feasible && skipped <= budget) maximum = Math.max(maximum, skipped);
        }
        expect(buildCombinedSkipPlan(state, { pairsPerWeek: budget, weeks: 1 }).weeks[0].skippedPairs).toBe(maximum);
    }
});

test('never borrows attendance from later classes; below-target subjects recover first', () => {
    const state = input(); state.subjects[0].initialAttended = 76;
    state.subjects[1].initialAttended = 70; state.subjects[1].target = 85;
    const result = buildCombinedSkipPlan(state, { pairsPerWeek: 6, weeks: 2 });
    expect(result.weeks[0].classes[0].action).toBe('attend');
    expect(result.weeks.flatMap((w) => w.classes).filter((cls) => cls.subjectId === 'b').every((cls) => cls.action === 'attend')).toBe(true);
    expect(result.subjects.find((s) => s.id === 'b').belowTarget).toBe(true);
    checkTrace(state, result);
});

test('uses actual holidays and term end, including completely empty weeks', () => {
    const state = input(); state.settings.semesterEndDate = '2026-10-14'; state.holidays = ['2026-10-12'];
    const result = buildCombinedSkipPlan(state, { weeks: 8 });
    expect(result.endDate).toBe('2026-10-14');
    expect(result.weeks[0].classes.map((cls) => cls.dateKey)).toEqual(['2026-10-14', '2026-10-14']);
    state.holidays.push('2026-10-14');
    expect(buildCombinedSkipPlan(state).weeks[0].classes).toEqual([]);
    state.settings.semesterEndDate = '2026-10-10';
    expect(buildCombinedSkipPlan(state).weeks).toEqual([]);
});

test('reserves unpublished pairs as missed and pauses skipping when baseline dates are unknown', () => {
    const state = input(); state.latestErpDate = '2026-10-07';
    const result = buildCombinedSkipPlan(state);
    expect(result.reservedPairs).toBe(2);
    expect(result.subjects.map((row) => row.reservedPairs)).toEqual([1, 1]);
    checkTrace(state, result);
    delete state.latestErpDate;
    expect(buildCombinedSkipPlan(state).skippedPairs).toBe(0);
    expect(buildCombinedSkipPlan(state).warnings.join(' ')).toMatch(/Sync/);
});

test('no timetable fallback, half-pairs, unsafe custom values, or split four-lecture blocks', () => {
    const state = input(); state.timetable = {};
    expect(buildCombinedSkipPlan(state).scheduledPairs).toBe(0);
    state.timetable.Monday = [{ subjectId: 'a', slotId: '0' }];
    expect(buildCombinedSkipPlan(state).warnings.join(' ')).toMatch(/incomplete/);
    expect(buildCombinedSkipPlan(state).skippedPairs).toBe(0);
    for (const value of [-1, 1.5, NaN, Infinity, '2']) expect(() => buildCombinedSkipPlan(input(), { pairsPerWeek: value })).toThrow();
    state.timetable.Monday = state.timeSlots.map((slot) => ({ subjectId: 'a', slotId: slot.id }));
    const plan = buildCombinedSkipPlan(state, { pairsPerWeek: 1, weeks: 1 });
    expect(plan.weeks[0].classes[0]).toMatchObject({ units: 4, pairs: 2, action: 'attend' });
});

test('random budgets, attendance fractions and subject requirements conserve units and remain safe at every skip', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 20 }), fc.constantFrom(75, 80, 85, 90, 100), (a, b, budget, target) => {
        const state = input(); state.subjects[0].initialAttended = a * 2; state.subjects[1].initialAttended = b * 2; state.subjects[1].target = target;
        checkTrace(state, buildCombinedSkipPlan(state, { pairsPerWeek: budget, weeks: 4 }));
    }), { numRuns: 80 });
});

test('malformed slot collections and duplicate periods pause suggestions', () => {
    const state = input(); state.timeSlots = {};
    expect(buildCombinedSkipPlan(state).skippedPairs).toBe(0);
    const duplicate = input(); duplicate.timetable.Monday.push({ ...duplicate.timetable.Monday[0] });
    expect(buildCombinedSkipPlan(duplicate).warnings.join(' ')).toMatch(/timetable/);
    expect(buildCombinedSkipPlan(duplicate).skippedPairs).toBe(0);
});

test('calendar choices reproduce the automatic totals and do not mutate the plan or state', () => {
    const state = input(), original = JSON.stringify(state);
    const auto = buildCombinedSkipPlan(state), before = JSON.stringify(auto);
    const ids = auto.weeks.flatMap((week) => week.classes.filter((cls) => cls.action === 'skip').map((cls) => cls.id));
    const projected = projectCombinedSkipPlan(auto, ids);
    expect(projected.subjects.map((subject) => [subject.a, subject.t, subject.skippedPairs])).toEqual(auto.subjects.map((subject) => [subject.a, subject.t, subject.skippedPairs]));
    expect(projected.subjects.every((subject) => subject.unsafeSkips === 0)).toBe(true);
    expect(JSON.stringify(auto)).toBe(before);
    expect(JSON.stringify(state)).toBe(original);
    expect(() => projectCombinedSkipPlan(auto, ['invented-class'])).toThrow();
});

test('manual calendar warns at the unsafe skip even when later attendance recovers the final percentage', () => {
    const state = input(); state.subjects[0].initialAttended = 76;
    const auto = buildCombinedSkipPlan(state, { weeks: 2 });
    const first = auto.weeks[0].classes.find((cls) => cls.subjectId === 'a');
    const projection = projectCombinedSkipPlan(auto, [first.id]);
    expect(projection.weeks[0].classes[0].unsafe).toBe(true);
    const subject = projection.subjects.find((row) => row.id === 'a');
    expect(subject.unsafeSkips).toBe(1);
    expect(subject.belowTarget).toBe(false);
    expect(subject.a).toBe(86);
    expect(subject.t).toBe(112);
});

test('calendar keeps larger blocks whole, handles duplicate choices once, and recovers using exact fractions', () => {
    const state = input(); state.subjects[0].initialAttended = 100;
    state.timetable = { Monday: state.timeSlots.map((slot) => ({ subjectId: 'a', slotId: slot.id })) };
    const auto = buildCombinedSkipPlan(state, { weeks: 1 });
    const id = auto.weeks[0].classes[0].id;
    const projection = projectCombinedSkipPlan(auto, [id, id]);
    expect(projection.weeks[0].classes[0]).toMatchObject({ units: 4, pairs: 2, action: 'skip', conductedAfter: 104 });
    expect(projection.skippedPairs).toBe(2);
    expect(projection.overall).toMatchObject({ attended: 180, conducted: 200, projectedA: 180, projectedT: 204 });
    expect(projection.overall.recovery.find((target) => target.label === 'Previous').pairs).toBe(18);
    expect(projection.subjects[0].recoverPreviousPairs).toBe(null);
});


test('saved plan includes unreported classes today without double counting published subject-days', () => {
    const state = input();
    state.devDate = '2026-10-12T08:00:00';
    state.settings.skipPlan = { pairsPerWeek: 2, weeks: 1 };
    const before = JSON.stringify(state);
    let plan = getSavedSkipPlan(state);
    expect(plan.startDate).toBe('2026-10-12');
    expect(plan.weeks[0].classes.filter((cls) => cls.dateKey === '2026-10-12')).toHaveLength(2);
    expect(plan.reservedPairs).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
    state.settings.lastSubjectSyncDates = { a: '2026-10-12' };
    plan = getSavedSkipPlan(state);
    expect(plan.weeks[0].classes.filter((cls) => cls.dateKey === '2026-10-12').map((cls) => cls.subjectId)).toEqual(['b']);
});
test('expired manual choices are removed, unsafe choices are preserved as warnings, and config is never attendance', () => {
    const state = input();
    state.devDate = '2026-10-12T08:00:00';
    state.subjects[0].initialAttended = 75;
    state.settings.skipPlan = { pairsPerWeek: 1, weeks: 1 };
    const cls = getSavedSkipPlan(state).weeks[0].classes[0];
    state.settings.skipPlan.skipIds = [cls.id, 'expired'];
    const plan = getSavedSkipPlan(state);
    expect(plan.weeks[0].classes[0]).toMatchObject({ action: 'skip', unsafe: true });
    expect(state.subjects[0].initialAttended).toBe(75);
    state.settings.skipPlan.pairsPerWeek = 1.5;
    expect(getSavedSkipPlan(state)).toBe(null);
});

test('unpublished classes that already ended today never lend attendance credit to later skips', () => {
    const state = input(); state.devDate = '2026-10-12T11:15:00';
    state.settings.skipPlan = { pairsPerWeek: 2, weeks: 1 };
    const plan = getSavedSkipPlan(state);
    expect(plan.subjects.find(s => s.id === 'a').reservedPairs).toBe(1);
    expect(plan.weeks[0].classes.filter(c => c.dateKey === '2026-10-12').map(c => c.subjectId)).toEqual(['b']);
    expect(plan.subjects.find(s => s.id === 'a').recordedA).toBe(90);
});
