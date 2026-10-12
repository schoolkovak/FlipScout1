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
  return rows.filter(x => { const k = x.url || x.id; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---- DDR4: 8GB sticks >= 3000MHz, under $65 per pair ----------------------
async function ddr4(read) {
  const s = await saved(["8GB DDR4 3200", "16GB DDR4 3200", "16GB DDR4 3600"], read);
  const listings = uniqueById(s.rows).map(x => ({ x, info: ddr4StickInfo(x.title) })).filter(r => r.info)
    .map(r => ({ ...slim(r.x), sticks: r.info.sticks, speed: r.info.speed, perPair: Math.round(r.x.totalPrice / r.info.sticks * 2 * 100) / 100 }))
    .filter(x => x.perPair > 8 && x.perPair < 65)
    .sort((a, b) => a.perPair - b.perPair);
  return { ...s, listings };
}

// ---- 500GB NVMe ----------------------------------------------------------
async function nvme500(read) {
  const s = await saved(["500GB NVMe SSD", "500GB SSD"], read);
  const listings = uniqueById(s.rows).filter(x => { const t = normalizeListingText(x.title); return /\b(nvme|m 2|m2|pcie)\b/.test(t) && /\b(500|512)\s?gb\b/.test(t); })
    .map(x => slim(x)).sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- Cases under $52 -------------------------------------------------------
async function cases(read) {
  const s = await saved(["ATX mid tower PC case", "Micro ATX PC case", "Mini ITX PC case"], read);
  const listings = uniqueById(s.rows).filter(x => x.totalPrice <= 52 && x.condition === "new")
    .filter(x => !/\b(cooler|aio|power supply|psu|motherboard|graphics card|cable|stand|dust filter|replacement|bracket)\b/i.test(x.title))
    .map(x => slim(x)).sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- PSUs: 650W / 550W (sometimes 750W), Bronze or Gold first --------------
async function psus(read) {
  const s = await saved(["650W 80+ Gold PSU", "650W PSU", "550W PSU", "750W 80+ Gold PSU", "750W PSU"], read);
  const watts = x => Number(normalizeListingText(x.title).match(/\b(\d{3,4})\s?w\b/)?.[1]) || null;
  const rank = x => ({ gold: 0, bronze: 0, platinum: 1, titanium: 1, silver: 2 }[x.rating] ?? 3);
  const wRank = w => ({ 650: 0, 550: 0, 750: 1 }[w] ?? 2);
  const listings = uniqueById(s.rows).map(x => ({ ...slim(x), watts: watts(x), rating: psuRating(x.title) }))
    .filter(x => [550, 650, 750].includes(x.watts))
    .map(x => ({ ...x, tag: x.watts + "W" + (x.rating ? " " + x.rating[0].toUpperCase() + x.rating.slice(1) : "") }))
    .sort((a, b) => rank(a) - rank(b) || wRank(a.watts) - wRank(b.watts) || a.totalPrice - b.totalPrice);
  return { ...s, listings };
}

// ---- Appeal per dollar (buyer appeal score from shared/catalog.js) ---------
function catalogNames(groupId, test) {
  const g = PART_GROUPS.find(x => x.id === groupId);
  return [...new Set(g.series.flatMap(x => x.items.map(i => i.name)))].filter(test);
}
async function appeal(read, names, table) {
  const s = await saved(names, read);
  const rows = [];
  for (const { name, snap } of s.perModel) {
    const meta = table.find(x => x.name === name);
    if (!meta?.appeal) continue;
    // Cheapest two real listings per model, ignoring bait far under typical used price.
    const ok = snap.results.filter(x => !(meta.fallbackUsed && x.totalPrice < meta.fallbackUsed * 0.4)).sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 2);
    for (const x of ok) rows.push({ ...slim(x), model: name, appeal: meta.appeal, appealPer100: Math.round(meta.appeal / x.totalPrice * 10000) / 100 });
  }
  rows.sort((a, b) => b.appealPer100 - a.appealPer100);
  return { ...s, listings: rows };
}
const ryzen = read => appeal(read, catalogNames("cpu", n => /^Ryzen/.test(n)), CPUS);
const gpus = read => appeal(read, catalogNames("gpu", () => true), GPUS);

export const FLIPPER_SECTIONS = {
  ddr4: { title: "DDR4 bulk 8GB sticks", run: ddr4 },
  nvme500: { title: "500GB NVMe SSDs", run: nvme500 },
  cases: { title: "PC cases under $52", run: cases },
  psu: { title: "PSUs 550–750W Bronze/Gold", run: psus },
  ryzen: { title: "Ryzen CPUs — appeal per $", run: ryzen },
  gpu: { title: "GPUs — appeal per $", run: gpus }
};

export async function flipperSection(id, read) {
  const section = FLIPPER_SECTIONS[id];
  if (!section) return null;
  const r = await section.run(read);
  return { id, title: section.title, listings: r.listings.slice(0, 60), count: r.listings.length, searchedAt: r.searchedAt, missing: r.missing };
}
