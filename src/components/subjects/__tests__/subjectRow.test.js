import { skipVerdict } from '../SubjectRow';

describe('skipVerdict', () => {
    it('tells a safe subject how much slack it has', () => {
        expect(skipVerdict('safe', 3)).toBe('Can skip 3 classes');
        expect(skipVerdict('safe', 1)).toBe('Can skip 1 class');
        expect(skipVerdict('safe', Infinity)).toBe('Can skip freely');
    });

    it('warns when there is no slack left', () => {
        expect(skipVerdict('edge', 0)).toBe("Can't skip next class");
        expect(skipVerdict('safe', 0)).toBe("Can't skip next class");
    });

    it('tells a subject below goal what it takes to recover', () => {
        expect(skipVerdict('danger', 14)).toBe('Attend 14 to recover');
        expect(skipVerdict('danger', Infinity)).toBe("Can't recover this semester");
        expect(skipVerdict('danger', 10000)).toBe("Can't recover this semester");
    });

    it('says nothing when the count is missing', () => {
        expect(skipVerdict('safe', undefined)).toBe('');
        expect(skipVerdict('safe', null)).toBe('');
    });
});
