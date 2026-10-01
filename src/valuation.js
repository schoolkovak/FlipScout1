import {
  GPUS, CPUS, RAM_OPTIONS, STORAGE_OPTIONS, MOTHERBOARDS, PSU_OPTIONS,
  CASE_OPTIONS, COOLER_OPTIONS, findByName, closestFallback, MARKET_SNAPSHOT
} from "../shared/catalog.js";

export const gpuValues=Object.fromEntries(GPUS.map(x=>[x.name,x.fallbackUsed]));
export const cpuValues=Object.fromEntries(CPUS.map(x=>[x.name,x.fallbackUsed]));

export function compatibilityChecks(input){
  const cpu=findByName(CPUS,input.cpu);
  const gpu=findByName(GPUS,input.gpu);
  const ram=findByName(RAM_OPTIONS,input.ram);
  const motherboard=findByName(MOTHERBOARDS,input.motherboard);
  const psu=findByName(PSU_OPTIONS,input.psu);
  const warnings=[];
  const positives=[];

  if(cpu&&motherboard&&cpu.socket!==motherboard.socket){
    warnings.push("CPU socket "+cpu.socket+" does not match motherboard "+motherboard.socket+".");
  } else if(cpu&&motherboard){
    positives.push("CPU and motherboard socket match.");
  }

  if(ram&&motherboard){
    const allowed=motherboard.ram.split("/");
    if(!allowed.includes(ram.type)) warnings.push(ram.type+" memory does not match the motherboard memory type.");
    else positives.push("RAM type matches the motherboard.");
  }

  if(cpu&&ram && !cpu.ram.split("/").includes(ram.type)){
    warnings.push(cpu.name+" does not support "+ram.type+" memory.");
  }

  if(gpu&&psu){
    if(psu.wattage<gpu.psuRec) warnings.push("The "+psu.wattage+"W PSU is below the "+gpu.psuRec+"W target stored for "+gpu.name+".");
    else positives.push("PSU wattage is appropriate for the GPU tier.");
  }

  if(gpu?.vram>=12) positives.push(gpu.vram+"GB VRAM improves resale appeal.");
  if(cpu?.appeal>=9) positives.push("Modern CPU platform has strong buyer appeal.");
  return {warnings,positives};
}

export function fallbackPcEstimate(input){
  const gpu=closestFallback(GPUS,input.gpu,220);
  const cpu=closestFallback(CPUS,input.cpu,90);
  const ram=closestFallback(RAM_OPTIONS,input.ram,100);
  const storage=closestFallback(STORAGE_OPTIONS,input.storage,120);
  const motherboard=closestFallback(MOTHERBOARDS,input.motherboard,90);
  const psu=closestFallback(PSU_OPTIONS,input.psu,60);
  const pcCase=closestFallback(CASE_OPTIONS,input.caseType,50);
  const cooler=closestFallback(COOLER_OPTIONS,input.cooler,20);

  const gpuObj=findByName(GPUS,input.gpu);
  const cpuObj=findByName(CPUS,input.cpu);
  const caseObj=findByName(CASE_OPTIONS,input.caseType);
  const compatibility=compatibilityChecks(input);

  const partsTotal=gpu+cpu+ram+storage+motherboard+psu+pcCase+cooler;
  const appeal=((gpuObj?.appeal||5)+(cpuObj?.appeal||5)+(caseObj?.appeal||5))/3;
  const visualPremium=appeal>=8?45:appeal>=6?20:0;
  const compatibilityPenalty=compatibility.warnings.length*45;
  const estimatedAsking=partsTotal+visualPremium-compatibilityPenalty;
  const low=Math.max(0,Math.round(estimatedAsking*.91));
  const high=Math.round(estimatedAsking*1.07);
  const resale=Math.round((low+high)/2);
  const sellingCosts=Math.round(resale*.08+15);
  const profit=resale-Number(input.price||0)-sellingCosts;
  const targetProfit=Math.max(120,Math.round(resale*.15));
  const maxBuy=Math.max(0,resale-sellingCosts-targetProfit);
  const discount=resale?(resale-Number(input.price||0))/resale:0;
  const compatibilityScore=Math.max(-20,10-compatibility.warnings.length*12);
  const score=Math.max(0,Math.min(100,Math.round(48+discount*85+appeal*1.7+compatibilityScore)));

  return {
    low,high,resale,sellingCosts,profit,maxBuy,score,
    compatibility,
    snapshot:MARKET_SNAPSHOT,
    components:{gpu,cpu,ram,storage,motherboard,psu,caseType:pcCase,cooler}
  };
}
