/*
 * Aced adaptive learning engine. Pure functions over a plain JSON student state, so the
 * same code runs in the browser (window.AcedEngine) and in node tests (require('./engine.js')).
 *
 * Model
 * - Every question is tagged with a subskill (`sub`) and a difficulty 1-5 (`diff`).
 * - Each subskill keeps an ability estimate `theta` on a logistic (Rasch-style) scale:
 *     P(correct) = 1 / (1 + e^-(theta - b)),  b = (diff - 3) * B_PER_LEVEL
 *   updated Elo-style after each answer with a step size that shrinks as evidence grows.
 * - Correct answers marked as guesses or made after a hint count only partially, so
 *   "right for the wrong reason" does not inflate ability or mastery.
 * - Mastery is staged (understood -> practicing -> timed -> mastered -> retained) and
 *   requires success across different questions and different sessions, never one answer.
 * - Spaced repetition: each successful session roughly doubles a skill's review interval;
 *   a miss resets it, and a miss on a mastered skill demotes it and makes it due now.
 * - Priority of a skill = expected scale points recoverable on the real test:
 *     (share of scored ACT items) x (scored items in section) x (scale points per raw point)
 *     x (1 - P(correct at the skill's typical ACT difficulty))
 *   times multipliers for repeated misses, slowness, due reviews, near-mastery, and
 *   exploration; mastered skills that are not due are heavily discounted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AcedEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 864e5;
  const B_PER_LEVEL = 0.9;
  const SECTIONS = ['english', 'math', 'reading', 'science'];
  const SCORED = { english: 40, math: 41, reading: 27, science: 34 };
  const STAGES = ['new', 'learning', 'understood', 'practicing', 'timed', 'mastered', 'retained'];
  const STAGE_LABEL = {
    new: 'Not started', learning: 'Learning', understood: 'First-time understanding', practicing: 'Practicing successfully',
    timed: 'Performing under time pressure', mastered: 'Consistent mastery', retained: 'Long-term retention'
  };
  const REASONS = {
    concept: "Didn't know the rule or concept",
    misread: 'Misread the question or passage',
    careless: 'Careless slip (knew it)',
    time: 'Rushed or ran out of time',
    twoway: 'Narrowed to two, picked wrong',
    guess: 'Guessed'
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const bOf = d => ((d || 3) - 3) * B_PER_LEVEL;
  const pCorrect = (theta, d) => 1 / (1 + Math.exp(-((theta || 0) - bOf(d))));
  // Difficulty level whose success chance for this ability is `p` (0.7 = desirable difficulty).
  const diffForP = (theta, p) => 3 + ((theta || 0) - Math.log(p / (1 - p))) / B_PER_LEVEL;

  function newState() {
    return { v: 2, created: Date.now(), attempts: [], skills: {}, items: {}, sessions: [], sims: [], checkpoints: [], estimates: [], prefs: { includeScience: false } };
  }

  function migrate(s) {
    if (!s || typeof s !== 'object') return newState();
    const base = newState();
    for (const k of Object.keys(base)) if (s[k] == null) s[k] = base[k];
    s.v = 2;
    return s;
  }

  function newSkill() {
    return { n: 0, c: 0, theta: 0, last: 0, due: 0, ivl: 0, recent: [], sess: [], itemsOk: [], timedOk: 0, timedN: 0,
      stage: 'new', masteredAt: 0, relapse: false, bumpSid: null, reasons: {}, hints: 0, guesses: 0,
      sessTheta: {}, stuck: false, strategy: 0, stuckSince: 0 };
  }

  // Outcome credit for a correct answer: full credit only when confident and unaided.
  function credit(a) {
    if (!a.ok) return 0;
    let w = 1;
    if (a.conf === 'guess') w = 0.25;
    else if (a.conf === 'unsure') w = 0.7;
    if (a.hint) w = Math.min(w, 0.5);
    return w;
  }

  /**
   * Record one answered question. `item` = {id, sec, sub, diff, t}; `a` = {ok, ms, changed, conf,
   * hint, timed, mode, sid, choice, reason}. Mutates and returns state.
   */
  function record(state, item, a, now) {
    now = now || Date.now();
    const sub = item.sub || 'unknown';
    const sk = state.skills[sub] || (state.skills[sub] = newSkill());
    // A retention check is an answer on a skill not practiced for a week or more.
    if (a.review == null) a.review = !!(sk.last && now - sk.last >= 7 * DAY);
    const w = credit(a);
    const p = pCorrect(sk.theta, item.diff);
    const outcome = a.ok ? p + w * (1 - p) : 0; // a guessed correct answer barely moves ability
    const K = Math.max(0.18, 0.9 / Math.sqrt(1 + sk.n / 3));
    if (sk.sessTheta[a.sid] == null) sk.sessTheta[a.sid] = sk.theta;
    sk.theta = clamp(sk.theta + K * (outcome - p), -4, 4);
    sk.n++; if (a.ok) sk.c++;
    if (a.hint) sk.hints++;
    if (a.ok && a.conf === 'guess') sk.guesses++;
    if (!a.ok && a.reason) sk.reasons[a.reason] = (sk.reasons[a.reason] || 0) + 1;
    const est = (item.t || 60) * 1000;
    const fast = a.ms != null && a.ms <= est;
    if (a.timed) { sk.timedN++; if (a.ok && w >= 0.7 && a.ms != null && a.ms <= est * 1.25) sk.timedOk++; }
    sk.recent.push({ ok: !!a.ok, w, d: item.diff || 3, ms: a.ms, t: item.t || 60, timed: !!a.timed, sid: a.sid, id: item.id, at: now, review: !!a.review });
    if (sk.recent.length > 12) sk.recent.shift();
    if (a.ok && w >= 0.7) {
      if (!sk.sess.includes(a.sid)) { sk.sess.push(a.sid); if (sk.sess.length > 12) sk.sess.shift(); }
      if (!sk.itemsOk.includes(item.id)) { sk.itemsOk.push(item.id); if (sk.itemsOk.length > 20) sk.itemsOk.shift(); }
    }
    // Spaced repetition: grow the interval at most once per session, reset on a miss.
    const wasMastered = sk.stage === 'mastered' || sk.stage === 'retained';
    if (a.ok && w >= 0.7) {
      if (sk.bumpSid !== a.sid) { sk.ivl = sk.ivl ? Math.min(60, sk.ivl * (fast ? 2.5 : 2)) : 1; sk.bumpSid = a.sid; }
      sk.due = now + sk.ivl * DAY;
    } else if (!a.ok) {
      sk.ivl = 1; sk.due = now + 0.25 * DAY; sk.bumpSid = a.sid;
      if (wasMastered) { sk.relapse = true; sk.due = now; }
    }
    sk.last = now;
    const prevStage = sk.stage;
    sk.stage = deriveStage(sk, a.typical || 3, now);
    if ((sk.stage === 'mastered' || sk.stage === 'retained') && !sk.masteredAt) sk.masteredAt = now;
    if (sk.stage !== 'mastered' && sk.stage !== 'retained' && wasMastered) sk.masteredAt = 0;
    if (a.ok && sk.relapse && sk.stage !== prevStage && STAGES.indexOf(sk.stage) >= STAGES.indexOf('practicing')) sk.relapse = false;
    updateStuck(sk, now);
    const it = state.items[item.id] || (state.items[item.id] = { n: 0, ok: 0, last: 0 });
    it.n++; if (a.ok) it.ok++; it.last = now; it.lastOk = !!a.ok;
    state.attempts.push({ id: item.id, sec: item.sec, sub, d: item.diff || 3, t: item.t || 60, ok: !!a.ok, w, ms: a.ms, changed: a.changed || 0,
      conf: a.conf || null, hint: !!a.hint, timed: !!a.timed, mode: a.mode || null, sid: a.sid, choice: a.choice, reason: a.reason || null,
      review: !!a.review, at: now });
    return state;
  }

  function deriveStage(sk, typical, now) {
    if (!sk.n) return 'new';
    const conf = sk.recent.filter(r => r.ok && r.w >= 0.7);
    if (!conf.length) return 'learning';
    const last5 = sk.recent.slice(-5), last6 = sk.recent.slice(-6);
    const acc = arr => arr.length ? arr.reduce((s, r) => s + (r.ok ? r.w : 0), 0) / arr.length : 0;
    const pTypical = pCorrect(sk.theta, Math.max(3, typical || 3));
    let stage = 'understood';
    if (conf.length >= 3 && acc(last5) >= 0.7) stage = 'practicing';
    if (stage === 'practicing' && sk.timedOk >= 2) stage = 'timed';
    if (stage === 'timed' && pTypical >= 0.8 && sk.sess.length >= 3 && sk.itemsOk.length >= 3 && acc(last6) >= 0.8) stage = 'mastered';
    if (stage === 'mastered' && sk.masteredAt && sk.recent.some(r => r.ok && r.w >= 0.7 && r.at - sk.masteredAt >= 7 * DAY)) stage = 'retained';
    return stage;
  }

  // A skill is "stuck" when practice is not moving ability: 12+ attempts across 3+ sessions,
  // accuracy under 60%, and ability gain under 0.25 since the stuck window began.
  function updateStuck(sk, now) {
    const sids = Object.keys(sk.sessTheta);
    if (sk.n < 12 || sids.length < 3) { sk.stuck = false; return; }
    const window = sk.recent.slice(-10);
    const acc = window.filter(r => r.ok).length / window.length;
    const startTheta = sk.sessTheta[sids[Math.max(0, sids.length - 3)]];
    const gain = sk.theta - startTheta;
    const nowStuck = acc < 0.6 && gain < 0.25;
    if (nowStuck && !sk.stuck) { sk.stuck = true; sk.strategy++; sk.stuckSince = now; }
    if (!nowStuck && sk.stuck && (acc >= 0.7 || gain >= 0.4)) sk.stuck = false;
  }

  // Scale points gained per extra raw point near the student's current raw score.
  function slope(conv, raw) {
    if (!conv || !conv.length) return 0.9;
    const r = clamp(Math.round(raw), 0, conv.length - 1);
    const lo = clamp(r - 2, 0, conv.length - 1), hi = clamp(r + 2, 0, conv.length - 1);
    return Math.max(0.3, (conv[hi] - conv[lo]) / Math.max(1, hi - lo));
  }

  function median(xs) { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

  /** Priority of one subskill with human-readable reasons. */
  function skillPriority(state, tax, sub, now, ctx) {
    now = now || Date.now();
    const info = tax.subs[sub] || { sec: 'english', weight: 0.01, diff: 3, t: 60, label: sub };
    const sec = info.sec;
    const sk = state.skills[sub] || newSkill();
    const p = pCorrect(sk.theta, info.diff || 3);
    const raw = ctx && ctx.raw && ctx.raw[sec] != null ? ctx.raw[sec] : SCORED[sec] * 0.6;
    const pts = slope(tax.conv && tax.conv[sec], raw);
    const sectionWeight = sec === 'science' ? (state.prefs && state.prefs.includeScience ? 0.75 : 0.15) : 1;
    // Expected scale points recoverable on this section if this subskill were mastered.
    const base = (info.weight || 0.01) * SCORED[sec] * pts * (1 - p) * sectionWeight;
    let mult = 1;
    const reasons = [];
    const misses = sk.recent.filter(r => !r.ok).length;
    if (misses >= 2) { mult *= 1 + 0.15 * misses; reasons.push(`missed ${misses} of your last ${sk.recent.length}`); }
    const ratio = median(sk.recent.filter(r => r.ms != null).map(r => r.ms / (r.t * 1000)));
    if (ratio != null && ratio > 1.3 && sk.recent.length >= 3) { mult *= 1.2; reasons.push(`you take ${ratio.toFixed(1)}x the target time`); }
    const mastered = sk.stage === 'mastered' || sk.stage === 'retained';
    const due = sk.n > 0 && sk.due && now >= sk.due;
    if (sk.relapse) { mult *= 1.6; reasons.push('you missed it after mastering it'); }
    if (due && !mastered) { mult *= 1.35; reasons.push('due for spaced review'); }
    if (mastered) { if (due) { mult *= 0.6; reasons.push('retention check due'); } else mult *= 0.12; }
    if (!mastered && p >= 0.55 && p < 0.8 && sk.n >= 3) { mult *= 1.25; reasons.push('close to mastery'); }
    if (sk.n < 2) { mult *= 1.15; reasons.push('not enough data yet'); }
    if (sk.stuck) reasons.push('progress stalled, switching to step-by-step practice');
    if (info.weight >= 0.06) reasons.push(`appears often (${Math.round(info.weight * 100)}% of ${cap(sec)})`);
    return { sub, sec, score: base * mult, base, p, pts, reasons, stage: sk.stage, label: info.label || sub };
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function rankSkills(state, tax, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const ctx = { raw: estimateRaw(state, tax) };
    return Object.keys(tax.subs)
      .filter(s => !opts.sections || opts.sections.includes(tax.subs[s].sec))
      .filter(s => !opts.subs || opts.subs.includes(s))
      .map(s => skillPriority(state, tax, s, now, ctx))
      .sort((a, b) => b.score - a.score);
  }

  function estimateRaw(state, tax) {
    const out = {};
    for (const sec of SECTIONS) {
      let raw = 0;
      for (const [sub, info] of Object.entries(tax.subs)) if (info.sec === sec) raw += (info.weight || 0) * SCORED[sec] * pCorrect((state.skills[sub] || {}).theta || 0, info.diff || 3);
      out[sec] = raw;
    }
    return out;
  }

  /** Difficulty to aim for: ~70% success, scaffolded down after repeated misses or when stuck. */
  function targetDifficulty(sk, info) {
    const typical = (info && info.diff) || 3;
    if (!sk || !sk.n) return clamp(Math.round(typical) - 1, 1, 5);
    const recent = sk.recent.slice(-3);
    const missStreak = (() => { let k = 0; for (let i = sk.recent.length - 1; i >= 0 && !sk.recent[i].ok; i--) k++; return k; })();
    if (sk.stuck || missStreak >= 2) return clamp(Math.min(typical, Math.round(diffForP(sk.theta, 0.8))) - 1, 1, 5);
    let d = Math.round(diffForP(sk.theta, 0.7));
    if (recent.length === 3 && recent.every(r => r.ok && r.w >= 0.7 && r.ms != null && r.ms <= r.t * 1000)) d += 1; // fast and right: push up
    // Never let easy wins stand in for ACT-level work once basics are in place.
    if (STAGES.indexOf(sk.stage) >= STAGES.indexOf('practicing')) d = Math.max(d, typical);
    return clamp(d, 1, 5);
  }

  /**
   * Pick the next item for a subskill. Prefers unseen items, held-out simulation items are
   * never used, items already used this session are skipped.
   */
  function pickItem(state, bank, sub, opts) {
    opts = opts || {};
    const used = opts.used || new Set();
    const sk = state.skills[sub];
    const info = (opts.tax && opts.tax.subs[sub]) || {};
    const want = opts.difficulty || targetDifficulty(sk, info);
    const rng = opts.rng || Math.random;
    let best = null, bestScore = Infinity;
    for (const it of bank) {
      if (it.sub !== sub || it.held || used.has(it.id) || it.flagged) continue;
      if (opts.exclude && opts.exclude.has(it.id)) continue;
      const seen = state.items[it.id];
      let s = Math.abs((it.diff || 3) - want) * 1.0;
      if (seen) s += 3 + (seen.lastOk ? 2 : 0) - Math.min(2, ((opts.now || Date.now()) - seen.last) / (14 * DAY));
      if (sk && sk.stuck && it.scaffold) s -= 0.75;
      s += rng() * 0.6;
      if (s < bestScore) { bestScore = s; best = it; }
    }
    return best;
  }

  /**
   * Build a study session. Returns {steps:[{id, sub, why}], plan:[{sub,label,count,reasons}]}.
   * mode: 'max' (default), 'targeted', 'speed', 'review'.
   */
  function planSession(state, bank, tax, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const rng = opts.rng || Math.random;
    const minutes = opts.minutes || 20;
    const mode = opts.mode || 'max';
    const overhead = mode === 'speed' ? 1.15 : 1.6; // time spent reading explanations in training
    const budget = minutes * 60;
    let ranked = rankSkills(state, tax, { now, sections: opts.sections, subs: opts.subs });
    const available = new Set(bank.filter(i => !i.held && !i.flagged).map(i => i.sub));
    ranked = ranked.filter(r => available.has(r.sub));
    if (mode === 'review') {
      const missed = new Set(state.attempts.filter(a => !a.ok).slice(-200).map(a => a.sub));
      ranked = ranked.filter(r => missed.has(r.sub));
    }
    if (!ranked.length) return { steps: [], plan: [] };
    // Focus on the top skills, plus one retention check and one exposure skill for balance.
    const focusN = minutes <= 10 ? 2 : minutes <= 20 ? 3 : minutes <= 30 ? 4 : 5;
    const focus = ranked.slice(0, focusN);
    const extras = [];
    if (mode === 'max') {
      const retention = ranked.find(r => (r.stage === 'mastered' || r.stage === 'retained') && !focus.includes(r) && (state.skills[r.sub] || {}).due <= now);
      if (retention) extras.push(Object.assign({}, retention, { reasons: ['retention check on a mastered skill'] }));
      const lastSeen = s => (state.skills[s.sub] || {}).last || 0;
      const exposure = ranked.filter(r => !focus.includes(r) && !extras.includes(r)).sort((a, b) => lastSeen(a) - lastSeen(b))[0];
      if (exposure) extras.push(Object.assign({}, exposure, { reasons: ['keeps every area in rotation'] }));
    }
    const chosen = focus.concat(extras);
    const total = chosen.reduce((s, r) => s + r.score, 0) || 1;
    const used = new Set();
    // Mistake review must use NEW questions on the missed skills, never the memorized originals.
    const exclude = mode === 'review' ? new Set(Object.keys(state.items)) : null;
    const steps = [];
    const plan = chosen.map(r => ({ sub: r.sub, label: r.label, sec: r.sec, reasons: r.reasons, share: r.score / total, count: 0 }));
    let spent = 0, guard = 0;
    // Weighted round-robin: each pick goes to the skill furthest below its target share.
    while (spent < budget && guard++ < 400) {
      const n = steps.length + 1;
      plan.sort((a, b) => (a.count / n - a.share) - (b.count / n - b.share));
      let placed = false;
      for (const pl of plan) {
        const it = pickItem(state, bank, pl.sub, { used, tax, now, rng, exclude });
        if (!it) continue;
        // Passage-based items: take up to 3 needed items from the same passage together.
        const group = [it];
        if (it.unit) {
          for (const other of bank) {
            if (group.length >= 3) break;
            if (other.unit === it.unit && other.id !== it.id && !used.has(other.id) && !other.held && !other.flagged && plan.some(p => p.sub === other.sub) && !state.items[other.id]) group.push(other);
          }
        }
        for (const g of group) {
          used.add(g.id);
          const owner = plan.find(p => p.sub === g.sub) || pl;
          owner.count++;
          steps.push({ id: g.id, sub: g.sub, why: owner.reasons.slice(0, 2) });
          spent += (g.t || 60) * overhead;
        }
        placed = true;
        break;
      }
      if (!placed) break;
    }
    // Keep passage groups contiguous, otherwise preserve interleaving.
    const order = [], seenUnit = new Set();
    const byId = Object.fromEntries(bank.map(i => [i.id, i]));
    for (const s of steps) {
      const u = byId[s.id].unit;
      if (!u) { order.push(s); continue; }
      if (seenUnit.has(u)) continue;
      seenUnit.add(u);
      for (const t of steps) if (byId[t.id].unit === u) order.push(t);
    }
    return { steps: order, plan: plan.filter(p => p.count).sort((a, b) => b.count - a.count) };
  }

  /** A fresh item on the same subskill to confirm learning after a miss. */
  function followUp(state, bank, sub, used, tax) {
    return pickItem(state, bank, sub, { used, tax, difficulty: undefined });
  }

  /** Advice keyed on what the student said went wrong. */
  function advice(sk) {
    if (!sk) return null;
    const r = sk.reasons || {};
    const top = Object.entries(r).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 2) return null;
    return {
      concept: 'Most misses here are from not knowing the rule. Read the skill lesson, then do the step-by-step questions before timed ones.',
      misread: 'Most misses come from misreading. Put the question in your own words before looking at the choices.',
      careless: 'You usually know this one. Before you confirm, re-check the step where errors happen (signs, units, the exact word asked).',
      time: 'Time pressure is the issue. Use Speed training for this skill once accuracy holds untimed.',
      twoway: 'You narrow to two and pick wrong. For the last two choices, find the specific word or fact that makes one of them wrong.',
      guess: 'You are guessing often here. Learn the core method from the lesson first.'
    }[top[0]];
  }

  /** Score estimate per section with an evidence label. Never claims official equivalence. */
  function estimateScores(state, tax) {
    const raw = estimateRaw(state, tax);
    const out = {};
    for (const sec of SECTIONS) {
      const att = state.attempts.filter(a => a.sec === sec);
      const secW = Object.values(tax.subs).filter(i => i.sec === sec).reduce((x, i) => x + (i.weight || 0), 0) || 1;
      const covered = Object.entries(tax.subs).filter(([s, i]) => i.sec === sec && (state.skills[s] || {}).n >= 2).reduce((x, [, i]) => x + (i.weight || 0), 0) / secW;
      const conv = tax.conv && tax.conv[sec];
      const scale = conv ? conv[clamp(Math.round(raw[sec]), 0, conv.length - 1)] : null;
      let level = 'insufficient';
      if (att.length >= 40 && covered >= 0.6) level = 'preliminary';
      const cp = (state.checkpoints || []).filter(c => c.scores && c.scores[sec] != null && c.est && c.est[sec] != null).slice(-1)[0];
      let calibrated = null;
      if (cp && level === 'preliminary') { calibrated = clamp(Math.round(scale + (cp.scores[sec] - cp.est[sec]) * 0.7), 1, 36); level = 'calibrated'; }
      const spread = clamp(Math.round(4 / Math.sqrt(Math.max(1, att.length / 40))), 1, 4);
      const center = calibrated != null ? calibrated : scale;
      out[sec] = { raw: Math.round(raw[sec] * 10) / 10, scale: center, low: center == null ? null : clamp(center - spread, 1, 36), high: center == null ? null : clamp(center + spread, 1, 36), level, attempts: att.length, coverage: Math.round(covered * 100) };
    }
    const core = ['english', 'math', 'reading'];
    const ok = core.every(s => out[s].level !== 'insufficient');
    out.composite = ok ? Math.round(core.reduce((s, k) => s + out[k].scale, 0) / 3) : null;
    return out;
  }

  /** Top priorities with an explanation and a practice recommendation. */
  function topPriorities(state, tax, k, now) {
    return rankSkills(state, tax, { now }).slice(0, k || 5).map(r => {
      const sk = state.skills[r.sub] || newSkill();
      const items = clamp(Math.round(6 + 14 * (1 - r.p)), 6, 20);
      const sessions = r.p < 0.5 ? 3 : 2;
      return Object.assign({}, r, {
        gainPts: Math.round(r.base * 10) / 10,
        recommend: `About ${items} questions over the next ${sessions} sessions`,
        advice: advice(sk),
        stageLabel: STAGE_LABEL[sk.stage],
        stuck: sk.stuck
      });
    });
  }

  /** Evidence that the system is (or is not) working. */
  function evaluate(state, now) {
    now = now || Date.now();
    const att = state.attempts;
    const acc = arr => arr.length ? Math.round(100 * arr.filter(a => a.ok).length / arr.length) : null;
    // Weak skills: first 5 attempts under 60%; compare with their 5 most recent attempts.
    const bySub = {};
    att.forEach(a => (bySub[a.sub] = bySub[a.sub] || []).push(a));
    const weak = Object.entries(bySub).filter(([, xs]) => xs.length >= 8 && acc(xs.slice(0, 5)) < 60);
    const weakBefore = acc(weak.flatMap(([, xs]) => xs.slice(0, 5)));
    const weakAfter = acc(weak.flatMap(([, xs]) => xs.slice(-5)));
    const timed = att.filter(a => a.timed);
    const half = Math.floor(timed.length / 2);
    const fresh = att.filter(a => !(state.items[a.id] && state.items[a.id].n > 1 && a.review));
    const retention = att.filter(a => a.review);
    const cps = (state.checkpoints || []).slice().sort((a, b) => a.at - b.at);
    const comp = c => c.composite;
    const official = cps.length >= 2 ? { first: comp(cps[0]), last: comp(cps[cps.length - 1]), delta: comp(cps[cps.length - 1]) - comp(cps[0]) } : cps.length ? { first: comp(cps[0]), last: comp(cps[0]), delta: 0 } : null;
    const trainFirst = acc(att.filter(a => a.mode !== 'sim').slice(0, 60));
    const trainLast = acc(att.filter(a => a.mode !== 'sim').slice(-60));
    const warnings = [];
    if (official && cps.length >= 2 && trainLast - trainFirst >= 10 && official.delta <= 0)
      warnings.push('Practice accuracy is rising but your official practice scores are not. Shift time toward timed full sections and full-length simulations, and log another official test after that.');
    if (timed.length >= 20 && acc(timed.slice(half)) < acc(timed.slice(0, half)) - 10)
      warnings.push('Accuracy under time pressure has dropped. Do Speed training on your highest-priority skills before adding new material.');
    const stuck = Object.entries(state.skills).filter(([, s]) => s.stuck).map(([k]) => k);
    if (stuck.length) warnings.push(`${stuck.length} skill(s) are not improving with practice. Those switch to lessons and step-by-step questions automatically.`);
    return {
      weakSkills: weak.length, weakBefore, weakAfter,
      timedEarly: acc(timed.slice(0, half)), timedLate: acc(timed.slice(half)), timedN: timed.length,
      freshAcc: acc(fresh.slice(-60)), retentionAcc: acc(retention), retentionN: retention.length,
      official, trainFirst, trainLast, warnings
    };
  }

  return {
    DAY, SECTIONS, SCORED, STAGES, STAGE_LABEL, REASONS,
    newState, migrate, record, pCorrect, diffForP, targetDifficulty, pickItem, planSession, followUp,
    skillPriority, rankSkills, topPriorities, estimateScores, estimateRaw, evaluate, advice, credit
  };
});
