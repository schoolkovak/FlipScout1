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
      rawLow:Math.round(data.market.low),
      rawHigh:Math.round(data.market.high),
      source:label,
      sampleSize:data.market.sampleSize,
      confidence:data.market.confidence,
      live:true,
      bySource:data.market.bySource||{},
      examples:(data.market.comps||[]).slice(0,4).map(x=>({
        title:x.title,
        source:x.source,
        condition:x.condition,
        price:Math.round(Number(x.totalPrice||x.itemPrice||0)),
        url:x.url||null
      }))
    };
  }
  return {
    value:fallback==null?null:Math.round(fallback),
    rawMedian:null,
    rawLow:null,
    rawHigh:null,
    source:"Fallback snapshot "+MARKET_SNAPSHOT,
    sampleSize:data?.market?.sampleSize||0,
    confidence:"Fallback",
    live:false,
    bySource:{},
    examples:[]
  };
}

function compactRam(ram){
  return String(ram||"").replace(/\s*\([^)]*\)/g,"");
}

function completePcQuery(body,resolved){
  const ram=String(body.ram||"").match(/\b\d+GB\b/i)?.[0];
  const storage=String(body.storage||"").match(/\b\d+(?:TB|GB)\b/i)?.[0];
  return [resolved.cpu.canonical,resolved.gpu.canonical,ram,storage,"gaming PC"].filter(Boolean).join(" ");
}

function medianNumber(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length) return null;
  const i=Math.floor(a.length/2);
  return a.length%2?a[i]:(a[i-1]+a[i])/2;
}

function onlineSellingCosts(salePrice,items){
  const knownShipping=(items||[])
    .filter(x=>x.shippingKnown&&Number.isFinite(Number(x.shipping)))
    .map(x=>Number(x.shipping));
  const shippingMedian=medianNumber(knownShipping);
  const feeRate=.0735;
  const orderFee=.40;
  const platformFee=Math.round((Number(salePrice||0)*feeRate+orderFee)*100)/100;
  const estimatedTotal=shippingMedian===null?platformFee:Math.round((platformFee+shippingMedian)*100)/100;
  return {
    feeRate,
    orderFee,
    platformFee,
    shippingMedian:shippingMedian===null?null:Math.round(shippingMedian*100)/100,
    estimatedTotal,
    netAfterEstimatedCosts:Math.round((Number(salePrice||0)-estimatedTotal)*100)/100,
    note:shippingMedian===null
      ?"eBay desktop-PC fee estimate; shipping unavailable from enough comps"
      :"eBay desktop-PC fee estimate plus median shipping from comparable listings"
  };
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
  const providerKeys={
    SERPER_API_KEY:body?.providerKeys?.SERPER_API_KEY||"",
    SEARCHAPI_API_KEY:body?.providerKeys?.SEARCHAPI_API_KEY||""
  };
  const resolved=resolveBuildParts(body);

  if(!resolved.cpu.item || !resolved.gpu.item){
    const componentCompTotal=Object.values(values).reduce((sum,x)=>sum+Number(x.sampleSize||0),0);
  const completeCompCount=Number(completePc?.sampleSize||0);
  const salesCount=Number(salesEvidence.listingCount||0);
  const localCompCount=Number(localMarket?.sampleSize||0);
  const componentCoveragePct=Math.round(liveCount/Object.keys(values).length*100);

  let evidenceGrade="F";
  let scoreCap=45;
  let evidenceReason="Very limited live evidence; treat the result as a rough screening estimate only.";
  if(salesCount>=6 && completeCompCount>=10 && liveCount>=4){
    evidenceGrade="A";scoreCap=95;evidenceReason="Strong sales-backed evidence, complete-PC comps, and live component coverage.";
  }else if((salesCount>=2 && completeCompCount>=6) || (completeCompCount>=15 && liveCount>=4)){
    evidenceGrade="B";scoreCap=88;evidenceReason="Good real-market coverage with multiple complete-PC comps and live component support.";
  }else if(completeCompCount>=4 && liveCount>=2){
    evidenceGrade="C";scoreCap=75;evidenceReason="Usable live evidence, but not enough depth for a high-confidence premium score.";
  }else if(liveCount>=2 || completeCompCount>=2 || salesCount>=1){
    evidenceGrade="D";scoreCap=60;evidenceReason="Thin market evidence; use the number to negotiate, not as a guaranteed resale price.";
  }

  const evidence={
    observedAt:new Date().toISOString(),
    grade:evidenceGrade,
    scoreCap,
    reason:evidenceReason,
    liveComponentCount:liveCount,
    componentCount:Object.keys(values).length,
    componentCoveragePct,
    componentCompTotal,
    completePcCompCount:completeCompCount,
    salesBackedListingCount:salesCount,
    reportedUnitsSold:Number(salesEvidence.totalReportedUnitsSold||0),
    localCompCount,
    localRequested:Boolean(canonicalBody.postalCode),
    hasSalesBackedEvidence:Boolean(salesBackedAvailable),
    onlineMethod,
    localMethod:localMarket?.method||null,
    fallbackComponents:Object.entries(values).filter(([,x])=>!x.live).map(([name])=>name)
  };

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
    gpu:baseInput(canonicalBody.gpu,"GPU","used",{componentEstimate:true,providerKeys}),
    cpu:baseInput(canonicalBody.cpu,"CPU","used",{componentEstimate:true,providerKeys}),
    storage:baseInput(canonicalBody.storage,"SSD / NVMe","new",{componentEstimate:true,providerKeys}),
    ram:baseInput(canonicalBody.ram,"RAM","new",{componentEstimate:true,providerKeys}),
    motherboard:baseInput(canonicalBody.motherboard,"Motherboard","used",{componentEstimate:true,providerKeys}),
    psu:baseInput(canonicalBody.psu,"PSU","new",{componentEstimate:true,providerKeys}),
    caseType:baseInput(canonicalBody.caseType,"Case","new",{componentEstimate:true,providerKeys}),
    cooler:baseInput(canonicalBody.cooler,canonicalBody.cooler?.includes("AIO")?"AIO Cooler":"CPU Cooler","new",{componentEstimate:true,providerKeys}),
    completePc:baseInput(completePcQuery(canonicalBody,resolved),"Complete PC","used",{providerKeys})
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

  const componentTotal=Object.values(values).reduce((sum,x)=>sum+Number(x.value||0),0);
  const gpu=findByName(GPUS,canonicalBody.gpu);
  const cpu=findByName(CPUS,canonicalBody.cpu);
  const pcCase=findByName(CASE_OPTIONS,canonicalBody.caseType);
  const appeal=((gpu?.appeal||5)+(cpu?.appeal||5)+(pcCase?.appeal||5))/3;
  const presentationPremium=appeal>=9?40:appeal>=8?25:appeal>=6?10:0;
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

  const onlineCosts=onlineSellingCosts(onlineLikely,data.completePc?.items||[]);

  const localData=canonicalBody.postalCode
    ? await searchLocalEbay(baseInput(completePcQuery(canonicalBody,resolved),"Complete PC","used",{
        postalCode:String(canonicalBody.postalCode),
        distanceRadius:Number(canonicalBody.distanceRadius||50),
        providerKeys
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

  const liveCount=Object.values(values).filter(x=>x.live).length;
  const componentCoverage=liveCount/Object.keys(values).length;

  let blendedBase;
  let blendMethod;
  if(salesBackedAvailable){
    const componentWeight=componentCoverage>=.5?.25:.10;
    blendedBase=Math.round(componentBased*componentWeight + onlineLikely*(1-componentWeight));
    blendMethod=Math.round(componentWeight*100)+"% component model + "+Math.round((1-componentWeight)*100)+"% sales-backed complete-PC evidence";
  }else if(completePc){
    const componentWeight=componentCoverage>=.5?.40:.20;
    blendedBase=Math.round(componentBased*componentWeight + completePc.median*(1-componentWeight));
    blendMethod=Math.round(componentWeight*100)+"% component model + "+Math.round((1-componentWeight)*100)+"% complete-PC asking comps";
  }else{
    blendedBase=Math.round(componentBased);
    blendMethod=liveCount>=4?"Live-component market model":"Fallback-heavy component model";
  }

  const uncertainty=salesBackedAvailable
    ? (salesEvidence.listingCount>=6?.06:.09)
    : completePc
      ? (completePc.sampleSize>=15?.09:.12)
      : liveCount>=4?.14:.20;
  const low=Math.max(0,Math.round(blendedBase*(1-uncertainty)));
  const high=Math.round(blendedBase*(1+uncertainty));

  return res.status(200).json({
    available:Boolean(
      Object.values(values).some(x=>x.live) ||
      completePc ||
      salesBackedAvailable ||
      localMarket
    ),
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
        confidence:salesBackedAvailable?salesEvidence.confidence:completePc?.confidence||"Model",
        costs:onlineCosts
      },
      local:localMarket
    },
    salesEvidence:salesEvidencePublicShape(salesEvidence),
    evidence,
    components:values,
    completePc,
    meta:{
      liveComponentCount:liveCount,
      componentCount:Object.keys(values).length,
      evidenceGrade,
      scoreCap,
      componentBased:Math.round(componentBased),
      snapshot:MARKET_SNAPSHOT,
      method:blendMethod
    }
  });
}
