const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const DAY = E.DAY;
const T0 = Date.UTC(2026, 9, 1);
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const tax = {
  conv: { english: Array.from({ length: 41 }, (_, i) => Math.max(1, Math.round(i * 0.9))), math: Array.from({ length: 42 }, (_, i) => Math.max(1, Math.round(i * 0.88))), reading: Array.from({ length: 28 }, (_, i) => Math.max(1, Math.round(i * 1.33))), science: Array.from({ length: 35 }, (_, i) => Math.max(1, Math.round(i * 1.06))) },
  subs: {
    'e.comma': { sec: 'english', weight: 0.12, diff: 3, t: 35, label: 'Commas' },
    'e.transition': { sec: 'english', weight: 0.08, diff: 3, t: 40, label: 'Transitions' },
    'm.linear': { sec: 'math', weight: 0.10, diff: 2, t: 60, label: 'Linear equations' },
    'm.trig': { sec: 'math', weight: 0.02, diff: 4, t: 75, label: 'Trig' },
    'r.inference': { sec: 'reading', weight: 0.2, diff: 3, t: 60, label: 'Inference' },
  },
};

function bankFor(sub, n, opts = {}) {
  return Array.from({ length: n }, (_, i) => ({ id: `${sub}-${i}`, sec: tax.subs[sub].sec, sub, diff: (i % 5) + 1, t: tax.subs[sub].t, ...opts }));
}
const bank = [
  ...bankFor('e.comma', 15), ...bankFor('e.transition', 10), ...bankFor('m.linear', 15), ...bankFor('m.trig', 6),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `r-p1-${i}`, sec: 'reading', sub: 'r.inference', diff: 3, t: 60, unit: 'p1' })),
  ...bankFor('m.linear', 3, { held: true }).map((x, i) => ({ ...x, id: `held-${i}` })),
];
const item = id => bank.find(b => b.id === id);
const ans = (state, id, ok, extra = {}, at = T0) => E.record(state, item(id), { ok, ms: 20000, sid: 's1', conf: 'sure', ...extra }, at);

test('probability model is monotonic and invertible', () => {
  assert.ok(E.pCorrect(1, 3) > E.pCorrect(0, 3));
  assert.ok(E.pCorrect(0, 2) > E.pCorrect(0, 4));
  const d = E.diffForP(0.5, 0.7);
  assert.ok(Math.abs(E.pCorrect(0.5, d) - 0.7) < 1e-9);
});

test('confident correct raises ability more than a guessed correct; misses lower it', () => {
  const a = E.newState(), b = E.newState(), c = E.newState();
  ans(a, 'e.comma-2', true);
  ans(b, 'e.comma-2', true, { conf: 'guess' });
  ans(c, 'e.comma-2', false);
  assert.ok(a.skills['e.comma'].theta > b.skills['e.comma'].theta);
  assert.ok(b.skills['e.comma'].theta > 0);
  assert.ok(c.skills['e.comma'].theta < 0);
  // hints reduce credit too
  const h = E.newState(); ans(h, 'e.comma-2', true, { hint: true });
  assert.ok(h.skills['e.comma'].theta < a.skills['e.comma'].theta);
});

test('one correct answer is never mastery; mastery needs sessions, variety and time pressure', () => {
  const s = E.newState();
  ans(s, 'e.comma-0', true);
  assert.equal(s.skills['e.comma'].stage, 'understood');
  // many correct untimed answers in ONE session: practicing at most
  for (let i = 1; i < 8; i++) ans(s, `e.comma-${i}`, true, { typical: 3 });
  assert.equal(s.skills['e.comma'].stage, 'practicing');
  // timed and correct across three sessions on different items
  let k = 8;
  for (const sid of ['s2', 's3', 's4']) for (let j = 0; j < 2; j++) ans(s, `e.comma-${k++}`, true, { sid, timed: true, ms: 15000, typical: 3 }, T0 + DAY * (k));
  assert.ok(['mastered', 'retained'].includes(s.skills['e.comma'].stage), s.skills['e.comma'].stage);
});

test('spaced repetition grows once per session, resets on a miss, and a relapse is due now', () => {
  const s = E.newState();
  ans(s, 'e.comma-0', true, { sid: 'a' }, T0);
  const i1 = s.skills['e.comma'].ivl;
  ans(s, 'e.comma-1', true, { sid: 'a' }, T0 + 1000);
  assert.equal(s.skills['e.comma'].ivl, i1, 'second success in the same session does not stretch the interval');
  ans(s, 'e.comma-2', true, { sid: 'b' }, T0 + DAY);
  assert.ok(s.skills['e.comma'].ivl > i1);
  ans(s, 'e.comma-3', false, { sid: 'c' }, T0 + 2 * DAY);
  assert.equal(s.skills['e.comma'].ivl, 1);
  // force mastery then miss
  const sk = s.skills['e.comma'];
  sk.stage = 'mastered'; sk.masteredAt = T0;
  ans(s, 'e.comma-4', false, { sid: 'd' }, T0 + 30 * DAY);
  assert.equal(sk.relapse, true);
  assert.ok(sk.due <= T0 + 30 * DAY);
  assert.notEqual(sk.stage, 'mastered');
});

test('priority favors frequent weak skills over mastered ones and boosts relapses', () => {
  const s = E.newState();
  for (let i = 0; i < 4; i++) ans(s, `e.comma-${i}`, false, { sid: 'x' });
  const m = (s.skills['m.linear'] = Object.assign(JSON.parse(JSON.stringify(s.skills['e.comma'])), { theta: 3, stage: 'mastered', due: T0 + 20 * DAY, recent: [], n: 20 }));
  const r = E.rankSkills(s, tax, { now: T0 + DAY });
  assert.equal(r[0].sub, 'e.comma');
  const lin = r.find(x => x.sub === 'm.linear');
  assert.ok(lin.score < r[0].score / 5);
  m.relapse = true; m.due = T0; m.stage = 'practicing';
  const r2 = E.rankSkills(s, tax, { now: T0 + DAY });
  assert.ok(r2.find(x => x.sub === 'm.linear').score > lin.score);
});

test('difficulty adapts: scaffolds after misses, rises after fast streaks, stays ACT-level once practicing', () => {
  const s = E.newState();
  ans(s, 'e.comma-2', false); ans(s, 'e.comma-3', false);
  const low = E.targetDifficulty(s.skills['e.comma'], tax.subs['e.comma']);
  assert.ok(low <= 2, `scaffold level ${low}`);
  const f = E.newState();
  for (let i = 0; i < 3; i++) ans(f, `e.comma-${i}`, true, { ms: 10000 });
  const hi = E.targetDifficulty(f.skills['e.comma'], tax.subs['e.comma']);
  assert.ok(hi >= 3, `rises to ${hi}`);
  f.skills['e.comma'].stage = 'practicing'; f.skills['e.comma'].theta = -2;
  assert.ok(E.targetDifficulty(f.skills['e.comma'], tax.subs['e.comma']) >= 3);
});

test('item picking never uses held-out simulation items or repeats within a session', () => {
  const s = E.newState();
  const used = new Set();
  for (let i = 0; i < 15; i++) {
    const it = E.pickItem(s, bank, 'm.linear', { used, tax, rng: seeded(i + 1) });
    assert.ok(it && !it.held && !used.has(it.id));
    used.add(it.id);
  }
  assert.equal(E.pickItem(s, bank, 'm.linear', { used, tax }), null);
});

test('unseen items are preferred over seen ones', () => {
  const s = E.newState();
  for (let i = 0; i < 14; i++) ans(s, `e.comma-${i}`, true);
  const it = E.pickItem(s, bank, 'e.comma', { tax, rng: seeded(3) });
  assert.equal(it.id, 'e.comma-14');
});

test('a session plan fits the time budget, has no duplicates, and keeps passage items together', () => {
  const s = E.newState();
  const { steps, plan } = E.planSession(s, bank, tax, { minutes: 20, rng: seeded(11), now: T0 });
  const ids = steps.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.some(id => id.startsWith('held')));
  const secs = steps.reduce((t, x) => t + item(x.id).t * 1.6, 0);
  assert.ok(secs <= 20 * 60 + 3 * 60 * 1.6, `planned ${secs}s`);
  assert.ok(plan.length >= 2);
  const units = steps.map(x => item(x.id).unit).filter(Boolean);
  for (let i = 1; i < units.length; i++) if (units[i] !== units[i - 1]) assert.ok(!units.slice(0, i - 1).includes(units[i]), 'passage items contiguous');
  const longer = E.planSession(s, bank, tax, { minutes: 60, rng: seeded(11), now: T0 });
  assert.ok(longer.steps.length > steps.length);
});

test('mistake review only targets skills that were missed', () => {
  const s = E.newState();
  ans(s, 'm.trig-0', false);
  const { steps } = E.planSession(s, bank, tax, { minutes: 10, mode: 'review', rng: seeded(5), now: T0 });
  assert.ok(steps.length > 0);
  assert.ok(steps.every(x => x.sub === 'm.trig'));
  assert.ok(!steps.some(x => x.id === 'm.trig-0'), 'review uses new questions first');
});

test('stuck detection switches strategy when practice is not working', () => {
  const s = E.newState();
  let k = 0;
  for (const sid of ['a', 'b', 'c', 'd']) for (let j = 0; j < 4; j++) ans(s, `e.comma-${k++ % 15}`, j === 0, { sid }, T0 + k * DAY);
  assert.equal(s.skills['e.comma'].stuck, true);
  assert.ok(s.skills['e.comma'].strategy >= 1);
});

test('score estimates are labeled insufficient without evidence and never pretend precision', () => {
  const s = E.newState();
  const est = E.estimateScores(s, tax);
  assert.equal(est.english.level, 'insufficient');
  assert.equal(est.composite, null);
  for (let i = 0; i < 45; i++) ans(s, `e.comma-${i % 15}`, i % 3 !== 0);
  for (let i = 0; i < 4; i++) ans(s, `e.transition-${i}`, true);
  const est2 = E.estimateScores(s, tax);
  assert.equal(est2.english.level, 'preliminary');
  assert.ok(est2.english.high - est2.english.low >= 2);
});

test('evaluation warns when practice improves but official scores do not', () => {
  const s = E.newState();
  for (let i = 0; i < 60; i++) ans(s, `e.comma-${i % 15}`, i % 2 === 0, {}, T0 + i);
  for (let i = 0; i < 60; i++) ans(s, `e.comma-${i % 15}`, true, {}, T0 + 100 + i);
  s.checkpoints.push({ at: T0, composite: 24 }, { at: T0 + 10 * DAY, composite: 24 });
  const ev = E.evaluate(s, T0 + 11 * DAY);
  assert.ok(ev.warnings.some(w => w.includes('official')));
});

test('follow-up after a miss is a different question on the same skill', () => {
  const s = E.newState();
  ans(s, 'e.transition-0', false);
  const f = E.followUp(s, bank, 'e.transition', new Set(['e.transition-0']), tax);
  assert.equal(f.sub, 'e.transition');
  assert.notEqual(f.id, 'e.transition-0');
});

test('state migration keeps existing data and fills new fields', () => {
  const old = { attempts: [{ id: 'x' }], skills: { a: {} } };
  const m = E.migrate(old);
  assert.equal(m.attempts.length, 1);
  assert.ok(Array.isArray(m.checkpoints));
  assert.equal(m.v, 2);
});
