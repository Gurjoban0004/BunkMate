import { shortSubjectName } from './subjectName';

export const G4_VERSION = '2026-10-06';
const normalize = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SUBJECTS = {
    ADI: ['ADI', 'ALGORITHMDESIGNIMPLEMENTATION', '24CSE0317'],
    SD: ['SD', 'SYSTEMDESIGN', '24CSE0318'],
    AIML: ['AIML', 'ARTIFICIALINTELLIGENCEMACHINELEARNING', '24CSE0316'],
    BEE: ['BEE', 'BEEII'],
    NALR: ['NALR', 'NALRI', 'NUMERICALAPTITUDELOGICALREASONING', '25UNI0110'],
};
const GRID = { Monday: ['ADI', 'SD', 'AIML'], Tuesday: ['ADI', 'BEE', 'NALR'], Wednesday: ['ADI', 'NALR', 'AIML'], Thursday: ['ADI', 'BEE', 'SD'], Friday: ['ADI', 'BEE', 'AIML'] };
const STARTS = ['09:00', '11:00', '14:00'];

export function isCse5G4(cohort) {
    return normalize(cohort?.branch) === 'CSE' && Number(cohort?.semester) === 5 && /^G0?4$/.test(normalize(cohort?.group));
}
export const isG4PortalGroup = (group) => /^(?:\d{2})?CSE-G0?4$/i.test(String(group || '').trim());
export function timetableFingerprint(timetable, timeSlots) {
    return JSON.stringify(Object.entries(timetable || {}).flatMap(([day, slots]) => (slots || []).map((slot) => {
        const time = (timeSlots || []).find((entry) => entry.id === slot.slotId);
        return [day, slot.subjectId, slot.customStart || time?.start || '', slot.customEnd || time?.end || '', normalize(slot.room)];
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
/** Supplied schedule, matched to existing subjects; never creates attendance stubs. */
export function suppliedG4Timetable(subjects) {
    const matches = {};
    for (const [label, aliases] of Object.entries(SUBJECTS)) {
        const candidates = subjects.filter((subject) => {
            if (label === 'BEE' && /\b(?:I|1)\b/.test(subject.name)) return false;
            if (label === 'NALR' && /\b(?:II|2)\b/.test(subject.name)) return false;
            const tags = (String(subject.name || '').match(/\([^)]*\)/g) || []).map(normalize);
            return [normalize(subject.code), normalize(shortSubjectName(subject.name)), ...tags, normalize(subject.name).replace(/AND/g, '')]
                .some((value) => aliases.includes(value) || (label === 'NALR' && value.startsWith('NUMERICALAPTITUDELOGICALREASONING')));
        });
        if (candidates.length !== 1) return null;
        matches[label] = candidates[0].id;
    }
    const timeSlots = Array.from({ length: 7 }, (_, index) => ({ id: `g4-period-${index + 1}`, start: `${String(index + 9).padStart(2, '0')}:00`, end: `${String(index + 10).padStart(2, '0')}:00` }));
    const timetable = { Saturday: [], Sunday: [] };
    for (const [day, labels] of Object.entries(GRID)) timetable[day] = labels.flatMap((label, index) => {
        const hour = Number(STARTS[index].slice(0, 2));
        return [0, 1].map((offset) => ({ subjectId: matches[label], slotId: `g4-period-${hour - 8 + offset}`, room: 'TG-312' }));
    });
    return { timetable, timeSlots };
}
export function activateG4Timetable(state, cohort) {
    if (!isCse5G4(cohort) || (state.timetableMeta?.group && !isG4PortalGroup(state.timetableMeta.group))) return state;
    const supplied = suppliedG4Timetable(state.subjects || []);
    if (!supplied) return state;
    return { ...state, ...supplied, settings: { ...state.settings, academicCohort: { branch: 'CSE', semester: 5, group: 'G4', confirmed: true }, cohortPromptDismissed: true },
        timetableMeta: { ...state.timetableMeta, source: 'cohort', cohortVersion: G4_VERSION,
            portalBaseline: ['erp', 'portal-web'].includes(state.timetableMeta?.source) && !state.timetableMeta?.timesAreInferred ? timetableFingerprint(state.timetable, state.timeSlots) : null,
            timesAreInferred: false, isEmpty: false } };
}
