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
    expect(markup).toContain('src="https://college.example/photo.jpg"');
    expect(markup).toContain('&lt;Student&gt;');
    expect(markup).toContain('referrerpolicy="no-referrer"');
});
test('unusable photo URLs leave initials rather than a broken or unsafe image', () => {
    const { run, handlers } = helpers();
    for (const url of ['javascript:alert(1)', 'https://user:secret@college.example/image', null]) {
        expect(run(`avatar('student', 'Student', ${JSON.stringify(url)}).s`)).not.toContain('<img');
    }
    const image = { matches: () => true, remove: jest.fn() };
    handlers.error({ target: image });
    expect(image.remove).toHaveBeenCalled();
});
