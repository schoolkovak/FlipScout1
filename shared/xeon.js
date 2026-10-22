// Xeon E5 v3/v4 (LGA 2011-3 / X99) parts: the CPU table and a listing
// classifier used by the matcher (what each Xeon catalog model keeps) and by
// the Xeon deal alerts (CPU, board, ECC RAM and combo listings).
//
// Scores are approximate PassMark CPU Mark values (multi-thread / single
// thread), only used to rank price-to-performance.
export const XEON_CPUS = {
  "2680v4": { name: "Xeon E5-2680 v4", cores: 14, threads: 28, boost: 3.3, tdp: 120, score: 17600, single: 1830 },
  "2690v4": { name: "Xeon E5-2690 v4", cores: 14, threads: 28, boost: 3.5, tdp: 135, score: 19000, single: 1960 },
  "2660v4": { name: "Xeon E5-2660 v4", cores: 14, threads: 28, boost: 3.2, tdp: 105, score: 16000, single: 1700 },
  "2650v4": { name: "Xeon E5-2650 v4", cores: 12, threads: 24, boost: 2.9, tdp: 105, score: 14500, single: 1650 },
  "2683v4": { name: "Xeon E5-2683 v4", cores: 16, threads: 32, boost: 3.0, tdp: 120, score: 18200, single: 1600 },
  "2695v4": { name: "Xeon E5-2695 v4", cores: 18, threads: 36, boost: 3.3, tdp: 120, score: 20000, single: 1700 },
  "2697v4": { name: "Xeon E5-2697 v4", cores: 18, threads: 36, boost: 3.6, tdp: 145, score: 21800, single: 1920 },
  "2698v4": { name: "Xeon E5-2698 v4", cores: 20, threads: 40, boost: 3.6, tdp: 135, score: 22000, single: 1900 },
  "2699v4": { name: "Xeon E5-2699 v4", cores: 22, threads: 44, boost: 3.6, tdp: 145, score: 24600, single: 1900 },
  "2696v4": { name: "Xeon E5-2696 v4", cores: 22, threads: 44, boost: 3.7, tdp: 150, score: 25500, single: 1950 },
  "2667v4": { name: "Xeon E5-2667 v4", cores: 8, threads: 16, boost: 3.6, tdp: 135, score: 13800, single: 2150 },
  "2643v4": { name: "Xeon E5-2643 v4", cores: 6, threads: 12, boost: 3.7, tdp: 135, score: 11300, single: 2200 },
  "1650v4": { name: "Xeon E5-1650 v4", cores: 6, threads: 12, boost: 4.0, tdp: 140, score: 11800, single: 2300 },
  "1660v4": { name: "Xeon E5-1660 v4", cores: 8, threads: 16, boost: 3.8, tdp: 140, score: 13800, single: 2250 },
  "2670v3": { name: "Xeon E5-2670 v3", cores: 12, threads: 24, boost: 3.1, tdp: 120, score: 14500, single: 1700 },
  "2678v3": { name: "Xeon E5-2678 v3", cores: 12, threads: 24, boost: 3.3, tdp: 120, score: 15500, single: 1800 },
  "2680v3": { name: "Xeon E5-2680 v3", cores: 12, threads: 24, boost: 3.3, tdp: 120, score: 15200, single: 1800 },
  "2690v3": { name: "Xeon E5-2690 v3", cores: 12, threads: 24, boost: 3.5, tdp: 135, score: 16300, single: 1900 },
  "2696v3": { name: "Xeon E5-2696 v3", cores: 18, threads: 36, boost: 3.8, tdp: 145, score: 21000, single: 1950 },
  "2699v3": { name: "Xeon E5-2699 v3", cores: 18, threads: 36, boost: 3.6, tdp: 145, score: 20800, single: 1900 },
  "1650v3": { name: "Xeon E5-1650 v3", cores: 6, threads: 12, boost: 3.8, tdp: 140, score: 10600, single: 2100 }
};
export const xeonKeyOf = name => Object.keys(XEON_CPUS).find(k => XEON_CPUS[k].name === name) || null;

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9.+]+/g, " ").replace(/\s+/g, " ").trim();

// Chinese X99 boards (sold new, ~$50-90) and branded ones (ASUS etc., used,
// $100+) sell at very different prices, so each has its own market.
const CHINA_BOARD = /\b(?:huananzhi|machinist|jginyue|atermiter|kllisre|qiyida|soyo|szmz|zsus|yuanjie|ttmall|mougol|x99 (?:f8|f8d|tf|qd4|qd3|8m|8d3|8md3|bd4|d4|p4|k9|tf q|tf gaming|t8|t8d|f8d plus|rs9|mr9a|mr9s))\b/;
const BRANDED_BOARD = /\b(?:asus|rog|msi|gigabyte|aorus|asrock|evga|supermicro|intel dx79|fatal1ty)\b/;

// Phrases that only say what something works with ("CPU for X99
// motherboard", "board supports E5-2680 v4 / 2690 v4", "64GB max").
function stripCompat(t) {
  return t
    .replace(/\b(?:for|fits)\s+(?:intel\s+)?(?:x99|c612|lga\s?2011\S*|2011 3)(?:\s+(?:server|desktop|gaming|workstation))*\s*(?:motherboards?|mainboards?|mobo|boards?|socket)?\b/g, " ")
    .replace(/\b(?:for|fits)\s+(?:server|desktop|workstation)?\s*(?:motherboards?|mainboards?|mobo)\b/g, " ")
    .replace(/\b(?:support|supports|supported|supporting|compatible with|compatible|works with)\b.*$/g, " ")
    .replace(/\b(?:max|maximum|up to)\s*\d+\s?gb\b|\b\d+\s?gb\s*max\b/g, " ");
}

// Every Xeon E5 v3/v4 named in a title, with how many CPUs ("2x", "pair").
export function xeonCpusIn(title) {
  const t = norm(title);
  const keys = [];
  for (const m of t.matchAll(/\b(?:(e[357])\s?)?(\d{4})\s?v\s?([234])\b/g)) {
    if (m[1] && m[1] !== "e5") continue;
    const k = m[2] + "v" + m[3];
    if (XEON_CPUS[k] && !keys.includes(k)) keys.push(k);
  }
  // RAM kits ("2x16GB", "16GB x 2") don't count as two CPUs.
  const c = t.replace(/\b\d{1,2}\s?x\s?\d+\s?gb\b|\b\d+\s?gb\s?x\s?\d{1,2}\b/g, " ");
  const count = /\b(?:matched pair|pair of|pair|2\s?x|x\s?2|2 pcs|2pcs|lot of 2|set of 2|qty 2|dual cpus?|2 cpus|two)\b/.test(c) ? 2 : 1;
  return { keys, count };
}

// Total GB of DDR4 RAM a title says is included, and the stick size.
export function ramIn(title) {
  const t = stripCompat(norm(title));
  if (!/\b(?:ddr4|ram|memory|rdimm|dimm|ecc|reg)\b/.test(t)) return null;
  // "4x16GB" / "4 x 16gb", or "16GB x4"
  const kit = t.match(/\b(\d{1,2})\s?x\s?(4|8|16|32|64)\s?gb\b/);
  if (kit) return { gb: Number(kit[1]) * Number(kit[2]), stick: Number(kit[2]), sticks: Number(kit[1]) };
  const kit2 = t.match(/\b(4|8|16|32|64)\s?gb\s?x\s?(\d{1,2})\b/);
  if (kit2) return { gb: Number(kit2[1]) * Number(kit2[2]), stick: Number(kit2[1]), sticks: Number(kit2[2]) };
  const gbs = [...t.matchAll(/\b(4|8|16|32|64|128|256)\s?gb\b/g)].map(m => Number(m[1]));
  if (!gbs.length) return null;
  const stick = gbs.filter(g => g <= 64).sort((a, b) => a - b)[0];
  const lot = Number(t.match(/\b(?:lot of|lot|qty|set of|pack of)\s*(\d{1,2})\b/)?.[1] || t.match(/\b(\d{1,2})\s*(?:pcs|pieces|sticks|pack)\b/)?.[1] || 0);
  if (lot && stick) return { gb: lot * stick, stick, sticks: lot };
  // "64GB (16GB sticks)" style: the biggest number is the total.
  const total = Math.max(...gbs);
  return stick ? { gb: total, stick, sticks: Math.max(1, Math.round(total / stick)) } : null;
}

const SYSTEM = /\b(?:gaming pc|desktop pc|desktop computer|tower pc|complete pc|full pc|pc build|prebuilt|laptop|notebook|poweredge|proliant|precision (?:tower|t?\d{4})|thinkstation|hp z\d{3}|z[468]40|dell t\d{4}|t[357][68]10|dl[1-9]\d0|r[4-7][23]0|rack ?mount|rackmount|[12]u server|[12]u|barebones?|chassis|server system|workstation (?:pc|computer|tower|desktop)|(?:pc|computer|tower) workstation|windows (?:10|11)|win ?1[01]|nas)\b/;
const OTHER_PARTS = /\b(?:rtx|gtx|radeon|rx\s?\d{3,4}|graphics card|gpu|\d+\s?(?:gb|tb)\s?(?:ssd|nvme|hdd|m.2)|ssd|hdd|hard drive|power supply|psu|\d{3,4}w)\b/;

// What a Xeon listing is: { type: "cpu" | "board" | "ram" | "combo", ... }
// or { type: null, reason } when it isn't one of those (whole servers and
// PCs, engineering samples, DDR3/X79, laptop RAM, other parts thrown in).
export function classifyXeon(title) {
  const raw = norm(title);
  if (!raw) return { type: null, reason: "empty" };
  if (SYSTEM.test(raw)) return { type: null, reason: "complete-system" };
  if (/\b(?:engineering sample|qualification sample|es|qs|qhv\w|qhu\w)\b/.test(raw) && !/\bes\b.*\bnot\b/.test(raw)) return { type: null, reason: "engineering-sample" };
  if (/\b(?:ddr3|ddr5|x79|lga\s?2011 (?!3)|lga2011(?!\s?3|v3| v3)|sodimm|so dimm|laptop|lrdimm|load reduced)\b/.test(raw)) return { type: null, reason: "wrong-platform" };
  const t = stripCompat(raw);
  const cpus = xeonCpusIn(t);
  const board = /\b(?:motherboards?|mainboards?|mobo|main board)\b/.test(t) || (/\bx99\b/.test(t) && !cpus.keys.length && !/\b(?:ram|memory|rdimm|dimm)\b/.test(t));
  const x99 = /\b(?:x99|c612|lga\s?2011\s?3|lga2011\s?v3|2011 3|2011v3)\b/.test(raw);
  const ram = ramIn(raw);
  const hasRam = !!(ram && /\b(?:ram|memory|ddr4|rdimm|dimm|ecc|reg)\b/.test(t) && /\b\d{1,3}\s?gb\b/.test(t));
  const ecc = /\b(?:ecc|rdimm|registered|reg|server memory)\b/.test(raw) && !/\bnon\s?ecc\b/.test(raw);
  if (cpus.keys.length && board) {
    if (OTHER_PARTS.test(t)) return { type: null, reason: "other-parts-included" };
    if (cpus.keys.length > 1) return { type: null, reason: "multiple-models" };
    return { type: "combo", cpu: cpus.keys[0], cpuCount: cpus.count, ramGb: hasRam ? ram.gb : 0, ramStick: hasRam ? ram.stick : 0, ecc: hasRam && ecc, tier: boardTier(raw) };
  }
  if (cpus.keys.length) {
    if (hasRam || OTHER_PARTS.test(t)) return { type: null, reason: "other-parts-included" };
    if (cpus.keys.length > 1) return { type: null, reason: "multiple-models" };
    return { type: "cpu", cpu: cpus.keys[0], count: cpus.count };
  }
  if (board) {
    if (!x99) return { type: null, reason: "not-x99" };
    if (hasRam || OTHER_PARTS.test(t) || /\b(?:cpu|processor|i7)\b/.test(t)) return { type: null, reason: "other-parts-included" };
    return { type: "board", tier: boardTier(raw) };
  }
  if (hasRam) {
    if (!/\b(?:ddr4|pc4)\b/.test(raw)) return { type: null, reason: "not-ddr4" };
    if (!ecc) return { type: null, reason: "not-ecc" };
    if (OTHER_PARTS.test(t)) return { type: null, reason: "other-parts-included" };
    return { type: "ram", ...ram };
  }
  return { type: null, reason: "not-xeon-part" };
}

export function boardTier(title) {
  const t = norm(title);
  if (/\b(?:dual|2 cpu|dual cpu|dual socket|2 socket|d8|x99 dual)\b/.test(t)) return "dual";
  if (BRANDED_BOARD.test(t)) return "branded";
  if (CHINA_BOARD.test(t)) return "china";
  return "unknown";
}

// Which kind of listing each Xeon catalog category keeps.
export const XEON_CATEGORY_TYPE = { "xeon cpu": "cpu", "xeon motherboard": "board", "xeon ecc ram": "ram", "xeon combo": "combo" };
