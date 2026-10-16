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
// usedComps = how many used listings the market price comes from (with
// fewer than 3 it falls back to all listings, mostly new retail prices).
const usedCount = rows => rows.filter(x => USED.has(x.condition)).length;
function dealFields(price, market, usedComps = 0) {
  if (!market) return { market: null, underPct: null, usedComps };
  return { market: Math.round(market * 100) / 100, underPct: Math.round((market - price) / market * 100), usedComps };
}
// Ignore bait/scam prices far under market.
const sane = (price, market) => !market || price >= market * 0.4;

// ---- DDR4: 8GB sticks >= 3000MHz, under $65 per pair, under market ---------
async function ddr4(read) {
  const s = await saved(["8GB DDR4 3200", "16GB DDR4 3200", "16GB DDR4 3600", "8GB DDR4 RAM lot"], read);
  const all = uniqueById(s.rows).map(x => ({ x, info: ddr4StickInfo(x.title) })).filter(r => r.info)
    .map(r => ({ ...slim(r.x), sticks: r.info.sticks, speed: r.info.speed, bulk: r.info.sticks >= 8, perPair: Math.round(r.x.totalPrice / r.info.sticks * 2 * 100) / 100 }))
    // Desktop gaming RAM only: no server ECC/registered sticks.
    .filter(x => !/\b(?:ecc|rdimm|registered|reg|server|buffered)\b/.test(normalizeListingText(x.title)));
  const market = usedMarket(all, x => x.perPair);
  const listings = all.filter(x => x.perPair > 8 && x.perPair < 65 && sane(x.perPair, market))
    .map(x => ({ ...x, ...dealFields(x.perPair, market, usedCount(all)) }))
    .filter(x => x.underPct == null || x.underPct >= DEAL_MIN_PCT)
    .sort((a, b) => a.perPair - b.perPair);
  return { ...s, listings };
}

// ---- 500GB NVMe, under market ----------------------------------------------
async function nvme500(read) {
  const s = await saved(["500GB NVMe SSD", "500GB SSD"], read);
  const all = uniqueById(s.rows).filter(x => { const t = normalizeListingText(x.title); return /\b(nvme|pcie)\b/.test(t) && !/\bsata\b/.test(t) && /\b(500|512)\s?gb\b/.test(t); });
  const market = usedMarket(all);
  const listings = all.filter(x => sane(x.totalPrice, market)).map(x => ({ ...slim(x), ...dealFields(x.totalPrice, market, usedCount(all)) }))
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
    .map(x => ({ ...slim(x), ...dealFields(x.totalPrice, market, usedCount(all)) }))
    .sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- White cases with ARGB fans included, Micro-ATX or bigger, <= $70 -------
// Well-regarded case makers/models (budget favorites) rank first.
const GOOD_CASE_RE = /\b(?:montech|lian li|lancool|phanteks|nzxt|corsair|fractal|cougar|darkflash|deepcool|antec|thermaltake|zalman|jonsbo|okinos|sama|musetex|aerocool|cooler master|be quiet|asus|msi|gamdias|diypc|vetroo|segotep|apevia|rosewill|hyte|kolink|silverstone)\b/;
export function whiteArgbCaseOk(title) {
  const t = normalizeListingText(title);
  if (!flipCaseOk(title)) return false;
  if (!/\bwhite\b/.test(t)) return false;
  // ARGB fans must come with it.
  return /\b(?:argb|a rgb|addressable)\b/.test(t) && /\bfans?\b/.test(t);
}
async function whiteArgbCases(read) {
  const s = await saved(["White ARGB PC case", "White Micro ATX ARGB case", "White PC case", "ARGB PC case", "RGB gaming PC case"], read);
  const all = uniqueById(s.rows).filter(x => whiteArgbCaseOk(x.title) && x.totalPrice <= 70);
  const market = usedMarket(all);
  const listings = all.map(x => ({ ...slim(x), ...dealFields(x.totalPrice, market, usedCount(all)), tag: GOOD_CASE_RE.test(normalizeListingText(x.title)) ? "Popular brand" : null }))
    .sort((a, b) => (b.tag ? 1 : 0) - (a.tag ? 1 : 0) || a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- New PSUs under $45: 550–750W, 80+ rated desktop units ---------------
// Compared with the typical NEW price for that wattage (used PSUs are rare).
async function cheapNewPsus(read) {
  const s = await saved(["650W 80+ Gold PSU", "650W PSU", "550W PSU", "750W 80+ Gold PSU", "750W PSU"], read);
  const watts = x => Number(normalizeListingText(x.title).match(/\b(\d{3,4})\s?w\b/)?.[1]) || null;
  const all = uniqueById(s.rows).map(x => ({ ...slim(x), watts: watts(x), rating: psuRating(x.title) }))
    .filter(x => [550, 600, 650, 700, 750].includes(x.watts) && x.condition === "new" && (x.rating || /\bwhite\b/.test(normalizeListingText(x.title))));
  const newMed = w => median(all.filter(x => x.watts === w).map(x => x.totalPrice));
  const listings = all.filter(x => x.totalPrice <= 45)
    .map(x => { const m = newMed(x.watts); const n = all.filter(y => y.watts === x.watts).length; return { ...x, market: m ? Math.round(m * 100) / 100 : null, underPct: m ? Math.round((m - x.totalPrice) / m * 100) : null, newComps: n, marketKind: "new", tag: x.watts + "W" + (x.rating ? " " + x.rating[0].toUpperCase() + x.rating.slice(1) : " 80+ White") }; })
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
    .map(x => ({ ...x, ...dealFields(x.totalPrice, marketBy[x.watts], usedCount(all.filter(y => y.watts === x.watts))), tag: x.watts + "W" + (x.rating ? " " + x.rating[0].toUpperCase() + x.rating.slice(1) : "") }))
    .filter(x => x.underPct == null || x.underPct >= DEAL_MIN_PCT)
    .sort((a, b) => rank(a) - rank(b) || wRank(a.watts) - wRank(b.watts) || a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- Motherboards: budget boards a flipper builds on, under their own used
// market (AM4 B450/B550/X570, AM5 B650, Intel B660/B760…), $150 or less ----
async function mobos(read) {
  const names = catalogNames("motherboard", () => true);
  const s = await saved(names, read);
  const rows = [];
  for (const { name, snap } of s.perModel) {
    const market = usedMarket(snap.results);
    const n = usedCount(snap.results);
    rows.push(...snap.results
      .filter(x => x.totalPrice <= 150 && sane(x.totalPrice, market))
      .map(x => ({ ...slim(x), model: name, ...dealFields(x.totalPrice, market, n), tag: name.replace(/ motherboard$/, "") }))
      .filter(d => d.underPct == null || d.underPct >= DEAL_MIN_PCT)
      .sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 5));
  }
  rows.sort((a, b) => (b.underPct || 0) - (a.underPct || 0) || a.totalPrice - b.totalPrice);
  return { ...s, listings: rows };
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
      .map(x => ({ x, ...dealFields(x.totalPrice, market, usedCount(snap.results)) }))
      .filter(d => d.underPct == null || d.underPct >= DEAL_MIN_PCT)
      .sort((a, b) => a.x.totalPrice - b.x.totalPrice).slice(0, 4);
    for (const d of deals) {
      const appealPer100 = Math.round(meta.appeal / d.x.totalPrice * 10000) / 100;
      const score = Math.round(Math.pow(meta.appeal, appealPower) / d.x.totalPrice * (1 + Math.max(0, d.underPct || 0) / 200) * 10000) / 100;
      rows.push({ ...slim(d.x), model: name, appeal: meta.appeal, appealPer100, market: d.market, underPct: d.underPct, usedComps: d.usedComps, score });
    }
  }
  rows.sort((a, b) => b.score - a.score || b.appeal - a.appeal);
  return { ...s, listings: rows };
}
const ryzen = read => appeal(read, catalogNames("cpu", n => /^Ryzen/.test(n)), CPUS, { maxPrice: 65 });
const gpus = read => appeal(read, catalogNames("gpu", () => true), GPUS, { appealPower: 2 });

// ---- Newegg combo deals (saved by the builder in combos.json) --------------
// Bundles with at least one flip part (CPU, motherboard, PSU, GPU, RAM, SSD,
// case), ranked by % saved. Total = combo price + shipping + FL sales tax.
const COMBO_TAX = 0.07;
// Same part detection as the builder (scripts/newegg.mjs), re-run here so
// saved combos follow today's rules.
const COMBO_KIND = [
  ["other", /\b(?:thermal (?:paste|compound|pad)|paste|compound|spreader|contact frame|sealing frame|bracket|cable|fan|cooler|aio|heatsink|workstation|pro b\d0|enclosure|adapter|dock|docking|caddy|reader)\b/i],
  ["cpu", /\b(?:ryzen \d|core i[3579]|core ultra \d)\b.*\b(?:processor|cpu)\b|\bprocessor\b.*\b(?:ryzen|core)\b/i],
  ["gpu", /\b(?:geforce|radeon rx|rtx \d{4}|graphics card|video card|arc [ab]\d{3})\b/i],
  ["motherboard", /\bmotherboard\b|\b[abxzh]\d{3}[a-z]?\b.*\b(?:atx|am[45]|lga ?\d{4})\b/i],
  ["psu", /\bpower suppl(?:y|ies)\b|\bpsu\b/i],
  ["ram", /\bddr[45]\b.*\b(?:memory|ram|dimm)\b|\bmemory kit\b/i],
  ["ssd", /\b(?:ssd|nvme)\b/i],
  ["case", /\b(?:pc case|computer case|mid[- ]tower|full tower)\b/i]
];
const comboKind = t => COMBO_KIND.find(([, re]) => re.test(String(t || "")))?.[0] || "other";
const COMBO_PARTS = new Set(["cpu", "motherboard", "psu", "gpu", "ram", "ssd", "case"]);
async function combos(read) {
  const data = await read("combos.json");
  const list = (data?.combos || [])
    // Every paid item must be a flip part (no paste/cable add-ons), and the
    // combo must save at least $10.
    .filter(c => c.comboPrice > 0 && c.comboPrice <= 1500 && c.savings >= 10 && (c.items || []).filter(x => !x.gift).every(x => COMBO_PARTS.has(comboKind(x.title))))
    .map(c => ({ ...c, kinds: [...new Set((c.items || []).filter(x => !x.gift).map(x => comboKind(x.title)))] }))
    .map(c => {
      const tax = Math.round(c.comboPrice * COMBO_TAX * 100) / 100;
      return {
        id: c.id, title: c.title, url: c.url, image: c.image, source: "Newegg", marketplace: "newegg", condition: "new",
        itemPrice: c.comboPrice, shipping: c.shipping || 0, shippingKnown: true, totalPrice: Math.round((c.comboPrice + (c.shipping || 0)) * 100) / 100,
        separate: c.separate, savings: c.savings, savingsPct: c.savingsPct, freeGift: !!c.freeGift, promo: c.promo || null,
        tax, totalAfterTax: Math.round((c.comboPrice + (c.shipping || 0) + tax) * 100) / 100,
        parts: (c.items || []).map(x => ({ title: x.title, kind: x.kind, price: x.price, count: x.count, gift: !!x.gift, url: x.url })),
        tag: (c.kinds || []).filter(k => COMBO_PARTS.has(k)).map(k => k === "psu" ? "PSU" : k === "cpu" ? "CPU" : k === "gpu" ? "GPU" : k === "ram" ? "RAM" : k === "ssd" ? "SSD" : k[0].toUpperCase() + k.slice(1)).join(" + ")
      };
    })
    .sort((a, b) => b.savingsPct - a.savingsPct || b.savings - a.savings);
  return { listings: list, searchedAt: data?.updatedAt || null, missing: data ? [] : ["Newegg combos"] };
}

export const FLIPPER_SECTIONS = {
  ddr4: { title: "DDR4 bulk 8GB sticks", run: ddr4 },
  nvme500: { title: "500GB NVMe SSDs", run: nvme500 },
  cases: { title: "RGB cases under $52 (Micro-ATX+)", run: cases },
  whitecases: { title: "White cases with ARGB fans (≤ $70)", run: whiteArgbCases },
  psunew: { title: "New PSUs under $45", run: cheapNewPsus },
  psu: { title: "PSUs 550–750W Bronze/Gold", run: psus },
  ryzen: { title: "Ryzen CPUs under $65", run: ryzen },
  mobo: { title: "Motherboards under their used market (≤ $150)", run: mobos },
  gpu: { title: "GPUs buyers want — appeal for the money", run: gpus },
  combos: { title: "Newegg combo deals", run: combos }
};

export async function flipperSection(id, read = readSnapshot) {
  const section = FLIPPER_SECTIONS[id];
  if (!section) return null;
  const r = await section.run(read);
  return { id, title: section.title, listings: r.listings.slice(0, 60), count: r.listings.length, searchedAt: r.searchedAt, missing: r.missing };
}
