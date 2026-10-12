import { searchPartsSniper, providerStatus } from "../_lib/market.js";
import { SNIPER_CATEGORIES, SNIPER_CONDITIONS, SNIPER_MARKETPLACES } from "../../shared/sniper.js";

const categoryNames=new Set(SNIPER_CATEGORIES.map(x=>x.name));
const conditionNames=new Set(SNIPER_CONDITIONS.map(x=>x.value));
const marketplaceIds=new Set(SNIPER_MARKETPLACES.map(x=>x.id));

function cleanTarget(raw,index){
  const category=categoryNames.has(raw?.category)?raw.category:"GPU";
  const query=String(raw?.query||"").trim().slice(0,160);
  const condition=conditionNames.has(raw?.condition)?raw.condition:"any";
  const maxPrice=Math.max(0,Math.min(100000,Number(raw?.maxPrice||0)||0));
  const buildBudget=Math.max(0,Math.min(250000,Number(raw?.buildBudget||0)||0));
  const committed=Math.max(0,Math.min(250000,Number(raw?.committed||0)||0));
  return {id:String(raw?.id||index),category,query,condition,maxPrice,buildBudget,committed};
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});

  const rawTargets=Array.isArray(req.body?.targets)?req.body.targets:[];
  if(!rawTargets.length)return res.status(400).json({available:false,message:"Add at least one target."});
  if(rawTargets.length>5)return res.status(400).json({available:false,message:"Deal Hunt supports up to five targets per scan."});

  const targets=rawTargets.map(cleanTarget);
  const invalid=targets.find(x=>!x.query);
  if(invalid)return res.status(400).json({available:false,message:"Every target needs a model, part, or requirement."});

  const marketplaces=[...new Set((Array.isArray(req.body?.marketplaces)?req.body.marketplaces:[])
    .filter(x=>marketplaceIds.has(x)))];
  if(!marketplaces.length)return res.status(400).json({available:false,message:"Choose at least one marketplace."});

  const providerKeys={
    SERPER_API_KEY:req.body?.providerKeys?.SERPER_API_KEY||"",
    SEARCHAPI_API_KEY:req.body?.providerKeys?.SEARCHAPI_API_KEY||""
  };
  const connected=providerStatus(providerKeys).some(x=>x.status==="Connected");
  if(!connected){
    return res.status(200).json({
      available:false,
      message:"Live marketplace providers are not connected yet.",
      sources:providerStatus(providerKeys)
    });
  }

  const deepScan=Boolean(req.body?.deepScan);
  const results=await Promise.all(targets.map(async target=>{
    const searchInput={
      query:target.query,
      category:target.category,
      condition:target.condition,
      partBudget:target.maxPrice,
      buildBudget:target.buildBudget,
      committed:target.committed,
      sortBy:"best",
      deepScan,
      marketplaces,
      providerKeys
    };
    try{
      const data=await searchPartsSniper(searchInput);
      const affordable=data.ranked.filter(x=>!target.maxPrice || x.totalPrice<=target.maxPrice);
      const best=(affordable[0]||data.ranked[0]||null);
      return {
        id:target.id,
        target,
        available:data.market.sampleSize>0,
        searchedAt:data.observedAt,
        cached:data.cached,
        market:{
          median:data.market.median,
          low:data.market.low,
          high:data.market.high,
          sampleSize:data.market.sampleSize,
          rawSampleSize:data.market.rawSampleSize,
          byCondition:data.market.byCondition,
          bySource:data.market.bySource,
          shippingKnownPct:data.market.shippingKnownPct,
          confidence:data.market.confidence
        },
        bestDeal:best,
        results:data.ranked.slice(0,40),
        errors:data.errors
      };
    }catch(error){
      return {
        id:target.id,
        target,
        available:false,
        market:{sampleSize:0},
        results:[],
        errors:[{provider:"Deal Hunt",message:String(error?.message||error).slice(0,180)}]
      };
    }
  }));

  const successful=results.filter(x=>x.available).length;
  res.status(200).json({
    available:successful>0,
    searchedAt:new Date().toISOString(),
    marketplaces,
    deepScan,
    targetCount:targets.length,
    successfulTargets:successful,
    results,
    sources:providerStatus(providerKeys)
  });
}
