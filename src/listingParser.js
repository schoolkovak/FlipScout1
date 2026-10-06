import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,COOLER_OPTIONS,CASE_OPTIONS
} from "../shared/catalog.js";

function norm(value){
  return String(value||"").toLowerCase().replace(/geforce|nvidia|amd radeon|radeon/g," ").replace(/[^a-z0-9]+/g,"");
}

function bestContained(list,text){
  const n=norm(text);
  const hits=list
    .map(item=>({item,key:norm(item.name)}))
    .filter(x=>x.key.length>=4&&n.includes(x.key))
    .sort((a,b)=>b.key.length-a.key.length);
  if(hits.length)return hits[0].item.name;

  // Match core model token when formatting is messy, but only if it maps uniquely.
  for(const item of list){
    const model=(item.name.match(/(?:RTX|GTX|RX|Arc|Ryzen|i[3579]|Ultra)\s*[A-Za-z]*\s*\d+[A-Za-z0-9]*/i)||[])[0];
    if(!model)continue;
    const key=norm(model);
    if(key.length>=4&&n.includes(key)){
      const collisions=list.filter(x=>norm(x.name).includes(key));
      if(collisions.length===1)return item.name;
    }
  }
  return null;
}

function closestOption(list,predicate){
  return list.find(predicate)?.name||null;
}

export function parseListingText(text){
  const raw=String(text||"");
  const lower=raw.toLowerCase();
  const found={confidence:0,notes:[]};

  found.cpu=bestContained(CPUS,raw);
  found.gpu=bestContained(GPUS,raw);

  const priceMatches=[...raw.matchAll(/\$\s*([0-9]{2,5}(?:\.[0-9]{1,2})?)/g)].map(m=>Number(m[1]));
  if(priceMatches.length)found.price=priceMatches[0];

  const ramMatch=lower.match(/\b(8|16|24|32|48|64|96|128)\s*gb\b[^\n,;]{0,35}\b(ddr4|ddr5)\b/i) ||
    lower.match(/\b(ddr4|ddr5)\b[^\n,;]{0,35}\b(8|16|24|32|48|64|96|128)\s*gb\b/i);
  if(ramMatch){
    const capacity=Number(ramMatch[1])||Number(ramMatch[2]);
    const type=(ramMatch.find(x=>/^ddr[45]$/i.test(x))||"").toUpperCase();
    found.ram=closestOption(RAM_OPTIONS,x=>x.capacity===capacity&&x.type===type) ||
      closestOption(RAM_OPTIONS,x=>x.capacity===capacity);
  }else{
    const capacityOnly=lower.match(/\b(8|16|24|32|48|64)\s*gb\s*(?:ram|memory)\b/i);
    if(capacityOnly)found.ram=closestOption(RAM_OPTIONS,x=>x.capacity===Number(capacityOnly[1]));
  }

  const storageMatch=lower.match(/\b(500|512|1000|1024|2000|2048|4000|4096)\s*gb\b[^\n,;]{0,30}\b(nvme|ssd|hdd)\b/i) ||
    lower.match(/\b(1|2|4)\s*tb\b[^\n,;]{0,30}\b(nvme|ssd|hdd)\b/i);
  if(storageMatch){
    const number=Number(storageMatch[1]);
    const cap=lower.slice(storageMatch.index,storageMatch.index+storageMatch[0].length).includes("tb")?number*1000:number;
    const type=(storageMatch[2]||"").toLowerCase();
    found.storage=closestOption(STORAGE_OPTIONS,x=>{
      if(Math.abs(x.capacity-cap)>100)return false;
      const n=x.name.toLowerCase();
      return type==="nvme"?n.includes("nvme"):type==="hdd"?n.includes("hdd"):n.includes("ssd");
    });
  }

  found.motherboard=bestContained(MOTHERBOARDS,raw);
  if(!found.motherboard){
    const chip=(lower.match(/\b(a520|b450|b550|x570|a620|b650|b850|x670|x870|b560|b660|b760|z690|z790|b860|z890)\b/i)||[])[1];
    if(chip)found.motherboard=closestOption(MOTHERBOARDS,x=>x.name.toLowerCase().includes(chip.toLowerCase()));
  }

  const watts=(lower.match(/\b(450|500|550|600|650|700|750|800|850|900|1000|1200)\s*w(?:att)?\b/i)||[])[1];
  if(watts){
    const w=Number(watts);
    found.psu=closestOption(PSU_OPTIONS,x=>x.wattage===w) ||
      [...PSU_OPTIONS].sort((a,b)=>Math.abs(a.wattage-w)-Math.abs(b.wattage-w))[0]?.name;
  }

  if(/\b(240|280|360)\s*mm\s*(aio|liquid)/i.test(lower)){
    const mm=(lower.match(/\b(240|280|360)\s*mm\b/i)||[])[1];
    found.cooler=closestOption(COOLER_OPTIONS,x=>x.name.startsWith(mm+"mm"));
  }else if(/\b(aio|liquid cool)/i.test(lower)){
    found.cooler=closestOption(COOLER_OPTIONS,x=>x.name.includes("240mm"));
  }else if(/\b(tower cooler|air cooler)/i.test(lower)){
    found.cooler=closestOption(COOLER_OPTIONS,x=>x.name.includes("Tower Air"));
  }

  if(/\b(rgb|argb)\b/i.test(lower)&&/\b(case|tower)\b/i.test(lower)){
    found.caseType=closestOption(CASE_OPTIONS,x=>x.name.includes("RGB"));
  }

  const detected=["cpu","gpu","ram","storage","motherboard","psu","cooler","caseType","price"].filter(k=>found[k]!=null);
  found.confidence=Math.min(100,Math.round(detected.length/9*100));
  if(!found.cpu)found.notes.push("CPU not confidently detected");
  if(!found.gpu)found.notes.push("GPU not confidently detected");
  if(!found.price)found.notes.push("Asking price not detected");
  return found;
}
