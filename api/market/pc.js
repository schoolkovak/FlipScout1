import { liveSearch, buildSalesEvidence, searchLocalEbay } from "../_lib/market.js";
import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,CASE_OPTIONS,COOLER_OPTIONS,
  closestFallback,findByName,MARKET_SNAPSHOT,resolveBuildParts
} from "../../shared/catalog.js";

function baseInput(query,category,condition,extra={}){
  return {query,category,condition,partBudget:0,buildBudget:0,committed:0,sortBy:"best",...extra};
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

function completePcQuery(body,resolved){
  return [resolved.cpu.canonical,resolved.gpu.canonical,"gaming PC"].filter(Boolean).join(" ");
}

function localLikelyFromMarket(market){
  if(!market?.sampleSize || market.sampleSize<3) return null;
  return Math.round(((Number(market.low)||Number(market.median)) + Number(market.median))/2);
}

function salesEvidencePublicShape(evidence){
  return {
    label:evidence.label,
    median:evidence.median,
    low:evidence.low,
    high:evidence.high,
    listingCount:evidence.listingCount,
    totalReportedUnitsSold:evidence.totalReportedUnitsSold,
    confidence:evidence.confidence,
    listings:(evidence.listings||[]).map(x=>({
      title:x.title,
      price:x.totalPrice,
      soldCount:x.soldCount,
      condition:x.condition,
      seller:x.seller,
      url:x.url
    }))
  };
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST required"});
  const body=req.body||{};
  const resolved=resolveBuildParts(body);

  if(!resolved.cpu.item || !resolved.gpu.item){
    return res.status(200).json({
      available:false,
      valid:false,
      validation:resolved,
      message:"Correct the unrecognized CPU or GPU before FlipScout calculates a resale value."
    });
  }

  const canonicalBody={
    ...body,
    cpu:resolved.cpu.canonical,
    gpu:resolved.gpu.canonical
  };

  const searches={
    gpu:baseInput(canonicalBody.gpu,"GPU","used",{componentEstimate:true}),
    cpu:baseInput(canonicalBody.cpu,"CPU","used",{componentEstimate:true}),
    storage:baseInput(canonicalBody.storage,"SSD / NVMe","new",{componentEstimate:true}),
    ram:baseInput(canonicalBody.ram,"RAM","new",{componentEstimate:true}),
    motherboard:baseInput(canonicalBody.motherboard,"Motherboard","used",{componentEstimate:true}),
    psu:baseInput(canonicalBody.psu,"PSU","new",{componentEstimate:true}),
    caseType:baseInput(canonicalBody.caseType,"Case","new",{componentEstimate:true}),
    cooler:baseInput(canonicalBody.cooler,canonicalBody.cooler?.includes("AIO")?"AIO Cooler":"CPU Cooler","new",{componentEstimate:true}),
    completePc:baseInput(completePcQuery(canonicalBody,resolved),"Complete PC","used")
  };

  const keys=Object.keys(searches);
  const settled=await Promise.all(keys.map(k=>liveSearch(searches[k]).catch(()=>null)));
  const data=Object.fromEntries(keys.map((k,i)=>[k,settled[i]]));

  const values={
    gpu:liveValue(data.gpu,closestFallback(GPUS,canonicalBody.gpu,0),{factor:1,min:4,label:"Live market comps"}),
    cpu:liveValue(data.cpu,closestFallback(CPUS,canonicalBody.cpu,0),{factor:1,min:4,label:"Live market comps"}),
    storage:liveValue(data.storage,closestFallback(STORAGE_OPTIONS,canonicalBody.storage,120),{factor:.74,min:5,label:"Live new-market median × resale factor"}),
    ram:liveValue(data.ram,closestFallback(RAM_OPTIONS,canonicalBody.ram,100),{factor:.72,min:5,label:"Live new-market median × resale factor"}),
    motherboard:liveValue(data.motherboard,closestFallback(MOTHERBOARDS,canonicalBody.motherboard,90),{factor:.82,min:4,label:"Live market median × resale factor"}),
    psu:liveValue(data.psu,closestFallback(PSU_OPTIONS,canonicalBody.psu,60),{factor:.58,min:5,label:"Live new-market median × resale factor"}),
    caseType:liveValue(data.caseType,closestFallback(CASE_OPTIONS,canonicalBody.caseType,50),{factor:.50,min:5,label:"Live new-market median × resale factor"}),
    cooler:liveValue(data.cooler,closestFallback(COOLER_OPTIONS,canonicalBody.cooler,20),{factor:.50,min:5,label:"Live new-market median × resale factor"})
  };

  const componentTotal=Object.values(values).reduce((sum,x)=>sum+x.value,0);
  const gpu=findByName(GPUS,canonicalBody.gpu);
  const cpu=findByName(CPUS,canonicalBody.cpu);
  const pcCase=findByName(CASE_OPTIONS,canonicalBody.caseType);
  const appeal=((gpu?.appeal||5)+(cpu?.appeal||5)+(pcCase?.appeal||5))/3;
  const presentationPremium=appeal>=9?85:appeal>=8?55:appeal>=6?25:0;
  const componentBased=Math.max(0,componentTotal+presentationPremium);

  let completePc=null;
  if(usable(data.completePc,4)){
    completePc={
      median:Math.round(data.completePc.market.median),
      low:Math.round(data.completePc.market.low),
      high:Math.round(data.completePc.market.high),
      sampleSize:data.completePc.market.sampleSize,
      confidence:data.completePc.market.confidence
    };
  }

  const salesEvidence=buildSalesEvidence(data.completePc?.items||[]);
  const salesBackedAvailable=salesEvidence.listingCount>=2 && salesEvidence.median;

  let onlineLikely=salesBackedAvailable
    ? Math.round(salesEvidence.median)
    : completePc?.median || Math.round(componentBased);

  const onlineMethod=salesBackedAvailable
    ? "Sales-backed eBay listings with reported prior units sold"
    : completePc
      ? "Current used complete-PC asking comps"
      : "Component market model";

  const localData=canonicalBody.postalCode
    ? await searchLocalEbay(baseInput(completePcQuery(canonicalBody,resolved),"Complete PC","used",{
        postalCode:String(canonicalBody.postalCode),
        distanceRadius:Number(canonicalBody.distanceRadius||50)
      }))
    : null;

  const localLikely=localLikelyFromMarket(localData?.market);
  const localMarket=localData?.market?.sampleSize ? {
    likely:localLikely,
    median:Math.round(localData.market.median),
    low:Math.round(localData.market.low),
    high:Math.round(localData.market.high),
    sampleSize:localData.market.sampleSize,
    confidence:localData.market.confidence,
    postalCode:String(canonicalBody.postalCode),
    distanceRadius:Number(canonicalBody.distanceRadius||50),
    method:"Nearby eBay local-pickup asking comps; likely price uses lower half of the local asking range"
  } : null;

  const blendedBase=salesBackedAvailable
    ? Math.round(componentBased*.35 + onlineLikely*.65)
    : completePc
      ? Math.round(componentBased*.55 + completePc.median*.45)
      : Math.round(componentBased);

  const liveCount=Object.values(values).filter(x=>x.live).length;
  const uncertainty=salesBackedAvailable ? .06 : completePc ? .08 : liveCount>=4 ? .10 : .13;
  const low=Math.max(0,Math.round(blendedBase*(1-uncertainty)));
  const high=Math.round(blendedBase*(1+uncertainty));

  return res.status(200).json({
    available:true,
    valid:true,
    validation:resolved,
    market:{low,high,median:blendedBase},
    resale:{
      online:{
        likely:onlineLikely,
        low:salesBackedAvailable?Math.round(salesEvidence.low):completePc?.low||low,
        high:salesBackedAvailable?Math.round(salesEvidence.high):completePc?.high||high,
        method:onlineMethod,
        salesBacked:Boolean(salesBackedAvailable),
        confidence:salesBackedAvailable?salesEvidence.confidence:completePc?.confidence||"Model"
      },
      local:localMarket
    },
    salesEvidence:salesEvidencePublicShape(salesEvidence),
    components:values,
    completePc,
    meta:{
      liveComponentCount:liveCount,
      componentCount:Object.keys(values).length,
      componentBased:Math.round(componentBased),
      snapshot:MARKET_SNAPSHOT,
      method:salesBackedAvailable
        ? "35% component market model + 65% sales-backed complete-PC evidence"
        : completePc
          ? "55% component market model + 45% complete-PC asking comps"
          : "component market model"
    }
  });
}
