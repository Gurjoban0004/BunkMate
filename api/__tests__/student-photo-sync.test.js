/** @jest-environment node */
const mockGet = jest.fn();
const mockSet = jest.fn().mockResolvedValue();
const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));
const mockFetchPhoto = jest.fn();
jest.mock('../_firebase-admin', () => ({ adminDb: { doc: (...args) => mockDoc(...args) } }));
jest.mock('../_erp-provider', () => ({ fetchStudentPhotoV2: (...args) => mockFetchPhoto(...args) }));
const { saveStudentPhoto } = require('../_student-photo');
const session = { rollNumber: 'student-1', userId: 'erp-user', securityToken: 'sealed-session' };
beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: () => ({}) });
    mockFetchPhoto.mockResolvedValue('https://college.example/photo.jpg');
});
test('old authenticated sign-ins backfill only photo metadata, preserving attendance', async () => {
    await saveStudentPhoto(session);
    expect(mockFetchPhoto).toHaveBeenCalledWith(session);
    expect(mockDoc).toHaveBeenCalledWith('admin/activity/students/student-1');
    expect(mockSet).toHaveBeenCalledWith({ studentPhoto: 'https://college.example/photo.jpg', studentPhotoCheckedAt: expect.any(Number) }, { merge: true });
});
test('saved photos and recent unavailable photos make no college request', async () => {
    for (const saved of [{ studentPhoto: 'https://college.example/saved.jpg' }, { studentPhotoCheckedAt: Date.now() }]) {
        mockGet.mockResolvedValue({ data: () => saved });
        await saveStudentPhoto(session);
    }
    expect(mockFetchPhoto).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
});
test('college failure does not fail sync and records retry cooldown', async () => {
    mockFetchPhoto.mockRejectedValue(new Error('offline'));
    await expect(saveStudentPhoto(session)).resolves.toBeUndefined();
    expect(mockSet).toHaveBeenCalledWith({ studentPhotoCheckedAt: expect.any(Number) }, { merge: true });
});
test('invalid identities and mock sessions never fetch or write', async () => {
    await saveStudentPhoto({ ...session, isMock: true });
    await saveStudentPhoto({ ...session, rollNumber: '../other' });
    expect(mockDoc).not.toHaveBeenCalled();
});
