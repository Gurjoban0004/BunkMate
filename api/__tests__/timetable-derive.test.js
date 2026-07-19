process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'x'.repeat(32);
const { deriveTimetableFromRegister } = require('../erp-timetable');

// Two subjects across two Tuesdays + one Monday. Weekdays (2026): Jan 19=Mon, 20=Tue, 27=Tue.
const REGISTER = `
<table><thead>
  <tr><th></th></tr>
  <tr><th>Mathematics<br>(24MAT0101)</th><th>1<br>20-01<br>1</th></tr>
</thead><tbody>
  <tr id='subject_100'>
    <td>Attendance Count</td>
    <td id='subject_100_2026_01_20_1'>1</td>
    <td id='subject_100_2026_01_27_1'>2</td>
    <td class='total_100'>2/2</td><td class='percent_100'>100%</td>
  </tr>
</tbody></table>
<table><thead>
  <tr><th></th></tr>
  <tr><th>Physics<br>(24PHY0101)</th><th>1<br>20-01<br>2</th></tr>
</thead><tbody>
  <tr id='subject_200'>
    <td>Attendance Count</td>
    <td id='subject_200_2026_01_20_2'>1</td>
    <td id='subject_200_2026_01_27_2'>2</td>
    <td id='subject_200_2026_01_19_1'>X</td>
    <td class='total_200'>2/3</td><td class='percent_200'>66%</td>
  </tr>
</tbody></table>`;

describe('deriveTimetableFromRegister', () => {
    const { timetable, found, timesAreInferred } = deriveTimetableFromRegister(REGISTER);

    test('finds the recurring weekly schedule', () => {
        expect(found).toBe(true);
        expect(timesAreInferred).toBe(true);
    });

    test('Tuesday has Mathematics p1 and Physics p2', () => {
        const tue = timetable.Tuesday;
        expect(tue.map(e => e.period)).toEqual([1, 2]); // sorted by period
        expect(tue[0].subjectCode).toBe('24MAT0101');
        expect(tue[1].subjectCode).toBe('24PHY0101');
    });

    test('Monday has Physics p1, Sunday/empty days stay empty', () => {
        expect(timetable.Monday.map(e => e.subjectCode)).toEqual(['24PHY0101']);
        expect(timetable.Wednesday).toEqual([]);
    });
});

// Regression for the real My-Info page (chalkpadpro/studentDetails/display) captured via
// HTTP Toolkit 2026-07-18: nested tables, rowheading header, dataFont day cells, AM/PM period
// times, and the subject name in a title attr. Trimmed to two periods / two days.
const DISPLAY_GRID = `
<div><h4>Class Name</h4>: <span>2024-BE-CSE-5 SEM</span></div>
<div class="timetable-desktop"><table class="reportTableBorder"><tr><td align="left">
<table class="reportTableBorder">
<tr class="rowheading">
  <td><b>Days/Periods</b></td>
  <td><b>1<br>09:00 AM<br>10:00 AM</b></td>
  <td><b>2<br>02:00 PM<br>03:00 PM</b></td>
</tr>
<tr class="trow0">
  <td class="dataFont">Monday</td>
  <td class="dataFont"><div><span style='color:#000000'><span title="Algorithm Design & Implementation (24CSE0317)">24CSE0317</span><br>TG312<br>DIYA GARG</span><hr></div></td>
  <td class="dataFont"><div>&nbsp;</div></td>
</tr>
<tr class="trow1">
  <td class="dataFont">Tuesday</td>
  <td class="dataFont"><div><span title="Algorithm Design & Implementation (24CSE0317)">24CSE0317</span><hr></div></td>
  <td class="dataFont"><div><span title="Discrete Structures (24CSE0314)">24CSE0314</span><hr></div></td>
</tr>
<tr class="trow0">
  <td class="dataFont">Wednesday</td>
  <td class="dataFont"><div>&nbsp;</div></td>
  <td class="dataFont"><div>&nbsp;</div></td>
</tr>
</table></td></tr></table></div>`;

describe('parseTimetableHTML (live display page)', () => {
    const { parseTimetableHTML } = require('../erp-timetable');
    const { timetable, periods, found, timesAreInferred } = parseTimetableHTML(DISPLAY_GRID);

    test('extracts the grid from the nested-table page', () => {
        expect(found).toBe(true);
    });

    test('period times come from the AM/PM headers, not defaults', () => {
        expect(timesAreInferred).toBe(false);
        expect(periods[0]).toMatchObject({ number: 1, start: '09:00', end: '10:00' });
        expect(periods[1]).toMatchObject({ number: 2, start: '14:00', end: '15:00' });
    });

    test('subject name comes from the title attr; empty cells skipped', () => {
        expect(timetable.Monday.map(e => e.period)).toEqual([1]);
        expect(timetable.Monday[0]).toMatchObject({
            subjectCode: '24CSE0317',
            subjectName: 'Algorithm Design & Implementation',
        });
        expect(timetable.Tuesday.map(e => e.subjectCode)).toEqual(['24CSE0317', '24CSE0314']);
    });
});
