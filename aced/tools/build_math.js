#!/usr/bin/env node
// Turns validated workflow output into site data, with local checks that do not trust the writers:
//   1. code-verified keys: the item's `check` expression must evaluate to the keyed choice
//   2. structure: 4 distinct choices, one key, known subskill
//   3. repetition: near-duplicate stems are rejected
//   4. answer positions: numeric choices ascending (ACT convention), others balanced
// Difficulty is taken from the independent reviewer's rating, not the writer's label.
// Usage: node tools/build_math.js <workflow-result.json> [--report out.json]
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reportPath = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : null;
const win = {};
new Function('window', fs.readFileSync(path.join(root, 'data/taxonomy.js'), 'utf8'))(win);
const TAX = win.ACED_DATA.taxonomy;
const CAT = { n: 'N', a: 'A', f: 'F', g: 'G', s: 'S', ies: 'IES' };

const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/−/g, '-').replace(/[$,]/g, '').trim();
// Numeric value of a choice when it is a plain number, fraction, percent, or kπ; otherwise null.
function num(c) {
  let s = strip(c).replace(/\s*(cm|in|ft|m|mi|km|kg|lb|g|s|min|hours?|square|cubic|units?|degrees?|°|feet|inches|meters|dollars)\b.*$/i, '').trim();
  let m;
  if ((m = s.match(/^(-?\d*\.?\d*)\s*π$/))) return (m[1] === '' || m[1] === '-' ? (m[1] === '-' ? -1 : 1) : +m[1]) * Math.PI;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/))) return +m[1] / +m[2];
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)%$/))) return +m[1];
  if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
  return null;
}
const words = s => new Set(strip(s).toLowerCase().match(/[a-z]{3,}/g) || []);
const jacc = (a, b) => { const A = words(a), B = words(b); let i = 0; A.forEach(w => { if (B.has(w)) i++; }); return i / Math.max(1, A.size + B.size - i); };

const report = { accepted: [], rejected: [] };
const ok = [];
for (const it of src.passed || []) {
  const why = [];
  if (!TAX.subs[it.sub] || TAX.subs[it.sub].sec !== 'math') why.push(`unknown sub ${it.sub}`);
  if (!Array.isArray(it.c) || it.c.length !== 4) why.push('needs 4 choices');
  else if (new Set(it.c.map(c => strip(c).toLowerCase().replace(/\s+/g, ''))).size !== 4) why.push('duplicate choices');
  let verified = 'solver-verified';
  if (it.check) {
    let v;
    try { v = Function('"use strict"; return (' + it.check + ')')(); } catch (e) { why.push('check expression error: ' + e.message); }
    if (typeof v === 'number' && isFinite(v)) {
      const vals = it.c.map(num);
      if (vals.every(x => x != null)) {
        const tol = Math.max(1e-6, Math.abs(v) * 0.004);
        const hits = vals.map((x, i) => Math.abs(x - v) <= tol ? i : -1).filter(i => i >= 0);
        if (hits.length !== 1 || hits[0] !== it.a) why.push(`code check ${v} does not match key ${it.a} (choices ${vals.map(x => +x.toFixed(4))})`);
        else verified = 'code-verified';
      }
    }
  }
  for (const o of ok) if (jacc(o.q, it.q) > 0.6) { why.push(`near-duplicate of slot ${o.slot}`); break; }
  if (why.length) { report.rejected.push({ slot: it.slot, sub: it.sub, why }); continue; }
  it.verified = verified;
  ok.push(it);
}

// Answer ordering: ascending for numeric sets; otherwise rotate toward the least-used letter.
const count = [0, 0, 0, 0];
function place(it) {
  const vals = it.c.map(num);
  let order = [0, 1, 2, 3];
  if (vals.every(x => x != null)) order.sort((a, b) => vals[a] - vals[b]);
  else {
    const target = count.indexOf(Math.min(...count));
    order = [0, 1, 2, 3].filter(k => k !== it.a);
    order.splice(target, 0, it.a);
  }
  it.c = order.map(k => it.c[k]); it.w = order.map(k => (it.w || [])[k] || ''); it.a = order.indexOf(it.a);
  count[it.a]++;
}

function toItem(it, id, extra) {
  place(it);
  const r = it.review || {};
  const o = Object.assign({ id, sec: 'math', sub: it.sub, cat: CAT[it.sub.split('.')[1]], model: !!it.model, diff: Math.max(1, Math.min(4, r.ratedDiff || it.diff)), steps: r.ratedSteps || it.steps, t: 67,
    q: it.q, c: it.c, a: it.a, e: it.e, w: it.w, strat: it.strat, desmos: it.desmos || '', fastest: it.fastest, validated: it.verified }, extra);
  if (it.fig && Object.keys(it.fig).length) o.fig = it.fig;
  return o;
}

const slots = new Map(ok.map(it => [it.slot, it]));
const form = [], spare = ok.filter(it => it.slot > 45);
const shortage = [];
for (let n = 1; n <= 45; n++) {
  let it = slots.get(n);
  if (!it) {
    // Fill a failed slot only with a validated spare from the same reporting category.
    const want = ((src.slots || []).find(s => s.slot === n) || {}).sub;
    const cat = want && want.split('.')[1];
    const k = spare.findIndex(s => s.sub.split('.')[1] === cat);
    if (k >= 0) { it = spare.splice(k, 1)[0]; report.accepted.push({ slot: n, note: `filled from spare slot ${it.slot}` }); }
  }
  if (!it) { shortage.push(n); continue; }
  form.push(toItem(Object.assign({}, it), `F1-M${n}`, { n, held: true, form: 'F1' }));
}
const bank = spare.map((it, i) => toItem(Object.assign({}, it), `M2-${it.slot}`, { n: i + 1 }));

const summary = { validatedFromWorkflow: (src.passed || []).length, failedInWorkflow: (src.failed || []).length, rejectedLocally: report.rejected.length, formItems: form.length, bankItems: bank.length, shortage,
  codeVerified: form.concat(bank).filter(i => i.validated === 'code-verified').length, letters: count };
console.log(JSON.stringify(summary, null, 1));
for (const r of report.rejected) console.log('REJECT slot', r.slot, r.sub, r.why.join('; '));
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ summary, report, failed: src.failed }, null, 1));
if (shortage.length) { console.error(`SHORTAGE: ${shortage.length} form slots have no validated question (${shortage.join(', ')}). Not writing a misleading test.`); process.exit(2); }

const head = `// Generated by tools/build_math.js from independently validated workflow output. Do not hand-edit.\nwindow.ACED_DATA = window.ACED_DATA || {};\n(function (D) {\n  D.items = D.items || [];\n`;
fs.writeFileSync(path.join(root, 'data/form1-math.js'), `${head}  // Aced Practice Test 1 — Math (45 questions; field-test items 7, 16, 29, 40)\n  D.items.push(...${JSON.stringify(form, null, 1)});\n})(window.ACED_DATA);\n`);
fs.writeFileSync(path.join(root, 'data/bank-math.js'), `${head}  // Validated Math training bank (not part of any practice test)\n  D.items.push(...${JSON.stringify(bank, null, 1)});\n})(window.ACED_DATA);\n`);
console.log('wrote data/form1-math.js and data/bank-math.js');
