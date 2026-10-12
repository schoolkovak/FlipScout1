// Flipper Deals: a few cheap, broad searches per section, filtered to the
// listings a PC flipper actually wants, with real store links only.
import { searchSerperShopping, qualifyOffers, resolveRealLinks } from "./market.js";
import { normalizeListingText, gpuModelKeys, cpuModelKeys } from "./matching.js";
import { GPUS, CPUS } from "../../shared/catalog.js";

const RESOLVE_LIMIT = 12;

async function shopping(input, queries) {
  const settled = await Promise.all(queries.map(q => searchSerperShopping(input, { q }).then(offers => ({ offers }), error => ({ offers: [], error: String(error?.message || error) }))));
  return { offers: settled.flatMap(r => r.offers), errors: settled.filter(r => r.error).map(r => r.error) };
}

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

export async function huntDdr4(input) {
  const { offers, errors } = await shopping(input, ["8GB DDR4 3200 desktop RAM", "16GB (2x8GB) DDR4 3200 desktop memory", "lot 8GB DDR4 3200 desktop RAM used"]);
  const stats = new Map();
  const { items } = qualifyOffers(offers, { query: "DDR4", category: "RAM / Memory", condition: "any" }, { stats });
  const priced = items.map(x => ({ x, info: ddr4StickInfo(x.title) })).filter(r => r.info)
    .map(r => ({ ...r, perPair: Math.round(r.x.totalPrice / r.info.sticks * 2 * 100) / 100 }))
    .filter(r => r.perPair < 65 && r.perPair > 8)
    .sort((a, b) => a.perPair - b.perPair);
  const keep = new Set(priced.map(r => r.x));
  const real = await resolveRealLinks(input, items.filter(x => keep.has(x)), stats, RESOLVE_LIMIT);
  const realSet = new Set(real);
  return { listings: priced.filter(r => realSet.has(r.x)).map(r => slim(r.x, { sticks: r.info.sticks, speed: r.info.speed, perPair: r.perPair })), errors };
}

// ---- Generic hunts --------------------------------------------------------
async function huntSimple(input, groups, { maxPrice = Infinity, condition = "any", sort } = {}) {
  const stats = new Map();
  let all = [];
  const errors = [];
  for (const g of groups) {
    const r = await shopping(input, g.queries);
    errors.push(...r.errors);
    const { items } = qualifyOffers(r.offers, { query: g.match, category: g.category, condition }, { stats });
    all.push(...items.map(x => Object.assign(x, { tag: g.tag || null })));
  }
  const seen = new Set();
  all = all.filter(x => x.totalPrice <= maxPrice && !seen.has(x.id) && seen.add(x.id));
  all.sort(sort || ((a, b) => a.totalPrice - b.totalPrice));
  const real = await resolveRealLinks(input, all.slice(0, RESOLVE_LIMIT * 2), stats, RESOLVE_LIMIT);
  return { listings: real.map(x => slim(x, { tag: x.tag })), errors };
}

export const huntNvme500 = input => huntSimple(input, [{ queries: ["500GB NVMe SSD M.2", "512GB NVMe M.2 SSD"], match: "500GB NVMe SSD", category: "NVMe SSD" }]);

export const huntCases = input => huntSimple(input, [{ queries: ["ATX mid tower PC case with fans", "micro ATX PC case"], match: "PC case", category: "PC Case" }], { maxPrice: 52, condition: "new" });

export function psuRating(title) {
  const t = normalizeListingText(title);
  return ["titanium", "platinum", "gold", "silver", "bronze"].find(r => t.includes(r)) || null;
}
export const huntPsus = async input => {
  const r = await huntSimple(input, [
    { queries: ["650W 80+ Bronze power supply", "650W 80+ Gold power supply"], match: "650W PSU", category: "Power Supply / PSU", tag: "650W" },
    { queries: ["550W 80+ Bronze power supply"], match: "550W PSU", category: "Power Supply / PSU", tag: "550W" },
    { queries: ["750W 80+ Gold power supply"], match: "750W PSU", category: "Power Supply / PSU", tag: "750W" }
  ], { condition: "new" });
  // Prefer Bronze/Gold; unrated or White units go last.
  const rank = x => ({ gold: 0, bronze: 0, platinum: 1, titanium: 1, silver: 2 }[psuRating(x.title)] ?? 3);
  r.listings = r.listings.map(x => ({ ...x, rating: psuRating(x.title) })).sort((a, b) => rank(a) - rank(b) || a.totalPrice - b.totalPrice);
  return r;
};

// ---- Appeal per dollar ----------------------------------------------------
function gpuModelFor(title) {
  const t = normalizeListingText(title);
  const keys = [...gpuModelKeys(t)];
  if (keys.length !== 1) return null;
  const vram = Number(t.replace(/\bo?(\d{1,2})g\b/g, "$1gb").match(/\b(\d{1,2})gb\b/)?.[1]) || null;
  const candidates = GPUS.filter(g => gpuModelKeys(normalizeListingText(g.name)).has(keys[0]) && g.appeal);
  if (!candidates.length) return null;
  if (candidates.length > 1 && !vram) return null; // 3060 8GB vs 12GB etc. must be stated
  return candidates.find(g => !vram || g.vram === vram) || null;
}
function cpuModelFor(title) {
  const t = normalizeListingText(title);
  if (!/\b(?:ryzen|amd)\b/.test(t)) return null;
  const keys = [...cpuModelKeys(t)];
  if (keys.length !== 1) return null;
  return CPUS.find(c => /^Ryzen/.test(c.name) && c.appeal && [...cpuModelKeys(normalizeListingText(c.name))][0] === keys[0]) || null;
}

async function huntAppeal(input, queries, category, modelFor) {
  const { offers, errors } = await shopping(input, queries);
  const byModel = new Map();
  for (const o of offers) {
    const model = modelFor(o.title);
    if (!model) continue;
    if (!byModel.has(model.name)) byModel.set(model.name, { model, offers: [] });
    byModel.get(model.name).offers.push(o);
  }
  const stats = new Map();
  let ranked = [];
  for (const { model, offers: group } of byModel.values()) {
    const { items } = qualifyOffers(group, { query: model.name, category, condition: "any" }, { stats });
    for (const x of items) {
      // Ignore bait prices far under the typical used price for that model.
      if (model.fallbackUsed && x.totalPrice < model.fallbackUsed * 0.4) continue;
      ranked.push(Object.assign(x, { model: model.name, appeal: model.appeal, appealPer100: Math.round(model.appeal / x.totalPrice * 10000) / 100 }));
    }
  }
  ranked.sort((a, b) => b.appealPer100 - a.appealPer100);
  // Keep the best listing per model, then resolve real links for the top ones.
  const bestPer = new Map();
  for (const x of ranked) if (!bestPer.has(x.model) || bestPer.get(x.model).length < 2) bestPer.set(x.model, [...(bestPer.get(x.model) || []), x]);
  const shortlist = [...bestPer.values()].flat().sort((a, b) => b.appealPer100 - a.appealPer100).slice(0, RESOLVE_LIMIT * 2);
  const real = await resolveRealLinks(input, shortlist, stats, RESOLVE_LIMIT);
  return { listings: real.sort((a, b) => b.appealPer100 - a.appealPer100).map(x => slim(x, { model: x.model, appeal: x.appeal, appealPer100: x.appealPer100 })), errors };
}

export const huntRyzen = input => huntAppeal(input, ["used AMD Ryzen 5 desktop processor", "used AMD Ryzen 7 desktop processor", "AMD Ryzen 5 3600 2600 3500X processor", "AMD Ryzen 5 5600 5500 processor"], "CPU", cpuModelFor);
export const huntGpuValue = input => huntAppeal(input, ["used graphics card RTX 3060 3070 2060", "used graphics card RX 6600 6700 XT 580", "used GTX 1660 1070 1080 graphics card", "used RTX 4060 4070 graphics card"], "GPU", gpuModelFor);

export const FLIPPER_SECTIONS = {
  ddr4: { title: "DDR4 bulk 8GB sticks", run: huntDdr4, ttl: 10800 },
  nvme500: { title: "500GB NVMe SSDs", run: huntNvme500, ttl: 10800 },
  cases: { title: "PC cases under $52", run: huntCases, ttl: 10800 },
  psu: { title: "PSUs 550–750W Bronze/Gold", run: huntPsus, ttl: 10800 },
  ryzen: { title: "Ryzen CPUs — appeal per $", run: huntRyzen, ttl: 21600 },
  gpu: { title: "GPUs — appeal per $", run: huntGpuValue, ttl: 21600 }
};
