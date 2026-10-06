import assert from "node:assert/strict";
import { resolveCatalogPart, GPUS, CPUS } from "../shared/catalog.js";
import { fallbackPcEstimate } from "../src/valuation.js";
import { parseListingText } from "../src/listingParser.js";
import { scoreBreakdown } from "../src/intelligence.js";

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

assert.ok(GPUS.length>=110,"GPU dropdown should have broad desktop coverage");
assert.ok(CPUS.length>=200,"CPU dropdown should have broad desktop coverage");
assert.ok(GPUS.some(x=>x.name==="RX 9070 GRE 12GB"));
assert.ok(GPUS.some(x=>x.name==="RTX 5090"));
assert.ok(CPUS.some(x=>x.name==="Ryzen 7 9850X3D"));
assert.ok(CPUS.some(x=>x.name==="Core Ultra 7 270K Plus"));

const thinScore=scoreBreakdown({
  result:{compatibility:{warnings:[]}},
  live:{evidence:{grade:"F",scoreCap:45},resale:{online:{salesBacked:false,costs:{shippingMedian:null}}}},
  best:{roi:40,profit:400},appeal:100,liquidity:100
});
assert.ok(thinScore.finalScore<=45,"Thin evidence must cap Flip Score");

const strongScore=scoreBreakdown({
  result:{compatibility:{warnings:[]}},
  live:{evidence:{grade:"A",scoreCap:95,completePcCompCount:20,componentCoveragePct:75},resale:{online:{salesBacked:true,costs:{shippingMedian:35}}},salesEvidence:{listingCount:10}},
  best:{roi:35,profit:350},appeal:90,liquidity:90
});
assert.ok(strongScore.finalScore<=95&&strongScore.finalScore>70,"Strong evidence should allow a strong but capped score");
