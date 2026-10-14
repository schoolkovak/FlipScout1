// Aced app: study modes, exam runner, dashboard. Learning logic lives in engine.js (AcedEngine).
'use strict';
const $ = id => document.getElementById(id);
const E = window.AcedEngine;
const D = window.ACED_DATA || {};
D.units = D.units || {}; D.items = D.items || []; D.forms = D.forms || []; D.lessons = D.lessons || {};
const OFFICIAL = window.ACED_OFFICIAL || { tests: {} };
const LET = ['A', 'B', 'C', 'D'];
const NAMES = { english: 'English', math: 'Math', reading: 'Reading', science: 'Science' };
const SECTIONS = ['english', 'math', 'reading', 'science'];
// Seconds per question for every timed quiz and test (user rule): English 42, Math 67, Reading 67, Science 60.
const SECS = { english: 42, math: 67, reading: 67, science: 60 };
// Generated math pool: answers are computed by construction, so these add fresh variety for training.
// Retired: template questions were too mechanical for ACT-level practice (audit 2026-10-14). Kept for
// reference only; practice and diagnostics use independently validated questions.
(function addGenerated() {
  if (!window.ACED_MATHGEN || !window.ACED_USE_TEMPLATES) return;
  const rnd = mulberry(20261014);
  const CAT = { n: 'N', a: 'A', f: 'F', g: 'G', s: 'S', ies: 'IES' };
  for (let i = 0; i < ACED_MATHGEN.count * 6; i++) {
    const g = ACED_MATHGEN.at(i, rnd);
    const order = shuffle([0, 1, 2, 3], rnd);
    const nums = g.c.every(x => /^-?[\d.]+$/.test(String(x)));
    const idx = nums ? [0, 1, 2, 3].sort((a, b) => +g.c[a] - +g.c[b]) : order;
    D.items.push({ id: 'G-' + i, sec: 'math', sub: g.sub, cat: CAT[g.sub.split('.')[1]], diff: g.diff || 2, t: 67, q: g.q, c: idx.map(k => g.c[k]), a: idx.indexOf(0), e: g.e, gen: true, model: !!g.model,
      desmos: g.desmos, strat: g.strat || '' });
  }
})();
const ITEMS = D.items;
const BYID = Object.create(null);
ITEMS.forEach(i => { BYID[i.id] = i; });
const TAX = prepTax();

const ICON = {
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>'
};

// ---------- storage (every access guarded) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
let ST = E.migrate(store.get('aced-state', null));
ST.prefs = Object.assign({ includeScience: false, minutes: 20, released: [], scores: { english: 30, math: 20, reading: 33 } }, ST.prefs || {});
const saveState = () => store.set('aced-state', ST);
const getSessions = () => store.get('aced-sessions', {});
function saveRun() {
  if (!R) return;
  R.updated = Date.now();
  const all = getSessions(); all[R.id] = R;
  const ok = store.set('aced-sessions', all);
  $('saved').textContent = ok ? 'Saved' : 'Not saved';
}
function dropRun(id) { const all = getSessions(); delete all[id]; store.set('aced-sessions', all); }

// ---------- helpers ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const pct = (a, b) => b ? Math.round(100 * a / b) : null;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const roundHalfUp = x => Math.max(1, Math.floor(x + 0.5));
const subLabel = s => (TAX.subs[s] && TAX.subs[s].label) || s;
const stagePill = st => `<span class="pill ${st}">${esc(E.STAGE_LABEL[st] || st)}</span>`;

function prepTax() {
  const t = JSON.parse(JSON.stringify(D.taxonomy || { subs: {}, conv: {} }));
  t.subs = t.subs || {}; t.conv = t.conv || {};
  for (const it of ITEMS) if (it.sub && !t.subs[it.sub]) t.subs[it.sub] = { sec: it.sec, label: it.sub, weight: 0.01, diff: 3, t: SECS[it.sec] };
  for (const sec of SECTIONS) {
    const subs = Object.values(t.subs).filter(s => s.sec === sec);
    const sum = subs.reduce((a, s) => a + (s.weight || 0), 0) || 1;
    subs.forEach(s => { s.weight = (s.weight || 0) / sum; });
  }
  return t;
}
// Items reserved for Aced practice tests stay out of training until that form has been taken.
function trainingBank() { const rel = new Set(ST.prefs.released || []); return ITEMS.filter(i => !i.held || rel.has(i.form)); }
const itemOf = x => typeof x === 'string' ? BYID[x] : x;

// Untested skills start from the student's real section scores instead of zero.
E.applyPriors(ST, TAX, ST.prefs.scores); saveState();

// ---------- theme ----------
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function paintTheme() {
  const dark = isDark();
  for (const b of [$('themeBtn'), $('themeBtn2')]) { b.innerHTML = dark ? ICON.sun : ICON.moon; b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); }
  if (calc) calc.updateSettings({ invertedColors: dark });
}
function toggleTheme() { document.documentElement.dataset.theme = isDark() ? 'light' : 'dark'; store.set('aced-theme', document.documentElement.dataset.theme); paintTheme(); }
{ const t = store.get('aced-theme', null); if (t) document.documentElement.dataset.theme = t; }
$('themeBtn').onclick = $('themeBtn2').onclick = toggleTheme;
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintTheme);

// ---------- passage rendering ----------
// English markup: paragraphs split by blank lines; a line "[3]" is a paragraph number; {12|text} is
// underlined portion 12; [A]-[D] are insertion points; [[2]] is a sentence number.
// Science: {fig:Figure 1} places a figure. Reading paragraphs are numbered.
function renderUnit(u) {
  if (!u) return '';
  const figs = Object.fromEntries((u.figures || []).map(f => [f.id, f]));
  const placed = new Set();
  const para = (txt, num) => {
    let h = esc(txt)
      .replace(/\{(\d+)\|([^}]*)\}/g, '<u data-n="$1">$2</u><sup class="un">$1</sup>')
      .replace(/\[\[(\d+)\]\]/g, '<span class="sn">[$1]</span>')
      .replace(/\[([A-D])\]/g, '<span class="lp">[$1]</span>')
      .replace(/\{fig:([^}]+)\}/g, (m, id) => { placed.add(id); return '</p>' + (window.AcedFigures ? AcedFigures.render(figs[id]) : '') + '<p>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    return num ? `<p class="num" data-p="${num}">${h}</p>` : `<p>${h}</p>`;
  };
  const block = (text, numbered) => {
    let n = 0;
    return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
      const ph = p.match(/^\[(\d+)\]$/);
      if (ph) return `<div class="ph">[${ph[1]}]</div>`;
      return para(p, numbered ? ++n : 0);
    }).join('');
  };
  const numbered = u.sec === 'reading';
  let h = `${u.label ? `<div class="meta">${esc(u.label)}</div>` : ''}${u.title ? `<div class="pt">${esc(u.title)}</div>` : ''}${u.intro ? `<div class="intro">${esc(u.intro)}</div>` : ''}`;
  h += block(u.passage, numbered);
  if (u.passageB) h += `<div class="pb">${u.titleB ? `<div class="pt">${esc(u.titleB)}</div>` : ''}${u.introB ? `<div class="intro">${esc(u.introB)}</div>` : ''}${block(u.passageB, numbered)}</div>`;
  for (const f of u.figures || []) if (!placed.has(f.id) && window.AcedFigures) h += AcedFigures.render(f);
  return h.replace(/<p><\/p>/g, '');
}
function markPassage(it, showEvidence) {
  const P = $('passage');
  P.querySelectorAll('u.cur').forEach(u => u.classList.remove('cur'));
  P.querySelectorAll('p.ev').forEach(p => p.classList.remove('ev'));
  const u = it && it.u && P.querySelector(`u[data-n="${it.u}"]`);
  if (u) { u.classList.add('cur'); u.scrollIntoView({ block: 'nearest' }); }
  if (showEvidence && it && it.evp) {
    for (const n of [].concat(it.evp)) { const p = P.querySelector(`p[data-p="${n}"]`); if (p) { p.classList.add('ev'); p.scrollIntoView({ block: 'nearest' }); } }
  }
}
function itemFigure(it) { return it && it.fig && window.AcedFigures ? AcedFigures.render(it.fig) : ''; }

// ---------- app shell / views ----------
let TAB = store.get('aced-tab', 'study');
let R = null, tick = null, calc = null, hl = false, saveCount = 0;
const UI = { sec: store.get('aced-sec', 'math'), len: ST.prefs.minutes || 20, tSec: 'english', tSubs: [], sSec: 'all', qzSec: 'english', qzN: 10, qzTimed: true, cpTest: Object.keys(OFFICIAL.tests)[0] || '1', skSec: 'english', planSeed: 1 };

function show(which) {
  $('app').hidden = which !== 'app'; $('test').hidden = which !== 'test';
  $('calc').hidden = true; $('paused').hidden = true;
  if (which === 'app') { stopTick(); R = null; }
  scrollTo(0, 0);
}
function go(tab) { TAB = tab; store.set('aced-tab', tab); show('app'); renderView(); }
function renderView() {
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === TAB));
  const v = { study: viewStudy, simulate: viewSimulate, official: viewOfficial, skills: viewSkills, progress: viewProgress, settings: viewSettings }[TAB] || viewStudy;
  $('view').innerHTML = v();
  paintTheme();
}
$('tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };

function resumeList() {
  const all = Object.values(getSessions()).sort((a, b) => b.updated - a.updated);
  if (!all.length) return '';
  return `<h2>In progress</h2><div class="grid">${all.map(s => {
    let where = '';
    if (s.kind === 'train') where = `${s.idx} of ${s.steps.length} questions done`;
    else { const p = s.parts[s.pi]; where = s.onBreak ? `On break before ${NAMES[p.sec]}` : `${NAMES[p.sec]} · question ${s.cur + 1} of ${p.items.length} · ${Object.keys(s.ans || {}).length} answered`; }
    const clock = s.kind === 'train' ? `${fmt(s.el || 0)} spent` : s.timed ? `${fmt(s.left)} left` : `${fmt(s.el)} elapsed`;
    return `<div class="card hero"><h3>${esc(s.label)}</h3><div class="meta">${where}</div><div class="meta">${clock} · saved ${new Date(s.updated).toLocaleString()}</div>
      <div class="row"><button class="btn pri" data-act="resume" data-id="${s.id}">Resume</button><button class="btn" data-act="discard" data-id="${s.id}">Discard</button></div></div>`;
  }).join('')}</div>`;
}

function priorityList(k, sections) {
  const pr = E.topPriorities(ST, TAX, k, Date.now(), sections);
  if (!ITEMS.length) return '<p class="meta">The question bank has not loaded.</p>';
  return pr.map((p, i) => `<div class="prio"><div class="rank">${i + 1}</div><div><b>${esc(p.label)}</b> <span class="meta">${NAMES[p.sec]}</span> ${stagePill(p.stage)}${p.stuck ? ' <span class="pill bad">Not improving</span>' : ''}</div>
    <div class="meta small">≈${p.gainPts} pts</div>
    <div class="why">${esc(p.reasons.slice(0, 3).join('; ') || 'not practiced yet')}. ${esc(p.recommend)}.${p.advice ? ' ' + esc(p.advice) : ''}</div></div>`).join('');
}

function practiceCount(sec, minutes, pace) { return Math.max(5, Math.floor(minutes * 60 / (SECS[sec] * (pace || 1)))); }
function viewStudy() {
  const sec = UI.sec;
  const missed = new Set(ST.attempts.filter(a => !a.ok && a.sec === sec).map(a => a.sub));
  const lens = [10, 20, 30, 60];
  const n = practiceCount(sec, UI.len);
  const sc = ST.prefs.scores || {};
  const diagDone = ST.attempts.some(a => a.mode === 'diag' && a.sec === sec);
  const tSubs = Object.entries(TAX.subs).filter(([s, i]) => i.sec === sec && trainingBank().some(x => x.sub === s)).sort((a, b) => b[1].weight - a[1].weight);
  const qzN = Math.max(5, UI.qzN);
  return `${resumeList()}
  <div class="spread" style="margin-top:18px"><div class="seg" role="group" aria-label="Section">${SECTIONS.map(s => `<button data-act="pickSec" data-sec="${s}" aria-pressed="${sec === s}">${NAMES[s]}</button>`).join('')}</div>
    <span class="meta small">Starting levels from your scores: ${['english', 'math', 'reading', 'science'].filter(s => sc[s]).map(s => `${NAMES[s]} ${sc[s]}`).join(' · ') || 'none set'} (change in Settings)</span></div>
  ${!diagDone ? `<div class="card hero" style="margin-top:14px"><div class="spread"><div><h3>${NAMES[sec]} diagnostic</h3><div class="meta">${sec === 'math' ? `20 questions covering every Math category, easiest to hardest, timed at ${SECS.math}s each (${fmt(20 * SECS.math)}). Measures where you actually stand so practice targets the right skills.` : `Full passages covering this section's skills, timed at ${SECS[sec]}s per question.`}</div></div>
    <button class="btn pri" data-act="startDiag">Start diagnostic</button></div></div>` : ''}
  <h2>Score-improvement section</h2>
  <div class="card ${diagDone ? 'hero' : ''}">
    <div class="spread"><div><h3>${NAMES[sec]} · ${UI.len}-minute section</h3><div class="meta">${n} questions, timed like the real test (${SECS[sec]}s each), with pause. Picks your highest-value ${NAMES[sec]} skills. Explanations and follow-up questions come in the review after you submit.</div></div>
    <div class="seg" role="group" aria-label="Section length">${lens.map(m => `<button data-act="len" data-m="${m}" aria-pressed="${UI.len === m}">${m} min</button>`).join('')}</div></div>
    <div>${priorityList(3, [sec])}</div>
    <div class="row"><button class="btn pri" data-act="startMax">Start ${n}-question section</button></div>
  </div>
  <h2>Other ways to practice ${NAMES[sec]}</h2>
  <div class="grid">
    <div class="card"><h3>Targeted skills</h3><div class="meta">Pick skills; same timed section format.</div>
      <div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:7px;padding:6px 8px">${tSubs.map(([s, i]) => `<label class="switch small"><input type="checkbox" data-change="tSub" value="${esc(s)}" ${UI.tSubs.includes(s) ? 'checked' : ''}>${esc(i.label)}</label>`).join('') || '<span class="meta">No skills yet.</span>'}</div>
      <button class="btn" data-act="startTargeted" ${UI.tSubs.length ? '' : 'disabled'}>Start ${n}-question section</button></div>
    <div class="card"><h3>Speed section</h3><div class="meta">Same questions, 15% less time per question (${Math.round(SECS[sec] * 0.85)}s). Trains pace without dropping accuracy.</div>
      <button class="btn" data-act="startSpeed">Start ${practiceCount(sec, UI.len, 0.85)}-question speed section</button></div>
    <div class="card"><h3>Mistake review</h3><div class="meta">New questions on the ${NAMES[sec]} skills you have missed. The original questions are not repeated.</div>
      <div class="meta">${missed.size} skill${missed.size === 1 ? '' : 's'} with misses</div>
      <button class="btn" data-act="startReview" ${missed.size ? '' : 'disabled'}>Start review section</button></div>
    <div class="card"><h3>Custom quiz</h3><div class="meta">Any number of questions (minimum 5), timed at ${SECS[sec]}s each with pause.</div>
      <div class="row"><label class="field">Questions<input type="number" min="5" max="100" value="${qzN}" data-change="qzN" style="width:90px"></label>
      <label class="field">Mode<select data-change="qzTimed"><option value="1" ${UI.qzTimed ? 'selected' : ''}>Timed</option><option value="0" ${UI.qzTimed ? '' : 'selected'}>Untimed</option></select></label></div>
      <div class="meta">${qzN} × ${SECS[sec]}s = ${fmt(qzN * SECS[sec])}</div>
      <button class="btn" data-act="startQuiz">Start ${qzN}-question quiz</button></div>
    ${diagDone ? `<div class="card"><h3>Retake diagnostic</h3><div class="meta">Re-measure ${NAMES[sec]} with new questions.</div><button class="btn" data-act="startDiag">Start diagnostic</button></div>` : ''}
  </div>`;
}

function viewSimulate() {
  const sci = !!ST.prefs.simScience;
  const forms = D.forms;
  const mins = s => (s.items || []).length * SECS[s.sec] / 60;
  const formSecs = f => SECTIONS.filter(s => f.sections[s] && (sci || s !== 'science'));
  const sims = (ST.sims || []).slice().reverse();
  return `${resumeList()}
  <h2>Real ACT simulation</h2>
  <p class="sub">Full-length Aced practice tests in the current enhanced format: English 50, Math 45, Reading 36, optional Science 40. Every question is original. Unscored field-test questions are mixed in as on the real test. No hints or feedback until you finish.</p>
  <div class="warn">Uncalibrated: Aced Practice Test 1 is being rebuilt. An audit found its Math difficulty below real Enhanced ACT level, and its English and Reading passages shorter than official ones. Results show raw scores only.</div>
  <label class="switch"><input type="checkbox" data-change="simSci" ${sci ? 'checked' : ''}> Include the optional Science section</label>
  <div class="grid" style="margin-top:10px">${forms.length ? forms.map(f => {
    const secs = formSecs(f);
    const total = secs.reduce((a, s) => a + f.sections[s].items.length * SECS[s] / 60, 0);
    const done = (ST.sims || []).some(x => x.form === f.id && x.full);
    return `<div class="card"><h3>${esc(f.name)}</h3><div class="meta">${secs.map(s => `${NAMES[s]} ${f.sections[s].items.length}`).join(' · ')}</div>
      <div class="meta">${total.toFixed(1)} min of testing + optional 10-minute break${done ? ' · taken before' : ''}</div>
      <div class="row"><button class="btn pri" data-act="startForm" data-f="${f.id}" data-timed="1">Timed</button><button class="btn" data-act="startForm" data-f="${f.id}" data-timed="0">Untimed</button></div></div>`;
  }).join('') : '<p class="meta">No practice tests are loaded.</p>'}</div>
  <h2>Full-length sections</h2>
  <p class="sub">Take one complete section on its own, timed at ${SECS.english}s per English question, ${SECS.math}s per Math question, ${SECS.reading}s per Reading question and ${SECS.science}s per Science question.</p>
  <div class="grid">${forms.flatMap(f => SECTIONS.filter(s => f.sections[s]).map(s => `<div class="card"><h3>${NAMES[s]}</h3><div class="meta">${esc(f.name)} · ${f.sections[s].items.length} questions · ${(f.sections[s].items.length * SECS[s] / 60).toFixed(1)} min${s === 'science' ? ' · optional on the real test' : ''}</div><div class="row"><button class="btn pri" data-act="startFormSection" data-f="${f.id}" data-sec="${s}" data-timed="1">Timed</button><button class="btn" data-act="startFormSection" data-f="${f.id}" data-sec="${s}" data-timed="0">Untimed</button></div></div>`)).join('')}</div>
  ${sims.length ? `<h3 style="margin-top:18px">Your Aced test results</h3><div class="tbl"><table class="t"><tr><th>Date</th><th>Test</th><th>Mode</th><th>English raw</th><th>Math raw</th><th>Reading raw</th><th>Science raw</th></tr>${sims.map(s => `<tr><td>${new Date(s.at).toLocaleDateString()}</td><td>${esc(s.label)}</td><td>${s.timed ? 'Timed' : 'Untimed'}</td>${SECTIONS.map(k => `<td>${(s.raw && s.raw[k]) || (s.scores && s.scores[k] != null ? s.scores[k] + ' (old est.)' : '—')}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}
`;
}

function viewOfficial() {
  const cps = (ST.checkpoints || []).slice().reverse();
  const t = OFFICIAL.tests[UI.cpTest] || {};
  return `  <h2>Official practice test scores</h2>
  <p class="sub">Take an official ACT practice test outside Aced, then enter your raw scores here (number correct on scored questions). These are your baseline and your proof that practice transfers to the real test. Aced also uses them to calibrate its estimates.</p>
  <div class="card"><div class="row">
    <label class="field">Official test<select data-change="cpTest">${Object.keys(OFFICIAL.tests).map(k => `<option value="${k}" ${k === UI.cpTest ? 'selected' : ''}>${esc(OFFICIAL.tests[k].name || 'Practice Test ' + k)}</option>`).join('')}</select></label>
    ${SECTIONS.map(s => `<label class="field">${NAMES[s]} raw (0–${t[s] ? t[s].length - 1 : '?'})<input type="number" min="0" max="${t[s] ? t[s].length - 1 : 50}" id="cp_${s}" placeholder="${s === 'science' ? 'optional' : ''}" style="width:110px"></label>`).join('')}
  </div><div class="meta" id="cpPreview">Enter raw scores to see scale scores.</div><div class="row"><button class="btn pri" data-act="saveCheckpoint">Save checkpoint</button></div></div>
  ${cps.length ? `<div class="tbl" style="margin-top:10px"><table class="t"><tr><th>Date</th><th>Official test</th><th>English</th><th>Math</th><th>Reading</th><th>Science</th><th>Composite</th><th></th></tr>${cps.map(c => `<tr><td>${new Date(c.at).toLocaleDateString()}</td><td>${esc(c.name)}</td>${SECTIONS.map(k => `<td>${c.scores[k] ?? '—'}${c.raw[k] != null ? ` <span class="meta">(${c.raw[k]})</span>` : ''}</td>`).join('')}<td><b>${c.composite ?? '—'}</b></td><td><button class="btn sm ghost" data-act="delCheckpoint" data-at="${c.at}">Remove</button></td></tr>`).join('')}</table></div>` : ''}`;
}
function viewSkills() {
  const now = Date.now();
  const rows = Object.entries(TAX.subs).filter(([, i]) => i.sec === UI.skSec).sort((a, b) => b[1].weight - a[1].weight).map(([s, i]) => {
    const sk = ST.skills[s] || { n: 0, c: 0, stage: 'new', recent: [] };
    const times = ST.attempts.filter(a => a.sub === s && a.ms != null);
    const avg = times.length ? times.reduce((x, a) => x + a.ms, 0) / times.length / 1000 : null;
    const p = E.pCorrect(sk.theta || 0, i.diff || 3);
    const due = sk.due ? (sk.due <= now ? 'Due now' : new Date(sk.due).toLocaleDateString()) : '—';
    const has = trainingBank().some(x => x.sub === s);
    return `<tr><td><b>${esc(i.label)}</b>${i.group ? `<div class="meta small">${esc(i.group)}</div>` : ''}</td><td class="meta">${Math.round(i.weight * 100)}%</td><td>${stagePill(sk.stage)}${sk.stuck ? ' <span class="pill bad">Not improving</span>' : ''}</td>
      <td>${sk.n ? `${pct(sk.c, sk.n)}%<div class="bar"><i style="width:${pct(sk.c, sk.n)}%"></i></div>` : '—'}</td><td>${sk.n}</td>
      <td>${avg != null ? `${avg.toFixed(0)}s <span class="meta">/ ${i.t || SECS[i.sec]}s</span>` : '—'}</td><td>${sk.n ? Math.round(p * 100) + '%' : '—'}</td><td class="meta">${due}</td>
      <td>${has ? `<button class="btn sm" data-act="trainOne" data-sub="${esc(s)}">Practice</button>` : ''}${D.lessons[s] ? ` <button class="btn sm ghost" data-act="lesson" data-sub="${esc(s)}">Lesson</button>` : ''}</td></tr>`;
  }).join('');
  const off = (TAX.official || {})[UI.skSec];
  const modelAtt = UI.skSec === 'math' ? ST.attempts.filter(a => BYID[a.id] && BYID[a.id].model) : [];
  return `<h2>Skills</h2><p class="sub">"Practice weight" is Aced's estimate of how much practice each skill deserves within the section; it is not an official ACT frequency. "At ACT level" is your estimated chance of answering a typical ACT question on that skill correctly.</p>
  <div class="seg" role="group" aria-label="Section" style="margin-bottom:12px">${SECTIONS.map(s => `<button data-act="skSec" data-sec="${s}" aria-pressed="${UI.skSec === s}">${NAMES[s]}</button>`).join('')}</div>
  ${off ? `<div class="card" style="margin-bottom:12px"><b>${esc(off.source)}</b><div class="tbl"><table class="t"><tr><th>Category</th><th>Share of the test</th><th>Your accuracy</th></tr>${off.rows.map(r => {
      const name = r[0].trim(), sub = r[0].startsWith('  ');
      const code = Object.keys(TAX.cats || {}).find(k => TAX.cats[k] === name);
      const att = code ? ST.attempts.filter(a => a.sec === UI.skSec && (BYID[a.id] || {}).cat === code) : [];
      return `<tr><td style="${sub ? 'padding-left:28px;color:var(--muted)' : 'font-weight:600'}">${sub ? '↳ ' : ''}${esc(name)}</td><td>${esc(r[1])}</td><td>${att.length ? `${pct(att.filter(a => a.ok).length, att.length)}% <span class="meta small">(${att.length})</span>` : '<span class="meta">—</span>'}</td></tr>`;
    }).join('')}</table></div>${UI.skSec === 'math' ? `<div class="meta small">Totals: Preparing for Higher Math 80% + Integrating Essential Skills 20% = 100%. The indented rows are parts of the 80% (official ranges overlap; Aced practice uses 11 + 18.5 + 18.5 + 18.5 + 13.5 = 80). Modeling overlaps other categories, so it is not added.</div><div class="meta small">Modeling questions are tagged on top of their category. Your modeling accuracy: ${modelAtt.length ? pct(modelAtt.filter(a => a.ok).length, modelAtt.length) + '% of ' + modelAtt.length : 'no data yet'}.</div>` : ''}</div>` : ''}
  <div id="lessonBox"></div>
  <div class="tbl" style="margin-top:12px"><table class="t"><tr><th>Skill</th><th>Practice weight (est.)</th><th>Stage</th><th>Accuracy</th><th>Tries</th><th>Avg time</th><th>At ACT level</th><th>Next review</th><th></th></tr>${rows}</table></div>`;
}

function lessonHTML(sub) {
  const L = D.lessons[sub];
  if (!L) return '';
  return `<div class="lesson"><b>${esc(L.title || subLabel(sub))}</b>${L.rule ? `<div><b>Rule:</b> ${esc(L.rule)}</div>` : ''}${L.method ? `<div><b>Fastest method:</b> ${esc(L.method)}</div>` : ''}${L.recognize ? `<div><b>How to spot it:</b> ${esc(L.recognize)}</div>` : ''}${L.traps ? `<div><b>Common traps:</b> ${esc(L.traps)}</div>` : ''}${L.example ? `<div><b>Example:</b> ${esc(L.example)}</div>` : ''}</div>`;
}

function lineChart(series, opts) {
  if (!window.AcedFigures || !series.some(s => s.points.length)) return '<p class="meta">Not enough data yet.</p>';
  return `<div class="chart">${AcedFigures.render(Object.assign({ type: 'line', series: series.filter(s => s.points.length) }, opts))}</div>`;
}

function viewProgress() {
  const est = E.estimateScores(ST, TAX);
  const ev = E.evaluate(ST);
  const att = ST.attempts;
  const lvl = { insufficient: 'Not enough data yet', preliminary: 'Preliminary, unvalidated', calibrated: 'Adjusted to your official tests' };
  const cards = SECTIONS.map(s => {
    const a = att.filter(x => x.sec === s), tm = a.filter(x => x.timed), ut = a.filter(x => !x.timed);
    const avg = a.filter(x => x.ms != null);
    const e = est[s];
    return `<div class="card"><div class="spread"><h3>${NAMES[s]}</h3><span class="pill">${lvl[e.level]}</span></div>
      <div class="big">${e.level === 'insufficient' ? '—' : `${e.low}–${e.high}`}</div>
      <div class="meta small">${e.level === 'insufficient' ? `${e.attempts} questions answered; skills covered ${e.coverage}% (needs 40 questions and 60%)` : 'Estimated scale-score range'}</div>
      <div class="row small"><span class="stat"><span class="meta">Accuracy</span><b>${a.length ? pct(a.filter(x => x.ok).length, a.length) + '%' : '—'}</b></span>
      <span class="stat"><span class="meta">Avg time</span><b>${avg.length ? Math.round(avg.reduce((x, y) => x + y.ms, 0) / avg.length / 1000) + 's' : '—'}</b></span>
      <span class="stat"><span class="meta">Timed / untimed</span><b>${tm.length ? pct(tm.filter(x => x.ok).length, tm.length) + '%' : '—'} / ${ut.length ? pct(ut.filter(x => x.ok).length, ut.length) + '%' : '—'}</b></span></div>
      <div class="meta small">Target pace ${SECS[s]}s per question · ${a.length} answered</div></div>`;
  }).join('');
  // accuracy over time: 7-day buckets per section
  const t0 = att.length ? att[0].at : Date.now();
  const series = SECTIONS.map(s => {
    const b = {};
    att.filter(x => x.sec === s && x.mode !== 'sim').forEach(x => { const w = Math.floor((x.at - t0) / (7 * E.DAY)); (b[w] = b[w] || []).push(x.ok); });
    return { name: NAMES[s], points: Object.entries(b).filter(([, v]) => v.length >= 5).map(([w, v]) => [+w + 1, Math.round(100 * v.filter(Boolean).length / v.length)]) };
  });
  const scoreSeries = [
    { name: 'Official practice tests', points: (ST.checkpoints || []).filter(c => c.composite).map(c => [Math.max(0, Math.round((c.at - t0) / E.DAY)), c.composite]) },
    { name: 'Aced practice tests', points: (ST.sims || []).filter(c => c.composite).map(c => [Math.max(0, Math.round((c.at - t0) / E.DAY)), c.composite]) }
  ];
  const skills = Object.entries(ST.skills).filter(([s]) => TAX.subs[s]);
  const near = skills.filter(([, k]) => ['practicing', 'timed'].includes(k.stage)).sort((a, b) => b[1].theta - a[1].theta).slice(0, 8);
  const urgent = skills.filter(([, k]) => k.relapse || k.stuck || (k.n >= 4 && k.c / k.n < 0.5)).sort((a, b) => (TAX.subs[b[0]].weight - TAX.subs[a[0]].weight)).slice(0, 8);
  const reasons = {};
  att.filter(a => a.reason).forEach(a => { reasons[a.reason] = (reasons[a.reason] || 0) + 1; });
  const totalR = Object.values(reasons).reduce((a, b) => a + b, 0);
  const lastSim = (ST.sims || []).filter(s => s.composite).slice(-1)[0];
  const lastCp = (ST.checkpoints || []).filter(s => s.composite).slice(-1)[0];
  const hist = store.get('aced-hist', []);
  return `<h2>Progress</h2>
  <p class="sub">These ranges are preliminary model estimates built from practice on uncalibrated Aced questions. They are not validated predictions of an ACT score. Only official practice tests (Official Scores tab) give trustworthy scale scores.</p>
  <div class="grid">${cards}</div>
  <div class="card" style="margin-top:14px"><div class="spread"><h3>Estimated composite</h3><span class="big">${est.composite ?? '—'}</span></div>
    <div class="meta">${est.composite == null ? 'Needs enough evidence in English, Math and Reading.' : 'Average of the English, Math and Reading estimates. Treat it as a range of about ±2.'}</div></div>
  <h2>Is it working?</h2>
  <div class="grid">
    <div class="card"><h3>Official practice tests</h3>${ev.official ? `<div class="big">${ev.official.last}</div><div class="meta">Baseline ${ev.official.first} → latest ${ev.official.last} (${ev.official.delta >= 0 ? '+' : ''}${ev.official.delta})</div>` : '<div class="meta">No official checkpoint yet. Log one under Official Scores to set your baseline.</div>'}</div>
    <div class="card"><h3>Previously weak skills</h3>${ev.weakSkills ? `<div class="big">${ev.weakBefore}% → ${ev.weakAfter}%</div><div class="meta">First 5 vs latest 5 tries on ${ev.weakSkills} skill(s) that started under 60%</div>` : '<div class="meta">Shows once a weak skill has 8+ tries.</div>'}</div>
    <div class="card"><h3>Under time pressure</h3>${ev.timedN >= 10 ? `<div class="big">${ev.timedEarly}% → ${ev.timedLate}%</div><div class="meta">Earlier vs recent timed questions (${ev.timedN})</div>` : '<div class="meta">Needs 10+ timed questions.</div>'}</div>
    <div class="card"><h3>Retention</h3>${ev.retentionN ? `<div class="big">${ev.retentionAcc}%</div><div class="meta">Accuracy on skills after a week or more away (${ev.retentionN} questions)</div>` : '<div class="meta">Measured when you return to a skill after 7+ days.</div>'}</div>
    <div class="card"><h3>Authentic vs Aced</h3><div class="meta">Latest official: <b>${lastCp ? lastCp.composite : '—'}</b> · latest Aced test: <b>${lastSim ? lastSim.composite : '—'}</b> · model estimate: <b>${est.composite ?? '—'}</b></div><div class="meta small">If Aced scores run well above official ones, the official result is the one to trust.</div></div>
  </div>
  ${ev.warnings.map(w => `<div class="warn" style="margin-top:10px">${esc(w)}</div>`).join('')}
  <h2>Highest priorities</h2><div class="card">${priorityList(5)}</div>
  <h2>Improvement over time</h2>
  <div class="grid"><div class="card"><h3>Practice accuracy by week</h3>${lineChart(series, { x: { label: 'Week' }, y: { label: 'Accuracy (%)', min: 0, max: 100 } })}</div>
  <div class="card"><h3>Composite scores</h3>${lineChart(scoreSeries, { x: { label: 'Day' }, y: { label: 'Composite', min: 1, max: 36 } })}</div></div>
  <div class="grid" style="margin-top:14px">
    <div class="card"><h3>Needs attention now</h3>${urgent.length ? urgent.map(([s, k]) => `<div class="spread small"><span>${esc(subLabel(s))}</span><span>${k.relapse ? '<span class="pill bad">Slipped</span>' : ''}${k.stuck ? '<span class="pill bad">Not improving</span>' : ''} ${pct(k.c, k.n)}%</span></div>`).join('') : '<div class="meta">Nothing urgent.</div>'}</div>
    <div class="card"><h3>Close to mastery</h3>${near.length ? near.map(([s, k]) => `<div class="spread small"><span>${esc(subLabel(s))}</span>${stagePill(k.stage)}</div>`).join('') : '<div class="meta">None yet.</div>'}</div>
    <div class="card"><h3>Why you miss questions</h3>${totalR ? Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="spread small"><span>${esc(E.REASONS[k] || k)}</span><span>${pct(v, totalR)}%</span></div>`).join('') : '<div class="meta">Tell Aced what happened after a miss and the pattern shows here.</div>'}</div>
  </div>
  ${hist.length ? `<h2>Earlier attempts</h2><div class="tbl"><table class="t"><tr><th>Date</th><th>Attempt</th><th>English</th><th>Math</th><th>Reading</th><th>Science</th><th>Composite</th></tr>${hist.slice().reverse().map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.label || r.sec || '')}</td>${SECTIONS.map(s => `<td>${(r.sc && r.sc[s]) ?? '—'}</td>`).join('')}<td>${r.comp ?? '—'}</td></tr>`).join('')}</table></div>` : ''}`;
}

function viewSettings() {
  const sc = ST.prefs.scores || {};
  return `<h2>Settings</h2>
  <div class="card"><h3>Your current ACT scores</h3><div class="meta">Untested skills start from these instead of zero. Real answers replace these estimates as you practice.</div>
    <div class="row">${SECTIONS.map(s => `<label class="field">${NAMES[s]}<input type="number" min="1" max="36" id="sc_${s}" value="${sc[s] || ''}" placeholder="${s === 'science' ? 'optional' : ''}" style="width:90px"></label>`).join('')}</div>
    <div class="row"><button class="btn pri" data-act="saveScores">Save scores</button><span class="meta" id="scMsg"></span></div></div>
  <div class="card" style="margin-top:12px"><label class="switch"><input type="checkbox" data-change="incSci" ${ST.prefs.includeScience ? 'checked' : ''}> Include Science in my study priorities (it does not count toward the composite)</label></div>
  <h2>Back up your progress</h2>
  <p class="sub">Progress is saved in this browser automatically. Copy a backup to keep it safe or move it to another device.</p>
  <div class="card"><div class="row"><button class="btn" data-act="exportData">Show backup</button><button class="btn" data-act="copyBackup">Copy backup</button></div>
  <label class="field">Backup text<textarea id="backup" rows="5" placeholder="Paste a backup here to restore it"></textarea></label>
  <div class="row"><button class="btn" data-act="importData">Restore from pasted backup</button><span class="meta" id="backupMsg"></span></div></div>
  <h2>Reset</h2><div class="card"><div class="meta">Erases skills, history and saved sessions in this browser.</div><div class="row"><button class="btn" data-act="reset">Erase all progress</button></div></div>
  <h2>About the questions</h2>
  <div class="card"><div class="meta">Every passage, question, answer choice and figure in Aced is newly written. Official ACT practice tests were studied only for their skill mix, timing, difficulty and question design, and every Aced question was checked automatically and by independent review against them for copying or close paraphrase. Aced is not affiliated with ACT, Inc. Aced test scores are estimates; only official tests produce official scores.</div>
  <div class="meta">Bank: ${ITEMS.length} questions · ${Object.keys(D.units).length} passages · ${D.forms.length} full practice tests</div></div>`;
}

// ---------- event wiring for views ----------
const ACT = {};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el, e); });
document.addEventListener('input', e => { if (e.target.id && e.target.id.startsWith('cp_')) cpPreview(); });
const CHG = {
  tSec: el => { UI.tSec = el.value; UI.tSubs = []; renderView(); },
  tSub: el => { UI.tSubs = el.checked ? UI.tSubs.concat(el.value) : UI.tSubs.filter(s => s !== el.value); renderView(); },
  sSec: el => { UI.sSec = el.value; },
  qzN: el => { UI.qzN = Math.max(5, Math.min(100, +el.value || 5)); renderView(); const i = document.querySelector('[data-change="qzN"]'); if (i) i.focus(); },
  qzTimed: el => { UI.qzTimed = el.value === '1'; },
  simSci: el => { ST.prefs.simScience = el.checked; saveState(); renderView(); },
  incSci: el => { ST.prefs.includeScience = el.checked; saveState(); },
  cpTest: el => { UI.cpTest = el.value; renderView(); }
};
ACT.len = el => { UI.len = +el.dataset.m; ST.prefs.minutes = UI.len; saveState(); renderView(); };
ACT.skSec = el => { UI.skSec = el.dataset.sec; renderView(); };
ACT.lesson = el => { $('lessonBox').innerHTML = `<div style="margin-top:12px">${lessonHTML(el.dataset.sub)}</div>`; };
ACT.resume = el => resume(el.dataset.id);
ACT.discard = el => { if (el.dataset.armed) { dropRun(el.dataset.id); renderView(); } else { el.dataset.armed = 1; el.textContent = 'Click again to discard'; } };
ACT.saveScores = () => {
  const sc = {};
  for (const sec of SECTIONS) { const v = +$('sc_' + sec).value; if (v >= 1 && v <= 36) sc[sec] = Math.round(v); }
  ST.prefs.scores = sc; E.applyPriors(ST, TAX, sc); saveState();
  $('scMsg').textContent = 'Saved. Untested skills now start from these scores.';
};
ACT.pickSec = el => { UI.sec = el.dataset.sec; UI.tSubs = []; store.set('aced-sec', UI.sec); renderView(); };
ACT.startMax = () => startPractice('max', { minutes: UI.len });
ACT.startTargeted = () => startPractice('targeted', { minutes: UI.len, subs: UI.tSubs.slice() });
ACT.trainOne = el => startPractice('targeted', { minutes: 10, subs: [el.dataset.sub], sec: (TAX.subs[el.dataset.sub] || {}).sec });
ACT.startSpeed = () => startPractice('speed', { minutes: UI.len });
ACT.startReview = () => startPractice('review', { minutes: UI.len });
ACT.startDiag = () => startPractice('diag', {});
ACT.startQuiz = () => startQuiz(UI.sec, Math.max(5, UI.qzN), UI.qzTimed);
ACT.startForm = el => startForm(el.dataset.f, el.dataset.timed === '1', null);
ACT.startFormSection = el => startForm(el.dataset.f, el.dataset.timed === '1', el.dataset.sec);
ACT.exportData = () => { $('backup').value = JSON.stringify({ aced: 2, state: ST, sessions: getSessions(), hist: store.get('aced-hist', []) }); $('backupMsg').textContent = 'Backup shown below.'; };
ACT.copyBackup = () => {
  ACT.exportData();
  const t = $('backup');
  navigator.clipboard?.writeText(t.value).then(() => { $('backupMsg').textContent = 'Copied.'; }, () => { t.select(); $('backupMsg').textContent = 'Select-all is on; copy with your keyboard.'; });
};
ACT.importData = () => {
  try {
    const d = JSON.parse($('backup').value);
    if (!d || d.aced !== 2 || !d.state) throw new Error('not an Aced backup');
    ST = E.migrate(d.state); saveState();
    if (d.sessions) store.set('aced-sessions', d.sessions);
    if (d.hist) store.set('aced-hist', d.hist);
    $('backupMsg').textContent = `Restored ${ST.attempts.length} answers.`;
  } catch (err) { $('backupMsg').textContent = 'That text is not a valid Aced backup. Paste the full backup text and try again.'; }
};
ACT.reset = el => {
  if (!el.dataset.armed) { el.dataset.armed = 1; el.textContent = 'Click again to erase everything'; return; }
  ST = E.newState(); saveState(); store.set('aced-sessions', {}); store.set('aced-hist', []); renderView();
};
function cpScores() {
  const t = OFFICIAL.tests[UI.cpTest]; if (!t) return null;
  const raw = {}, scores = {};
  for (const s of SECTIONS) {
    const el = $('cp_' + s); if (!el || el.value === '') continue;
    const r = Math.max(0, Math.min(t[s].length - 1, Math.round(+el.value)));
    raw[s] = r; scores[s] = t[s][r];
  }
  const core = ['english', 'math', 'reading'];
  const composite = core.every(s => scores[s] != null) ? roundHalfUp(core.reduce((a, s) => a + scores[s], 0) / 3) : null;
  return { raw, scores, composite, name: t.name || `Official Practice Test ${UI.cpTest}` };
}
function cpPreview() {
  const c = cpScores(); if (!c) return;
  $('cpPreview').textContent = Object.keys(c.scores).length ? SECTIONS.filter(s => c.scores[s] != null).map(s => `${NAMES[s]} ${c.scores[s]}`).join(' · ') + (c.composite ? ` · Composite ${c.composite}` : '') : 'Enter raw scores to see scale scores.';
}
ACT.saveCheckpoint = () => {
  const c = cpScores();
  if (!c || !Object.keys(c.scores).length) { $('cpPreview').textContent = 'Enter at least one raw score.'; return; }
  const est = E.estimateScores(ST, TAX);
  c.est = Object.fromEntries(SECTIONS.map(s => [s, est[s].scale]));
  c.at = Date.now(); c.test = UI.cpTest;
  ST.checkpoints.push(c); saveState(); renderView();
};
ACT.delCheckpoint = el => { ST.checkpoints = ST.checkpoints.filter(c => String(c.at) !== el.dataset.at); saveState(); renderView(); };

// ---------- starting sessions ----------
// Every practice mode runs as a timed section of the real test: one section, n × pace seconds, pause,
// no feedback until submit. Explanations, mistake reasons and follow-ups come in the review afterward.
const MODE_LABEL = { max: 'section', targeted: 'targeted section', speed: 'speed section', review: 'mistake-review section', diag: 'diagnostic' };
function diagItems(sec, bank, rng) {
  const used = new Set();
  if (sec === 'math') {
    const subs = Object.entries(TAX.subs).filter(([s, i]) => i.sec === 'math' && bank.some(x => x.sub === s)).sort((a, b) => b[1].weight - a[1].weight);
    const chosen = [];
    for (const cat of ['IES', 'A', 'F', 'G', 'S', 'N']) { const f = subs.find(([, i]) => i.cat === cat); if (f) chosen.push(f); }
    for (const sub of subs) { if (chosen.length >= 20) break; if (!chosen.includes(sub)) chosen.push(sub); }
    const items = chosen.map(([s, i]) => E.pickItem(ST, bank, s, { used, tax: TAX, rng, difficulty: Math.round(i.diff || 3) })).filter(Boolean);
    items.forEach(i => used.add(i.id));
    return items.sort((a, b) => (a.diff || 3) - (b.diff || 3)).map(i => i.id);
  }
  // Passage sections: whole passages that cover the most distinct skills.
  const units = {};
  bank.filter(i => i.sec === sec && i.unit).forEach(i => (units[i.unit] = units[i.unit] || []).push(i));
  const ranked = Object.values(units).sort((a, b) => new Set(b.map(i => i.sub)).size - new Set(a.map(i => i.sub)).size);
  return ranked.slice(0, sec === 'english' ? 2 : 2).flat().map(i => i.id);
}
function startPractice(mode, opts) {
  const sec = opts.sec || UI.sec;
  const bank = trainingBank();
  const rng = mulberry((Date.now() ^ ST.attempts.length) & 0x7fffffff);
  const pace = mode === 'speed' ? 0.85 : 1;
  let ids;
  if (mode === 'diag') ids = diagItems(sec, bank, rng);
  else {
    const count = practiceCount(sec, opts.minutes || UI.len, pace);
    const plan = E.planSession(ST, bank, TAX, { minutes: opts.minutes || UI.len, count, mode: mode === 'targeted' ? 'max' : mode, sections: [sec], subs: opts.subs, rng });
    ids = plan.steps.map(x => x.id).slice(0, count + 2);
  }
  if (ids.length < 5) { alertView(mode === 'review' ? `Not enough new ${NAMES[sec]} questions are left on the skills you missed. Try a regular section instead.` : `Not enough ${NAMES[sec]} questions are available for that selection yet.`); return; }
  const label = mode === 'diag' ? `${NAMES[sec]} diagnostic` : `${NAMES[sec]} ${opts.minutes || UI.len}-minute ${MODE_LABEL[mode]}`;
  R = newExam('practice', `${label} · ${ids.length} questions`, true, [{ sec, items: ids, ft: [] }], null);
  R.mode = mode; R.pace = pace;
  ST.sessions.push({ id: R.sid, at: Date.now(), mode, n: ids.length }); saveState();
  beginPart();
}
function alertView(msg) { $('view').insertAdjacentHTML('afterbegin', `<div class="warn">${esc(msg)}</div>`); scrollTo(0, 0); }

function startQuiz(sec, n, timed) {
  const rnd = mulberry(Date.now() & 0x7fffffff);
  let pool = trainingBank().filter(i => i.sec === sec);
  const unseen = pool.filter(i => !ST.items[i.id]);
  let pick = shuffle(unseen, rnd).concat(shuffle(pool.filter(i => ST.items[i.id]), rnd)).slice(0, n);
  const ids = pick.map(i => i.id);
  const extra = [];
  if (sec === 'math' && window.ACED_MATHGEN) while (ids.length + extra.length < n) { const g = ACED_MATHGEN(rnd); g.id = uid('g'); g.sec = 'math'; extra.push(g); }
  // keep passage-based questions together
  if (sec !== 'math') ids.sort((a, b) => (BYID[a].unit || '').localeCompare(BYID[b].unit || '') || (BYID[a].n || 0) - (BYID[b].n || 0));
  const items = ids.concat(extra);
  const ftN = Math.round(items.length * { english: 10 / 50, math: 4 / 45, reading: 9 / 36, science: 6 / 40 }[sec]);
  const ft = shuffle(items.map(x => typeof x === 'string' ? x : x.id), rnd).slice(0, ftN);
  R = newExam('quiz', `${NAMES[sec]} quiz · ${items.length} questions`, timed, [{ sec, items, ft }], null);
  beginPart();
}
function startForm(fid, timed, onlySec) {
  const f = D.forms.find(x => x.id === fid); if (!f) return;
  const secs = onlySec ? [onlySec] : SECTIONS.filter(s => f.sections[s] && (s !== 'science' || ST.prefs.simScience));
  const parts = secs.map(s => ({ sec: s, items: f.sections[s].items.slice(), ft: (f.sections[s].ft || []).slice() }));
  R = newExam(onlySec ? 'section' : 'full', `${f.name}${onlySec ? ' · ' + NAMES[onlySec] : secs.includes('science') ? ' + Science' : ''}`, timed, parts, fid);
  beginPart();
}
function newExam(type, label, timed, parts, form) {
  return { id: uid('x'), v: 2, kind: 'exam', type, label, timed, parts, form, pi: 0, cur: 0, ans: {}, x: {}, flag: {}, ms: {}, chg: {}, left: 0, el: 0, results: [], onBreak: false, created: Date.now(), updated: Date.now(), sid: uid('s') };
}
function beginPart() {
  const p = R.parts[R.pi];
  R.cur = 0; R.ans = {}; R.x = {}; R.flag = {}; R.ms = {}; R.chg = {}; R.el = 0; R.onBreak = false;
  R.left = Math.round(p.items.length * SECS[p.sec] * (R.pace || 1));
  saveRun(); enterRunner();
}
function resume(id) {
  R = getSessions()[id];
  if (!R) return renderView();
  if (!R.kind || R.kind === 'full' || R.kind === 'section' || R.kind === 'quiz') { R.type = R.type || R.kind; R.kind = 'exam'; R.ms = R.ms || {}; R.chg = R.chg || {}; R.sid = R.sid || uid('s'); }
  if (R.kind === 'exam' && R.onBreak) return showBreak();
  enterRunner();
}

// ---------- runner shell ----------
function enterRunner() {
  show('test');
  $('passage').dataset.p = '';
  $('nav').hidden = true;
  $('pauseBtn').hidden = !R.timed; $('pauseBtn').innerHTML = ICON.pause;
  $('flagBtn').hidden = R.kind !== 'exam';
  $('endBtn').hidden = R.kind !== 'exam';
  $('indexBtn').hidden = R.kind !== 'exam';
  $('help').hidden = true; $('nav').hidden = true;
  $('timeLbl').textContent = R.kind === 'exam' ? (R.timed ? 'TOTAL TIME LEFT' : 'TIME USED') : 'TIME';
  $('answered').parentElement.hidden = R.kind !== 'exam';
  paintTools();
  startTick(); showTime(); render();
}
function startTick() {
  stopTick();
  tick = setInterval(() => {
    if (!R || !$('paused').hidden || document.hidden) return;
    R.el = (R.el || 0) + 1;
    if (R.kind === 'exam') {
      const n = R.cur + 1; R.ms[n] = (R.ms[n] || 0) + 1000;
      if (R.timed) { R.left--; if (R.left <= 0) { R.left = 0; return finishPart(); } }
    } else {
      const r = curResp(); if (r && r.phase === 'answer') { r.ms = (r.ms || 0) + 1000; if (R.mode === 'speed') speedBar(); }
    }
    showTime();
    if (++saveCount % 5 === 0) saveRun();
  }, 1000);
}
function stopTick() { clearInterval(tick); tick = null; }
function showTime() {
  if (!R) return;
  // The timer can be hidden, but it reappears for the final 5 minutes, as on the official test.
  const hide = timerHidden && !(R.kind === 'exam' && R.timed && R.left < 300);
  $('timeWrap').style.visibility = hide ? 'hidden' : 'visible';
  if (R.kind === 'exam') { $('timer').textContent = R.timed ? fmt(R.left) : fmt(R.el); $('timer').classList.toggle('low', R.timed && R.left < 300); }
  else $('timer').textContent = fmt(R.el || 0);
}
$('pauseBtn').onclick = () => { $('paused').hidden = false; $('pauseBtn').innerHTML = ICON.play; $('pauseBtn').setAttribute('aria-label', 'Resume'); saveRun(); };
$('resumeBtn').onclick = () => { $('paused').hidden = true; $('pauseBtn').innerHTML = ICON.pause; $('pauseBtn').setAttribute('aria-label', 'Pause'); };

document.addEventListener('mouseup', () => {
  if (!hl) return; const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
  const r = s.getRangeAt(0); if (!$('passage').contains(r.commonAncestorContainer)) return;
  try { r.surroundContents(document.createElement('mark')); } catch (e) { /* selection crosses elements */ }
  s.removeAllRanges(); savePassageState(); saveRun();
});
$('passage').addEventListener('click', e => { if (e.target.tagName === 'MARK' && !hl) { e.target.replaceWith(...e.target.childNodes); savePassageState(); saveRun(); } });
addEventListener('pagehide', saveRun);
addEventListener('beforeunload', saveRun);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); });
$('calcBtn').onclick = () => {
  $('calc').hidden = !$('calc').hidden;
  if (calc || $('calc').hidden || $('calcEl').dataset.loading) return;
  $('calcEl').dataset.loading = 1;
  const s = document.createElement('script');
  s.src = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
  s.onload = () => { calc = Desmos.GraphingCalculator($('calcEl'), { expressionsCollapsed: false, invertedColors: isDark() }); };
  s.onerror = () => { $('calcEl').innerHTML = '<p style="padding:12px">Desmos is blocked on this preview link but works on the deployed site. <a href="https://www.desmos.com/calculator" target="_blank" rel="noopener">Open Desmos in a new tab</a>.</p>'; };
  document.head.appendChild(s);
};
$('calcClose').onclick = () => { $('calc').hidden = true; };

function setPassage(html, key) {
  $('main').classList.toggle('solo', !html); $('passage').hidden = !html;
  if (html && $('passage').dataset.p !== key) {
    const saved = R && R.hlx && R.hlx[key];
    $('passage').innerHTML = saved || html; $('passage').dataset.p = key;
    $('passage').scrollTop = (R && R.scr && R.scr[key]) || 0;
  }
}
function choicesHTML(it, opts) {
  return it.c.map((c, k) => {
    const cls = [opts.sel === k ? 'sel' : '', opts.x && opts.x[k] ? 'x' : '', opts.reveal && k === it.a ? 'right' : '', opts.reveal && opts.sel === k && k !== it.a ? 'wrong' : ''].join(' ');
    return `<div class="choice ${cls}"><label><input type="radio" name="a" ${opts.sel === k ? 'checked' : ''} ${opts.lock ? 'disabled' : ''} data-pick="${k}"><b>${LET[k]}.</b> <span>${c}</span></label>${opts.lock ? '' : `<button class="elim" data-elim="${k}" aria-label="Cross out choice ${LET[k]}" title="Cross out ${LET[k]}">${LET[k]}̶</button>`}</div>`;
  }).join('');
}
// Like the official test: question text first, then any figure or table, then the choices.
function stemHTML(it) { return `${it.q ? `<div class="stem">${it.q}</div>` : ''}${itemFigure(it)}`; }
function render() { if (R.kind === 'exam') renderExam(); else renderTrain(); }

// ---------- exam runner (simulations and quizzes) ----------
function partItems(p) { return p.items.map(itemOf); }
function isFT(p, it) { return !!(it.ft || (p.ft || []).includes(it.id)); }
function examPassage(p, it) {
  if (it.unit && D.units[it.unit]) return [renderUnit(D.units[it.unit]), it.unit];
  if (it.pid && p.passages) return [p.passages[it.pid], it.pid];
  return [null, null];
}
function renderExam() {
  const p = R.parts[R.pi], items = partItems(p), it = items[R.cur], n = R.cur + 1;
  $('ttl').textContent = R.type === 'practice' || R.type === 'quiz' ? R.label : `${R.label} — ${NAMES[p.sec]}`;
  $('itemLabel').textContent = `Item ${n}`;
  $('calcBtn').hidden = p.sec !== 'math';
  const [ph, key] = examPassage(p, it);
  setPassage(ph, key);
  if (ph) markPassage(it, false);
  $('qpane').innerHTML = `<div class="qnum">Question ${n} of ${items.length}</div>${stemHTML(it)}${choicesHTML(it, { sel: R.ans[n], x: Object.fromEntries([0, 1, 2, 3].map(k => [k, R.x[n + '-' + k]])) })}`;
  $('flagBtn').setAttribute('aria-pressed', !!R.flag[n]);
  $('answered').textContent = `${Object.keys(R.ans).length} of ${items.length}`;
  $('bot').innerHTML = `<button class="tn-nav" data-run="prev" ${R.cur === 0 ? 'disabled' : ''}>‹ PREV</button><button class="tn-nav" data-run="next">NEXT ›</button>`;
  $('qpane').scrollTop = 0;
  navR();
}
// Question index: every item with answered / unanswered / flagged status (like the TestNav index).
function navR() {
  if (R.kind !== 'exam') return;
  const p = R.parts[R.pi];
  const answered = Object.keys(R.ans).length, flagged = Object.values(R.flag).filter(Boolean).length;
  $('nav').innerHTML = `<div class="tn-ph"><b>Index · ${NAMES[p.sec]}</b><button class="tn-x" data-close="nav" aria-label="Close index">×</button></div>
    <div class="tn-legend"><span>${answered} answered</span><span>${p.items.length - answered} unanswered</span><span>⚑ ${flagged} flagged</span></div>
    <div class="tn-list">${p.items.map((_, k) => `<button class="${R.ans[k + 1] != null ? 'ans' : ''} ${k === R.cur ? 'cur' : ''} ${R.flag[k + 1] ? 'fl' : ''}" data-run="goto" data-k="${k}"><span>Item ${k + 1}</span><span class="st">${R.ans[k + 1] != null ? 'Answered' : 'Unanswered'}</span></button>`).join('')}</div>`;
}
$('flagBtn').onclick = () => { if (!R || R.kind !== 'exam') return; const n = R.cur + 1; R.flag[n] = !R.flag[n]; saveRun(); render(); };
// ---------- test tools (TestNav-style) ----------
const TOOL = { hl: false, elim: false, lr: false, zoom: 1 };
function closeMenus() { for (const m of ['toolsMenu', 'contrastMenu']) $(m).hidden = true; $('toolsBtn').setAttribute('aria-expanded', 'false'); $('contrastBtn').setAttribute('aria-expanded', 'false'); }
$('toolsBtn').onclick = e => { e.stopPropagation(); const open = $('toolsMenu').hidden; closeMenus(); $('toolsMenu').hidden = !open; $('toolsBtn').setAttribute('aria-expanded', open); };
$('contrastBtn').onclick = e => { e.stopPropagation(); const open = $('contrastMenu').hidden; closeMenus(); $('contrastMenu').hidden = !open; $('contrastBtn').setAttribute('aria-expanded', open); };
document.addEventListener('click', e => { if (!e.target.closest('.tn-menu')) closeMenus(); });
function paintTools() {
  $('hlBtn').setAttribute('aria-checked', TOOL.hl);
  document.querySelector('[data-tool="elim"]').setAttribute('aria-checked', TOOL.elim);
  document.querySelector('[data-tool="lr"]').setAttribute('aria-checked', TOOL.lr);
  $('test').classList.toggle('no-elim', !TOOL.elim && R && R.kind === 'exam');
  $('lineReader').hidden = !TOOL.lr;
  $('magVal').textContent = Math.round(TOOL.zoom * 100) + '%';
  $('test').style.setProperty('--tn-zoom', TOOL.zoom);
}
$('toolsMenu').addEventListener('click', e => {
  const b = e.target.closest('[data-tool]'); if (!b) return;
  const t = b.dataset.tool;
  if (t === 'hl') { TOOL.hl = !TOOL.hl; hl = TOOL.hl; }
  if (t === 'elim') TOOL.elim = !TOOL.elim;
  if (t === 'lr') TOOL.lr = !TOOL.lr;
  if (t === 'mag') TOOL.zoom = { 1: 1.25, 1.25: 1.5, 1.5: 1.75, 1.75: 1 }[TOOL.zoom] || 1;
  if (t !== 'calc') { paintTools(); if (t !== 'mag') closeMenus(); }
});
$('contrastMenu').addEventListener('click', e => {
  const b = e.target.closest('[data-contrast]'); if (!b) return;
  $('test').classList.remove('c-rose', 'c-yb', 'c-wb', 'c-gg');
  if (b.dataset.contrast) $('test').classList.add('c-' + b.dataset.contrast);
  store.set('aced-contrast', b.dataset.contrast); closeMenus();
});
{ const c = store.get('aced-contrast', ''); if (c) $('test').classList.add('c-' + c); }
// Line reader: a reading band that follows the pointer; arrow keys move it.
let lrY = 220;
function placeLR() { const b = $('lineReader'); b.style.top = (lrY - b.offsetHeight / 2) + 'px'; }
document.addEventListener('mousemove', e => { if (TOOL.lr && !$('test').hidden) { lrY = e.clientY; placeLR(); } });
let timerHidden = false;
$('hideTimer').onclick = () => { timerHidden = !timerHidden; showTime(); $('hideTimer').setAttribute('aria-label', timerHidden ? 'Show timer' : 'Hide timer'); };
$('indexBtn').onclick = () => { if (!R || R.kind !== 'exam') return; navR(); $('nav').hidden = !$('nav').hidden; $('help').hidden = true; };
$('helpBtn').onclick = () => { $('help').hidden = !$('help').hidden; $('nav').hidden = true; };
document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) $(c.dataset.close).hidden = true; });
$('endBtn').onclick = () => { if (R && R.kind === 'exam') showReview(); };
// End Test → review screen with every item's status, then submit (as on the official test).
function showReview() {
  const p = R.parts[R.pi], items = p.items;
  const un = items.length - Object.keys(R.ans).length, fl = Object.values(R.flag).filter(Boolean).length;
  const box = document.createElement('div'); box.className = 'tn-review'; box.id = 'review';
  box.innerHTML = `<div class="box"><h2 style="margin-top:0">Review · ${NAMES[p.sec]}</h2>
    <p>${items.length - un} answered · <b>${un} unanswered</b> · ⚑ ${fl} flagged${R.timed ? ` · ${fmt(R.left)} left` : ''}</p>
    <div class="tn-list" style="margin:12px 0">${items.map((_, k) => `<button class="${R.ans[k + 1] != null ? 'ans' : ''} ${R.flag[k + 1] ? 'fl' : ''}" data-rv="${k}"><span>Item ${k + 1}</span><span class="st">${R.ans[k + 1] != null ? 'Answered' : 'Unanswered'}</span></button>`).join('')}</div>
    <p class="meta">Once you submit this section you cannot return to it.</p>
    <div class="row"><button class="btn" data-rv="back">Return to test</button><button class="btn pri" data-rv="submit">Submit section</button></div></div>`;
  $('test').appendChild(box);
  box.onclick = e => {
    const b = e.target.closest('[data-rv]'); if (!b) return;
    const v = b.dataset.rv;
    if (v === 'submit') { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Confirm: submit section'; return; } box.remove(); finishPart(); return; }
    box.remove();
    if (v !== 'back') { R.cur = +v; saveRun(); render(); }
  };
}
// Highlights and passage scroll position persist per passage for the whole attempt.
function savePassageState() {
  if (!R) return; const key = $('passage').dataset.p; if (!key) return;
  R.hlx = R.hlx || {}; R.scr = R.scr || {};
  if ($('passage').querySelector('mark')) R.hlx[key] = $('passage').innerHTML; else delete R.hlx[key];
}
$('passage').addEventListener('scroll', () => { if (R && $('passage').dataset.p) { R.scr = R.scr || {}; R.scr[$('passage').dataset.p] = $('passage').scrollTop; } });
document.addEventListener('keydown', e => {
  if ($('test').hidden || !R) return;
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); RUN.next ? RUN.next() : null; }
  else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); RUN.prev(); }
  else if (e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); $('flagBtn').click(); }
  else if (TOOL.lr && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest('input,textarea')) { e.preventDefault(); lrY += e.key === 'ArrowDown' ? 24 : -24; placeLR(); }
  else if (e.key === 'Escape') { closeMenus(); $('nav').hidden = true; $('help').hidden = true; }
});

$('qpane').addEventListener('change', e => {
  const k = e.target.dataset.pick; if (k == null) return;
  if (R.kind === 'exam') {
    const n = R.cur + 1;
    if (R.ans[n] != null && R.ans[n] !== +k) R.chg[n] = (R.chg[n] || 0) + 1;
    R.ans[n] = +k; delete R.x[n + '-' + k]; saveRun(); render();
  } else {
    const r = curResp(); if (r.phase !== 'answer') return;
    if (r.choice != null && r.choice !== +k) r.changed = (r.changed || 0) + 1;
    r.choice = +k; if (r.x) delete r.x[k]; saveRun(); render();
  }
});
$('qpane').addEventListener('click', e => {
  const b = e.target.closest('[data-elim]'); if (!b) return;
  const k = +b.dataset.elim;
  if (R.kind === 'exam') {
    const n = R.cur + 1, key = n + '-' + k; R.x[key] = !R.x[key];
    if (R.x[key] && R.ans[n] === k) delete R.ans[n];
  } else {
    const r = curResp(); r.x = r.x || {}; r.x[k] = !r.x[k]; if (r.x[k] && r.choice === k) r.choice = null;
  }
  saveRun(); render();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-run]'); if (!b || !R) return;
  RUN[b.dataset.run](b, e);
});
const RUN = {};
RUN.exit = () => { saveRun(); go(TAB); };
RUN.prev = () => { if (R.kind === 'exam' && R.cur > 0) { R.cur--; saveRun(); render(); } };
RUN.next = () => { if (R.kind !== 'exam') return; const p = R.parts[R.pi]; if (R.cur < p.items.length - 1) { R.cur++; saveRun(); render(); } else showReview(); };
RUN.navt = () => { $('nav').hidden = !$('nav').hidden; };
RUN.goto = b => { R.cur = +b.dataset.k; $('nav').hidden = true; saveRun(); render(); };
RUN.submit = b => {
  const un = R.parts[R.pi].items.length - Object.keys(R.ans).length;
  if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = un ? `${un} unanswered. Click again to submit` : 'Click again to submit'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Submit section'; } }, 4000); return; }
  finishPart();
};

function scorePart(p, ans) {
  const items = partItems(p);
  let raw = 0, tot = 0; const cats = {};
  items.forEach((q, k) => {
    if (isFT(p, q)) return; tot++;
    const ok = ans[k + 1] === q.a; if (ok) raw++;
    const c = q.cat || q.k; if (c) { cats[c] = cats[c] || [0, 0]; cats[c][1]++; if (ok) cats[c][0]++; }
  });
  const conv = TAX.conv[p.sec];
  const scale = Object.keys(ans).length && conv ? conv[Math.round(raw / (tot || 1) * (conv.length - 1))] : null;
  return { sec: p.sec, raw, tot, scale, cats };
}
function finishPart() {
  stopTick();
  const p = R.parts[R.pi];
  const res = scorePart(p, R.ans);
  res.el = R.el; res.ans = Object.assign({}, R.ans); res.flag = Object.assign({}, R.flag); res.ms = Object.assign({}, R.ms);
  R.results.push(res);
  // Feed every answered question into the skill model (field-test items are ours too, so they count for learning).
  partItems(p).forEach((it, k) => {
    const n = k + 1;
    if (R.ans[n] == null || !it.sub) return;
    const before = (ST.skills[it.sub] || {}).theta || 0;
    const mode = R.type === 'practice' ? R.mode : R.type === 'quiz' ? 'quiz' : 'sim';
    E.record(ST, it, { ok: R.ans[n] === it.a, ms: R.ms[n] || null, changed: R.chg[n] || 0, timed: R.timed, mode, sid: R.sid, choice: R.ans[n], typical: (TAX.subs[it.sub] || {}).diff });
    // A diagnostic answer is also weak evidence about untested skills in the same reporting category.
    if (mode === 'diag') E.spread(ST, TAX, it.sub, ST.skills[it.sub].theta - before, 0.35);
  });
  saveState();
  if (R.pi < R.parts.length - 1) { R.pi++; R.onBreak = true; R.breakLeft = p.sec === 'math' ? 600 : 0; saveRun(); return showBreak(); }
  dropRun(R.id); if (R.type === 'practice' || R.type === 'quiz') showPracticeResults(R); else showExamResults(R);
}
function showBreak() {
  show('app'); stopTick();
  const next = R.parts[R.pi], prev = R.results[R.results.length - 1];
  const has = R.breakLeft > 0;
  $('view').innerHTML = `<h2>${NAMES[prev.sec]} submitted</h2>
    <p class="sub">Next: <b>${NAMES[next.sec]}</b>, ${next.items.length} questions${R.timed ? `, ${fmt(next.items.length * SECS[next.sec])}` : ''}. Scores appear when the whole test is finished.</p>
    ${has ? `<p>Optional break: <b id="brk">${fmt(R.breakLeft)}</b></p>` : ''}
    <div class="row"><button class="btn pri" id="nextPart">Start ${NAMES[next.sec]}</button><button class="btn" id="brkExit">Save &amp; exit</button></div>`;
  const keep = R;
  if (has) tick = setInterval(() => { keep.breakLeft--; const b = $('brk'); if (b) b.textContent = fmt(keep.breakLeft); if (keep.breakLeft <= 0) { stopTick(); R = keep; beginPart(); } else if (keep.breakLeft % 5 === 0) { R = keep; saveRun(); } }, 1000);
  $('nextPart').onclick = () => { stopTick(); R = keep; beginPart(); };
  $('brkExit').onclick = () => { R = keep; saveRun(); go('simulate'); };
}
function explainHTML(it, chosen) {
  const wrong = chosen != null && chosen !== it.a;
  const L = D.lessons[it.sub] || {};
  const parts = [];
  if (wrong && it.w && it.w[chosen]) parts.push(`<div><b>Why ${LET[chosen]} is wrong:</b> ${it.w[chosen]}</div>`);
  if (it.e) parts.push(`<div><b>Why ${LET[it.a]} is right:</b> ${it.e}</div>`);
  if (it.ev) parts.push(`<div><b>Evidence:</b> ${it.ev}</div>`);
  if (it.sec === 'math') {
    // Name the faster route for this skill: Desmos when it beats paper, paper when it does not.
    const desmos = it.desmos || L.desmos;
    const paper = it.strat || L.method;
    if (L.fastest === 'desmos' && desmos) {
      parts.push(`<div><b>Fastest: Desmos.</b> ${desmos}</div>`);
      if (paper) parts.push(`<div><b>On paper:</b> ${paper}</div>`);
    } else {
      if (paper) parts.push(`<div><b>Fastest: on paper.</b> ${paper}</div>`);
      if (desmos) parts.push(`<div><b>Desmos check:</b> ${desmos}</div>`);
    }
  } else if (it.strat) parts.push(`<div><b>Fastest reliable method:</b> ${it.strat}</div>`);
  if (it.recog || L.recognize) parts.push(`<div><b>Spot this type:</b> ${it.recog || L.recognize}</div>`);
  return parts.join('');
}
// Results for practice sections, diagnostics and quizzes: accuracy, pace, what was missed, and a review.
function showPracticeResults(sess) {
  show('app');
  const p = sess.parts[0], r = sess.results[0], items = partItems(p);
  const answered = items.filter((_, k) => r.ans[k + 1] != null).length;
  const right = items.filter((q, k) => r.ans[k + 1] === q.a).length;
  const misses = items.map((q, k) => ({ q, k })).filter(({ q, k }) => r.ans[k + 1] !== q.a);
  const times = Object.values(r.ms || {});
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) : null;
  const byCat = {};
  items.forEach((q, k) => { const c = q.cat || '?'; byCat[c] = byCat[c] || [0, 0]; byCat[c][1]++; if (r.ans[k + 1] === q.a) byCat[c][0]++; });
  const catRows = Object.entries(byCat).map(([c, v]) => `<tr><td>${esc((TAX.cats && TAX.cats[c]) || c)}</td><td>${v[0]} / ${v[1]}</td></tr>`).join('');
  const rev = items.map((q, k) => {
    const n = k + 1, u = r.ans[n], ok = u === q.a;
    return `<div class="rev"><div class="row"><b>${n}.</b> ${ok ? '<b class="ok">Correct</b>' : u == null ? '<b class="no">Not answered</b>' : '<b class="no">Incorrect</b>'} <span class="pill">${esc(subLabel(q.sub))}</span> ${r.ms && r.ms[n] ? `<span class="meta small">${Math.round(r.ms[n] / 1000)}s</span>` : ''}</div>
      <div>${q.u ? `<span class="meta">Underlined portion ${q.u}.</span> ` : ''}${q.q || ''}</div>
      <div class="meta">Your answer: ${u != null ? LET[u] + '. ' + q.c[u] : '—'}</div><div>Correct: <b>${LET[q.a]}. ${q.c[q.a]}</b></div><div class="small">${explainHTML(q, u)}</div></div>`;
  }).join('');
  UI.lastPractice = sess;
  $('view').innerHTML = `<div class="spread"><h2>${esc(sess.label)}: done</h2><button class="btn" data-act="backHome">Back to study</button></div>
    <div class="grid"><div class="card"><div class="meta">Correct</div><div class="big">${right}/${items.length}</div><div class="meta">${answered < items.length ? `${items.length - answered} not answered` : 'all answered'}</div></div>
    <div class="card"><div class="meta">Average time</div><div class="big">${avg != null ? avg + 's' : '—'}</div><div class="meta">Pace: ${Math.round(SECS[p.sec] * (sess.pace || 1))}s per question</div></div>
    <div class="card"><div class="meta">Time used</div><div class="big">${fmt(r.el || 0)}</div><div class="meta">of ${fmt(items.length * SECS[p.sec] * (sess.pace || 1))}</div></div></div>
    ${misses.length ? `<div class="card hero" style="margin-top:12px"><div class="spread"><div><b>Review your ${misses.length} miss${misses.length === 1 ? '' : 'es'}</b><div class="meta">For each one: tell Aced what happened, see why the right answer is right (with the Desmos or paper shortcut), then get a new question on the same skill.</div></div><button class="btn pri" data-act="reviewMisses">Start review</button></div></div>` : ''}
    ${sess.mode === 'diag' ? `<h2>Diagnostic by category</h2><div class="tbl"><table class="t"><tr><th>Category</th><th>Correct</th></tr>${catRows}</table></div><p class="meta">Skills you did not see directly were adjusted from related questions in the same category. Your plan below uses these results.</p>` : ''}
    <h2>What to do next in ${NAMES[p.sec]}</h2><div class="card">${priorityList(3, [p.sec])}</div>
    <details><summary class="btn sm" style="display:inline-block;margin-top:12px">Review all ${items.length} questions</summary>${rev}</details>`;
}
ACT.reviewMisses = () => {
  const sess = UI.lastPractice; if (!sess) return;
  const p = sess.parts[0], r = sess.results[0], items = partItems(p);
  const steps = [], resp = {};
  items.forEach((q, k) => {
    if (r.ans[k + 1] === q.a) return;
    const i = steps.length;
    steps.push(typeof p.items[k] === 'string' ? { id: q.id, sub: q.sub, missed: true } : { id: q.id, item: q, sub: q.sub, missed: true });
    // Already recorded during the section: start at "what happened?" (or the explanation if skipped).
    resp[i] = { phase: r.ans[k + 1] == null ? 'explain' : 'reason', choice: r.ans[k + 1], ok: false, recorded: true, ms: (r.ms || {})[k + 1] || 0 };
  });
  R = { id: uid('t'), v: 2, kind: 'train', mode: 'review', label: `${NAMES[p.sec]} review`, timed: false, steps, idx: 0, resp, sid: sess.sid, el: 0, created: Date.now(), updated: Date.now() };
  saveRun(); enterRunner();
};
function showExamResults(sess) {
  show('app');
  const sc = {}; sess.results.forEach(r => { if (r.scale != null) sc[r.sec] = r.scale; });
  const full = sess.type === 'full';
  const comp = full && sc.english && sc.math && sc.reading ? roundHalfUp((sc.english + sc.math + sc.reading) / 3) : null;
  const stem = full && sc.math && sc.science ? roundHalfUp((sc.math + sc.science) / 2) : null;
  if (sess.form) {
    ST.sims.push({ at: Date.now(), form: sess.form, full, label: sess.label, timed: sess.timed, raw: Object.fromEntries(sess.results.map(r => [r.sec, `${r.raw}/${r.tot}`])), scores: {}, composite: null, uncalibrated: true });
    if (full && !ST.prefs.released.includes(sess.form)) ST.prefs.released.push(sess.form);
    saveState();
  }
  const missed = new Set();
  // Aced forms are uncalibrated: report raw results only, never an implied ACT scale score.
  const tiles = sess.results.map(r => `<div class="card"><div class="meta">${NAMES[r.sec]} · raw score</div><div class="big">${r.raw}/${r.tot}</div><div class="meta">${pct(r.raw, r.tot)}% of scored questions · ${fmt(r.el)}</div></div>`).join('');
  const detail = sess.results.map((r, pi) => {
    const p = sess.parts[pi], items = partItems(p);
    const cats = Object.entries(r.cats).map(([k, v]) => `<tr><td>${esc((TAX.cats && TAX.cats[k]) || k)}</td><td>${v[0]} / ${v[1]}</td></tr>`).join('');
    const rev = items.map((q, k) => {
      const n = k + 1, u = r.ans[n], ok = u === q.a, ft = isFT(p, q);
      if (!ok && q.sub) missed.add(q.sub);
      const mark = ft ? '' : ok ? '<b class="ok">Correct</b>' : u == null ? '<b class="no">Omitted</b>' : '<b class="no">Incorrect</b>';
      return `<div class="rev"><div class="row"><b>${n}.</b> ${mark} ${ft ? '<span class="pill">Field test · not scored</span>' : ''} ${q.sub ? `<span class="pill">${esc(subLabel(q.sub))}</span>` : ''} ${r.flag[n] ? '<span class="pill">Flagged</span>' : ''} ${r.ms && r.ms[n] ? `<span class="meta small">${Math.round(r.ms[n] / 1000)}s</span>` : ''}</div>
        <div>${q.u ? `<span class="meta">Underlined portion ${q.u}.</span> ` : ''}${q.q || ''}</div>
        <div class="meta">Your answer: ${u != null ? LET[u] + '. ' + q.c[u] : '—'}</div><div>Correct: <b>${LET[q.a]}. ${q.c[q.a]}</b></div><div class="small">${explainHTML(q, u)}</div></div>`;
    }).join('');
    return `<h2>${NAMES[r.sec]} · ${r.scale ?? '—'}</h2><p class="meta">Raw score ${r.raw} of ${r.tot} scored questions. ${items.filter(q => isFT(p, q)).length} field-test questions were not scored.</p>
      ${cats ? `<div class="tbl"><table class="t"><tr><th>Reporting category</th><th>Correct</th></tr>${cats}</table></div>` : ''}
      <details><summary class="btn sm" style="display:inline-block;margin-top:10px">Review all ${items.length} questions</summary>${rev}</details>`;
  }).join('');
  const h = store.get('aced-hist', []);
  h.push({ date: new Date().toLocaleDateString(), label: sess.label, mode: sess.timed ? 'Timed' : 'Untimed', sc, comp, stem });
  store.set('aced-hist', h.slice(-100));
  const missedList = [...missed];
  $('view').innerHTML = `<div class="spread"><h2>${esc(sess.label)} results</h2><button class="btn" data-act="backHome">Back</button></div>
    <div class="warn">Uncalibrated practice result. Aced questions have not been validated against official ACT performance, so this raw score does not convert to an ACT scale score. Use official practice tests (Official Scores tab) for score estimates.</div>
    <div class="grid">${tiles}</div>
    ${missedList.length ? `<div class="card" style="margin-top:12px"><div class="spread"><div><b>Turn misses into points</b><div class="meta">${missedList.length} skills had misses. Practice them with new questions.</div></div><button class="btn pri" data-act="trainMissed" data-subs="${esc(missedList.join('|'))}">Practice missed skills</button></div></div>` : ''}
    ${detail}`;
}
ACT.backHome = () => go(TAB === 'simulate' ? 'simulate' : 'study');
ACT.trainMissed = el => startTrain('targeted', { minutes: 20, subs: el.dataset.subs.split('|') });

// ---------- training runner (feedback, reasons, follow-ups) ----------
function curResp() { if (!R || R.kind !== 'train') return null; return R.resp[R.idx] || (R.resp[R.idx] = { phase: 'answer', ms: 0 }); }
function stepItem(i) { const s = R.steps[i]; return s ? (s.item || BYID[s.id]) : null; }
function renderTrain() {
  if (R.idx >= R.steps.length) return trainSummary();
  const it = stepItem(R.idx), r = curResp(), step = R.steps[R.idx];
  if (!it) { R.idx++; return renderTrain(); }
  $('ttl').textContent = `${R.label} — ${NAMES[it.sec]}`;
  $('calcBtn').hidden = it.sec !== 'math';
  const unit = it.unit && D.units[it.unit];
  setPassage(unit ? renderUnit(unit) : null, it.unit);
  if (unit) markPassage(it, r.phase === 'explain');
  const n = R.idx + 1, total = R.steps.length;
  const lock = r.phase !== 'answer';
  let h = `<div class="spread"><div class="qnum">Question ${n} of ${total}</div><div class="row">${step.follow ? '<span class="pill">Check: new question, same skill</span>' : ''}<span class="pill">${esc(subLabel(it.sub))}</span></div></div>`;
  if (R.mode === 'speed') h += `<div class="qtimer" id="qtimer"><i style="width:${Math.min(100, (r.ms || 0) / 10 / SECS[it.sec])}%"></i></div>`;
  h += stemHTML(it);
  h += choicesHTML(it, { sel: r.choice, x: r.x, lock, reveal: r.phase === 'explain' });
  if (r.phase === 'answer') {
    h += `<div class="conf">How sure are you? ${['sure', 'unsure', 'guess'].map(c => `<button class="chip" data-run="conf" data-c="${c}" aria-pressed="${r.conf === c}">${{ sure: 'Sure', unsure: 'Unsure', guess: 'Guessing' }[c]}</button>`).join('')}</div>`;
    if (r.hint && it.h) h += `<div class="hint"><b>Hint:</b> ${it.h}</div>`;
  } else if (r.phase === 'reason') {
    h += `<div class="fb no"><div class="verdict">Not quite. Before the explanation: what happened?</div>
      <div class="row">${Object.entries(E.REASONS).map(([k, v]) => `<button class="chip" data-run="reason" data-r="${k}" aria-pressed="${r.reason === k}">${esc(v)}</button>`).join('')}</div>
      <label class="field">Your thinking (optional)<input id="whyNote" value="${esc(r.note || '')}" placeholder="e.g. I thought the comma was needed because…"></label>
      <div class="row"><button class="btn pri" data-run="reasonGo">Show explanation</button><button class="btn ghost" data-run="reasonSkip">Skip</button></div></div>`;
  } else {
    const sk = ST.skills[it.sub];
    const tip = sk ? E.advice(sk) : null;
    const showLesson = !r.ok && (r.reason === 'concept' || (sk && sk.stuck) || r.conf === 'guess');
    h += `<div class="fb ${r.ok ? 'ok' : 'no'}"><div class="verdict">${r.ok ? (r.conf === 'guess' ? 'Correct, but you were guessing. Make sure the reasoning below matches yours.' : r.conf === 'unsure' ? 'Correct. Check that your reasoning matches.' : 'Correct.') : `The answer is ${LET[it.a]}.`}</div>
      ${explainHTML(it, r.choice)}
      ${showLesson && D.lessons[it.sub] ? lessonHTML(it.sub) : D.lessons[it.sub] ? `<details><summary class="meta">Skill lesson: ${esc(subLabel(it.sub))}</summary>${lessonHTML(it.sub)}</details>` : ''}
      ${tip && !r.ok ? `<div class="note small">${esc(tip)}</div>` : ''}
      ${R.mode === 'speed' ? `<div class="meta small">Time: ${Math.round((r.ms || 0) / 1000)}s (pace ${SECS[it.sec]}s)</div>` : ''}</div>`;
  }
  $('qpane').innerHTML = h;
  const answering = r.phase === 'answer';
  $('bot').innerHTML = `<button class="btn" data-run="exit">Save &amp; exit</button>
    <div class="row">${answering && it.h && R.mode !== 'speed' && !r.hint ? '<button class="btn" data-run="hint">Hint</button>' : ''}
    ${answering ? `<button class="btn pri" data-run="check" ${r.choice == null ? 'disabled' : ''}>Check answer</button>` : r.phase === 'explain' ? `<button class="btn pri" data-run="tnext">${R.idx + 1 >= R.steps.length ? 'Finish' : 'Next question →'}</button>` : ''}</div>
    <button class="btn ghost" data-run="tend">End session</button>`;
  $('qpane').scrollTop = 0;
}
function speedBar() { const r = curResp(), it = stepItem(R.idx), b = $('qtimer'); if (!b || !it) return; const f = (r.ms || 0) / 1000 / SECS[it.sec]; b.firstChild.style.width = Math.min(100, f * 100) + '%'; b.classList.toggle('over', f > 1); }
RUN.conf = b => { const r = curResp(); r.conf = r.conf === b.dataset.c ? null : b.dataset.c; saveRun(); render(); };
RUN.hint = () => { const r = curResp(); r.hint = true; saveRun(); render(); };
RUN.check = () => {
  const r = curResp(), it = stepItem(R.idx); if (r.choice == null) return;
  r.ok = r.choice === it.a;
  if (r.ok) { recordTrain(r, it); r.phase = 'explain'; }
  else r.phase = 'reason';
  saveRun(); render();
};
RUN.reason = b => { const r = curResp(); r.reason = b.dataset.r; render(); };
RUN.reasonGo = () => { const r = curResp(); const n = $('whyNote'); if (n) r.note = n.value.slice(0, 500); finishMiss(r); };
RUN.reasonSkip = () => { finishMiss(curResp()); };
function finishMiss(r) {
  const it = stepItem(R.idx);
  recordTrain(r, it); r.phase = 'explain';
  // Follow-up: a new question on the same skill to check the fix, inserted right after this one.
  if (!R.steps[R.idx].follow) {
    const used = new Set(R.steps.map(s => s.id));
    const f = E.followUp(ST, trainingBank(), it.sub, used, TAX);
    if (f) R.steps.splice(R.idx + 1, 0, { id: f.id, sub: f.sub, why: ['check that the fix stuck'], follow: true });
  }
  saveRun(); render();
}
function recordTrain(r, it) {
  if (r.recorded) {
    if (r.reason || r.note) {
      const a = [...ST.attempts].reverse().find(x => x.id === it.id);
      if (a && !a.reason) { a.reason = r.reason || null; a.note = r.note || a.note; const sk = ST.skills[it.sub]; if (sk && r.reason) sk.reasons[r.reason] = (sk.reasons[r.reason] || 0) + 1; saveState(); }
    }
    return;
  }
  E.record(ST, it, { ok: r.ok, ms: r.ms || null, changed: r.changed || 0, conf: r.conf || null, hint: !!r.hint, timed: R.mode === 'speed', mode: R.mode, sid: R.sid, choice: r.choice, reason: r.reason || null, typical: (TAX.subs[it.sub] || {}).diff });
  r.recorded = true;
  if (r.note) ST.attempts[ST.attempts.length - 1].note = r.note;
  saveState();
}
RUN.tnext = () => { R.idx++; saveRun(); render(); };
RUN.tend = b => {
  if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Click again to end'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'End session'; } }, 4000); return; }
  R.steps = R.steps.slice(0, R.idx + (curResp().recorded ? 1 : 0)); R.idx = R.steps.length; trainSummary();
};
function trainSummary() {
  stopTick();
  const done = Object.values(R.resp).filter(r => r.recorded);
  const right = done.filter(r => r.ok).length;
  const subs = [...new Set(R.steps.map(s => (s.item || BYID[s.id] || {}).sub).filter(Boolean))];
  const rows = subs.map(s => { const sk = ST.skills[s] || {}; return `<tr><td>${esc(subLabel(s))}</td><td>${stagePill(sk.stage || 'new')}</td><td>${sk.n ? pct(sk.c, sk.n) + '%' : '—'}</td><td class="meta">${sk.due ? new Date(sk.due).toLocaleDateString() : '—'}</td></tr>`; }).join('');
  const times = done.map((r, i) => r.ms).filter(Boolean);
  const sess = R; dropRun(R.id);
  show('app');
  $('view').innerHTML = `<div class="spread"><h2>${esc(sess.label)}: done</h2><button class="btn" data-act="backHome">Back to study</button></div>
    <div class="grid"><div class="card"><div class="meta">Correct</div><div class="big">${right}/${done.length}</div></div>
    <div class="card"><div class="meta">Average time</div><div class="big">${times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) + 's' : '—'}</div></div>
    <div class="card"><div class="meta">Time spent</div><div class="big">${fmt(sess.el || 0)}</div></div></div>
    <h2>Skills practiced</h2><div class="tbl"><table class="t"><tr><th>Skill</th><th>Stage</th><th>Overall accuracy</th><th>Next review</th></tr>${rows}</table></div>
    <h2>What to do next</h2><div class="card">${priorityList(3, [...new Set(sess.steps.map(st => (st.item || BYID[st.id] || {}).sec).filter(Boolean))])}</div>`;
}

// ---------- boot ----------
go(TAB);
