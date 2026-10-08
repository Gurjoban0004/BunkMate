import { allowedWebTab, initialWebTab } from '../webTabRouting';

test('admin dashboard links resolve only for authenticated admin capabilities', () => {
    expect(initialWebTab('?tab=Admin', true)).toBe('Admin');
    expect(initialWebTab('?tab=Admin', false)).toBe('Today');
    expect(allowedWebTab('Admin', false)).toBe('Today');
});
test('normal tab links resolve and unknown destinations fall back safely', () => {
    expect(initialWebTab('?tab=Insights', false)).toBe('Insights');
    expect(initialWebTab('?tab=Subjects&debug=viewport', false)).toBe('Subjects');
    expect(initialWebTab('?tab=unknown', true)).toBe('Today');
    expect(initialWebTab('', true)).toBe('Today');
});
