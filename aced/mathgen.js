// Generates enhanced-ACT-style math items (4 choices, correct first; the app shuffles).
// Distractors model common student errors. Used to top up math quizzes beyond the fixed bank.
window.ACED_MATHGEN = (function () {
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const nz = (r, a, b) => { let v = 0; while (!v) v = ri(r, a, b); return v; };
  const sgn = v => (v < 0 ? '− ' + -v : '+ ' + v);
  function uniq(correct, ds, r) {
    const out = [String(correct)];
    for (const d of ds) if (!out.includes(String(d))) out.push(String(d));
    let bump = 1;
    while (out.length < 4) { const v = typeof correct === 'number' ? correct + bump * (r() < .5 ? 1 : -1) * ri(r, 1, 3) : correct + "'".repeat(bump); if (!out.includes(String(v))) out.push(String(v)); bump++; }
    return out.slice(0, 4);
  }
  const T = [
    r => { const a = nz(r, 2, 9), x = ri(r, -9, 12), b = ri(r, -20, 20), c = a * x + b;
      return { k: 'A', q: `If ${a}x ${sgn(b)} = ${c}, what is the value of x?`, c: uniq(x, [(c + b) / a, c - b, x + 2], r), e: `Subtract ${b} from both sides, then divide by ${a}: x = ${x}.` }; },
    r => { const x1 = ri(r, -6, 6), y1 = ri(r, -6, 6), m = nz(r, -5, 5), dx = nz(r, 1, 5), x2 = x1 + dx, y2 = y1 + m * dx;
      return { k: 'G', q: `What is the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}) in the standard (x,y) coordinate plane?`, c: uniq(m, [-m, dx === 1 ? m + 1 : `${dx}/${m * dx}`, `${y2 + y1}/${x2 + x1 || 1}`], r), e: `Slope = (${y2} − ${y1}) / (${x2} − ${x1}) = ${m}.` }; },
    r => { const p = pick(r, [10, 15, 20, 25, 30, 40]), price = pick(r, [40, 60, 80, 120, 150, 200]), t = pick(r, [5, 6, 8]);
      const after = price * (1 - p / 100), fin = +(after * (1 + t / 100)).toFixed(2);
      return { k: 'IES', q: `A jacket priced at $${price} is discounted ${p}%. Sales tax of ${t}% is then applied to the discounted price. What is the final cost?`, c: uniq('$' + fin.toFixed(2), ['$' + after.toFixed(2), '$' + (price * (1 - (p - t) / 100)).toFixed(2), '$' + (price * (1 + t / 100) * (1 - p / 100) + 1).toFixed(2)], r), e: `$${price} × ${1 - p / 100} = $${after.toFixed(2)}; × ${1 + t / 100} = $${fin.toFixed(2)}.` }; },
    r => { const p = nz(r, -7, 7), q = nz(r, -7, 7); if (p === q) return T[0](r); const b = -(p + q), c = p * q;
      const fmtR = (a, b) => `x = ${a} and x = ${b}`;
      return { k: 'A', q: `What are the solutions of x² ${sgn(b)}x ${sgn(c)} = 0?`, c: uniq(fmtR(Math.min(p, q), Math.max(p, q)), [fmtR(Math.min(-p, -q), Math.max(-p, -q)), fmtR(Math.min(p, -q), Math.max(p, -q)), fmtR(Math.min(-p, q), Math.max(-p, q))], r), e: `Factor: (x ${sgn(-p)})(x ${sgn(-q)}) = 0, so x = ${p} or x = ${q}.` }; },
    r => { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]]);
      return { k: 'G', q: `A right triangle has legs of length ${a} and ${b}. What is the length of the hypotenuse?`, c: uniq(c, [a + b, Math.abs(b - a) + a, `√${a + b}`], r), e: `√(${a}² + ${b}²) = √${a * a + b * b} = ${c}.` }; },
    r => { const n = ri(r, 4, 6), mean = ri(r, 70, 92), vals = Array.from({ length: n - 1 }, () => ri(r, mean - 12, mean + 12)); const last = mean * n - vals.reduce((s, v) => s + v, 0);
      if (last < 40 || last > 100) return T[5](r);
      return { k: 'S', q: `The mean of ${n} test scores is ${mean}. ${n - 1} of the scores are ${vals.join(', ')}. What is the remaining score?`, c: uniq(last, [mean, last + n, last - n], r), e: `Total = ${n} × ${mean} = ${mean * n}; subtract the known scores to get ${last}.` }; },
    r => { const a = ri(r, 2, 4), m = ri(r, 2, 5), n = ri(r, 2, 4), p = ri(r, 1, 3);
      return { k: 'N', q: `Which of the following is equivalent to (${a}x<sup>${m}</sup>)<sup>${n}</sup> · x<sup>${p}</sup>?`, c: uniq(`${a ** n}x<sup>${m * n + p}</sup>`, [`${a * n}x<sup>${m * n + p}</sup>`, `${a ** n}x<sup>${m + n + p}</sup>`, `${a}x<sup>${m * n * p}</sup>`], r), e: `(${a}x^${m})^${n} = ${a ** n}x^${m * n}; multiply by x^${p} to get ${a ** n}x^${m * n + p}.` }; },
    r => { const h = ri(r, -6, 6), k = ri(r, -6, 6), rad = ri(r, 2, 9);
      const sx = h === 0 ? 'x²' : `(x ${sgn(-h)})²`, sy = k === 0 ? 'y²' : `(y ${sgn(-k)})²`;
      return { k: 'G', q: `Circle C is graphed in the standard (x,y) coordinate plane. Its equation is ${sx} + ${sy} = ${rad * rad}. What are the center and radius of circle C?`, c: uniq(`(${h}, ${k}); ${rad}`, [`(${-h}, ${-k}); ${rad}`, `(${h}, ${k}); ${rad * rad}`, `(${-h}, ${-k}); ${rad * rad}`], r), e: `Center (h, k) = (${h}, ${k}); radius = √${rad * rad} = ${rad}.` }; },
    r => { const a = nz(r, 2, 5), b = ri(r, -6, 6), x = ri(r, -3, 4), c2 = ri(r, 1, 4), d = ri(r, -5, 5);
      const g = c2 * x + d, f = a * g + b;
      return { k: 'F', q: `Let f(x) = ${a}x ${sgn(b)} and g(x) = ${c2}x ${sgn(d)}. What is f(g(${x}))?`, c: uniq(f, [c2 * (a * x + b) + d, a * x + b + g, g], r), e: `g(${x}) = ${g}; f(${g}) = ${a}(${g}) ${sgn(b)} = ${f}.` }; },
    r => { const red = ri(r, 2, 8), blue = ri(r, 2, 8), green = ri(r, 1, 6), tot = red + blue + green;
      const g = (a, b) => b ? g(b, a % b) : a, f = (n, d) => { const k = g(n, d); return `${n / k}/${d / k}`; };
      return { k: 'S', q: `A bag contains ${red} red, ${blue} blue, and ${green} green marbles. One marble is drawn at random. What is the probability that it is NOT blue?`, c: uniq(f(tot - blue, tot), [f(blue, tot), f(red, tot), f(tot - blue, blue)], r), e: `${tot - blue} of the ${tot} marbles are not blue.` }; },
    r => { const a1 = ri(r, -5, 9), d = nz(r, -4, 6), n = ri(r, 8, 20), an = a1 + (n - 1) * d, sum = n * (a1 + an) / 2;
      return { k: 'F', q: `What is the sum of the first ${n} terms of the arithmetic sequence ${a1}, ${a1 + d}, ${a1 + 2 * d}, …?`, c: uniq(sum, [an, n * (a1 + an), n * (a1 + a1 + n * d) / 2], r), e: `The ${n}th term is ${an}; sum = ${n}(${a1} + ${an})/2 = ${sum}.` }; },
    r => { const a = nz(r, 1, 4), b = ri(r, 2, 6) * 2 * a, c = ri(r, -10, 10), v = b / (2 * a), top = -a * v * v + b * v + c;
      return { k: 'F', q: `The height, in feet, of a ball t seconds after it is thrown is h(t) = −${a === 1 ? '' : a}t² + ${b}t ${sgn(c)}. What is the maximum height of the ball?`, c: uniq(top, [v, top - c, b + c], r), e: `Vertex at t = ${b}/(2·${a}) = ${v}; h(${v}) = ${top}.` }; },
    r => { const a = ri(r, 2, 6), b = ri(r, 3, 9), c = ri(r, 10, 30);
      return { k: 'A', q: `For which values of x is ${a}x − ${b} > ${c}?`, c: uniq(`x > ${+((c + b) / a).toFixed(2)}`, [`x < ${+((c + b) / a).toFixed(2)}`, `x > ${+((c - b) / a).toFixed(2)}`, `x > ${c + b - a}`], r), e: `${a}x > ${c + b}, so x > ${+((c + b) / a).toFixed(2)}.` }; },
    r => { const w = ri(r, 3, 12), l = w + ri(r, 2, 10);
      return { k: 'IES', q: `A rectangle has a perimeter of ${2 * (l + w)} meters and a length of ${l} meters. What is its area, in square meters?`, c: uniq(l * w, [2 * (l + w), l * (l + w - l + 1), l * (2 * (l + w) - 2 * l)], r), e: `Width = (${2 * (l + w)} − ${2 * l})/2 = ${w}; area = ${l} × ${w} = ${l * w}.` }; },
    r => { const r1 = ri(r, 2, 6), h = ri(r, 3, 12) * 3;
      return { k: 'G', q: `A right circular cone has radius ${r1} cm and height ${h} cm. What is its volume, in cubic centimeters? (V = ⅓πr²h)`, c: uniq(`${r1 * r1 * h / 3}π`, [`${r1 * r1 * h}π`, `${2 * r1 * h / 3}π`, `${r1 * h}π`], r), e: `⅓π(${r1})²(${h}) = ${r1 * r1 * h / 3}π.` }; },
    r => { const n = ri(r, 6, 10), k = ri(r, 2, 4); let C = 1; for (let i = 0; i < k; i++) C = C * (n - i) / (i + 1); let P = 1; for (let i = 0; i < k; i++) P *= n - i;
      return { k: 'S', q: `In how many ways can a ${k}-person committee be chosen from ${n} students if order does not matter?`, c: uniq(C, [P, n * k, n ** k], r), e: `C(${n}, ${k}) = ${C}.` }; },
    r => { const rate = ri(r, 18, 36), g1 = ri(r, 4, 8), g2 = ri(r, 9, 15);
      return { k: 'IES', q: `A car travels ${rate * g1} miles on ${g1} gallons of gas. At this rate, how many miles can it travel on ${g2} gallons?`, c: uniq(rate * g2, [rate * g1 + g2, rate * (g2 - g1), Math.round(rate * g1 * g1 / g2)], r), e: `${rate * g1}/${g1} = ${rate} mi/gal; × ${g2} = ${rate * g2}.` }; },
  ];
  return rnd => pick(rnd, T)(rnd);
})();
