// Xeon deal alerts (alert-only part types, like the extra CPUs in
// deal-alerts.mjs): Xeon E5 v3/v4 CPUs, X99 boards, DDR4 ECC RAM, and
// CPU + board (+ ECC RAM) combos, from the saved listings of the Xeon / X99
// catalog models. Each listing is compared with what its parts sell for:
//   CPU    lower third of that model's asking prices, per CPU
//   board  median of X99 boards of the same kind (Chinese / branded)
//   RAM    median $/GB of ECC sticks of the same size
//   combo  CPU market + board market + RAM GB × $/GB
// perfBonus adds price-to-performance (PassMark points per dollar, or GB per
// dollar for RAM) to the alert ranking.
import { modelPath } from "../api/_lib/snapshots.js";
import { PART_GROUPS } from "../shared/partCatalog.js";
import { XEON_CPUS, classifyXeon } from "../shared/xeon.js";

export const XEON_SECTIONS = { xeoncpu: "Xeon CPUs", xeonboard: "X99 boards", eccram: "DDR4 ECC RAM", xeoncombo: "Xeon combos" };
// ❗ for Xeon parts: they're cheap, so the dollar bar is lower than the
// general $50 one (CPUs, boards and RAM $20+, combos $40+ per item).
export const XEON_GREAT_PCT = 35;
export const XEON_GREAT_PROFIT = { xeoncpu: 20, xeonboard: 20, eccram: 20, xeoncombo: 40 };
const MIN_COMPS = 5;
const TIER_LABEL = { china: "Chinese X99 boards", branded: "branded X99 boards" };

const median = a => { const s = a.filter(n => n > 0).sort((x, y) => x - y); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const lowerThird = a => { const s = a.filter(n => n > 0).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 3)] : null; };
const r2 = n => Math.round(n * 100) / 100;
const pct = (market, price) => Math.round((market - price) / market * 100);
const bonus = perDollar => Math.round(5 * Math.log2(1 + perDollar) * 10) / 10;
const fmt = n => Math.round(n).toLocaleString("en-US");
const short = key => XEON_CPUS[key].name.replace(/^Xeon /, "");

export async function xeonSections(read) {
  const names = PART_GROUPS.find(g => g.id === "xeon")?.series.flatMap(s => s.items.map(i => i.name)) || [];
  const rows = [], seen = new Set();
  for (const name of names) for (const x of (await read(modelPath(name)))?.results || []) {
    if (!x.url || seen.has(x.url) || !(x.totalPrice > 0)) continue;
    seen.add(x.url);
    const c = classifyXeon(x.title);
    if (c.type) rows.push({ x, c });
  }
  const of = type => rows.filter(r => r.c.type === type);
  // Markets
  const cpuPrices = {};
  for (const { x, c } of of("cpu")) (cpuPrices[c.cpu] ||= []).push(x.totalPrice / c.count);
  const cpuMarket = key => (cpuPrices[key]?.length >= MIN_COMPS ? { m: lowerThird(cpuPrices[key]), n: cpuPrices[key].length } : null);
  const boardPrices = {};
  for (const { x, c } of of("board")) (boardPrices[c.tier] ||= []).push(x.totalPrice);
  const boardMarket = tier => (TIER_LABEL[tier] && boardPrices[tier]?.length >= MIN_COMPS ? { m: median(boardPrices[tier]), n: boardPrices[tier].length } : null);
  const perGb = {};
  for (const { x, c } of of("ram")) (perGb[c.stick] ||= []).push(x.totalPrice / c.gb);
  const allGb = Object.values(perGb).flat();
  const ramMarket = stick => (perGb[stick]?.length >= MIN_COMPS ? { m: median(perGb[stick]), n: perGb[stick].length } : allGb.length >= MIN_COMPS ? { m: median(allGb), n: allGb.length } : null);

  const base = x => ({ id: x.id, title: x.title, source: x.source, marketplace: x.marketplace, condition: x.condition, totalPrice: x.totalPrice, url: x.url, image: x.image || null });
  const out = Object.fromEntries(Object.entries(XEON_SECTIONS).map(([id, title]) => [id, { title, listings: [] }]));
  const add = (id, listing, price, market) => {
    if (!market?.m || price < market.m * 0.4) return; // bait / wrong-item prices
    out[id].listings.push({ ...listing, market: r2(market.m), underPct: pct(market.m, price), usedComps: market.n });
  };
  for (const { x, c } of of("cpu")) {
    const each = r2(x.totalPrice / c.count), spec = XEON_CPUS[c.cpu], ppd = spec.score / each;
    add("xeoncpu", { ...base(x), model: spec.name, ...(c.count > 1 ? { perUnit: each, count: c.count, unitLabel: " per CPU", unitNoun: "CPUs" } : {}),
      perfBonus: bonus(ppd / 200), note: `${spec.cores}C/${spec.threads}T · ~${fmt(spec.score)} PassMark · ${fmt(ppd)} pts/$` }, each, cpuMarket(c.cpu));
  }
  for (const { x, c } of of("board")) {
    add("xeonboard", { ...base(x), model: c.tier === "branded" ? "X99 board (branded)" : "X99 board", note: "vs " + (TIER_LABEL[c.tier] || "X99 boards") }, x.totalPrice, boardMarket(c.tier));
  }
  for (const { x, c } of of("ram")) {
    const m = ramMarket(c.stick), gbPrice = x.totalPrice / c.gb;
    if (!m) continue;
    add("eccram", { ...base(x), model: `${c.gb}GB DDR4 ECC${c.sticks > 1 ? ` (${c.sticks}×${c.stick}GB)` : ""}`, perfBonus: bonus(1 / gbPrice),
      note: `$${gbPrice.toFixed(2)}/GB vs ~$${m.m.toFixed(2)}/GB` }, x.totalPrice, { m: m.m * c.gb, n: m.n });
  }
  for (const { x, c } of of("combo")) {
    // Unbranded combo boards are priced like Chinese boards (the cheaper market).
    const cpu = cpuMarket(c.cpu), board = boardMarket(c.tier === "unknown" ? "china" : c.tier), ram = c.ramGb ? ramMarket(c.ramStick) : { m: 0, n: Infinity };
    if (!cpu || !board || !ram) continue;
    const worth = cpu.m * c.cpuCount + board.m + (c.ramGb ? ram.m * c.ramGb : 0), spec = XEON_CPUS[c.cpu];
    const ppd = spec.score * c.cpuCount / x.totalPrice;
    add("xeoncombo", { ...base(x), model: `${c.cpuCount > 1 ? "2× " : ""}${short(c.cpu)} + X99${c.ramGb ? ` + ${c.ramGb}GB${c.ecc ? " ECC" : ""}` : ""}`, perfBonus: bonus(ppd / 200),
      note: `${spec.cores * c.cpuCount}C/${spec.threads * c.cpuCount}T · ~${fmt(spec.score * c.cpuCount)} PassMark · ${fmt(ppd)} pts/$`, marketKind: "parts" }, x.totalPrice, { m: worth, n: Math.min(cpu.n, board.n, ram.n) });
  }
  for (const s of Object.values(out)) s.listings.sort((a, b) => b.underPct - a.underPct);
  return out;
}
