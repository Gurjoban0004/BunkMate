import { calculatePercentage, getClassesForDay, getErpCoverageDateForSubject, getSubjectAttendance, maxSkippableUnits } from '../attendance';
import { pairsToReachFraction } from '../attendanceImpact';
import { parseLocalDate, toPlannerDateKey } from './semesterWindow';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const whole = (value) => Number.isSafeInteger(value) && value >= 0;
const ratio = (a, t, target) => ({ numerator: t ? 100 * a - target * t : -target, denominator: t || 1 });
const compareRatio = (a, b) => a.numerator * b.denominator - b.numerator * a.denominator;
function fairer(a, b) {
    for (let i = 0; i < a.length; i++) {
        const difference = compareRatio(a[i], b[i]);
        if (difference) return difference > 0;
    }
    return false;
}
function validDate(value) {
    const date = parseLocalDate(value);
    return date && toPlannerDateKey(date) === value ? date : null;
}
const requirement = (subject, state) => {
    const value = Number(subject.target ?? state.settings?.dangerThreshold ?? 75);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 75;
};
const holiday = (state, key) => state.holidays?.includes(key) || state.attendanceRecords?.[key]?._holiday;
const weekKey = (date) => {
    const monday = new Date(date);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return toPlannerDateKey(monday);
};

// For a fixed skipped count, all paths have the same fraction. Retain a feasible
// path for each count; later skips preserve early-week attendance credit.
function subjectChoices(base, events, limit, allowSkip) {
    let choices = new Map([[0, { a: base.a, t: base.t, ids: [] }]]);
    for (const event of events) {
        const next = new Map();
        for (const [count, path] of choices) {
            if (!next.has(count)) next.set(count, { ...path, a: path.a + event.units, t: path.t + event.units });
            const skipped = count + event.pairs;
            if (allowSkip && skipped <= limit && 100 * path.a >= base.target * (path.t + event.units)) {
                next.set(skipped, { a: path.a, t: path.t + event.units, ids: [...path.ids, event.id] });
            }
        }
        choices = next;
    }
    return choices;
}

/** Pure, timetable-backed plan. No historical records or college totals are changed. */
export function buildCombinedSkipPlan(state, { pairsPerWeek = 2, weeks = 4, fromDate = state.devDate || new Date(), includeToday = false } = {}) {
    if (!whole(pairsPerWeek)) throw new RangeError('Weekly skips must be a whole, non-negative number');
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new RangeError('Choose between 1 and 12 weeks');
    const now = new Date(fromDate);
    if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid plan date');
    const todayKey = toPlannerDateKey(now);
    const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const start = validDate(todayKey);
    if (!includeToday) start.setDate(start.getDate() + 1);
    const end = validDate(weekKey(start));
    end.setDate(end.getDate() + weeks * 7 - 1);
    const semesterEnd = state.settings?.semesterEndDate;
    const warnings = [];
    if (state.timetableMeta?.source !== 'manual' && (state.timetableMeta?.timesAreInferred || ['derived', 'register-derived'].includes(state.timetableMeta?.source))) {
        warnings.push('Confirm class times in Edit timetable before planning skips. These times are inferred.');
    }
    if (semesterEnd) {
        const term = typeof semesterEnd === 'string' ? validDate(semesterEnd.split('T')[0]) : null;
        if (!term) warnings.push('Check the semester end date in Settings.');
        else if (term < end) end.setTime(term.getTime());
    }
    // Only read college totals here; validate session sizes below before using them.
    const attendanceState = { ...state, timetable: {} };
    const subjects = (state.subjects || []).map((subject) => {
        const stats = getSubjectAttendance(subject.id, attendanceState);
        return { ...subject, target: requirement(subject, state), recordedA: stats.attendedUnits, recordedT: stats.totalUnits,
            a: stats.attendedUnits, t: stats.totalUnits, reservedPairs: 0, skippedPairs: 0 };
    });
    const ids = new Set(subjects.map((subject) => subject.id));
    const weekly = {};
    let invalidSchedule = false;
    for (const day of DAYS) {
        const raw = state.timetable?.[day] || [];
        if (!Array.isArray(raw)) { invalidSchedule = true; weekly[day] = []; continue; }
        const slots = Array.isArray(state.timeSlots) ? state.timeSlots : [];
        const seen = new Set();
        if (raw.some((slot) => {
            if (!slot || !ids.has(slot.subjectId) || (!slot.customStart && !slots.some((time) => time.id === slot.slotId))) return true;
            const key = `${slot.subjectId}:${slot.customStart || slot.slotId}:${slot.customEnd || ''}`;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        })) invalidSchedule = true;
        try { weekly[day] = getClassesForDay(state, day).sort((a, b) => a.startTime.localeCompare(b.startTime)); }
        catch { invalidSchedule = true; weekly[day] = []; }
        for (let i = 0; i < weekly[day].length; i++) {
            const cls = weekly[day][i];
            const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
            if (!Number.isInteger(cls.units) || cls.units < 2 || cls.units % 2 || !time.test(cls.startTime) || !time.test(cls.endTime) || cls.endTime <= cls.startTime) invalidSchedule = true;
            if (i > 0 && weekly[day][i - 1].endTime > cls.startTime) invalidSchedule = true;
        }
    }
    if (invalidSchedule) warnings.push('The timetable has unmatched, overlapping, or incomplete class pairs. Skip suggestions are paused until it is corrected.');
    let needsSync = false;
    for (const subject of subjects) {
        const coverage = validDate(getErpCoverageDateForSubject(subject.id, state));
        const oldest = validDate(todayKey); oldest.setDate(oldest.getDate() - 31);
        if (!coverage || coverage > now || coverage < oldest) { needsSync = true; continue; }
        const cursor = new Date(coverage);
        cursor.setDate(cursor.getDate() + 1);
        // Do not invent credit for classes after the college's published register.
        while (toPlannerDateKey(cursor) < todayKey || (!includeToday && toPlannerDateKey(cursor) === todayKey)) {
            const key = toPlannerDateKey(cursor);
            if (!holiday(state, key) && state.attendanceRecords?.[key]?.[subject.id]?.status !== 'cancelled') weekly[DAYS[cursor.getDay()]].filter((cls) => cls.subjectId === subject.id && cls.units >= 2 && cls.units % 2 === 0).forEach((cls) => {
                subject.t += cls.units;
                subject.reservedPairs += cls.units / 2;
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        if (includeToday && toPlannerDateKey(coverage) < todayKey && !holiday(state, todayKey) && state.attendanceRecords?.[todayKey]?.[subject.id]?.status !== 'cancelled') {
            weekly[DAYS[now.getDay()]].filter((cls) => cls.subjectId === subject.id && cls.endTime <= clock && cls.units >= 2 && cls.units % 2 === 0).forEach((cls) => {
                subject.t += cls.units;
                subject.reservedPairs += cls.units / 2;
            });
        }
    }
    if (needsSync) warnings.push('Sync with our college first: an attendance update date is missing, in the future, or over 31 days old.');
    const events = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const dateKey = toPlannerDateKey(cursor);
        if (!holiday(state, dateKey)) weekly[DAYS[cursor.getDay()]].forEach((cls, index) => {
            // Unverified single periods are never turned into invented two-lecture events.
            if (cls.units < 2 || cls.units % 2) return;
            // Today's published subject-day is already in the baseline totals.
            if (includeToday && dateKey === todayKey && getErpCoverageDateForSubject(cls.subjectId, state) >= todayKey) return;
            if (includeToday && dateKey === todayKey && cls.endTime <= clock) return;
            if (state.attendanceRecords?.[dateKey]?.[cls.subjectId]?.status === 'cancelled') return;
            events.push({ ...cls, id: `${dateKey}:${cls.subjectId}:${cls.startTime}:${index}`, dateKey, dayName: DAYS[cursor.getDay()], weekKey: weekKey(cursor), pairs: cls.units / 2 });
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    const allowSkip = !warnings.length;
    const baselines = Object.fromEntries(subjects.map((subject) => [subject.id, { ...subject }]));
    const weekPlans = [];
    const weekKeys = [];
    const monday = validDate(weekKey(start));
    while (end >= start && monday <= end) { weekKeys.push(toPlannerDateKey(monday)); monday.setDate(monday.getDate() + 7); }
    for (const key of weekKeys) {
        const classes = events.filter((event) => event.weekKey === key);
        const cap = Math.min(pairsPerWeek, classes.reduce((sum, cls) => sum + cls.pairs, 0));
        let allocations = new Map([[0, { heads: [], choices: [] }]]);
        for (const subject of subjects) {
            const options = subjectChoices(subject, classes.filter((cls) => cls.subjectId === subject.id), cap, allowSkip);
            const next = new Map();
            for (const [used, allocation] of allocations) for (const [count, option] of options) {
                if (used + count > cap) continue;
                const heads = [...allocation.heads, ratio(option.a, option.t, subject.target)].sort(compareRatio);
                const candidate = { heads, choices: [...allocation.choices, { id: subject.id, count, option }] };
                if (!next.has(used + count) || fairer(heads, next.get(used + count).heads)) next.set(used + count, candidate);
            }
            allocations = next;
        }
        const skippedPairs = Math.max(...allocations.keys());
        const selection = allocations.get(skippedPairs);
        const skipIds = new Set(selection.choices.flatMap((choice) => choice.option.ids));
        const trace = Object.fromEntries(subjects.map((subject) => [subject.id, { a: subject.a, t: subject.t }]));
        const rows = classes.map((cls) => {
            const action = skipIds.has(cls.id) ? 'skip' : 'attend';
            const current = trace[cls.subjectId];
            current.t += cls.units;
            if (action === 'attend') current.a += cls.units;
            return { ...cls, action, attendedAfter: current.a, conductedAfter: current.t, percentageAfter: calculatePercentage(current.a, current.t) };
        });
        selection.choices.forEach(({ id, count, option }) => {
            const subject = subjects.find((item) => item.id === id);
            subject.a = option.a; subject.t = option.t; subject.skippedPairs += count;
        });
        const sunday = validDate(key); sunday.setDate(sunday.getDate() + 6);
        weekPlans.push({ key, classes: rows, skippedPairs, requestedPairs: pairsPerWeek, shortfall: pairsPerWeek - skippedPairs, partial: key < toPlannerDateKey(start) || sunday > end });
    }
    const resultSubjects = subjects.map((subject) => {
        const base = baselines[subject.id];
        const ownEvents = events.filter((cls) => cls.subjectId === subject.id);
        const choices = subjectChoices(base, ownEvents, ownEvents.reduce((sum, cls) => sum + cls.pairs, 0), allowSkip);
        return { ...subject, currentPercentage: calculatePercentage(subject.recordedA, subject.recordedT), projectedPercentage: calculatePercentage(subject.a, subject.t),
            skipNowPairs: !allowSkip ? 0 : subject.target === 0 ? null : Math.floor(maxSkippableUnits(base.a, base.t, subject.target) / 2),
            maxWindowSkipPairs: Math.max(...choices.keys()), scheduledPairs: ownEvents.reduce((sum, cls) => sum + cls.pairs, 0),
            recoveryPairs: pairsToReachFraction(base.a, base.t, subject.target, 100), belowTarget: 100 * subject.a < subject.target * subject.t };
    });
    return { subjects: resultSubjects, weeks: weekPlans, warnings, pairsPerWeek, horizonWeeks: weeks,
        startDate: toPlannerDateKey(start), endDate: toPlannerDateKey(end), hasEndDate: !!semesterEnd,
        reservedPairs: subjects.reduce((sum, subject) => sum + subject.reservedPairs, 0),
        scheduledPairs: events.reduce((sum, cls) => sum + cls.pairs, 0), skippedPairs: subjects.reduce((sum, subject) => sum + subject.skippedPairs, 0) };
}

/** Saved choices are preferences, never marks in the college register. */
export function getSavedSkipPlan(state, preferences = state.settings?.skipPlan) {
    if (!preferences || !whole(preferences.pairsPerWeek) || ![1, 2, 4, 8].includes(preferences.weeks)) return null;
    const plan = buildCombinedSkipPlan(state, { ...preferences, includeToday: true });
    const available = new Set(plan.weeks.flatMap((week) => week.classes.map((cls) => cls.id)));
    const selected = plan.warnings.length ? [] : Array.isArray(preferences.skipIds)
        ? preferences.skipIds.filter((id) => available.has(id))
        : plan.weeks.flatMap((week) => week.classes.filter((cls) => cls.action === 'skip').map((cls) => cls.id));
    return projectCombinedSkipPlan(plan, selected);
}

/** Replays calendar choices without changing the register or treating a risky choice as safe. */
export function projectCombinedSkipPlan(plan, skipIds) {
    if (!Array.isArray(skipIds)) throw new TypeError('Choose scheduled class IDs');
    const ids = new Set(plan.weeks.flatMap((week) => week.classes.map((cls) => cls.id)));
    if (skipIds.some((id) => !ids.has(id))) throw new RangeError('Unknown scheduled class');
    if (plan.warnings.length && skipIds.length) throw new RangeError('Sync attendance and correct the timetable before planning skips');
    const selected = new Set(skipIds);
    const subjects = plan.subjects.map((subject) => ({ ...subject, a: subject.recordedA,
        t: subject.recordedT + subject.reservedPairs * 2, skippedPairs: 0, unsafeSkips: 0 }));
    const byId = Object.fromEntries(subjects.map((subject) => [subject.id, subject]));
    const weeks = plan.weeks.map((week) => {
        const classes = week.classes.map((cls) => {
            const subject = byId[cls.subjectId], skip = selected.has(cls.id);
            subject.t += cls.units;
            if (skip) subject.skippedPairs += cls.pairs;
            else subject.a += cls.units;
            const unsafe = skip && 100 * subject.a < subject.target * subject.t;
            if (unsafe) subject.unsafeSkips++;
            return { ...cls, action: skip ? 'skip' : 'attend', unsafe, attendedAfter: subject.a,
                conductedAfter: subject.t, percentageAfter: calculatePercentage(subject.a, subject.t) };
        });
        const skippedPairs = classes.reduce((sum, cls) => sum + (cls.action === 'skip' ? cls.pairs : 0), 0);
        return { ...week, classes, skippedPairs, shortfall: Math.max(0, week.requestedPairs - skippedPairs),
            overBudget: skippedPairs > week.requestedPairs };
    });
    subjects.forEach((subject) => {
        subject.projectedPercentage = calculatePercentage(subject.a, subject.t);
        subject.belowTarget = 100 * subject.a < subject.target * subject.t;
        subject.recoverPreviousPairs = pairsToReachFraction(subject.a, subject.t, subject.recordedA, subject.recordedT);
    });
    const overall = subjects.reduce((sum, subject) => ({ attended: sum.attended + subject.recordedA,
        conducted: sum.conducted + subject.recordedT, projectedA: sum.projectedA + subject.a, projectedT: sum.projectedT + subject.t }),
    { attended: 0, conducted: 0, projectedA: 0, projectedT: 0 });
    overall.currentPercentage = calculatePercentage(overall.attended, overall.conducted);
    overall.projectedPercentage = calculatePercentage(overall.projectedA, overall.projectedT);
    overall.recovery = [{ label: 'Previous', numerator: overall.attended, denominator: overall.conducted },
        ...[75, 80, 85, 90].map((target) => ({ label: `${target}%`, numerator: target, denominator: 100 }))]
        .map((target) => ({ label: target.label, pairs: pairsToReachFraction(overall.projectedA, overall.projectedT, target.numerator, target.denominator) }));
    return { ...plan, subjects, weeks, overall, skippedPairs: subjects.reduce((sum, subject) => sum + subject.skippedPairs, 0) };
}
