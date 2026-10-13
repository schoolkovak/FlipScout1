// Flipper Deals: built entirely from saved listings (see snapshots.js), so
// the page costs no API credits. Each section filters/ranks the saved
// listings of a few catalog models the way a PC flipper shops.
import { normalizeListingText } from "./matching.js";
import { readSnapshot, modelPath } from "./snapshots.js";
import { PART_GROUPS } from "../../shared/partCatalog.js";
import { GPUS, CPUS } from "../../shared/catalog.js";

function slim(x, extra = {}) {
  return {
    id: x.id, title: x.title, source: x.source, marketplace: x.marketplace, condition: x.condition,
    itemPrice: x.itemPrice, shipping: x.shipping, shippingKnown: x.shippingKnown, totalPrice: x.totalPrice,
    url: x.url, image: x.image || null, ...extra
  };
}

// ---- DDR4 bulk: 8GB sticks >= 3000MHz, < $65 per pair ----------------------
const DDR4_SPEEDS = new Set(["3000", "3200", "3333", "3466", "3600", "3733", "3800", "4000", "4133", "4266", "4400", "4600"]);
export function ddr4StickInfo(title) {
  const t = normalizeListingText(title);
  if (!/\bddr4\b/.test(t)) return null;
  const speeds = [...t.matchAll(/\b(\d{4})(?:mhz|mt)?\b/g)].map(m => m[1]).filter(x => DDR4_SPEEDS.has(x) || /^2[0-9]{3}$/.test(x));
  const speed = speeds.find(x => DDR4_SPEEDS.has(x));
  if (!speed) return null; // must state 3000MHz or faster
  if (speeds.some(x => !DDR4_SPEEDS.has(x))) return null; // mixed / slower speeds listed
  let sticks = null;
  const kit = t.match(/\b(\d{1,2})\s*x\s*8gb\b/);
  const lot = t.match(/\b(?:lot of|lot|qty|quantity|set of|pack of)\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*(?:pcs|pieces|sticks|pack)\b/);
  if (kit) sticks = Number(kit[1]);
  else if (lot) sticks = Number(lot[1]);
  else if (/\b16gb\b/.test(t) && /\b2\s*x\s*8gb|2x8gb|\(2 x 8gb\)/.test(t)) sticks = 2;
  else if (/\b8gb\b/.test(t) && !/\b(16|32|64)gb\b/.test(t)) sticks = 1;
  if (!sticks || sticks < 1 || sticks > 32) return null;
  if (!/(?:\b|x)8gb\b/.test(t)) return null;
  return { sticks, speed };
}

export function psuRating(title) {
  const t = normalizeListingText(title);
  return ["titanium", "platinum", "gold", "silver", "bronze"].find(r => t.includes(r)) || null;
}

async function saved(names, read = readSnapshot) {
  const snaps = await Promise.all(names.map(async name => ({ name, snap: await read(modelPath(name)) })));
  const have = snaps.filter(x => x.snap?.results?.length);
  const times = have.map(x => x.snap.searchedAt).filter(Boolean).sort();
  return {
    rows: have.flatMap(x => x.snap.results.map(r => ({ ...r, model: x.name }))),
    perModel: have,
    missing: snaps.filter(x => !x.snap?.results?.length).map(x => x.name),
    searchedAt: times[times.length - 1] || null
  };
}

function uniqueById(rows) {
  const seen = new Set();
  const keys = x => [String(x.url || x.id).replace(/(\/itm\/\d+)[?#].*$/, "$1"), (x.marketplace || "") + "|" + normalizeListingText(x.title) + "|" + Math.round(Number(x.totalPrice) || 0)];
  return rows.filter(x => { const k = keys(x); if (k.some(v => seen.has(v))) return false; k.forEach(v => seen.add(v)); return true; });
}

// ---- Deal math -------------------------------------------------------------
// A flipper deal must sit clearly under what the same thing sells for right
// now. "Market" = median price of the comparable saved listings (used ones
// where there are enough, since flips are bought used).
const DEAL_MIN_PCT = 10;
const USED = new Set(["used", "refurbished", "renewed", "open-box"]);
function median(list) {
  const a = list.filter(n => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function usedMarket(rows, price = x => x.totalPrice) {
  const used = rows.filter(x => USED.has(x.condition)).map(price);
  return median(used.length >= 3 ? used : rows.map(price));
}
function dealFields(price, market) {
  if (!market) return { market: null, underPct: null };
  return { market: Math.round(market * 100) / 100, underPct: Math.round((market - price) / market * 100) };
}
// Ignore bait/scam prices far under market.
const sane = (price, market) => !market || price >= market * 0.4;

// ---- DDR4: 8GB sticks >= 3000MHz, under $65 per pair, under market ---------
async function ddr4(read) {
  const s = await saved(["8GB DDR4 3200", "16GB DDR4 3200", "16GB DDR4 3600"], read);
  const all = uniqueById(s.rows).map(x => ({ x, info: ddr4StickInfo(x.title) })).filter(r => r.info)
    .map(r => ({ ...slim(r.x), sticks: r.info.sticks, speed: r.info.speed, perPair: Math.round(r.x.totalPrice / r.info.sticks * 2 * 100) / 100 }))
    // Desktop gaming RAM only: no server ECC/registered sticks.
    .filter(x => !/\b(?:ecc|rdimm|registered|reg|server|buffered)\b/.test(normalizeListingText(x.title)));
  const market = usedMarket(all, x => x.perPair);
  const listings = all.filter(x => x.perPair > 8 && x.perPair < 65 && sane(x.perPair, market))
    .map(x => ({ ...x, ...dealFields(x.perPair, market) }))
    .filter(x => x.underPct == null || x.underPct >= DEAL_MIN_PCT)
    .sort((a, b) => a.perPair - b.perPair);
  return { ...s, listings };
}

// ---- 500GB NVMe, under market ----------------------------------------------
async function nvme500(read) {
  const s = await saved(["500GB NVMe SSD", "500GB SSD"], read);
  const all = uniqueById(s.rows).filter(x => { const t = normalizeListingText(x.title); return /\b(nvme|pcie)\b/.test(t) && !/\bsata\b/.test(t) && /\b(500|512)\s?gb\b/.test(t); });
  const market = usedMarket(all);
  const listings = all.filter(x => sane(x.totalPrice, market)).map(x => ({ ...slim(x), ...dealFields(x.totalPrice, market) }))
    .filter(x => x.underPct == null || x.underPct >= DEAL_MIN_PCT)
    .sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- Cases: RGB, Micro-ATX or bigger, $52 or less --------------------------
export function flipCaseOk(title) {
  const t = normalizeListingText(title);
  if (!/\b(?:rgb|argb|a rgb)\b/.test(t)) return false; // buyers want RGB
  if (/\b(?:open air|open frame|test bench|bench|test table|sff|small form factor)\b/.test(t)) return false;
  const bigBoard = /\b(?:atx|matx|micro atx|m atx|e atx|eatx|mid tower|full tower|midtower)\b/.test(t);
  if (/\b(?:mini itx|itx|mini tower)\b/.test(t) && !bigBoard) return false;
  if (!bigBoard) return false;
  return !/\b(?:cooler|aio|power supply|psu|motherboard|graphics card|cable|stand|dust filter|replacement|bracket|side panel|front panel)\b/.test(t);
}
async function cases(read) {
  const s = await saved(["RGB gaming PC case", "ARGB PC case", "White PC case", "ATX mid tower PC case", "Micro ATX PC case"], read);
  const all = uniqueById(s.rows).filter(x => flipCaseOk(x.title));
  const market = usedMarket(all);
  const listings = all.filter(x => x.totalPrice <= 52 && sane(x.totalPrice, market))
    .map(x => ({ ...slim(x), ...dealFields(x.totalPrice, market) }))
    .sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- PSUs: 650W / 550W (sometimes 750W), Bronze or Gold, under market -------
async function psus(read) {
  const s = await saved(["650W 80+ Gold PSU", "650W PSU", "550W PSU", "750W 80+ Gold PSU", "750W PSU"], read);
  const watts = x => Number(normalizeListingText(x.title).match(/\b(\d{3,4})\s?w\b/)?.[1]) || null;
  const rank = x => ({ gold: 0, bronze: 0, platinum: 1, titanium: 1, silver: 2 }[x.rating] ?? 3);
  const wRank = w => ({ 650: 0, 550: 0, 750: 1 }[w] ?? 2);
  const all = uniqueById(s.rows).map(x => ({ ...slim(x), watts: watts(x), rating: psuRating(x.title) })).filter(x => [550, 650, 750].includes(x.watts));
  const marketBy = Object.fromEntries([550, 650, 750].map(w => [w, usedMarket(all.filter(x => x.watts === w))]));
  const listings = all.filter(x => sane(x.totalPrice, marketBy[x.watts]))
    .map(x => ({ ...x, ...dealFields(x.totalPrice, marketBy[x.watts]), tag: x.watts + "W" + (x.rating ? " " + x.rating[0].toUpperCase() + x.rating.slice(1) : "") }))
    .filter(x => x.underPct == null || x.underPct >= DEAL_MIN_PCT)
    .sort((a, b) => rank(a) - rank(b) || wRank(a.watts) - wRank(b.watts) || a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- Appeal per dollar, only under each model's used market ----------------
// GPUs: appeal matters most. A newer, popular card (e.g. an RTX 5060 at ~$300)
// should beat an older card that is cheaper and even faster (a 3070), but a
// $4,000 card can't justify itself for a flip. Score = appeal² / price, so
// appeal dominates while price still has to be justified.
// CPUs: appeal matters less; never more than $65; score = appeal / price.
// Both only list listings at least DEAL_MIN_PCT under that model's used market.
function catalogNames(groupId, test) {
  const g = PART_GROUPS.find(x => x.id === groupId);
  return [...new Set(g.series.flatMap(x => x.items.map(i => i.name)))].filter(test);
}
async function appeal(read, names, table, { maxPrice = Infinity, appealPower = 1 } = {}) {
  const s = await saved(names, read);
  const rows = [];
  for (const { name, snap } of s.perModel) {
    const meta = table.find(x => x.name === name || x.name === "Intel " + name);
    if (!meta?.appeal) continue;
    const market = usedMarket(snap.results);
    const deals = snap.results
      .filter(x => x.totalPrice <= maxPrice && sane(x.totalPrice, market))
      .map(x => ({ x, ...dealFields(x.totalPrice, market) }))
      .filter(d => d.underPct == null || d.underPct >= DEAL_MIN_PCT)
      .sort((a, b) => a.x.totalPrice - b.x.totalPrice).slice(0, 3);
    for (const d of deals) {
      const appealPer100 = Math.round(meta.appeal / d.x.totalPrice * 10000) / 100;
      const score = Math.round(Math.pow(meta.appeal, appealPower) / d.x.totalPrice * (1 + Math.max(0, d.underPct || 0) / 200) * 10000) / 100;
      rows.push({ ...slim(d.x), model: name, appeal: meta.appeal, appealPer100, market: d.market, underPct: d.underPct, score });
    }
  }
  rows.sort((a, b) => b.score - a.score || b.appeal - a.appeal);
  return { ...s, listings: rows };
}
const ryzen = read => appeal(read, catalogNames("cpu", n => /^Ryzen/.test(n)), CPUS, { maxPrice: 65 });
const gpus = read => appeal(read, catalogNames("gpu", () => true), GPUS, { appealPower: 2 });

export const FLIPPER_SECTIONS = {
  ddr4: { title: "DDR4 bulk 8GB sticks", run: ddr4 },
  nvme500: { title: "500GB NVMe SSDs", run: nvme500 },
  cases: { title: "RGB cases under $52 (Micro-ATX+)", run: cases },
  psu: { title: "PSUs 550–750W Bronze/Gold", run: psus },
  ryzen: { title: "Ryzen CPUs under $65", run: ryzen },
  gpu: { title: "GPUs buyers want — appeal for the money", run: gpus }
};

export async function flipperSection(id, read) {
  const section = FLIPPER_SECTIONS[id];
  if (!section) return null;
  const r = await section.run(read);
  return { id, title: section.title, listings: r.listings.slice(0, 60), count: r.listings.length, searchedAt: r.searchedAt, missing: r.missing };
}
