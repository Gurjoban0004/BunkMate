import { shortSubjectName } from '../subjectName';

describe('shortSubjectName', () => {
    it.each([
        ['Algorithm Design & Implementation', 'ADI'],
        ['Programming Abstractions Using Java', 'PAUJ'],
        ['Art of Communication - II', 'AOC'],
        ['Art of Communication', 'AOC'],
        ['Applied Linear Algebra', 'ALA'],
        ['System Design', 'System Design'],
        ['DBMS', 'DBMS'],
        ['Thermodynamics', 'Thermodynamics'],
        ['', ''],
        [undefined, ''],
    ])('%s → %s', (input, want) => {
        expect(shortSubjectName(input)).toBe(want);
    });
});
