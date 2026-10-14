// Generates enhanced-ACT-style math items with answers computed by construction.
// Each template returns {sub, q, c: [correct, ...3 distractors], e, strat?, model?, diff}; the app orders choices.
// Distractors encode common errors (sign slips, wrong formula, partial answers, reversed operations).
window.ACED_MATHGEN = (function () {
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const nz = (r, a, b) => { let v = 0; while (!v) v = ri(r, a, b); return v; };
  const sgn = v => (v < 0 ? '− ' + -v : '+ ' + v);
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
  const cx = (a, b) => b === 0 ? String(a) : a === 0 ? (b === 1 ? 'i' : b === -1 ? '−i' : `${b}i`.replace('-', '−')) : `${a} ${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}i`;
  const neg = s => String(s).replace(/^-/, '−');
  // Four distinct choices, correct first; pads with nearby numbers when distractors collide.
  function uniq(correct, ds, r) {
    const out = [neg(correct)];
    for (const d of ds) { const s = neg(d); if (!out.includes(s)) out.push(s); }
    let k = 1;
    // Numeric answers get nearby integers as extra distractors; non-numeric collisions are left short
    // so the item fails validation and is regenerated.
    while (out.length < 4 && typeof correct === 'number' && k < 20) { const v = neg(correct + k * (k % 2 ? 1 : -1) + (k > 2 ? 1 : 0)); if (!out.includes(v)) out.push(v); k++; }
    return out.slice(0, 4);
  }
  const T = [
    // ---------- Algebra ----------
    r => { const a = nz(r, 2, 9), x = ri(r, -9, 12), b = ri(r, -20, 20), c = a * x + b;
      return { sub: 'm.a.linear', diff: 1, q: `If ${a}x ${sgn(b)} = ${c}, what is the value of x?`, c: uniq(x, [(c + b) / a, c - b, x + 2], r), e: `Subtract ${b} from both sides, then divide by ${a}: x = ${x}.` }; },
    r => { const a = ri(r, 2, 6), b = ri(r, 3, 9), c = ri(r, 10, 30), v = +((c + b) / a).toFixed(2);
      return { sub: 'm.a.linear', diff: 2, q: `Which inequality is equivalent to ${a}x − ${b} > ${c} ?`, c: uniq(`x > ${v}`, [`x < ${v}`, `x > ${+((c - b) / a).toFixed(2)}`, `x > ${c + b - a}`], r), e: `${a}x > ${c + b}, so x > ${v}.` }; },
    r => { const k = ri(r, 2, 6), m = ri(r, 1, 9), n = ri(r, 1, 9);
      return { sub: 'm.a.linear', diff: 3, q: `If x/${k} − ${m} = ${n}, what is x in terms of the given numbers?`, c: uniq(k * (n + m), [n + m * k, k * n - m, (n + m) / k], r), e: `Add ${m}: x/${k} = ${n + m}. Multiply by ${k}: x = ${k * (n + m)}.`, strat: 'Undo the last operation first (subtraction), then the division.' }; },
    r => { const per = pick(r, [6, 8, 12, 15, 24]), items = ri(r, 50, 400); if (items % per === 0) return null; const boxes = Math.ceil(items / per);
      return { sub: 'm.a.linear', model: true, diff: 2, q: `A bakery packs muffins in boxes that hold ${per} each. What is the least number of boxes needed to pack ${items} muffins?`, c: uniq(boxes, [boxes - 1, Math.round(items / per) === boxes ? boxes + 1 : Math.round(items / per), items % per], r), e: `${items} ÷ ${per} = ${(items / per).toFixed(2)}, so round UP: ${boxes} boxes.`, strat: '“Least number needed” means round up, even for a small remainder.' }; },
    r => { const c = ri(r, -6, 8), w = ri(r, 2, 9);
      return { sub: 'm.a.abs', diff: 3, q: `How many integers x satisfy |x ${sgn(-c)}| ≤ ${w} ?`, c: uniq(2 * w + 1, [2 * w, w + 1, 2 * w - 1], r), e: `${c - w} ≤ x ≤ ${c + w}: that is ${2 * w + 1} integers (count both endpoints).`, strat: 'Rewrite as a compound inequality, then count inclusively.' }; },
    r => { const a = ri(r, 2, 5), b = ri(r, 1, 9), c = a * ri(r, 2, 6), s1 = (c + b) / a, s2 = (b - c) / a;
      if (!Number.isInteger(s1) || !Number.isInteger(s2)) return null;
      return { sub: 'm.a.abs', diff: 3, q: `What is the sum of the solutions of |${a}x − ${b}| = ${c} ?`, c: uniq(s1 + s2, [s1, s1 - s2, -(s1 + s2)], r), e: `${a}x − ${b} = ${c} gives x = ${s1}; ${a}x − ${b} = −${c} gives x = ${s2}. Sum: ${s1 + s2}.` }; },
    r => { const x = ri(r, -4, 6), y = ri(r, -5, 5), a = nz(r, 1, 5), b = nz(r, -4, 4), c = nz(r, 1, 6), d = nz(r, -5, 5);
      if (a * d - b * c === 0) return null;
      return { sub: 'm.a.systems', diff: 3, q: `If ${a}x ${sgn(b)}y = ${a * x + b * y} and ${c}x ${sgn(d)}y = ${c * x + d * y}, what is the value of y?`, c: uniq(y, [x, -y, x + y], r), e: `Eliminate x (multiply and subtract). The solution is x = ${x}, y = ${y}.`, desmos: 'Graph both lines and read the y-coordinate of the intersection.', strat: 'Check which variable the question asks for.' }; },
    r => { const k = ri(r, 2, 4), a = ri(r, 1, 4), b = ri(r, 2, 6);
      return { sub: 'm.a.systems', diff: 4, q: `For what value of c does the system ${a}x + ${b}y = 7 and ${k * a}x + cy = 5 have no solution?`, c: uniq(k * b, [b, k * a, -k * b], r), e: `No solution means parallel lines: c/${b} = ${k * a}/${a} = ${k}, so c = ${k * b}, while 5 ≠ ${7 * k}.` }; },
    r => { const a = ri(r, 2, 5), b = nz(r, -9, 9);
      return { sub: 'm.a.poly', diff: 2, q: `Which expression is equivalent to (${a}x ${sgn(b)})² ?`, c: [`${a * a}x² ${sgn(2 * a * b)}x ${sgn(b * b)}`, `${a * a}x² ${sgn(b * b)}`, `${2 * a}x ${sgn(2 * b)}`, `${a * a}x² ${sgn(a * b)}x ${sgn(b * b)}`], e: `(p + q)² = p² + 2pq + q²: the middle term is 2(${a}x)(${b}) = ${2 * a * b}x.`, strat: 'Never square term by term; the middle term is the usual trap.' }; },
    r => { const p = nz(r, -7, 7), q = nz(r, -7, 7); if (p === q || p === -q) return null;
      const b = -(p + q), c = p * q, f = (m, n) => `x = ${Math.min(m, n)} and x = ${Math.max(m, n)}`;
      return { sub: 'm.a.poly', diff: 2, q: `What are the solutions of x² ${sgn(b)}x ${sgn(c)} = 0 ?`, c: uniq(f(p, q), [f(-p, -q), f(p, -q), f(-p, q)], r), e: `Factor: (x ${sgn(-p)})(x ${sgn(-q)}) = 0, so x = ${p} or x = ${q}.` }; },
    r => { const a = pick(r, [1, 2, 3]), b = ri(r, -9, 9), c = ri(r, -12, 12), k = nz(r, -4, 4), rem = a * k * k + b * k + c;
      return { sub: 'm.a.poly', diff: 4, q: `What is the remainder when p(x) = ${a === 1 ? '' : a}x² ${sgn(b)}x ${sgn(c)} is divided by x ${sgn(-k)} ?`, c: uniq(rem, [a * k * k - b * k + c, c, rem + 2 * k], r), e: `Remainder theorem: the remainder is p(${k}) = ${rem}.`, strat: 'Dividing by (x − k) leaves remainder p(k); no long division needed.' }; },
    r => { const k = ri(r, 2, 5);
      return { sub: 'm.a.poly', diff: 4, q: `When (x + ${k})³ is expanded, what is the coefficient of x² ?`, c: uniq(3 * k, [k, k * k, 3 * k * k], r), e: `(x + ${k})³ = x³ + 3(${k})x² + 3(${k})²x + ${k}³, so the coefficient is ${3 * k}.` }; },
    r => { const k = ri(r, 3, 8), a = pick(r, [1, 3, 5, 7]); if ((k * k - a) % 2) return null; const x = (k * k - a) / 2;
      return { sub: 'm.a.radrat', diff: 3, q: `What value of x satisfies √(2x + ${a}) = ${k} ?`, c: uniq(x, [(k - a) / 2, k * k - a, (k * k + a) / 2], r), e: `Square both sides: 2x + ${a} = ${k * k}, so x = ${x}.`, strat: 'Square only after the radical is alone on one side.' }; },
    r => { const x = ri(r, 5, 12), a = ri(r, 2, 4), b = 1, d = ri(r, 2, 4); const lhs = a * (x - d), rhs = x - b;
      if (lhs % rhs !== 0) return null;
      const k = lhs / rhs; // a/(x-b) = k/(x-d)?  build: a(x−d) = k(x−b)
      return { sub: 'm.a.radrat', diff: 4, q: `What value of x satisfies ${a}/(x − ${b}) = ${k}/(x − ${d}) ?`, c: uniq(x, [x + 2, d, b + k], r), e: `Cross-multiply: ${a}(x − ${d}) = ${k}(x − ${b}). Solving gives x = ${x}; check it does not make a denominator zero.` }; },
    // ---------- Functions ----------
    r => { const a = nz(r, 2, 5), b = ri(r, -6, 6), x = ri(r, -3, 4), c2 = ri(r, 1, 4), d = ri(r, -5, 5), g = c2 * x + d, f = a * g + b;
      return { sub: 'm.f.notation', diff: 3, q: `Let f(x) = ${a}x ${sgn(b)} and g(x) = ${c2}x ${sgn(d)}. What is f(g(${x})) ?`, c: uniq(f, [c2 * (a * x + b) + d, a * x + b + g, g], r), e: `g(${x}) = ${g}; f(${g}) = ${f}.`, strat: 'Inside out: evaluate g first.' }; },
    r => { const a = ri(r, 2, 5), b = ri(r, 2, 9), x = ri(r, -4, -1), v = a * x * x - b * x;
      return { sub: 'm.f.notation', diff: 2, q: `If f(x) = ${a}x² − ${b}x, what is f(${x}) ?`, c: uniq(v, [-a * x * x - b * x, a * x * x + b * x, a * x * x], r), e: `${a}(${x})² − ${b}(${x}) = ${a * x * x} + ${-b * x} = ${v}.`, strat: 'Use parentheses: (−n)² is positive.' }; },
    r => { const hrs = pick(r, [8, 10, 12, 16, 20]);
      return { sub: 'm.f.notation', model: true, diff: 3, q: `A phone battery drains at a constant rate from 100% to 0% in ${hrs} hours. The function B(h) gives the percent of charge remaining h hours after it was fully charged, for the time until it is empty. What is the range of B?`, c: ['[0, 100]', `[0, ${hrs}]`, `[${hrs}, 100]`, `[0, ${100 / hrs}]`], e: `The range is the set of outputs: the charge goes from 100% down to 0%. [0, ${hrs}] is the domain.`, strat: 'Domain = inputs (here hours); range = outputs (here percent).' }; },
    r => { const a = nz(r, 2, 6), b = nz(r, -9, 9);
      return { sub: 'm.f.inverse', diff: 2, q: `Given f(x) = ${a}x ${sgn(b)}, what is f⁻¹(x) ?`, c: [`(x ${sgn(-b)})/${a}`, `(x ${sgn(b)})/${a}`, `${a}x ${sgn(-b)}`, `1/(${a}x ${sgn(b)})`], e: `Swap x and y: x = ${a}y ${sgn(b)}, so y = (x ${sgn(-b)})/${a}.`, strat: 'An inverse undoes the steps in reverse order; it is not the reciprocal.' }; },
    r => { const a = nz(r, 1, 4), b = ri(r, 2, 6) * 2 * a, c = ri(r, -10, 10), v = b / (2 * a), top = -a * v * v + b * v + c;
      return { sub: 'm.f.quad', model: true, diff: 4, q: `The height, in feet, of a ball t seconds after it is thrown is h(t) = −${a === 1 ? '' : a}t² + ${b}t ${sgn(c)}. What is the maximum height of the ball?`, c: uniq(top, [v, top - c, b + c], r), e: `Vertex at t = ${b}/(2·${a}) = ${v}; h(${v}) = ${top}.`, desmos: 'Graph it and click the vertex.' }; },
    r => { const h = ri(r, -5, 5), k = ri(r, -6, 9), a = pick(r, [-3, -2, -1, 2, 3]);
      return { sub: 'm.f.quad', diff: 3, q: `What is the vertex of the graph of y = ${a === -1 ? '−' : a === 1 ? '' : neg(a)}(x ${sgn(-h)})² ${sgn(k)} ?`, c: uniq(`(${neg(h)}, ${neg(k)})`, [`(${neg(-h)}, ${neg(k)})`, `(${neg(h)}, ${neg(-k)})`, `(${neg(k)}, ${neg(h)})`], r), e: `Vertex form a(x − h)² + k has vertex (h, k) = (${h}, ${k}).` }; },
    r => { const P = pick(r, [800, 1200, 1500, 2000]), p = pick(r, [4, 5, 6, 8]), n = ri(r, 2, 3), v = Math.round(P * (1 + p / 100) ** n);
      return { sub: 'm.f.explog', model: true, diff: 3, q: `A town of ${P.toLocaleString()} people grows by ${p}% each year. To the nearest whole number, what is the population after ${n} years?`, c: uniq(v, [P + P * p / 100 * n, Math.round(P * (1 + p * n / 100)) + 1, Math.round(P * (1 + p / 100))], r), e: `${P} × ${(1 + p / 100).toFixed(2)}^${n} ≈ ${v}.`, strat: 'Percent growth compounds: multiply by (1 + rate) each period.' }; },
    r => { const b = pick(r, [2, 3, 4, 5]), e1 = ri(r, 2, 5), e2 = ri(r, 1, e1 - 1);
      return { sub: 'm.f.explog', diff: 3, q: `What is the value of log<sub>${b}</sub>(${b ** e1}) − log<sub>${b}</sub>(${b ** e2}) ?`, c: uniq(e1 - e2, [e1 + e2, b ** (e1 - e2), e1], r), e: `log<sub>${b}</sub>(${b ** e1}) = ${e1} and log<sub>${b}</sub>(${b ** e2}) = ${e2}; ${e1} − ${e2} = ${e1 - e2}.`, strat: 'log_b(N) asks: b to what power gives N?' }; },
    r => { const A = pick(r, [64, 80, 96, 160]), hl = pick(r, [3, 4, 6, 8]), n = ri(r, 2, 4);
      return { sub: 'm.f.explog', model: true, diff: 4, q: `A substance has a half-life of ${hl} hours. A sample starts at ${A} grams. How many grams remain after ${hl * n} hours?`, c: uniq(A / 2 ** n, [A / 2, A - A / 2 * n > 0 ? A - A / 2 * n : A / (2 * n), A / (2 * n)], r), e: `${hl * n} hours is ${n} half-lives: ${A} × (1/2)^${n} = ${A / 2 ** n}.` }; },
    r => { const a = pick(r, [3, 5, 8]), f = pick(r, [2, 3]), lin = pick(r, [true, false]);
      const vals = [0, 1, 2, 3].map(x => lin ? a + 4 * x : a * f ** x);
      return { sub: 'm.f.explog', model: true, diff: 3, q: `A table shows x = 0, 1, 2, 3 with y = ${vals.join(', ')}. Which type of function best models the data?`, c: lin ? ['Linear', 'Exponential', 'Quadratic', 'Constant'] : ['Exponential', 'Linear', 'Quadratic', 'Constant'], e: lin ? 'The outputs increase by the same amount (4) each step: constant differences mean linear.' : `Each output is ${f} times the previous one: constant ratios mean exponential.`, strat: 'Check differences first, then ratios.' }; },
    r => { const h = ri(r, -5, 5), k = ri(r, -6, 6);
      return { sub: 'm.f.transform', diff: 3, q: `The graph of y = f(x) is shifted ${Math.abs(h)} units ${h >= 0 ? 'right' : 'left'} and ${Math.abs(k)} units ${k >= 0 ? 'up' : 'down'}. Which equation gives the new graph?`, c: [`y = f(x ${sgn(-h)}) ${sgn(k)}`, `y = f(x ${sgn(h)}) ${sgn(k)}`, `y = f(x ${sgn(-h)}) ${sgn(-k)}`, `y = f(x ${sgn(k)}) ${sgn(-h)}`], e: `A shift right by h replaces x with x − h; a shift up by k adds k.`, strat: 'Inside the parentheses moves opposite to the sign; outside moves with it.' }; },
    r => { const b = pick(r, [2, 3, 4]), h = ri(r, 1, 5), k = nz(r, -4, 6);
      return { sub: 'm.f.transform', diff: 4, q: `The graph of y = log<sub>${b}</sub>(x + ${h}) ${sgn(k)} has a vertical asymptote at which line?`, c: [`x = −${h}`, `x = ${h}`, `y = ${neg(k)}`, `x = 0`], e: `log is undefined at 0: x + ${h} = 0 gives x = −${h}. Vertical shifts do not move a vertical asymptote.` }; },
    r => { const a = ri(r, 1, 4), b = ri(r, -5, 5), c = ri(r, 2, 6), x = pick(r, [-3, -1, 0, 2, 4]), cut = 1;
      const v = x < cut ? a * x + b : c - x * x;
      return { sub: 'm.f.piecewise', diff: 3, q: `The function f is defined by f(x) = ${a}x ${sgn(b)} for x < ${cut} and f(x) = ${c} − x² for x ≥ ${cut}. What is f(${x}) ?`, c: uniq(v, [x < cut ? c - x * x : a * x + b, -v, v + a], r), e: `${x} ${x < cut ? '<' : '≥'} ${cut}, so use ${x < cut ? `${a}x ${sgn(b)}` : `${c} − x²`}: f(${x}) = ${v}.`, strat: 'First decide which piece the input belongs to.' }; },
    r => { const a = ri(r, 1, 6), b = ri(r, 1, 6), k = ri(r, 2, 4);
      return { sub: 'm.f.piecewise', diff: 4, q: `What are the vertical and horizontal asymptotes of y = (${k}x + ${a})/(x − ${b}) ?`, c: [`x = ${b} and y = ${k}`, `x = −${b} and y = ${k}`, `x = ${b} and y = 0`, `x = ${k} and y = ${b}`], e: `The denominator is 0 at x = ${b}. The degrees match, so y approaches the ratio of leading coefficients, ${k}/1 = ${k}.` }; },
    r => { const a1 = ri(r, -5, 9), d = nz(r, -4, 6), n = ri(r, 8, 20), an = a1 + (n - 1) * d, sum = n * (a1 + an) / 2;
      return { sub: 'm.f.seq', diff: 3, q: `What is the sum of the first ${n} terms of the arithmetic sequence ${a1}, ${a1 + d}, ${a1 + 2 * d}, … ?`, c: uniq(sum, [an, n * (a1 + an), n * (a1 + a1 + n * d) / 2], r), e: `Term ${n} is ${an}; sum = ${n}(${a1} + ${an})/2 = ${sum}.` }; },
    r => { const n = ri(r, 12, 40);
      return { sub: 'm.f.seq', model: true, diff: 3, q: `Cans are stacked in rows: 1 can in the top row, 2 in the next row, 3 in the next, and so on, for ${n} rows. How many cans are in the stack?`, c: uniq(n * (n + 1) / 2, [n * n, n * (n - 1) / 2, n * n / 2], r), e: `1 + 2 + … + ${n} = ${n}(${n + 1})/2 = ${n * (n + 1) / 2}.`, strat: 'Pair the first and last rows: each pair totals n + 1.' }; },
    r => { const A = ri(r, 2, 6), B = pick(r, [2, 3, 4, 6]);
      return { sub: 'm.f.trig', diff: 4, q: `What are the amplitude and period of y = ${A} cos(${B}x) ?`, c: [`Amplitude ${A}, period ${frac(2, B)}π`.replace('1π', 'π'), `Amplitude ${A}, period ${B}π`, `Amplitude ${B}, period ${frac(2, A)}π`.replace('1π', 'π'), `Amplitude ${2 * A}, period 2π`], e: `Amplitude = ${A}; period = 2π/${B}.` }; },
    r => { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]]);
      return { sub: 'm.g.triangle', diff: 1, q: `A right triangle has legs of length ${a} and ${b}. What is the length of the hypotenuse?`, c: uniq(c, [a + b, b + 1 === c ? c + 2 : b + 1, c * c], r), e: `√(${a}² + ${b}²) = ${c}.` }; },
    r => { const x = ri(r, 35, 55), y = ri(r, 56, 80), z = 180 - x - y; if (z <= y || z === x) return null;
      return { sub: 'm.g.triangle', diff: 3, q: `In △JKL, ∠J = ${x}°, ∠K = ${y}°. Which side of the triangle is longest?`, c: ['JK', 'KL', 'JL', 'All sides are equal.'], e: `∠L = ${z}° is the largest angle, and the longest side is opposite it: JK.`, strat: 'Find the missing angle, then use: largest angle ↔ longest opposite side.' }; },
    r => { const k = ri(r, 2, 5), A = ri(r, 3, 12);
      return { sub: 'm.g.similar', diff: 3, q: `Two similar triangles have corresponding sides in the ratio 1 : ${k}. The smaller triangle has area ${A}. What is the area of the larger triangle?`, c: uniq(A * k * k, [A * k, A * 2 * k, A * k * k * k], r), e: `Areas scale by the square of the length ratio: ${A} × ${k}² = ${A * k * k}.` }; },
    r => { const a = ri(r, 3, 9), b = ri(r, 4, 12), k = pick(r, [1.5, 2, 2.5, 3]);
      return { sub: 'm.g.similar', diff: 3, q: `A ${a}-by-${b} photo is enlarged to a similar print whose shorter side is ${a * k}. How long is the print's longer side?`, c: uniq(+(b * k).toFixed(1), [+(b + a * k - a).toFixed(1), +(b * k * k).toFixed(1), +(a * k * b / a + 1).toFixed(1)], r), e: `Scale factor ${k}: ${b} × ${k} = ${b * k}.`, strat: 'Similar figures: multiply every length by the same factor.' }; },
    r => { const rad = ri(r, 2, 9);
      return { sub: 'm.g.circles', diff: 2, q: `A circle has a diameter of ${2 * rad}. What is its area?`, c: [`${rad * rad}π`, `${2 * rad}π`, `${4 * rad * rad}π`, `${rad}π`], e: `r = ${rad}; area = π(${rad})² = ${rad * rad}π.`, strat: 'Halve the diameter before squaring.' }; },
    r => { const r1 = ri(r, 2, 6), h = ri(r, 3, 12) * 3;
      return { sub: 'm.g.area', diff: 2, q: `A right circular cone has radius ${r1} and height ${h}. What is its volume?<br><span class="meta">(Note: For a cone, V = ⅓πr²h, where r is the base radius and h is the height.)</span>`, c: [`${r1 * r1 * h / 3}π`, `${r1 * r1 * h}π`, `${r1 * r1 * h * 2 / 3}π`, `${r1 * h}π`], e: `⅓π(${r1})²(${h}) = ${r1 * r1 * h / 3}π.` }; },
    r => { const rad = ri(r, 2, 5), h = ri(r, 4, 10), w = pick(r, [0.036, 0.04, 0.05]);
      const v = Math.PI * rad * rad * h, wt = +(v * w).toFixed(2);
      return { sub: 'm.g.area', model: true, diff: 4, q: `A cylindrical can has radius ${rad} cm and height ${h} cm. It is filled with a liquid that weighs ${w} newtons per cubic centimeter. To the nearest hundredth, what is the weight of the liquid? (V = πr²h)`, c: uniq(wt.toFixed(2), [(2 * Math.PI * rad * h * w).toFixed(2), (rad * rad * h * w).toFixed(2), (Math.PI * rad * h * w).toFixed(2)], r), e: `V = π(${rad})²(${h}) ≈ ${v.toFixed(1)} cm³; × ${w} ≈ ${wt.toFixed(2)}.`, strat: 'Volume first, then multiply by the weight per unit volume.' }; },
    r => { const x1 = ri(r, -6, 6), y1 = ri(r, -6, 6), m = nz(r, -5, 5), dx = nz(r, 1, 5), x2 = x1 + dx, y2 = y1 + m * dx;
      return { sub: 'm.g.coord', diff: 2, q: `What is the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2})?`, c: uniq(m, [-m, frac(dx, m * dx), m + 1], r), e: `(${y2} − ${y1})/(${x2} − ${x1}) = ${m}.` }; },
    r => { const p = pick(r, [[2, 3], [1, 4], [3, 5], [2, 5], [4, 3]]);
      return { sub: 'm.g.coord', diff: 3, q: `Which line is perpendicular to y = (${p[0]}/${p[1]})x + 4 ?`, c: [`y = −(${p[1]}/${p[0]})x + 1`, `y = (${p[1]}/${p[0]})x + 1`, `y = −(${p[0]}/${p[1]})x + 1`, `y = (${p[0]}/${p[1]})x − 4`], e: 'Perpendicular slopes multiply to −1: the negative reciprocal.' }; },
    r => { const x = nz(r, -7, 7), y = nz(r, -7, 7), d = ri(r, 2, 6);
      return { sub: 'm.g.transform', diff: 3, q: `Point P(${x}, ${y}) is reflected across the y-axis and then translated ${d} units down. What are the coordinates of the image?`, c: uniq(`(${neg(-x)}, ${neg(y - d)})`, [`(${neg(x)}, ${neg(-y - d)})`, `(${neg(-x)}, ${neg(y + d)})`, `(${neg(x - d)}, ${neg(-y)})`], r), e: `Reflecting across the y-axis negates x: (${-x}, ${y}). Down ${d}: (${-x}, ${y - d}).`, strat: 'y-axis reflection changes the sign of x only.' }; },
    r => { const a = ri(r, 2, 8), b = ri(r, 2, 8); if (a === b) return null;
      return { sub: 'm.g.conics', diff: 3, q: `Where does the ellipse x²/${a * a} + y²/${b * b} = 1 cross the positive y-axis?`, c: [`(0, ${b})`, `(0, ${b * b})`, `(0, ${a})`, `(${a}, 0)`], e: `Set x = 0: y² = ${b * b}, so y = ${b}.`, strat: 'Intercepts come from the square roots of the denominators.' }; },
    r => { const h = ri(r, -5, 5), k = ri(r, -5, 5), rad = ri(r, 2, 7), D = -2 * h, E = -2 * k, F = h * h + k * k - rad * rad;
      return { sub: 'm.g.conics', diff: 4, q: `The graph of x² + y² ${sgn(D)}x ${sgn(E)}y ${sgn(F)} = 0 is a circle. What is its radius?`, c: uniq(rad, [rad * rad, Math.abs(F), rad + 1], r), e: `Complete the square: (x ${sgn(-h)})² + (y ${sgn(-k)})² = ${rad * rad}, so r = ${rad}.` }; },
    r => { const L = ri(r, 60, 200), deg = pick(r, [30, 35, 40, 50]);
      return { sub: 'm.g.trig', model: true, diff: 3, q: `A kite is flying on a straight, taut ${L}-foot string that makes a ${deg}° angle with the level ground. Which expression gives the kite's height above the point where the string is held?`, c: [`${L} sin ${deg}°`, `${L} cos ${deg}°`, `${L} tan ${deg}°`, `${L}/sin ${deg}°`], e: 'The string is the hypotenuse and the height is opposite the angle: height = hypotenuse × sin.' }; },
    r => { const t = pick(r, [[5, 12, 13], [8, 15, 17], [3, 4, 5], [7, 24, 25]]);
      return { sub: 'm.g.trig', diff: 3, q: `For an acute angle θ, sin θ = ${t[0]}/${t[2]}. What is tan θ ?`, c: [`${t[0]}/${t[1]}`, `${t[1]}/${t[2]}`, `${t[1]}/${t[0]}`, `${t[2]}/${t[1]}`], e: `Opposite ${t[0]}, hypotenuse ${t[2]}, adjacent ${t[1]}; tan = ${t[0]}/${t[1]}.` }; },
    // ---------- Number & Quantity ----------
    r => { const a = ri(r, 2, 4), m = ri(r, 2, 5), n = ri(r, 2, 4), p = ri(r, 1, 3);
      return { sub: 'm.n.exponents', diff: 2, q: `Which expression is equivalent to (${a}x<sup>${m}</sup>)<sup>${n}</sup> · x<sup>${p}</sup> ?`, c: [`${a ** n}x<sup>${m * n + p}</sup>`, `${a * n}x<sup>${m * n + p}</sup>`, `${a ** n}x<sup>${m + n + p}</sup>`, `${a}x<sup>${m * n * p}</sup>`], e: `(${a}x^${m})^${n} = ${a ** n}x^${m * n}; times x^${p} gives ${a ** n}x^${m * n + p}.` }; },
    r => { const [b, n, m, v] = pick(r, [[8, 3, 2, 4], [27, 3, 2, 9], [16, 4, 3, 8], [32, 5, 2, 4], [125, 3, 2, 25]]);
      return { sub: 'm.n.exponents', diff: 3, q: `What is the value of ${b}<sup>${m}/${n}</sup> ?`, c: uniq(v, [b * m / n, Math.round(b ** (1 / n)), b ** (m / n) === v ? v * 2 : v + 1], r), e: `Take the ${n === 3 ? 'cube' : n + 'th'} root first: ${Math.round(b ** (1 / n))}, then raise to the ${m}${m === 2 ? 'nd' : 'rd'} power: ${v}.`, strat: 'Fractional exponent: root (denominator) first, then power (numerator).' }; },
    r => { const sq = pick(r, [16, 25, 36, 49, 64, 81]), non = pick(r, [12, 18, 20, 27, 32, 50]);
      return { sub: 'm.n.real', diff: 2, q: 'Which value is NOT a rational number?', c: [`√${non}`, `√${sq}`, `${ri(r, 2, 9)}/${pick(r, [3, 7, 11])}`, `0.${ri(r, 1, 9)}${ri(r, 1, 9)}`], e: `√${non} is not a perfect square, so it is irrational. √${sq} = ${Math.sqrt(sq)}, fractions and terminating decimals are rational.` }; },
    r => { const d = ri(r, 1, 8);
      return { sub: 'm.n.real', diff: 3, q: `The repeating decimal 0.${d}${d}${d}… (the digit ${d} repeats forever) is equal to which fraction?`, c: [frac(d, 9), frac(d, 10), frac(d, 99), frac(d * 10 + d, 100)], e: `Let n = 0.${d}${d}…; 10n − n = ${d}, so 9n = ${d} and n = ${frac(d, 9)}.`, strat: 'One repeating digit d: the fraction is d/9.' }; },
    r => { const a = pick(r, [2, 3, 5]), m = pick(r, [8, 18, 50]);
      const prod = Math.sqrt(a * (a === 2 ? m : a * 4));
      return { sub: 'm.n.real', diff: 3, q: 'Which of the following products is a rational number?', c: [`√${a} · √${a === 2 ? m : a * 4}`, `√${a} · √${a + 1}`, `√${a} · ${a + 1}`, `π · ${a}`], e: `√${a} · √${a === 2 ? m : a * 4} = √${a * (a === 2 ? m : a * 4)} = ${prod}, a whole number. The others stay irrational.` }; },
    r => { const n = ri(r, 5, 40), m = n % 4;
      return { sub: 'm.n.complex', diff: 3, q: `What is the value of i<sup>${n}</sup>, where i = √−1 ?`, c: [['1', 'i', '−1', '−i'][m], ['1', 'i', '−1', '−i'][(m + 1) % 4], ['1', 'i', '−1', '−i'][(m + 2) % 4], ['1', 'i', '−1', '−i'][(m + 3) % 4]], e: `Powers of i repeat every 4. ${n} ÷ 4 leaves remainder ${m}, so i<sup>${n}</sup> = i<sup>${m}</sup> = ${['1', 'i', '−1', '−i'][m]}.` }; },
    r => { const a = ri(r, 1, 5), b = nz(r, -5, 5), c = ri(r, 1, 5), d = nz(r, -5, 5);
      const re = a * c - b * d, im = a * d + b * c;
      return { sub: 'm.n.complex', diff: 3, q: `What is (${cx(a, b)})(${cx(c, d)}), where i = √−1 ?`, c: uniq(cx(re, im), [cx(a * c + b * d, im), cx(re, a * d - b * c), cx(a * c, b * d)], r), e: `FOIL and use i² = −1: real part ${a}·${c} − (${b})(${d}) = ${re}; imaginary part ${im}.` }; },
    r => { const a = ri(r, 1, 9), b = nz(r, -6, 6), c = ri(r, 1, 9), d = nz(r, -6, 6);
      return { sub: 'm.n.complex', diff: 2, q: `What is (${cx(a, b)}) − (${cx(c, d)}), where i = √−1 ?`, c: uniq(cx(a - c, b - d), [cx(a + c, b + d), cx(a - c, b + d), cx(a - c - b + d, 0)], r), e: 'Subtract real parts and imaginary parts separately; distribute the minus sign to both parts.' }; },
    r => { const u = [ri(r, -5, 5), ri(r, -5, 5)], v = [ri(r, -5, 5), ri(r, -5, 5)], k = ri(r, 2, 3);
      return { sub: 'm.n.vecmat', diff: 3, q: `Vectors u = ⟨${u[0]}, ${u[1]}⟩ and v = ⟨${v[0]}, ${v[1]}⟩. What is u + ${k}v ?`, c: uniq(`⟨${neg(u[0] + k * v[0])}, ${neg(u[1] + k * v[1])}⟩`, [`⟨${neg(k * (u[0] + v[0]))}, ${neg(k * (u[1] + v[1]))}⟩`, `⟨${neg(u[0] + v[0])}, ${neg(u[1] + v[1])}⟩`, `⟨${neg(u[0] - k * v[0])}, ${neg(u[1] - k * v[1])}⟩`], r), e: 'Scale v by the number, then add components.' }; },
    r => { const [a, b] = pick(r, [[3, 4], [6, 8], [5, 12], [8, 15]]);
      return { sub: 'm.n.vecmat', diff: 2, q: `What is the magnitude of the vector ⟨${a}, −${b}⟩ ?`, c: uniq(Math.hypot(a, b), [a + b, a * a + b * b, b - a], r), e: `√(${a}² + ${b}²) = ${Math.hypot(a, b)}.` }; },
    r => { const A = [[ri(r, -3, 5), ri(r, -3, 5)], [ri(r, -3, 5), ri(r, -3, 5)]], B = [[ri(r, -3, 5), ri(r, -3, 5)], [ri(r, -3, 5), ri(r, -3, 5)]];
      const m = M => `[${M[0][0]} ${M[0][1]}; ${M[1][0]} ${M[1][1]}]`.replace(/-/g, '−'), S = A.map((row, i) => row.map((x, j) => x + B[i][j])), D = A.map((row, i) => row.map((x, j) => x - B[i][j]));
      return { sub: 'm.n.vecmat', diff: 2, q: `Let A = ${m(A)} and B = ${m(B)} (rows separated by semicolons). What is A + B ?`, c: uniq(m(S), [m(D), m(S.map(r2 => r2.slice().reverse())), m([[S[0][0], S[1][0]], [S[0][1], S[1][1]]])], r), e: 'Add matrices entry by entry in matching positions.' }; },
    // ---------- Statistics & Probability ----------
    r => { const a = ri(r, 2, 8), b = ri(r, 2, 8), c = ri(r, 1, 6), tot = a + b + c;
      return { sub: 'm.s.prob', diff: 2, q: `A bag has ${a} red, ${b} blue, and ${c} green marbles. One is drawn at random. What is the probability it is NOT blue?`, c: uniq(frac(tot - b, tot), [frac(b, tot), frac(a, tot), frac(tot - b, b)], r), e: `${tot - b} of ${tot} are not blue.` }; },
    r => { const red = ri(r, 4, 12), blk = ri(r, 3, 10);
      return { sub: 'm.s.prob', diff: 4, q: `A drawer holds ${red} red socks and ${blk} black socks. Two socks are taken out at random, one after the other, without replacement. If the first sock is red, what is the probability that the second sock is black?`, c: uniq(frac(blk, red + blk - 1), [frac(blk, red + blk), frac(red - 1, red + blk - 1), frac(blk - 1, red + blk - 1)], r), e: `After one red sock is removed, ${red + blk - 1} socks remain and ${blk} are black.`, strat: 'Without replacement: the total drops by one.' }; },
    r => { const d = ri(r, 2, 4), l = ri(r, 1, 2);
      return { sub: 'm.s.count', diff: 2, q: `A locker code is ${l} letter${l > 1 ? 's' : ''} (A–Z) followed by ${d} digit${d > 1 ? 's' : ''} (0–9). Letters and digits may repeat. How many different codes are possible?`, c: uniq(26 ** l * 10 ** d, [26 * l + 10 * d, 26 ** l + 10 ** d, 26 * l * 10 * d], r), e: `Multiply the choices for each position: 26^${l} × 10^${d} = ${(26 ** l * 10 ** d).toLocaleString()}.` }; },
    r => { const n = ri(r, 6, 10), k = ri(r, 2, 4); let C = 1, P = 1; for (let i = 0; i < k; i++) { C = C * (n - i) / (i + 1); P *= n - i; }
      return { sub: 'm.s.count', diff: 3, q: `In how many ways can a ${k}-person committee be chosen from ${n} people?`, c: uniq(C, [P, n * k, n ** k], r), e: `Order does not matter: C(${n}, ${k}) = ${C}.` }; },
    r => { const a = ri(r, 15, 40), b = ri(r, 10, 35), both = ri(r, 3, Math.min(a, b) - 2);
      return { sub: 'm.s.count', diff: 3, q: `In a class, ${a} students play an instrument, ${b} play a sport, and ${both} do both. How many students do at least one of the two?`, c: uniq(a + b - both, [a + b, a + b - 2 * both, a + b + both], r), e: `Add the two groups and subtract the overlap once: ${a} + ${b} − ${both} = ${a + b - both}.` }; },
    r => { const v = [pick(r, [200, 300, 500]), pick(r, [50, 80, 100]), pick(r, [20, 40, 60])], p = [pick(r, [0.01, 0.02, 0.03]), pick(r, [0.02, 0.04, 0.05]), pick(r, [0.05, 0.1])];
      const ev = v.reduce((s, x, i) => s + x * p[i], 0), rest = +(1 - p.reduce((a, b) => a + b, 0)).toFixed(2);
      return { sub: 'm.s.expect', model: true, diff: 3, q: `A raffle ticket wins $${v[0]} with probability ${p[0]}, $${v[1]} with probability ${p[1]}, $${v[2]} with probability ${p[2]}, and $0 with probability ${rest}. What is the expected value of one ticket?`, c: uniq('$' + ev.toFixed(2), ['$' + ((v[0] + v[1] + v[2]) / 4).toFixed(2), '$' + (v[0] * p[0]).toFixed(2), '$' + (ev * 2).toFixed(2)], r), e: `Sum of value × probability = $${ev.toFixed(2)}.` }; },
    r => { const mu = pick(r, [60, 70, 80, 500]), sd = pick(r, [4, 5, 8, 10]);
      return { sub: 'm.s.stats', diff: 3, q: `Test scores are approximately normal with mean ${mu} and standard deviation ${sd}. About what percent of scores fall between ${mu - sd} and ${mu + sd}?`, c: ['68%', '34%', '95%', '50%'], e: 'In a normal distribution, about 68% of values lie within one standard deviation of the mean (34% on each side).', strat: '68–95–99.7: within 1, 2, and 3 standard deviations.' }; },
    r => { const n = ri(r, 4, 6), mean = ri(r, 70, 92), vals = Array.from({ length: n - 1 }, () => ri(r, mean - 12, mean + 12)), last = mean * n - vals.reduce((s, x) => s + x, 0);
      if (last < 40 || last > 100) return null;
      return { sub: 'm.s.stats', diff: 2, q: `The mean of ${n} scores is ${mean}. ${n - 1} of the scores are ${vals.join(', ')}. What is the remaining score?`, c: uniq(last, [mean, last + n, last - n], r), e: `Total = ${n} × ${mean} = ${mean * n}; subtract the known scores.` }; },
    r => { const m = pick(r, [2.5, 3, 4, 0.5]), b = ri(r, 5, 40), x = ri(r, 3, 12), actual = +(m * x + b + pick(r, [-9, -6, -4, 5, 7, 11])).toFixed(1), pred = +(m * x + b).toFixed(1);
      return { sub: 'm.s.model', model: true, diff: 3, q: `A model for a data set is ŷ = ${m}x + ${b}. For the data point with x = ${x}, the actual value is ${actual}. By how much does the actual value differ from the model's prediction?`, c: uniq(+Math.abs(actual - pred).toFixed(1), [pred, actual, +(Math.abs(actual - b)).toFixed(1)], r), e: `Prediction: ${m}(${x}) + ${b} = ${pred}. Difference: |${actual} − ${pred}| = ${Math.abs(actual - pred).toFixed(1)}.`, strat: 'Residual = actual − predicted.' }; },
    r => { const m = pick(r, [1.5, 2.4, 3.2, 0.8]), unit = pick(r, [['hour studied', 'points'], ['degree warmer', 'drinks sold'], ['year', 'dollars']]);
      return { sub: 'm.s.model', model: true, diff: 3, q: `A line of best fit is y = ${m}x + 12, where x is in ${unit[0]}s and y is in ${unit[1]}. What does ${m} represent?`, c: [`The predicted increase in ${unit[1]} for each additional ${unit[0]}`, `The predicted ${unit[1]} when x = 0`, `The exact increase in ${unit[1]} for every ${unit[0]}`, `The number of data points above the line`], e: 'Slope = predicted change in y per one-unit increase in x. It is a prediction, not an exact rule.' }; },
    r => { const neg2 = pick(r, [true, false]);
      return { sub: 'm.s.model', diff: 3, q: `In a scatterplot, y tends to ${neg2 ? 'decrease' : 'increase'} steadily as x increases, and the points lie close to a straight line. Which correlation coefficient is most plausible?`, c: neg2 ? ['−0.9', '−0.1', '0.9', '1.4'] : ['0.9', '0.1', '−0.9', '1.4'], e: `A strong ${neg2 ? 'negative' : 'positive'} linear trend has r near ${neg2 ? '−1' : '1'}; r can never exceed 1 in absolute value.` }; },
    r => { const N = pick(r, [800, 1200, 1500, 2400]), n = pick(r, [100, 120, 200, 250]), p = pick(r, [20, 25, 30, 40]);
      return { sub: 'm.s.model', model: true, diff: 2, q: `In a random sample of ${n} students at a school of ${N.toLocaleString()}, ${p}% said they bike to school. Based on the sample, about how many students at the school bike to school?`, c: uniq(N * p / 100, [n * p / 100, N * p / 100 / 2, N - N * p / 100], r), e: `Apply the sample proportion to the population: ${p}% of ${N} = ${N * p / 100}.`, strat: 'A random sample’s percent estimates the whole population’s percent.' }; },
    r => { const p = pick(r, [10, 15, 20, 25, 30]), price = pick(r, [40, 60, 80, 120]), t = pick(r, [5, 6, 8]), after = price * (1 - p / 100), fin = +(after * (1 + t / 100)).toFixed(2);
      return { sub: 'm.ies.percent', model: true, diff: 2, q: `A $${price} jacket is ${p}% off, and then ${t}% sales tax is added to the sale price. What is the final cost?`, c: uniq('$' + fin.toFixed(2), ['$' + after.toFixed(2), '$' + (price * (1 - (p - t) / 100)).toFixed(2), '$' + (price * (1 + t / 100)).toFixed(2)], r), e: `$${price} × ${1 - p / 100} = $${after.toFixed(2)}; × ${1 + t / 100} = $${fin.toFixed(2)}.` }; },
    r => { const p1 = pick(r, [10, 20, 25, 30, 50]), p2 = pick(r, [10, 20, 25, 40]);
      const res = Math.round((1 + p1 / 100) * (1 - p2 / 100) * 1000) / 10;
      return { sub: 'm.ies.percent', diff: 4, q: `A price is raised ${p1}% and then the new price is lowered ${p2}%. The final price is what percent of the original price?`, c: uniq(`${res}%`, [`${100 + p1 - p2}%`, `${100 - p1 + p2}%`, `${Math.round((1 - p1 / 100) * (1 + p2 / 100) * 1000) / 10}%`], r), e: `Multiply the factors: ${1 + p1 / 100} × ${1 - p2 / 100} = ${(res / 100).toFixed(3)}, or ${res}%.`, strat: 'Successive percent changes multiply; they never just add.' }; },
    r => { const o = pick(r, [64, 80, 120, 150]), n = o + o * pick(r, [10, 15, 20, 25]) / 100;
      return { sub: 'm.ies.percent', diff: 3, q: `A price rose from $${o} to $${n}. By what percent did it increase?`, c: uniq(`${Math.round((n - o) / o * 100)}%`, [`${Math.round((n - o) / n * 100)}%`, `${n - o}%`, `${Math.round(n / o * 100)}%`], r), e: `(${n} − ${o})/${o} = ${Math.round((n - o) / o * 100)}%.`, strat: 'Divide the change by the ORIGINAL value.' }; },
    r => { const a = ri(r, 2, 7), b = a + ri(r, 1, 5), k = ri(r, 8, 40);
      return { sub: 'm.ies.ratio', model: true, diff: 3, q: `A garden has tomato and pepper plants in a ratio of ${a} to ${b}. There are ${(b - a) * k} more pepper plants than tomato plants. How many plants are there in all?`, c: uniq((a + b) * k, [(b - a) * k * 2, b * k, (a + b) * (b - a) * k], r), e: `The difference is ${b - a} parts = ${(b - a) * k}, so one part = ${k}. Total = ${a + b} parts = ${(a + b) * k}.`, strat: 'Turn the given difference into “parts,” find one part, then scale.' }; },
    r => { const rate = ri(r, 18, 36), g1 = ri(r, 4, 8), g2 = ri(r, 9, 15);
      return { sub: 'm.ies.ratio', model: true, diff: 1, q: `A car travels ${rate * g1} miles on ${g1} gallons of gas. At this rate, how far can it travel on ${g2} gallons?`, c: uniq(rate * g2, [rate * g1 + g2, rate * (g2 - g1), Math.round(rate * g1 * g1 / g2)], r), e: `${rate} miles per gallon × ${g2} = ${rate * g2}.` }; },
    r => { const fee = pick(r, [30, 35, 45, 50]), inc = pick(r, [5, 10, 15]), extra = pick(r, [8, 10, 12]), used = inc + ri(r, 2, 9);
      return { sub: 'm.ies.express', model: true, diff: 3, q: `A data plan costs $${fee} per month and includes ${inc} GB. Each GB used beyond ${inc} costs $${extra}. Which expression gives the monthly cost when ${used} GB are used?`, c: [`${fee} + ${extra}(${used} − ${inc})`, `${fee} + ${extra}(${used})`, `${fee}(${used} − ${inc}) + ${extra}`, `${fee} + ${extra} + ${used} − ${inc}`], e: `The base fee covers ${inc} GB; only the ${used - inc} extra GB are charged at $${extra}.` }; },
    r => { const a = ri(r, 3, 9), s = ri(r, 4, 9), n1 = ri(r, 20, 60), n2 = ri(r, 30, 90);
      return { sub: 'm.ies.express', model: true, diff: 1, q: `Adult tickets cost $${a + 4} and student tickets cost $${s}. A show sold ${n1} adult and ${n2} student tickets. What was the total revenue?`, c: uniq(`$${(a + 4) * n1 + s * n2}`, [`$${(a + 4 + s) * (n1 + n2)}`, `$${(a + 4) * n2 + s * n1}`, `$${(a + 4) * n1}`], r), e: `${n1} × $${a + 4} + ${n2} × $${s}.` }; },
    r => { const w = ri(r, 3, 12), l = w + ri(r, 2, 10);
      return { sub: 'm.ies.geom', diff: 2, q: `A rectangle has perimeter ${2 * (l + w)} meters and length ${l} meters. What is its area, in square meters?`, c: uniq(l * w, [2 * (l + w), l * (l + w) - l * l + l, (l + w) * 2 - l], r), e: `Width = ${w}; area = ${l} × ${w} = ${l * w}.` }; },
    r => { const L = ri(r, 4, 12), W = ri(r, 3, 9), H = ri(r, 2, 6);
      return { sub: 'm.ies.geom', model: true, diff: 2, q: `A box is ${L} in long, ${W} in wide, and ${H} in tall. How many cubic inches of sand fill it?`, c: uniq(L * W * H, [2 * (L * W + L * H + W * H), L + W + H, L * W], r), e: `Volume = ${L} × ${W} × ${H} = ${L * W * H}.` }; },
    r => { const vals = Array.from({ length: 6 }, () => ri(r, 3, 30)).sort((a, b) => a - b), med = (vals[2] + vals[3]) / 2, mean = +(vals.reduce((a, b) => a + b, 0) / 6).toFixed(2);
      if (med === mean) return null;
      return { sub: 'm.ies.data', diff: 1, q: `What is the median of ${vals.slice().sort(() => 0.5 - r()).join(', ')}?`, c: uniq(med, [mean, vals[2], vals[3] + 1], r), e: `In order: ${vals.join(', ')}. Median = (${vals[2]} + ${vals[3]})/2 = ${med}.`, strat: 'Sort first; with an even count, average the middle two.' }; },
  ];
  // Reject any item whose four choices are not all different (after normalizing spacing and signs)
  // or that carries a padding artifact; regenerate instead of shipping a broken question.
  const key = c => String(c).replace(/<[^>]+>/g, '').replace(/\s+/g, '').replace(/−/g, '-').toLowerCase();
  const ZERO = /[+−] 0(?![.\d])|(^|[^\d.])0[xy]|\b1x\b/;  // "+ 0", "0x", "1x" read as sloppy typesetting
  const valid = o => o && o.c.length === 4 && new Set(o.c.map(key)).size === 4 && !o.c.some(c => /\(\d\)$|'$/.test(String(c)) || String(c).startsWith('−0.') && false) && !ZERO.test(o.q) && !o.c.some(c => ZERO.test(String(c)));
  function make(i, rnd) {
    for (let tries = 0; tries < 30; tries++) { const out = T[i](rnd); if (out) out.q = out.q.replace(/(^|[\s(,])-(\d)/g, '$1−$2'); if (valid(out)) { out.tpl = i; return out; } }
    return null;
  }
  const run = rnd => { for (;;) { const o = make(Math.floor(rnd() * T.length), rnd); if (o) return o; } };
  run.count = T.length;
  run.at = (i, rnd) => make(i % T.length, rnd) || run(rnd);
  return run;
})();
