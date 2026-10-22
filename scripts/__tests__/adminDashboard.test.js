const fs = require('fs');
const path = require('path');
const vm = require('vm');

function helpers() {
    const page = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
    const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
    const handlers = {};
    const context = vm.createContext({ URL, document: { addEventListener: (type, fn) => { handlers[type] = fn; } } });
    const format = script.slice(script.indexOf('class Raw'), script.indexOf('const memo'));
    const identities = script.slice(script.indexOf('let NAMES'), script.indexOf('// ── Pieces'));
    vm.runInContext(format + identities, context);
    return { run: (expression) => vm.runInContext(expression, context), handlers };
}

test('dense dashboard identities use saved roster photos and escape student text', () => {
    const { run } = helpers();
    run("NAMES.set('student', '<Student>'); PHOTOS.set('student', 'https://college.example/photo.jpg');");
    const markup = run("who('student').s");
    expect(markup).toContain('src="/api/photo?roll=student"');
    expect(markup).toContain('aria-label="View full photo of &lt;Student&gt;"');
    expect(markup).toContain('&lt;Student&gt;');
    expect(markup).toContain('referrerpolicy="no-referrer"');
});
test('unusable photo URLs leave initials rather than a broken or unsafe image', () => {
    const { run, handlers } = helpers();
    for (const url of ['javascript:alert(1)', 'https://user:secret@college.example/image', null]) {
        expect(run(`avatar('student', 'Student', ${JSON.stringify(url)}).s`)).not.toContain('<img');
    }
    const image = { matches: (selector) => selector === 'img[data-student-photo]', remove: jest.fn() };
    handlers.error({ target: image });
    expect(image.remove).toHaveBeenCalled();
});

function dashboard(fetcher, hash = '#controls') {
    const { JSDOM } = require('jsdom');
    const page = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
    const dom = new JSDOM(page, { url: `http://127.0.0.1/${hash}`, runScripts: 'outside-only' });
    dom.window.fetch = jest.fn(async (url) => { const data = await fetcher(url); return { ok: true, json: async () => data }; });
    dom.window.AbortSignal = { timeout: () => undefined };
    dom.window.eval(page.match(/<script>([\s\S]*?)<\/script>/)[1] + '\nwindow.dashboardTest = { render, clear: () => memo.clear() };');
    return dom;
}
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const roster = { users: [{ rollNumber: 'a', studentName: '<Anya>', batchGroup: 'G4', inCloud: true, belowGoal: 1, lastActive: 1 }], byPlatform: {}, byVersion: {}, unfinished: { count: 0 } };
const fixture = (url) => url.includes('userRoster') ? roster : url.includes('/config') ? null : [];

test('dashboard searches batch names, escapes identities, and exposes sortable keyboard buttons', async () => {
    const dom = dashboard(fixture, '#students');
    try {
        await settle();
        const doc = dom.window.document;
        expect(doc.querySelector('#s-count').textContent).toBe('1 of 1 students');
        const search = doc.querySelector('#s-q');
        search.value = 'G4'; search.dispatchEvent(new dom.window.Event('input'));
        expect(doc.querySelector('#s-count').textContent).toBe('1 of 1 students');
        expect(doc.querySelector('#s-table').innerHTML).toContain('&lt;Anya&gt;');
        doc.querySelector('button[data-sort="studentName"]').click();
        expect(doc.querySelector('th[aria-sort="descending"] button').dataset.sort).toBe('studentName');
        search.value = 'missing'; search.dispatchEvent(new dom.window.Event('input'));
        expect(doc.querySelector('#s-count').textContent).toBe('0 of 1 students');
    } finally { dom.window.close(); }
});

test('a slow previous tab cannot overwrite the current dashboard or its loaded status', async () => {
    let resolveRoster;
    let slow = false;
    const dom = dashboard((url) => slow && url.includes('userRoster') ? new Promise((resolve) => { resolveRoster = resolve; }) : fixture(url));
    try {
        await settle();
        slow = true;
        dom.window.dashboardTest.clear();
        dom.window.history.replaceState(null, '', '#students');
        void dom.window.dashboardTest.render();
        await settle();
        dom.window.history.replaceState(null, '', '#controls');
        void dom.window.dashboardTest.render();
        await settle();
        resolveRoster(roster);
        await settle();
        expect(dom.window.document.querySelector('#view h2').textContent).toBe('Controls');
        expect(dom.window.document.querySelector('#s-table')).toBeNull();
        expect(dom.window.document.querySelector('#view .error')).toBeNull();
        expect(dom.window.document.querySelector('#view').getAttribute('aria-busy')).toBe('false');
    } finally { dom.window.close(); }
});

test('failed panels offer a working retry and rejected requests do not stay cached', async () => {
    let fail = true;
    const dom = dashboard((url) => {
        if (url.includes('/config') && fail) throw new Error('Temporary outage');
        return fixture(url);
    });
    try {
        await settle();
        const doc = dom.window.document;
        expect(doc.querySelector('#c-config').textContent).toContain('Temporary outage');
        fail = false;
        doc.querySelector('#c-config button[data-retry]').click();
        await settle();
        expect(doc.querySelector('#c-config').textContent).toContain('No config document');
        expect(doc.querySelector('#c-config .error')).toBeNull();
    } finally { dom.window.close(); }
});
