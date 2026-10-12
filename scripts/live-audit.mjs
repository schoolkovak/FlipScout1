#!/usr/bin/env node
// Live provider audit: runs real searches through the production pipeline
// and reports, per provider and per store, how many listings came back, how
// many survived filtering, and why the rest were dropped.
//
// Uses real API credits. Keys come from the environment only:
//   SERPER_API_KEY=... SEARCHAPI_API_KEY=... node scripts/live-audit.mjs
// Options:
//   --deep               also run Deep Scan (more SearchAPI credits)
//   --only=<n>           run only the first n test searches
//   --out=<file.json>    write the full report (default: live-audit-report.json)
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { searchMarketplaces, providerStatus, searchApiAccount } from "../api/_lib/market.js";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));

const SEARCHES = [
  { query: "RTX 5070", category: "GPU", condition: "any" },
  { query: "RX 9070 XT", category: "GPU", condition: "any" },
  { query: "RTX 3060 12GB", category: "GPU", condition: "used" },
  { query: "Ryzen 7 9800X3D", category: "CPU", condition: "any" },
  { query: "2TB NVMe SSD", category: "NVMe SSD", condition: "new" },
  { query: "32GB DDR5 6000", category: "RAM / Memory", condition: "any" },
  { query: "850W 80+ Gold PSU", category: "Power Supply / PSU", condition: "any" },
  { query: "RTX 4070 Super", category: "GPU", condition: "open-box" },
  { query: "RTX 3080", category: "GPU", condition: "refurbished" }
].slice(0, Number(args.only) || undefined);

const pad = (s, n) => String(s).padEnd(n);
const money = n => n == null ? "—" : "$" + Number(n).toFixed(2);

async function main() {
  const status = providerStatus({});
  console.log("Provider credentials:");
  for (const s of status) console.log("  " + pad(s.name, 26) + s.status);
  if (!status.some(s => s.status === "Connected")) {
    console.error("\nNo provider credentials in the environment. Set SERPER_API_KEY and/or SEARCHAPI_API_KEY.");
    process.exit(2);
  }
  const report = { startedAt: new Date().toISOString(), providers: status, account: null, searches: [] };
  try {
    report.account = await searchApiAccount({});
    if (report.account) console.log("\nSearchAPI account:", JSON.stringify(report.account).slice(0, 400));
  } catch (error) {
    report.accountError = error.message;
    console.log("\nSearchAPI account check failed:", error.message);
  }

  const modes = args.deep ? [false, true] : [false];
  for (const search of SEARCHES) {
    for (const deepScan of modes) {
      const label = `${search.query} [${search.category}, ${search.condition}${deepScan ? ", deep" : ""}]`;
      const started = Date.now();
      const result = await searchMarketplaces({ ...search, deepScan, partBudget: 0, buildBudget: 0, committed: 0 }, { includeOtherMerchants: true });
      const ms = Date.now() - started;
      console.log("\n" + "=".repeat(100) + "\n" + label + `  —  ${result.ranked.length} qualified listings in ${ms} ms`);
      console.log("Providers:");
      for (const p of result.providers) {
        const dropped = Object.entries(p.dropped || {}).sort((a, b) => b[1] - a[1]).map(([r, n]) => n + " " + r).join(", ");
        console.log("  " + pad(p.name, 34) + (p.status === "ok"
          ? `${pad(p.raw + " raw", 9)} ${pad(p.kept + " kept", 9)} ${p.duplicates ? p.duplicates + " dup  " : ""}${dropped}`
          : p.status.toUpperCase() + ": " + p.message));
        for (const e of p.examples || []) console.log("      · " + pad(e.reason, 22) + money(e.price) + "  " + e.title + (e.detail ? "  (" + e.detail + ")" : ""));
      }
      console.log("Stores:");
      for (const c of result.coverage) console.log("  " + pad(c.name, 14) + pad(c.listings, 5) + c.note);
      const other = result.ranked.filter(x => x.marketplace === "other").length;
      if (other) console.log("  " + pad("Other stores", 14) + other);
      console.log("Market: median " + money(result.market.median) + ", " + result.market.sampleSize + " comps, by condition " + JSON.stringify(result.market.byCondition));
      console.log("Cheapest 8 (Lowest Total Price):");
      for (const x of result.ranked.slice().sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 8))
        console.log("  " + pad(money(x.totalPrice) + (x.shippingKnown ? "" : "+?"), 11) + pad(x.source, 13) + pad(x.condition, 12) + x.title.slice(0, 70) + "\n" + " ".repeat(36) + (x.url || ""));
      report.searches.push({ ...search, deepScan, ms, qualified: result.ranked.length, market: { ...result.market, comps: undefined }, providers: result.providers, coverage: result.coverage, listings: result.ranked.map(x => ({ title: x.title, source: x.source, provider: x.provider, condition: x.condition, totalPrice: x.totalPrice, shippingKnown: x.shippingKnown, url: x.url, score: x.score })) });
    }
  }
  const out = typeof args.out === "string" ? args.out : "live-audit-report.json";
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("\nFull report written to " + out);
}

main().catch(error => { console.error(error); process.exit(1); });
