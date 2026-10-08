const PUBLIC_TABS = ['Today', 'Subjects', 'Insights'];
export function allowedWebTab(tab, isAdmin) {
    return PUBLIC_TABS.includes(tab) || (isAdmin && tab === 'Admin') ? tab : 'Today';
}
export function initialWebTab(search, isAdmin) {
    return allowedWebTab(new URLSearchParams(search || '').get('tab'), isAdmin);
}
