// Renders science/math figures from data specs as theme-aware SVG or HTML tables.
// Spec: {id, type:'line'|'scatter'|'bar'|'table', title, x:{label}, y:{label, min, max},
//        series:[{name, points:[[x,y],...]}], columns:[...], rows:[[...]], note}
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DASH = ['', '6 4', '2 3', '10 3 2 3'];
  const MARK = ['circle', 'square', 'triangle', 'diamond'];

  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, raw = span / (n || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= (n || 5) + 1) || mag * 10;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 1e6; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function marker(kind, x, y) {
    const r = 3.6;
    if (kind === 'square') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}"/>`;
    if (kind === 'triangle') return `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z"/>`;
    if (kind === 'diamond') return `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z"/>`;
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }

  function chart(f) {
    const W = 520, H = 320, L = 64, R = 18, T = 26, B = 56;
    const series = f.series || [];
    const pts = series.flatMap(s => s.points || []);
    const cat = f.type === 'bar' && pts.some(p => typeof p[0] === 'string');
    const xs = cat ? [] : pts.map(p => +p[0]);
    const ys = pts.map(p => +p[1]);
    const yMin = f.y && f.y.min != null ? f.y.min : Math.min(0, ...ys);
    const yMax = f.y && f.y.max != null ? f.y.max : Math.max(...ys);
    const yt = niceTicks(yMin, yMax, 5);
    const y0 = yt[0], y1 = yt[yt.length - 1];
    const sy = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1));
    let body = '', xAxis = '';
    if (cat) {
      const cats = [...new Set(pts.map(p => p[0]))];
      const bw = (W - L - R) / cats.length, inner = bw * 0.7 / Math.max(1, series.length);
      cats.forEach((c, i) => {
        xAxis += `<text x="${L + bw * (i + 0.5)}" y="${H - B + 18}" text-anchor="middle">${esc(c)}</text>`;
        series.forEach((s, k) => {
          const p = (s.points || []).find(q => q[0] === c); if (!p) return;
          const x = L + bw * i + bw * 0.15 + inner * k;
          body += `<rect class="s${k}" x="${x}" y="${sy(Math.max(0, p[1]))}" width="${inner - 2}" height="${Math.abs(sy(p[1]) - sy(0))}"><title>${esc(s.name || '')} ${esc(c)}: ${p[1]}</title></rect>`;
        });
      });
    } else {
      const xMin = f.x && f.x.min != null ? f.x.min : Math.min(...xs);
      const xMax = f.x && f.x.max != null ? f.x.max : Math.max(...xs);
      const xt = niceTicks(xMin, xMax, 6);
      const x0 = xt[0], x1 = xt[xt.length - 1];
      const sx = v => L + (W - L - R) * ((v - x0) / (x1 - x0 || 1));
      xt.forEach(v => { xAxis += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - B}"/><text x="${sx(v)}" y="${H - B + 18}" text-anchor="middle">${v}</text>`; });
      series.forEach((s, k) => {
        const p = (s.points || []).map(q => [sx(+q[0]), sy(+q[1])]);
        if (f.type !== 'scatter' && p.length > 1) body += `<polyline class="s${k} line" stroke-dasharray="${DASH[k % 4]}" points="${p.map(q => q.join(',')).join(' ')}"/>`;
        body += `<g class="s${k} pt">${p.map(q => marker(MARK[k % 4], q[0], q[1])).join('')}</g>`;
      });
    }
    let yAxis = yt.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const legend = series.length > 1 ? `<div class="fig-legend">${series.map((s, k) => `<span><svg width="26" height="12" aria-hidden="true"><line class="s${k} line" x1="1" x2="25" y1="6" y2="6" stroke-dasharray="${DASH[k % 4]}"/><g class="s${k} pt">${marker(MARK[k % 4], 13, 6)}</g></svg>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.title || f.id || 'figure')}">
      ${yAxis}${xAxis}<line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/><line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${body}
      <text class="lab" x="${(L + W - R) / 2}" y="${H - 12}" text-anchor="middle">${esc(f.x && f.x.label)}</text>
      <text class="lab" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(f.y && f.y.label)}</text>
    </svg>${legend}`;
  }

  function table(f) {
    const head = (f.columns || []).map(c => `<th>${esc(c)}</th>`).join('');
    const rows = (f.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    return `<div class="tw"><table class="fig-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // Geometry diagram: {type:'geometry', points:{A:[x,y]}, segments:[['A','B']], polygons:[['A','B','C']],
  // circles:[{c:[x,y], r}], rightAngles:[['A','B','C']] (angle at B), labels:[{at:[x,y], text}], dashed:[['A','C']]}
  // Coordinates are in arbitrary units; the drawing is scaled to fit. Not drawn to scale, as on the ACT.
  function geometry(f) {
    const P = f.points || {};
    const all = Object.values(P).concat((f.circles || []).flatMap(c => [[c.c[0] - c.r, c.c[1] - c.r], [c.c[0] + c.r, c.c[1] + c.r]])).concat((f.labels || []).map(l => l.at));
    if (!all.length) return '';
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 420, H = 300, pad = 34;
    const k = Math.min((W - 2 * pad) / ((maxX - minX) || 1), (H - 2 * pad) / ((maxY - minY) || 1));
    const tx = x => pad + (x - minX) * k + ((W - 2 * pad) - (maxX - minX) * k) / 2;
    const ty = y => H - pad - (y - minY) * k - ((H - 2 * pad) - (maxY - minY) * k) / 2;
    const pt = n => P[n] ? [tx(P[n][0]), ty(P[n][1])] : null;
    let s = '';
    (f.polygons || []).forEach(poly => { const q = poly.map(pt).filter(Boolean); s += `<polygon class="geo" points="${q.map(p => p.join(',')).join(' ')}"/>`; });
    (f.segments || []).forEach(([a, b]) => { const p = pt(a), q = pt(b); if (p && q) s += `<line class="geo" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; });
    (f.dashed || []).forEach(([a, b]) => { const p = pt(a), q = pt(b); if (p && q) s += `<line class="geo" stroke-dasharray="5 4" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; });
    (f.circles || []).forEach(c => { s += `<circle class="geo" cx="${tx(c.c[0])}" cy="${ty(c.c[1])}" r="${c.r * k}"/>`; });
    (f.rightAngles || []).forEach(([a, b, c]) => {
      const A = pt(a), B = pt(b), C = pt(c); if (!A || !B || !C) return;
      const u = (p) => { const dx = p[0] - B[0], dy = p[1] - B[1], m = Math.hypot(dx, dy) || 1; return [dx / m * 11, dy / m * 11]; };
      const ua = u(A), uc = u(C);
      s += `<path class="geo thin" d="M${B[0] + ua[0]} ${B[1] + ua[1]} L${B[0] + ua[0] + uc[0]} ${B[1] + ua[1] + uc[1]} L${B[0] + uc[0]} ${B[1] + uc[1]}"/>`;
    });
    const cx = Object.values(P).reduce((a, p) => a + p[0], 0) / (Object.keys(P).length || 1);
    const cy = Object.values(P).reduce((a, p) => a + p[1], 0) / (Object.keys(P).length || 1);
    Object.keys(P).forEach(n => {
      if (f.hidePoints && f.hidePoints.includes(n)) return;
      const [x, y] = pt(n); const dx = P[n][0] - cx, dy = P[n][1] - cy, m = Math.hypot(dx, dy) || 1;
      s += `<circle class="dot" cx="${x}" cy="${y}" r="2.6"/><text class="glab" x="${x + dx / m * 14}" y="${y - dy / m * 14 + 4}" text-anchor="middle">${esc(n)}</text>`;
    });
    (f.labels || []).forEach(l => { s += `<text class="glab num" x="${tx(l.at[0])}" y="${ty(l.at[1]) + 4}" text-anchor="middle">${esc(l.text)}</text>`; });
    return `<svg class="fig-svg geo-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.alt || 'geometry figure')}">${s}</svg>`;
  }

  // Coordinate plane: axes through the origin plus plotted series / points.
  function plane(f) {
    const g = Object.assign({}, f, { type: f.connect === false ? 'scatter' : 'line' });
    return chart(g);
  }

  function render(f) {
    if (!f) return '';
    const inner = f.type === 'table' ? table(f) : f.type === 'geometry' ? geometry(f) : f.type === 'plane' ? plane(f) : chart(f);
    return `<figure class="fig"><figcaption><b>${esc(f.id || '')}</b>${f.title ? ' ' + esc(f.title) : ''}</figcaption>${inner}${f.note ? `<div class="fig-note">${esc(f.note)}</div>` : ''}</figure>`;
  }

  root.AcedFigures = { render };
})(typeof self !== 'undefined' ? self : this);
