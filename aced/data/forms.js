// Full-length Aced practice tests, assembled from the form files loaded before this one.
// Items in a form are held:true so they stay out of training until that test has been taken.
// ft = unscored field-test questions, placed the way enhanced ACT forms place them:
// one whole passage in English, Reading and Science, and a few scattered items in Math.
window.ACED_DATA = window.ACED_DATA || {};
(function (D) {
  D.forms = D.forms || [];
  const FORMS = [
    { id: 'F1', name: 'Aced Practice Test 1', ft: { english: { unit: 'F1E3' }, math: { n: [7, 16, 29, 40] }, reading: { unit: 'F1R1' }, science: { unit: 'F1S4' } } }
  ];
  // Balance answer letters across each section. Only items whose choice order carries no meaning are
  // touched: "No Change" stays A, and ordered sets (numbers, ranges, Yes/No, Point A-D, Kept/Deleted) stay put.
  const ORDERED = /^(\d|−|-|\$|Yes|No[ ,;.]|Kept|Deleted|Point|less|greater|between|above|below|It was|x =|x ≤|x ≥|y =|\{|Student|Scientist|None)/;
  function balance(items) {
    const count = [0, 0, 0, 0];
    items.forEach(i => count[i.a]++);
    for (const it of items) {
      const nc = it.c[0] === 'No Change';
      if (it.c.some(c => ORDERED.test(c)) && !nc) continue;
      if (nc && it.a === 0) continue;
      const slots = nc ? [1, 2, 3] : [0, 1, 2, 3];
      const target = slots.reduce((b, k) => count[k] < count[b] ? k : b, slots[0]);
      if (count[target] >= count[it.a] - 1) continue;
      const swap = arr => { if (arr) { const t = arr[it.a]; arr[it.a] = arr[target]; arr[target] = t; } };
      swap(it.c); swap(it.w);
      count[it.a]--; count[target]++; it.a = target;
    }
  }
  for (const f of FORMS) {
    for (const sec of ['english', 'math', 'reading', 'science']) balance((D.items || []).filter(i => i.form === f.id && i.sec === sec && sec !== 'math'));
    const sections = {};
    for (const sec of ['english', 'math', 'reading', 'science']) {
      const items = (D.items || []).filter(i => i.form === f.id && i.sec === sec).sort((a, b) => a.n - b.n);
      if (!items.length) continue;
      const rule = f.ft[sec] || {};
      const ft = items.filter(i => (rule.unit && i.unit === rule.unit) || (rule.n && rule.n.includes(i.n))).map(i => i.id);
      sections[sec] = { items: items.map(i => i.id), ft };
    }
    D.forms.push({ id: f.id, name: f.name, sections });
  }
})(window.ACED_DATA);
