// Validates the taxonomy and every question's classification (bank, practice test, generated pool).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]).filter(f => !['engine.js', 'figures.js', 'app.js'].includes(f));
const window = {};
for (const f of files) new Function('window', 'self', fs.readFileSync(path.join(root, f), 'utf8'))(window, window);
const D = window.ACED_DATA, T = D.taxonomy, G = window.ACED_MATHGEN;
const key = c => String(c).replace(/<[^>]+>/g, '').replace(/\s+/g, '').replace(/−/g, '-').toLowerCase();
const sum = arr => arr.reduce((a, b) => a + b, 0);
const catShare = (sec, cat) => sum(Object.values(T.subs).filter(s => s.sec === sec && s.cat === cat).map(s => s.weight));

// The same generated pool the app builds at load time.
let seed = 20261014;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pool = Array.from({ length: G.count * 6 }, (_, i) => G.at(i, rnd));

test('practice weights total 100% in every section', () => {
  for (const sec of ['english', 'math', 'reading', 'science']) {
    const w = sum(Object.values(T.subs).filter(s => s.sec === sec).map(s => s.weight));
    assert.ok(Math.abs(w - 1) < 1e-9, `${sec} sums to ${w}`);
  }
});

test('English category shares sit inside the official ranges', () => {
  const pow = catShare('english', 'POW'), kla = catShare('english', 'KLA'), cse = catShare('english', 'CSE');
  assert.ok(pow >= 0.38 && pow <= 0.43, `POW ${pow}`);
  assert.ok(kla >= 0.18 && kla <= 0.23, `KLA ${kla}`);
  assert.ok(cse >= 0.38 && cse <= 0.43, `CSE ${cse}`);
});

test('Reading practice targets: KID 50%, CS 30%, IKI 20%', () => {
  assert.ok(Math.abs(catShare('reading', 'KID') - 0.5) < 0.005);
  assert.ok(Math.abs(catShare('reading', 'CS') - 0.3) < 0.005);
  assert.ok(Math.abs(catShare('reading', 'IKI') - 0.2) < 0.005);
});

test('Math matches the official blueprint: PHM 80% (N 10-12, A/F/G 17-20, S 12-15), IES 20%', () => {
  const r = c => catShare('math', c);
  assert.ok(Math.abs(r('IES') - 0.2) < 1e-9, `IES ${r('IES')}`);
  assert.ok(Math.abs(r('N') + r('A') + r('F') + r('G') + r('S') - 0.8) < 1e-9);
  assert.ok(r('N') >= 0.10 && r('N') <= 0.12);
  for (const c of ['A', 'F', 'G']) assert.ok(r(c) >= 0.17 && r(c) <= 0.20, `${c} ${r(c)}`);
  assert.ok(r('S') >= 0.12 && r('S') <= 0.15);
});

test('Math covers the required topics without overweighting rare ones', () => {
  const need = ['m.f.explog', 'm.f.piecewise', 'm.n.complex', 'm.n.vecmat', 'm.f.transform', 'm.g.conics', 'm.g.similar', 'm.s.model'];
  for (const s of need) assert.ok(T.subs[s], `missing ${s}`);
  for (const s of ['m.n.vecmat', 'm.g.conics', 'm.f.trig', 'm.g.transform']) assert.ok(T.subs[s].weight <= 0.015, `${s} overweighted`);
});

test('every bank and practice-test question is correctly formed and classified', () => {
  for (const it of D.items) {
    const s = T.subs[it.sub];
    assert.ok(s, `${it.id}: unknown sub ${it.sub}`);
    assert.equal(s.sec, it.sec, `${it.id}: sub ${it.sub} is not a ${it.sec} skill`);
    assert.equal(it.cat, s.cat, `${it.id}: cat ${it.cat} should be ${s.cat}`);
    assert.equal(it.c.length, 4, `${it.id}: needs 4 choices`);
    assert.equal(new Set(it.c.map(key)).size, 4, `${it.id}: duplicate choices`);
    assert.ok(it.a >= 0 && it.a <= 3, `${it.id}: bad key`);
    if (it.unit) assert.ok(D.units[it.unit], `${it.id}: missing passage`);
    if (it.u) assert.ok(D.units[it.unit].passage.includes(`{${it.u}|`), `${it.id}: underline ${it.u} not in passage`);
  }
});

test('every generated math question is valid and classified', () => {
  for (const g of pool) {
    const s = T.subs[g.sub];
    assert.ok(s && s.sec === 'math', `template ${g.tpl}: bad sub ${g.sub}`);
    assert.equal(new Set(g.c.map(key)).size, 4, `template ${g.tpl}: duplicate choices ${g.c}`);
    assert.ok(!/NaN|Infinity|undefined\b(?! at)|\$\{/.test(g.q + g.c.join('')), `template ${g.tpl}: broken text`);
  }
});

test('every skill has a lesson; every math skill names Desmos or paper as fastest', () => {
  for (const [s, info] of Object.entries(T.subs)) {
    assert.ok(D.lessons[s], `no lesson for ${s}`);
    if (info.sec === 'math') assert.ok(['desmos', 'paper'].includes(D.lessons[s].fastest), `${s} has no fastest route`);
  }
});

test('validated math training bank covers every math category (shortages are reported, not padded)', () => {
  const training = D.items.filter(i => i.sec === 'math' && !i.held);
  assert.ok(training.every(i => i.validated), 'every math training item must come from the validation pipeline');
  for (const cat of ['N', 'A', 'F', 'G', 'S', 'IES']) assert.ok(training.some(i => i.cat === cat), `no validated ${cat} training items`);
  const short = Object.entries(T.subs).filter(([s, i]) => i.sec === 'math' && !training.some(x => x.sub === s)).map(([s]) => s);
  if (short.length) console.log('math skills with no validated training items yet:', short.join(', '));
});

test('practice-test math items are validated and span authentic difficulty', () => {
  const f = D.items.filter(i => i.form === 'F1' && i.sec === 'math');
  assert.equal(f.length, 45);
  assert.ok(f.every(i => i.validated));
  const d = [1, 2, 3, 4].map(k => f.filter(i => i.diff === k).length);
  assert.ok(d[2] + d[3] >= 15, `too few level 3-4 items: ${d}`);
  assert.ok(d[0] <= 9, `too many level-1 items: ${d}`);
});

test('Aced Practice Test 1 has the enhanced structure and is held out of training', () => {
  const f = D.forms.find(x => x.id === 'F1');
  const scored = sec => f.sections[sec].items.length - f.sections[sec].ft.length;
  assert.deepEqual([scored('english'), scored('math'), scored('reading'), scored('science')], [40, 41, 27, 34]);
  for (const sec in f.sections) for (const id of f.sections[sec].items) assert.ok(D.items.find(i => i.id === id).held);
});

test('official conversions are kept separate and Test 4 is not mixed into the estimate curve', () => {
  assert.ok(window.ACED_OFFICIAL.tests['4'], 'Test 4 table available for logging the final assessment');
  const src = fs.readFileSync(path.join(root, 'data/taxonomy.js'), 'utf8');
  assert.match(src, /Tests 1-3/);
});
