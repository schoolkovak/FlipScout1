import assert from "node:assert/strict";
import { resolveCatalogPart } from "../shared/catalog.js";
import { fallbackPcEstimate } from "../src/valuation.js";
import { parseListingText } from "../src/listingParser.js";

const gpuTypo=resolveCatalogPart("gpu","RTX5070-Ti");
assert.equal(gpuTypo.canonical,"RTX 5070 Ti");

const cpuTypo=resolveCatalogPart("cpu","Ryzen5-5600X");
assert.equal(cpuTypo.canonical,"Ryzen 5 5600X");

const fakeGpu=resolveCatalogPart("gpu","RTX 9090");
assert.equal(fakeGpu.status,"unknown");

const ambiguousGpu=resolveCatalogPart("gpu","RTX 3060");
assert.equal(ambiguousGpu.status,"ambiguous");
assert.ok(ambiguousGpu.suggestions.includes("RTX 3060 8GB"));
assert.ok(ambiguousGpu.suggestions.includes("RTX 3060 12GB"));

const validBuild={
  price:800,
  cpu:"Ryzen5-5600X",
  gpu:"RTX5070-Ti",
  ram:"16GB DDR4-3600 (2x8GB)",
  storage:"1TB NVMe SSD",
  motherboard:"B550 AM4 Motherboard",
  psu:"750W 80+ Gold PSU",
  caseType:"Midrange Tempered Glass RGB Case",
  cooler:"Basic Tower Air Cooler"
};
const valid=fallbackPcEstimate(validBuild);
assert.equal(valid.identityValid,true);
assert.ok(valid.score>0);
assert.equal(valid.compatibility.warnings.length,0);

const fake=fallbackPcEstimate({...validBuild,gpu:"RTX 9090"});
assert.equal(fake.identityValid,false);
assert.equal(fake.score,0);
assert.equal(fake.resale,null);

const mismatch=fallbackPcEstimate({...validBuild,motherboard:"B650 AM5 Motherboard"});
assert.ok(mismatch.compatibility.warnings.some(x=>x.includes("does not match")));

console.log("FlipScout smoke tests passed");

const parsed=parseListingText("$850 Gaming PC - Ryzen5 5600X, RTX 4060, 16GB DDR4, 1TB NVMe, B550 motherboard, 650W PSU");
assert.equal(parsed.cpu,"Ryzen 5 5600X");
assert.equal(parsed.gpu,"RTX 4060");
assert.ok(parsed.ram?.includes("16GB"));
assert.ok(parsed.storage?.includes("1TB"));
assert.ok(parsed.motherboard?.includes("B550"));
assert.ok(parsed.psu?.includes("650W"));
assert.equal(parsed.price,850);
