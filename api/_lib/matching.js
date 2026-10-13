// Listing matcher: decides whether a marketplace listing is a valid offer for
// what the user searched, and why not when it is rejected.
//
// Hard checks (model + variant, VRAM, capacity, interface, wattage, chipset,
// condition, broken/incomplete/accessory/laptop/prebuilt) reject a listing
// outright. Remaining descriptive words in the query only adjust relevance.
import { resolveCatalogPart, GPUS, CPUS } from "../../shared/catalog.js";
import { SNIPER_CATEGORIES } from "../../shared/sniper.js";

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------
const GPU_SUFFIX = "(?:ti|super|xtx|xt|gre)";

export function normalizeListingText(value) {
  let s = String(value || "").toLowerCase()
    .replace(/[™®©℠]/g, " ")
    .replace(/80\s*\+/g, "80 plus ")
    .replace(/wi[\s-]?fi/g, "wifi")
    .replace(/\bmicro[\s-]?atx\b|\bm[\s-]atx\b/g, "matx")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ");
  // "2 TB" -> "2tb", "850 W" -> "850w", "850 watts" -> "850w", "360 mm" -> "360mm"
  s = s.replace(/(\d+(?:\.\d+)?)\s+(tb|gb|mb|mhz|mm)\b/g, "$1$2")
    .replace(/(\d{3,4})\s*watts?\b/g, "$1w")
    .replace(/(\d{3,4})\s+w\b/g, "$1w");
  // "rtx5070" -> "rtx 5070"; "5070 ti" / "5070 ti super" -> "5070ti" / "5070tisuper"
  s = s.replace(/\b(rtx|gtx|gt|rx|arc)(?=[ab]?\d)/g, "$1 ");
  const joinSuffix = new RegExp("\\b(\\d{3,4}" + GPU_SUFFIX + "*)\\s+(" + GPU_SUFFIX.slice(3, -1) + ")\\b", "g");
  for (let i = 0; i < 3; i++) s = s.replace(joinSuffix, "$1$2");
  // Intel "270K Plus" style suffix
  s = s.replace(/\b(\d{3}k)\s+plus\b/g, "$1plus");
  return s.replace(/\s+/g, " ").trim();
}

function compact(s) { return s.replace(/\s+/g, ""); }

// Negation-aware phrase test: "no artifacts", "not broken" do not count.
function hasUnnegated(text, re) {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const g = new RegExp(re.source, flags);
  let m;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 14), m.index);
    if (!/\b(?:no|not|zero|without|never|free of|non)\s*$/.test(before)) return m[0];
    if (m[0].length === 0) g.lastIndex++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------
const PARTS_RE = /\b(?:for parts|parts only|parts or repair|parts repair|not working|non working|doesn t work|does not work|broken|defective|faulty|dead|no display|no post|no signal|no video|no output|artifacting|artifacts|needs? repair|for repair|repair only|as is|untested|damaged|cracked|bent pins?|missing pins?|burn(?:ed|t)|water damaged?|bricked)\b/;

export const CONDITION_FAMILIES = ["new", "open-box", "refurbished", "renewed", "used"];

// "damaged box" / "box is crushed" describe packaging, not the part.
function stripPackagingDamage(s) {
  return s.replace(/\b(?:damaged|broken|crushed|dented|torn|opened)\s+(?:retail\s+|outer\s+)?(?:box|packaging)\b/g, " ")
    .replace(/\bbox\s+(?:is\s+|was\s+)?(?:damaged|broken|crushed|dented|torn)\b/g, " ");
}

export function classifyCondition(value, { structured = false } = {}) {
  const s = stripPackagingDamage(normalizeListingText(value));
  if (!s) return "unknown";
  if (hasUnnegated(s, PARTS_RE)) return "parts";
  if (/\brenewed\b/.test(s)) return "renewed";
  if (/\b(?:refurb\w*|restored|reconditioned|remanufactured)\b/.test(s)) return "refurbished";
  if (/\b(?:unopened|never opened|factory sealed)\b/.test(s)) return "new";
  if (/\b(?:open ?box|openbox|new open(?:ed)?|new other|opened|new without box|new with defects|nob)\b/.test(s)) return "open-box";
  if (/\b(?:used|pre ?owned|preowned|second ?hand|like new|working pull|pulled from|tested working|gently used)\b/.test(s)) return "used";
  if (/\b(?:brand new|new|sealed|nib)\b/.test(s)) return "new";
  if (structured && /\b(?:very good|good|acceptable|excellent|fair)\b/.test(s)) return "used";
  return "unknown";
}

export function conditionMatches(actual, requested) {
  if (actual === "parts") return false;
  if (!requested || requested === "any") return true;
  if (actual === requested) return true;
  const refurb = new Set(["refurbished", "renewed"]);
  return refurb.has(actual) && refurb.has(requested);
}

// ---------------------------------------------------------------------------
// Category kinds
// ---------------------------------------------------------------------------
export function categoryKind(category) {
  const c = String(category || "").toLowerCase().trim();
  if (c === "gpu" || c.includes("graphics")) return "gpu";
  if (c === "cpu" || c === "processor") return "cpu";
  if (c === "ssd / nvme" || c === "ssd / storage" || c === "storage") return "ssd";
  if (c.includes("nvme")) return "nvme";
  if (c.includes("sata ssd")) return "sata";
  if (c.includes("hdd") || c.includes("hard drive")) return "hdd";
  if (c.includes("ssd")) return "ssd";
  if (c === "ram" || c.startsWith("ram ") || c.includes("memory")) return "ram";
  if (c.includes("motherboard")) return "motherboard";
  if (c === "psu" || c.includes("power supply")) return "psu";
  if (c === "case" || c === "pc case") return "case";
  if (c.includes("aio")) return "aio";
  if (c.includes("air cooler")) return "aircooler";
  if (c === "cpu cooler") return "cooler";
  if (c === "case fans") return "fans";
  if (c.includes("complete pc")) return "pc";
  return "generic";
}

// Words that describe the category rather than the specific item; they never
// need to appear in a listing title.
const STOPWORDS = new Set(("a an and the for with of in to by or new used preowned pre owned refurbished renewed open box " +
  "gpu cpu graphics card video processor desktop gaming pc computer " +
  "ssd nvme m.2 m2 internal solid state drive hard hdd storage " +
  "ram memory kit ddr ddr4 ddr5 " +
  "motherboard mainboard mobo board " +
  "psu power supply " +
  "case chassis tower " +
  "cooler cooling cpu air aio liquid water " +
  "fan fans " +
  // FlipScout catalog descriptors ("Basic Tower Air Cooler", "Midrange ... Case")
  "basic budget midrange premium stock showcase " +
  "plus 80").split(" "));

function softTokens(normQuery, consumed) {
  return normQuery.split(" ").filter(t => t.length > 1 && !STOPWORDS.has(t) && !consumed.has(t));
}

function tokenCoverage(normTitle, tokens) {
  if (!tokens.length) return 1;
  const words = new Set(normTitle.split(" "));
  const flat = compact(normTitle);
  let hit = 0;
  for (const t of tokens) if (words.has(t) || (t.length >= 3 && flat.includes(t))) hit++;
  return hit / tokens.length;
}

// ---------------------------------------------------------------------------
// Shared rejection rules
// ---------------------------------------------------------------------------
const INCOMPLETE_RE = /\b(?:box only|empty box|box and manual|manual only|no gpu|no cpu|no ram|no ssd|no hdd|no psu|barebones?|missing (?:fan|fans|backplate|shroud|cables?|pins?|parts?|screws?|bracket|io shield|accessories|lid))\b/;
const ACCESSORY_FOR_RE = /\b(?:water ?block|waterblock|backplate|heatsink|cooler|fans?|bracket|mount|cables?|adapter|shroud|enclosure|cover|pads?|stand|holder|frame|kit|shield|screen|panel|filter|sticker|skin)\s+(?:for|compatible with|fits|replacement for)\s+(?!gaming|gamers|desktop|pc\b|pcs\b|computer|home|office|work|amd\b|intel\b|ryzen|lga|socket|am4\b|am5\b|cpu\b|processor|\d)/;
// Unambiguous complete-system wording.
const STRONG_SYSTEM_RE = /\b(?:prebuilt|pre built|complete pc|complete system|computer system|tower pc|all in one|mini pc|gaming rig|custom built pc|custom gaming pc)\b/;
// Wording that retailers also use for components ("Video Card Desktop PC Gaming").
const WEAK_SYSTEM_RE = /\b(?:gaming pc|gaming desktop|gaming computer|desktop pc|desktop computer|workstation pc)\b/;

function stripHostPhrases(s) {
  // "graphics card for gaming PC desktop computer" names the host, it is not a prebuilt.
  return s.replace(/\b(?:for|fits|in)\s+(?:a\s+|your\s+|the\s+|any\s+)?(?:(?:gaming|desktop|desktops|home|office|pc|pcs|computer|computers|gamers)\b\s*)+/g, " ");
}

// A component listing is really a whole PC when it names other core parts.
function systemSignal(kind, t, host) {
  const strong = host.match(STRONG_SYSTEM_RE);
  if (strong) return strong[0];
  if (kind === "gpu" || kind === "ram" || ["nvme", "ssd", "sata", "hdd"].includes(kind)) {
    if (cpuContextKeys(t).size) return "listing also names a CPU";
  }
  if (kind === "cpu" || kind === "ram" || ["nvme", "ssd", "sata", "hdd"].includes(kind)) {
    if (gpuPrefixedKeys(t).size) return "listing also names a GPU";
  }
  if (kind === "gpu" && WEAK_SYSTEM_RE.test(host) && /\bddr[345]\b/.test(t) && capacitiesGb(t, 128).length) return "listing includes PC specs";
  return null;
}

// GPU listings that are really laptops or whole PCs without saying so:
// laptop model lines, or specs only a complete system has (system RAM, an
// SSD size, laptop CPU names, a screen with a refresh rate).
const LAPTOP_LINE_RE = /\b(?:razer blade|blade 1[468]|strix scar|scar 1[5-8]|zephyrus|legion (?:pro|slim|[579])|(?:msi )?(?:raider|stealth|titan|vector|katana|crosshair|sword|cyborg) (?:ge|gs|gt|a1|1[5-8]|hx|ai|\d{2})|alienware (?:m1[5-8]|x1[5-8]|1[68])|omen (?:max|transcend|1[67])|predator helios|helios neo|aorus (?:1[5-8]|master 1[68])|rog strix g1[5-8]|tuf gaming (?:a1[5-8]|f1[5-8]))\b/;
const SYSTEM_SPEC_RE = /\b\d{1,3}\s?gb\s+(?:ram|ddr[45]x?|memory|ddr5 ram|ddr4 ram)\b|\b\d{1,2}\s?tb\s+(?:ssd|nvme|m 2|storage|hdd)\b|\b\d{3,4}\s?gb\s+(?:ssd|nvme)\b|\b(?:ryzen ai|core ultra|ultra [579] (?:\d{3}hx|hx)|i[3579] \d{4,5}hx?|hx \d{3})\b|\b(?:qhd|fhd|uhd|wqxga|oled)\b[^|]*\b\d{3}\s?hz\b|\b\d{3}\s?hz\b[^|]*\b(?:qhd|fhd|uhd|wqxga|oled)\b/;
export function gpuHostSignal(t) {
  return t.match(LAPTOP_LINE_RE)?.[0] || t.match(SYSTEM_SPEC_RE)?.[0] || null;
}

function laptopRe(kind) {
  // SODIMM part numbers: Samsung M471…, SK hynix HMA8…GS / HMAA…GS, Crucial CT…SF…
  return kind === "ram"
    ? /\b(?:laptop|notebook|so ?dimm|sodimm|m471\w*|hma\w*gs\w*|ct\d+g4sf\w*)\b/
    : /\b(?:laptop|notebook|mobile|max q|mxm)\b/;
}

const CHIPSET_RE = /\b([abhxz]\d{3})(e|m|i|ex)?\b/g;
const KNOWN_CHIPSETS = new Set("a320 a520 a620 b350 b450 b550 b650 b840 b850 x370 x470 x570 x670 x870 h410 h510 h610 h670 h770 h810 b460 b560 b660 b760 b860 z390 z490 z590 z690 z790 z890 x299 trx40 trx50".split(" "));

function chipsetsIn(s) {
  const out = new Set();
  for (const m of s.matchAll(CHIPSET_RE)) if (KNOWN_CHIPSETS.has(m[1])) out.add(m[1]);
  return out;
}

// ---------------------------------------------------------------------------
// GPU models
// ---------------------------------------------------------------------------
const GPU_PREFIXED_RE = new RegExp("\\b(?:rtx|gtx|gt|rx|arc|radeon|geforce|quadro)\\s+(?:rtx\\s+|rx\\s+|pro\\s+)?([ab]?\\d{3,4}" + GPU_SUFFIX + "*)(?=\\s|$)", "g");
const GPU_BARE_RE = new RegExp("(?:^|\\s)(\\d{3,4}" + GPU_SUFFIX + "*)(?=\\s|$)", "g");

function gpuPrefixedKeys(s) {
  return new Set([...s.matchAll(GPU_PREFIXED_RE)].map(m => m[1]));
}

const GPU_KEY_VRAMS = new Map();
for (const gpu of GPUS) {
  for (const key of gpuPrefixedKeys(normalizeListingText(gpu.name))) {
    if (!GPU_KEY_VRAMS.has(key)) GPU_KEY_VRAMS.set(key, new Set());
    GPU_KEY_VRAMS.get(key).add(gpu.vram);
  }
}

export function gpuModelKeys(normTitle) {
  const keys = gpuPrefixedKeys(normTitle);
  if (keys.size) return keys;
  // eBay shorthand like "EVGA 3080 FTW3": accept bare numbers only when they
  // are real catalog GPU models.
  for (const m of normTitle.matchAll(GPU_BARE_RE)) if (GPU_KEY_VRAMS.has(m[1])) keys.add(m[1]);
  return keys;
}

function gpuVrams(normTitle) {
  const s = normTitle.replace(/\bo?(\d{1,2})g\b/g, "$1gb");
  const out = new Set();
  for (const m of s.matchAll(/\b(\d{1,2})gb\b/g)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 48) out.add(n);
  }
  return out;
}

function expectedGpu(query) {
  const norm = normalizeListingText(query);
  const resolved = resolveCatalogPart("gpu", query);
  const items = resolved.item ? [resolved.item]
    : resolved.status === "ambiguous" ? resolved.suggestions.map(n => GPUS.find(g => g.name === n)).filter(Boolean) : [];
  let key = null;
  for (const item of items) { key = [...gpuPrefixedKeys(normalizeListingText(item.name))][0] || key; if (key) break; }
  if (!key) key = [...gpuModelKeys(norm)][0] || null;
  const queryVram = [...gpuVrams(norm)][0] || null;
  const vram = queryVram || (resolved.item ? resolved.item.vram : null);
  const variants = key ? GPU_KEY_VRAMS.get(key) : null;
  const vramStrict = Boolean(vram && (queryVram || (variants && variants.size > 1)));
  return { key, vram, vramStrict };
}

// ---------------------------------------------------------------------------
// CPU models
// ---------------------------------------------------------------------------
function cpuBrandOf(s) {
  if (/\b(?:amd|ryzen|athlon|threadripper)\b/.test(s)) return "amd";
  if (/\b(?:intel|core|i[3579]|pentium|celeron|xeon)\b/.test(s)) return "intel";
  return null;
}

function stripCpuNoise(s) {
  return s.replace(/\blga\s*\d{4}\b/g, " ").replace(/\bsocket\s*\d{4}\b/g, " ")
    .replace(/\bddr[345]\s*\d{4}\w*/g, " ").replace(/\b\d{4}\s*(?:mhz|mt s|mts)\b/g, " ");
}

const CPU_TOKEN_RE = /(?:^|\s)(\d{3,5}[a-z][a-z0-9]*|\d{4,5})(?=\s|$)/g;
const CPU_KEYS = new Map();
for (const cpu of CPUS) {
  const n = normalizeListingText(cpu.name);
  const brand = cpuBrandOf(n);
  for (const m of n.matchAll(CPU_TOKEN_RE)) {
    if (!CPU_KEYS.has(m[1])) CPU_KEYS.set(m[1], new Set());
    CPU_KEYS.get(m[1]).add(brand);
  }
}

// Model numbers written right after a CPU family name count even when the
// catalog does not list them (e.g. "Ryzen 5 5600X3D"), so they are never
// mistaken for the searched model.
const CPU_CONTEXT_RE = /\b(?:ryzen\s+(?:threadripper\s+)?(?:pro\s+)?[3579]|i[3579]|(?:core\s+)?ultra\s+[3579](?:\s+processor)?|core\s+i[3579]\s+processor|athlon(?:\s+gold|\s+silver)?)\s+(\d{3,5}[a-z0-9]*)(?=\s|$)/g;

// Only CPU numbers written next to a CPU family name ("Ryzen 5 7600",
// "i7 14700K"). Used to spot prebuilts/combos, where a bare "7600" would
// wrongly match an RX 7600 graphics card.
function cpuContextKeys(normTitle) {
  return new Set([...stripCpuNoise(normTitle).matchAll(CPU_CONTEXT_RE)].map(m => m[1]));
}

export function cpuModelKeys(normTitle) {
  const s = stripCpuNoise(normTitle);
  const keys = new Set([...s.matchAll(CPU_TOKEN_RE)].map(m => m[1]).filter(k => CPU_KEYS.has(k)));
  for (const m of s.matchAll(CPU_CONTEXT_RE)) keys.add(m[1]);
  return keys;
}

function expectedCpu(query) {
  const resolved = resolveCatalogPart("cpu", query);
  const source = normalizeListingText(resolved.item ? resolved.item.name : query);
  const key = [...cpuModelKeys(source)][0] || [...stripCpuNoise(source).matchAll(CPU_TOKEN_RE)].map(m => m[1])[0] || null;
  return { key, brand: cpuBrandOf(source) };
}

// ---------------------------------------------------------------------------
// Capacities / numbers
// ---------------------------------------------------------------------------
function capacitiesGb(s, min) {
  const out = [];
  for (const m of s.matchAll(/\b(\d+(?:\.\d+)?)(tb|gb)\b/g)) {
    const gb = m[2] === "tb" ? Number(m[1]) * 1000 : Number(m[1]);
    if (gb >= min) out.push(gb);
  }
  return out;
}
function distinctWithin(values, tol = .12) {
  const out = [];
  for (const v of values) if (!out.some(x => Math.abs(x - v) / Math.max(x, v) <= tol)) out.push(v);
  return out;
}
function sameCapacity(a, b) { return Math.abs(a - b) / Math.max(a, b) <= .12; }

const RAM_SPEEDS = new Set("1600 1866 2133 2400 2666 2800 2933 3000 3200 3333 3466 3600 3733 3800 4000 4133 4266 4400 4600 4800 5200 5600 6000 6200 6400 6600 6800 7000 7200 7600 7800 8000 8200 8400 8800 9000".split(" "));

function ramTotal(s) {
  const kits = [...s.matchAll(/\b(\d+)\s*x\s*(\d+)gb\b/g)].map(m => Number(m[1]) * Number(m[2]));
  const explicit = capacitiesGb(s, 4);
  const all = [...kits, ...explicit];
  return all.length ? Math.max(...all) : null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
function reject(reason, detail) { return { ok: false, reason, detail: detail || null, relevance: 0 }; }

export function evaluateListing({ title, query, category, structuredCondition = "", defaultCondition = "unknown", requestedCondition = "any" }) {
  const t = normalizeListingText(title);
  const q = normalizeListingText(query);
  if (!t || !q) return reject("empty-title");
  const kind = categoryKind(category);

  // Condition -------------------------------------------------------------
  const structured = classifyCondition(structuredCondition, { structured: true });
  const titleParts = hasUnnegated(stripPackagingDamage(t), PARTS_RE);
  if (structured === "parts" || titleParts) return reject("broken-or-parts", titleParts || structuredCondition);
  const fromTitle = classifyCondition(title);
  let condition = structured !== "unknown" ? structured : fromTitle;
  let conditionAssumed = false;
  if (condition === "unknown" && defaultCondition && defaultCondition !== "unknown") {
    condition = defaultCondition; conditionAssumed = true;
  }
  if (!conditionMatches(condition, requestedCondition)) return reject("condition-mismatch", condition);

  // Incomplete / accessory / form-factor ------------------------------------
  const incomplete = hasUnnegated(t, INCOMPLETE_RE);
  if (incomplete) return reject("incomplete", incomplete);
  const host = stripHostPhrases(t);
  if (kind !== "generic" && kind !== "case" && kind !== "fans" && ACCESSORY_FOR_RE.test(host)) return reject("accessory", host.match(ACCESSORY_FOR_RE)[0]);
  // SSDs/HDDs legitimately say "for laptop and desktop"; only reject laptop
  // GPUs/CPUs/RAM/boards, where the laptop part is a different product.
  if (["gpu", "cpu", "ram", "motherboard", "pc"].includes(kind) && laptopRe(kind).test(t) && !laptopRe(kind).test(q))
    return reject("laptop-or-mobile", t.match(laptopRe(kind))[0]);
  if (kind === "gpu") {
    // "For ASUS TUF RX 6700 XT ... Heatsink": a part made for that card.
    if (/^for\b/.test(t) || (/\b(?:heatsink|heat sink|cooling fans?|replacement fans?|fans? replacement|water ?block|shroud)\b/.test(t) && !/\b\d{1,2}\s?gb?\b|\bgddr\d/.test(t))) return reject("accessory", "gpu part");
    // A bare circuit board (no cooler/shroud) is not a working graphics card.
    const bare = t.match(/\b(?:pcb|bare board|board only|core only|no (?:cooler|heatsink|shroud|fans?)|without (?:cooler|heatsink|shroud|fans?))\b/);
    if (bare) return reject("incomplete", bare[0]);
    const sig = gpuHostSignal(t);
    if (sig) return reject("laptop-or-system", sig);
  }
  if (["gpu", "cpu", "motherboard", "ram", "nvme", "ssd", "sata", "hdd", "psu"].includes(kind)) {
    const system = systemSignal(kind, t, host);
    if (system) return reject("complete-system", system);
  }

  const consumed = new Set();
  let softFloor = .5;

  if (kind === "gpu") {
    if (/\b(?:water ?block|waterblock|replacement fans?|fan replacement|riser|vertical mount|anti sag|support bracket|thermal pads?|bios chip|backplate only|shroud only|pcb only|heatsink only|cooler only)\b/.test(t))
      return reject("accessory", "gpu accessory");
    const exp = expectedGpu(query);
    if (exp.key) {
      const keys = gpuModelKeys(t);
      if (!keys.size) return reject("model-not-stated");
      if (!keys.has(exp.key)) return reject("model-mismatch", [...keys].join(","));
      if (keys.size > 1) return reject("multiple-models", [...keys].join(","));
      const vrams = gpuVrams(t);
      if (vrams.size > 1) return reject("multiple-variants", [...vrams].join("/") + "GB");
      if (exp.vram && vrams.size && !vrams.has(exp.vram)) return reject("vram-mismatch", [...vrams][0] + "GB");
      if (exp.vramStrict && !vrams.size) return reject("vram-not-stated", "model has several VRAM versions");
      for (const tok of q.split(" ")) if (/\d/.test(tok) || /^(?:rtx|gtx|gt|rx|arc|radeon|geforce|nvidia|amd|intel)$/.test(tok)) consumed.add(tok);
    }
  } else if (kind === "cpu") {
    const exp = expectedCpu(query);
    if (exp.key) {
      const keys = cpuModelKeys(t);
      if (!keys.size) return reject("model-not-stated");
      if (!keys.has(exp.key)) return reject("model-mismatch", [...keys].join(","));
      if (keys.size > 1) return reject("multiple-models", [...keys].join(","));
      const brand = cpuBrandOf(t);
      if (exp.brand && brand && brand !== exp.brand) return reject("model-mismatch", brand);
      if (/\bcombo\b/.test(t) || chipsetsIn(t).size || /\b(?:motherboard|mobo|mainboard)\b/.test(t)) return reject("bundle-or-combo", "cpu with motherboard");
      if (/\b(?:engineering sample|qualification sample|es cpu|qs cpu)\b/.test(t)) return reject("model-mismatch", "engineering sample");
      for (const tok of q.split(" ")) if (/\d/.test(tok) || /^(?:ryzen|core|ultra|intel|amd)$/.test(tok)) consumed.add(tok);
    }
  } else if (kind === "nvme" || kind === "ssd" || kind === "sata" || kind === "hdd") {
    if (/\b(?:enclosure|duplicator|docking|dock|caddy|adapter card|to usb|usb adapter|sata cable)\b/.test(t)) return reject("accessory", "storage accessory");
    const wantsExternal = /\b(?:external|portable|usb)\b/.test(q);
    if (!wantsExternal && /\b(?:external|portable|usb c|usb 3|usb3|thunderbolt)\b/.test(t)) return reject("form-factor-mismatch", "external drive");
    const wantNvme = kind === "nvme" || /\bnvme\b|\bpcie\b/.test(q);
    const wantSata = kind === "sata" || /\bsata\b/.test(q);
    const wantHdd = kind === "hdd" || /\bhdd\b|\bhard disk\b|\brpm\b/.test(q);
    const isNvme = /\b(?:nvme|pcie|gen ?[345])\b/.test(t);
    const isSsd = /\b(?:ssd|solid state|nvme)\b/.test(t);
    if (wantNvme && !isNvme && /\bsata\b/.test(t)) return reject("interface-mismatch", "SATA");
    if (wantSata && isNvme) return reject("interface-mismatch", "NVMe");
    if (wantHdd && isSsd) return reject("interface-mismatch", "SSD");
    if (!wantHdd && /\b(?:\d{4}\s*rpm|hard disk|hdd)\b/.test(t) && !isSsd) return reject("interface-mismatch", "HDD");
    const qRpm = q.match(/\b(\d{4})\s*rpm\b/)?.[1];
    if (qRpm) {
      const tRpm = new Set([...t.matchAll(/\b(\d{4})\s*rpm\b/g)].map(m => m[1]));
      if (tRpm.size && !tRpm.has(qRpm)) return reject("speed-mismatch", [...tRpm][0] + " RPM");
      consumed.add(qRpm + "rpm"); consumed.add(qRpm); consumed.add("rpm");
    }
    const qCap = capacitiesGb(q, 100)[0];
    if (qCap) {
      const caps = distinctWithin(capacitiesGb(t, 100));
      if (!caps.length) return reject("capacity-not-stated");
      if (caps.length > 1) return reject("multiple-variants", caps.join("/") + "GB");
      if (!sameCapacity(caps[0], qCap)) return reject("capacity-mismatch", caps[0] + "GB");
    }
    for (const tok of q.split(" ")) if (/^\d+(?:\.\d+)?(?:tb|gb)$/.test(tok)) consumed.add(tok);
  } else if (kind === "ram") {
    if (/\b(?:rdimm|lrdimm|registered|server memory)\b/.test(t) && !/\b(?:rdimm|registered|server)\b/.test(q)) return reject("form-factor-mismatch", "server RDIMM");
    const qGen = q.match(/\bddr([345])\b/)?.[1];
    const tGens = new Set([...t.matchAll(/\bddr([345])\b/g)].map(m => m[1]));
    if (tGens.size > 1) return reject("multiple-variants", "DDR generations");
    if (qGen && tGens.size && !tGens.has(qGen)) return reject("generation-mismatch", "DDR" + [...tGens][0]);
    const qTotal = ramTotal(q);
    if (qTotal) {
      const tTotal = ramTotal(t);
      if (!tTotal) return reject("capacity-not-stated");
      if (tTotal !== qTotal) return reject("capacity-mismatch", tTotal + "GB");
    }
    const qSpeed = [...q.matchAll(/\b(\d{4})(?:mhz|mt)?\b/g)].map(m => m[1]).find(x => RAM_SPEEDS.has(x));
    if (qSpeed) {
      const tSpeeds = new Set([...t.matchAll(/\b(\d{4})(?:mhz|mt)?\b/g)].map(m => m[1]).filter(x => RAM_SPEEDS.has(x)));
      if (tSpeeds.size && !tSpeeds.has(qSpeed)) return reject("speed-mismatch", [...tSpeeds][0]);
      consumed.add(qSpeed); consumed.add(qSpeed + "mhz");
    }
    const qCl = Number(q.match(/\bc(?:l)?(\d{2})\b/)?.[1]);
    if (qCl) {
      const tCl = Number(t.match(/\bc(?:l)?(\d{2})\b/)?.[1]);
      if (tCl && tCl > qCl) return reject("latency-mismatch", "CL" + tCl);
      consumed.add("cl" + qCl); consumed.add("c" + qCl);
    }
    for (const tok of q.split(" ")) if (/^(?:\d+gb|\d+x\d+gb|\d+x|ddr[345])$/.test(tok)) consumed.add(tok);
  } else if (kind === "motherboard") {
    const qChips = chipsetsIn(q);
    const tChips = chipsetsIn(t);
    if (qChips.size) {
      if (!tChips.size) return reject("model-not-stated", "chipset");
      if (![...qChips].some(c => tChips.has(c))) return reject("model-mismatch", [...tChips].join(","));
      if (tChips.size > 1) return reject("multiple-models", [...tChips].join(","));
      for (const c of qChips) { consumed.add(c); for (const sfx of ["m", "e", "i"]) consumed.add(c + sfx); }
    }
    const qSock = q.match(/\b(am4|am5|lga\s*\d{4})\b/)?.[1]?.replace(/\s/g, "");
    const tSock = new Set([...t.matchAll(/\b(am4|am5|lga\s*\d{4})\b/g)].map(m => m[1].replace(/\s/g, "")));
    if (qSock && tSock.size && !tSock.has(qSock)) return reject("socket-mismatch", [...tSock][0]);
    if (qSock) { consumed.add(qSock); consumed.add("lga"); consumed.add(qSock.replace("lga", "")); }
    if (/\b(?:combo|bundle|with cpu|cpu included)\b/.test(t) || cpuContextKeys(t).size) return reject("bundle-or-combo", "motherboard with CPU");
    if (/\b(?:io shield|i o shield|bios chip|cmos battery|standoffs?)\b/.test(t) && !/\bmotherboard\b/.test(t)) return reject("accessory", "motherboard accessory");
  } else if (kind === "psu") {
    if (/\b(?:sleeved|extension|cable kit|cable set|cables only|cable only|replacement cable|tester|adapter)\b/.test(t) && !/\bpower supply\b/.test(stripHostPhrases(t.replace(/\b(?:cable|adapter)s?(?:\s+(?:kit|set))?\s+for\s+.*$/, "")))) return reject("accessory", "psu cable/adapter");
    const qWatt = q.match(/\b(\d{3,4})w\b/)?.[1];
    if (qWatt) {
      const explicit = new Set([...t.matchAll(/\b(\d{3,4})w\b/g)].map(m => m[1]));
      const embedded = new RegExp("(?:^|[^0-9])" + qWatt + "(?![0-9])").test(t);
      if (explicit.size && !explicit.has(qWatt)) return reject("wattage-mismatch", [...explicit][0] + "W");
      if (!explicit.size && !embedded) return reject("wattage-not-stated");
      consumed.add(qWatt + "w"); consumed.add(qWatt);
    }
    const ratings = ["bronze", "silver", "gold", "platinum", "titanium"];
    const qRate = ratings.find(r => q.includes(r));
    const tRates = ratings.filter(r => t.includes(r));
    if (qRate && tRates.length && !tRates.includes(qRate)) return reject("efficiency-mismatch", tRates[0]);
    if (qRate) consumed.add(qRate);
  } else if (kind === "case") {
    const isCase = /\b(?:mid tower|full tower|mini tower|tower|tower case|chassis|computer case|pc case|atx case|itx case|matx case|case)\b/.test(t);
    const caseBody = /\b(?:mid tower|full tower|mini tower|tower|chassis|computer case|pc case|atx case|itx case|matx case)\b/.test(t);
    const casePart = /\b(?:side panel|front panel|glass panel|replacement panel|dust filter|case feet|case badge|pcie bracket|vertical gpu)\b/.test(t);
    // "...Tower with Magnetic Dust Filter" is a case; "Side Panel for 4000D" is a part.
    if (casePart && (!caseBody || /\b(?:replacement|spare)\b/.test(t))) return reject("accessory", "case part");
    if (/\b(?:case fans?|fan pack|\d pack|3 pack)\b/.test(t) && !/\b(?:mid tower|full tower|mini tower|tower case|chassis|computer case|pc case|atx case)\b/.test(t)) return reject("accessory", "case fans");
    if (!isCase) return reject("model-not-stated", "not a case");
  } else if (kind === "aio" || kind === "aircooler" || kind === "cooler" || kind === "fans") {
    if (/\b(?:mounting kit|mounting bracket|bracket kit|retention kit|backplate kit|replacement fans?|replacement pump|pump only|lcd screen only|thermal paste only)\b/.test(t)) return reject("accessory", "cooler part");
    const isLiquid = /\b(?:aio|liquid|water cool\w*|all in one|radiator)\b/.test(t) || /\bh(?:60|100|115|150|170)i\b/.test(t);
    const wantLiquid = kind === "aio" || /\b(?:aio|liquid|water)\b/.test(q);
    const wantAir = kind === "aircooler" || /\b(?:air|tower)\b/.test(q);
    if (kind !== "fans") {
      if (wantLiquid && !isLiquid) return reject("form-factor-mismatch", "not an AIO");
      if (wantAir && !wantLiquid && isLiquid) return reject("form-factor-mismatch", "AIO, not air");
    } else if (/\b(?:cpu cooler|aio|liquid cooler|gpu fan)\b/.test(t)) return reject("form-factor-mismatch", "not case fans");
    const sizeRe = /(?:^|\s)(120|140|240|280|360|420)(?:mm)?(?=\s|$)/;
    const qSize = q.match(sizeRe)?.[1];
    if (qSize && (wantLiquid || kind === "fans")) {
      const corsair = { h60i: "120", h100i: "240", h115i: "280", h150i: "360", h170i: "420" };
      const sizes = new Set([...t.matchAll(/(?:^|[^0-9])(120|140|240|280|360|420)(?:mm)?(?![0-9])/g)].map(m => m[1]));
      for (const [code, size] of Object.entries(corsair)) if (t.includes(code)) sizes.add(size);
      if (!sizes.size) return reject("size-not-stated");
      if (!sizes.has(qSize)) return reject("size-mismatch", [...sizes][0] + "mm");
      consumed.add(qSize); consumed.add(qSize + "mm");
    }
  } else if (kind === "pc") {
    if (/\b(?:laptop|notebook|case only|barebones?|no gpu|no cpu)\b/.test(t)) return reject("incomplete", "not a complete desktop");
    const gpuKey = expectedGpu(query).key;
    const cpuKey = expectedCpu(query).key;
    if (gpuKey && !gpuModelKeys(t).has(gpuKey)) return reject("model-mismatch", "GPU");
    if (cpuKey && !cpuModelKeys(t).has(cpuKey)) return reject("model-mismatch", "CPU");
    softFloor = 0;
  } else {
    const profile = SNIPER_CATEGORIES.find(x => x.name.toLowerCase() === String(category || "").toLowerCase());
    const excluded = (profile?.exclude || []).find(term => (" " + t + " ").includes(" " + normalizeListingText(term) + " "));
    if (excluded) return reject("accessory", excluded);
    softFloor = .6;
  }

  const tokens = softTokens(q, consumed);
  const coverage = tokenCoverage(t, tokens);
  if (coverage < softFloor) return reject("weak-title-match", tokens.join(" "));
  return { ok: true, reason: null, detail: null, relevance: Math.round((.75 + .25 * coverage) * 1000) / 1000, condition, conditionAssumed };
}

export function relevanceScore(title, query, category) {
  return evaluateListing({ title, query, category }).relevance;
}
