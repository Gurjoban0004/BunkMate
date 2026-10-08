const { studentPhotoUrl } = require('../_student-photo');

describe('student photos', () => {
    const originalBase = process.env.ERP_BASE_URL;
    beforeEach(() => { process.env.ERP_BASE_URL = 'https://college.example.edu/'; });
    afterAll(() => {
        if (originalBase === undefined) delete process.env.ERP_BASE_URL;
        else process.env.ERP_BASE_URL = originalBase;
    });
    test('uses college photo URLs and resolves relative photo paths', () => {
        expect(studentPhotoUrl('https://college.example.edu/photos/student.jpg')).toBe('https://college.example.edu/photos/student.jpg');
        expect(studentPhotoUrl('/photos/student.jpg')).toBe('https://college.example.edu/photos/student.jpg');
        expect(studentPhotoUrl('photos/student.jpg')).toBe('https://college.example.edu/photos/student.jpg');
    });
    test.each([null, '', 'javascript:alert(1)', 'data:text/html,anything', 'https://user:password@college.example.edu/photo', 'http://college.example.edu/photo'])('rejects unusable photo value %s', (value) => {
        expect(studentPhotoUrl(value)).toBeNull();
    });
});
