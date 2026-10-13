// Case attributes read from a listing title, for the Size / Lighting / Color
// filters on case pages and the Flipper Deals case rules.
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");

export function caseAttributes(title) {
  const t = " " + norm(title) + " ";
  const micro = /\b(?:micro atx|matx|m atx|micro tower)\b/.test(t);
  const itx = /\b(?:mini itx|itx|sff|small form factor)\b/.test(t);
  const atx = /\b(?:mid tower|full tower|e atx|eatx)\b/.test(t) || (/\batx\b/.test(t) && !/\b(?:micro atx|m atx)\b/.test(t.replace(/\b(?:supports?|compatible with|fits)\b.*$/, "")));
  const size = atx && !/\b(?:micro atx case|matx case|micro tower)\b/.test(t) ? "ATX" : micro ? "Micro ATX" : itx ? "Mini ITX" : atx ? "ATX" : "Other";
  const lighting = /\b(?:argb|a rgb|addressable|5v 3 ?pin|sync)\b/.test(t) ? "ARGB" : /\brgb\b|\bled\b/.test(t) ? "RGB" : "No RGB";
  const color = /\b(?:white|snow)\b/.test(t) ? "White" : /\bblack\b/.test(t) ? "Black" : "Other";
  return { Size: size, Lighting: lighting, Color: color };
}

export const CASE_FACETS = [
  { key: "Size", values: ["ATX", "Micro ATX", "Mini ITX"] },
  { key: "Lighting", values: ["ARGB", "RGB", "No RGB"] },
  { key: "Color", values: ["White", "Black"] }
];

// Monitors: size, resolution, panel and refresh rate from the title.
export function monitorAttributes(title) {
  const t = " " + norm(title) + " ";
  const raw = String(title || "").toLowerCase();
  const inch = Number(raw.match(/\b(\d{2}(?:\.\d)?)\s?(?:"|”|''|-?\s?inch|in\b)/)?.[1] || t.match(/\b(2[1-9]|3[0-9]|4[0-9])\b(?= [a-z]*\s?(?:monitor|display|gaming|curved|ultrawide|fhd|qhd|uhd))/)?.[1]) || null;
  const Size = !inch ? "Other" : inch < 25 ? "24\" & under" : inch < 28 ? "25–27\"" : inch < 33 ? "28–32\"" : "34\"+";
  const Resolution = /\b(?:4k|uhd|2160p|3840)\b/.test(t) ? "4K" : /\b(?:1440p|qhd|wqhd|2k|2560|uwqhd|3440)\b/.test(t) ? "1440p" : /\b(?:1080p|fhd|full hd|1920)\b/.test(t) ? "1080p" : "Other";
  const Panel = /\b(?:qd oled|oled)\b/.test(t) ? "OLED" : /\b(?:ips|nano ips|fast ips)\b/.test(t) ? "IPS" : /\bva\b/.test(t) ? "VA" : /\btn\b/.test(t) ? "TN" : "Other";
  const hz = Math.max(0, ...[...t.matchAll(/\b(\d{2,3})\s?hz\b/g)].map(m => Number(m[1])));
  const Refresh = !hz ? "Other" : hz >= 240 ? "240Hz+" : hz >= 165 ? "165–200Hz" : hz >= 120 ? "120–144Hz" : "60–100Hz";
  return { Size, Resolution, Panel, Refresh };
}

export const MONITOR_FACETS = [
  { key: "Size", values: ["24\" & under", "25–27\"", "28–32\"", "34\"+"] },
  { key: "Resolution", values: ["1080p", "1440p", "4K"] },
  { key: "Panel", values: ["IPS", "VA", "OLED", "TN"] },
  { key: "Refresh", values: ["60–100Hz", "120–144Hz", "165–200Hz", "240Hz+"] }
];
