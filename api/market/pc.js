import { liveSearch } from "../_lib/market.js";
import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,CASE_OPTIONS,COOLER_OPTIONS,
  closestFallback,findByName,MARKET_SNAPSHOT
} from "../../shared/catalog.js";

function baseInput(query,category,condition){
  return {query,category,condition,partBudget:0,buildBudget:0,committed:0,sortBy:"best"};
}

function usable(data,min=5){
  return data?.market?.sampleSize>=min && Number.isFinite(Number(data.market.median));
}

function liveValue(data,fallback,{factor=1,min=5,label="Live asking comps"}={}){
  if(usable(data,min)){
    return {
      value:Math.round(data.market.median*factor),
      rawMedian:Math.round(data.market.median),
      source:label,
      sampleSize:data.market.sampleSize,
      confidence:data.market.confidence,
      live:true
    };
  }
  return {
    value:Math.round(fallback),
    rawMedian:null,
    source:"Fallback snapshot "+MARKET_SNAPSHOT,
    sampleSize:data?.market?.sampleSize||0,
    confidence:"Fallback",
    live:false
  };
}

function compactRam(ram){
  return String(ram||"").replace(/\s*\([^)]*\)/g,"");
}

function buildPcQuery(body){
  return [body.cpu,body.gpu,compactRam(body.ram),body.storage,"gaming PC"].filter(Boolean).join(" ");
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST required"});
  const body=req.body||{};

  const searches={
    gpu:baseInput(body.gpu,"GPU","used"),
    cpu:baseInput(body.cpu,"CPU","used"),
    storage:baseInput(body.storage,"SSD / NVMe","new"),
    ram:baseInput(body.ram,"RAM","new"),
    motherboard:baseInput(body.motherboard,"Motherboard","used"),
    psu:baseInput(body.psu,"PSU","new"),
    caseType:baseInput(body.caseType,"Case","new"),
    cooler:baseInput(body.cooler,body.cooler?.includes("AIO")?"AIO Cooler":"CPU Cooler","new"),
    completePc:baseInput(buildPcQuery(body),"Complete PC","used")
  };

  const keys=Object.keys(searches);
  const settled=await Promise.all(keys.map(k=>liveSearch(searches[k]).catch(()=>null)));
  const data=Object.fromEntries(keys.map((k,i)=>[k,settled[i]]));

  const values={
    gpu:liveValue(data.gpu,closestFallback(GPUS,body.gpu,220),{factor:1,min:4,label:"Live used asking comps"}),
    cpu:liveValue(data.cpu,closestFallback(CPUS,body.cpu,90),{factor:1,min:4,label:"Live used asking comps"}),
    storage:liveValue(data.storage,closestFallback(STORAGE_OPTIONS,body.storage,120),{factor:.74,min:5,label:"Live new-market median × resale factor"}),
    ram:liveValue(data.ram,closestFallback(RAM_OPTIONS,body.ram,100),{factor:.72,min:5,label:"Live new-market median × resale factor"}),
    motherboard:liveValue(data.motherboard,closestFallback(MOTHERBOARDS,body.motherboard,90),{factor:1,min:4,label:"Live used asking comps"}),
    psu:liveValue(data.psu,closestFallback(PSU_OPTIONS,body.psu,60),{factor:.58,min:5,label:"Live new-market median × resale factor"}),
    caseType:liveValue(data.caseType,closestFallback(CASE_OPTIONS,body.caseType,50),{factor:.50,min:5,label:"Live new-market median × resale factor"}),
    cooler:liveValue(data.cooler,closestFallback(COOLER_OPTIONS,body.cooler,20),{factor:.50,min:5,label:"Live new-market median × resale factor"})
  };

  const componentTotal=Object.values(values).reduce((sum,x)=>sum+x.value,0);
  const gpu=findByName(GPUS,body.gpu);
  const cpu=findByName(CPUS,body.cpu);
  const pcCase=findByName(CASE_OPTIONS,body.caseType);
  const appeal=((gpu?.appeal||5)+(cpu?.appeal||5)+(pcCase?.appeal||5))/3;
  const presentationPremium=appeal>=9?85:appeal>=8?55:appeal>=6?25:0;
  const componentBased=Math.max(0,componentTotal+presentationPremium);

  let median=componentBased;
  let completePc=null;
  if(usable(data.completePc,5)){
    completePc={
      median:Math.round(data.completePc.market.median),
      low:Math.round(data.completePc.market.low),
      high:Math.round(data.completePc.market.high),
      sampleSize:data.completePc.market.sampleSize,
      confidence:data.completePc.market.confidence
    };
    median=Math.round(componentBased*.60+completePc.median*.40);
  }

  const liveCount=Object.values(values).filter(x=>x.live).length;
  const uncertainty=liveCount>=6?.07:liveCount>=3?.10:.13;
  const low=Math.max(0,Math.round(median*(1-uncertainty)));
  const high=Math.round(median*(1+uncertainty));

  return res.status(200).json({
    available:liveCount>0 || Boolean(completePc),
    market:{low,high,median},
    components:values,
    completePc,
    meta:{
      liveComponentCount:liveCount,
      componentCount:Object.keys(values).length,
      componentBased:Math.round(componentBased),
      snapshot:MARKET_SNAPSHOT,
      method:completePc?"60% component market model + 40% complete-PC asking comps":"component market model"
    }
  });
}
