/** @jest-environment node */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const fs = require('fs');
const path = require('path');

describe('ERP provider parsing', () => {
    test('parses legacy login status 1 session payload', () => {
        const { parseLegacySession } = require('../_erp-provider');
        const raw = {
            status: '1',
            data: {
                userId: '24635',
                name: 'GURJOBAN SINGH',
                studentId: '9508',
                roleId: '4',
                sessionId: '19',
                apiKey: 'RFeRrG20260502052713',
                photo: 'https://example.test/photo.jpg',
            },
        };

        expect(parseLegacySession(raw)).toEqual(expect.objectContaining({
            userId: '24635',
            studentId: '9508',
            roleId: '4',
            sessionId: '19',
            apiKey: 'RFeRrG20260502052713',
            studentName: 'GURJOBAN SINGH',
            studentPhoto: 'https://example.test/photo.jpg',
        }));
    });

    test('parses legacy OTP status 4 payload with data array', () => {
        const { parseLegacySession } = require('../_erp-provider');
        const raw = {
            status: '4',
            mobileString: 'email address gur****@chitkara.edu.in',
            data: [{
                userId: '24635',
                name: 'GURJOBAN SINGH',
                studentId: '9508',
                roleId: '4',
                sessionId: '19',
                apiKey: 'ZJ03qV20260502050813',
            }],
        };

        expect(parseLegacySession(raw)).toEqual(expect.objectContaining({
            userId: '24635',
            studentId: '9508',
            roleId: '4',
            sessionId: '19',
            apiKey: 'ZJ03qV20260502050813',
            studentName: 'GURJOBAN SINGH',
        }));
    });

    test('reads JSON payloads served as text/html', async () => {
        const { readErpPayload } = require('../_erp-provider');
        const response = {
            text: jest.fn().mockResolvedValue('{"status":"1","data":{"userId":"24635"}}'),
        };

        await expect(readErpPayload(response)).resolves.toEqual({
            status: '1',
            data: { userId: '24635' },
        });
    });
});

describe('attendance register parser', () => {
    test('extracts all subjects, portal IDs, totals, absences, and units from captured register', () => {
        const { parseRegisterHTML } = require('../erp-calendar');
        const found = fs.readFileSync(path.join(__dirname, '../../../Found.txt'), 'utf8');
        const tableStart = found.indexOf("<table border='1'");
        const html = found.slice(tableStart);

        const result = parseRegisterHTML(html);

        expect(result.subjects).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: '24CSE0212', erpSubjectId: '10755', attended: 113, total: 133, percentage: 84.96 }),
            expect.objectContaining({ code: '24CSE0213', erpSubjectId: '10756', attended: 68,  total: 80,  percentage: 85 }),
            expect.objectContaining({ code: '24CSE0214', erpSubjectId: '10757', attended: 48,  total: 54,  percentage: 88.89 }),
            expect.objectContaining({ code: '24CSE0215', erpSubjectId: '10758', attended: 31,  total: 40,  percentage: 77.5 }),
            expect.objectContaining({ code: '24CSE0216', erpSubjectId: '10762', attended: 15,  total: 16,  percentage: 93.75 }),
            expect.objectContaining({ code: '24ECE0202', erpSubjectId: '10574', attended: 54,  total: 65,  percentage: 83.08 }),
        ]));
        expect(result.subjects).toHaveLength(6);
        expect(result.latestDate).toBe('2026-05-01');
        expect(result.calendar['2026-01-23']['Data Structures using Object Oriented Programming-II']).toEqual(expect.objectContaining({
            status: 'absent',
            code: '24CSE0212',
            erpSubjectId: '10755',
            units: 2,
        }));
        expect(result.calendar['2026-01-20']['Data Structures using Object Oriented Programming-II']).toEqual(expect.objectContaining({
            status: 'present',
            period: 1,
            units: 2,
        }));
    });
});
