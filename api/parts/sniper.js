import { searchPartsSniper, providerStatus } from "../_lib/market.js";
import { SNIPER_CATEGORIES, SNIPER_CONDITIONS, SNIPER_MARKETPLACES, allowsUsed } from "../../shared/sniper.js";
import { sortDeals } from "../../shared/dealSort.js";
import { findCatalogModel } from "../../shared/partCatalog.js";
import { readSnapshot, modelPath, ageHours } from "../_lib/snapshots.js";
import { filterByCondition } from "../_lib/summary.js";
import { buildMarket, rankDeals, checkEbayAvailability } from "../_lib/market.js";

// Credit savers: a target that matches a catalog model saved in the last
// SAVED_MAX_AGE_H hours is answered from the saved listings (0 credits).
// Live targets get TARGET_BUDGET_MS each; a slow one returns a clear
// message instead of holding up (or timing out) the whole hunt.
const SAVED_MAX_AGE_H=24;
const TARGET_BUDGET_MS=45000;

async function fromSaved(target,marketplaces){
  const hit=findCatalogModel(target.query);
  if(!hit)return null;
  const snap=await readSnapshot(modelPath(hit.item.name));
  if(!snap?.results?.length||ageHours(snap.searchedAt)>SAVED_MAX_AGE_H)return null;
  const items=(await checkEbayAvailability(filterByCondition(snap.results,target.condition).filter(x=>marketplaces.includes(x.marketplace)))).items;
  if(!items.length)return null;
  const market=buildMarket(items);
  const ranked=rankDeals(items,market,{query:target.query,partBudget:target.maxPrice,buildBudget:target.buildBudget,committed:target.committed,sortBy:"lowest",msrp:hit.item.msrp||0});
  return {ranked,market,observedAt:snap.searchedAt,cached:true,errors:[],
    providers:[{name:"Saved listings (updated "+Math.max(1,Math.round(ageHours(snap.searchedAt)))+"h ago)",status:"ok",raw:items.length,kept:ranked.length,dropped:{}}],
    coverage:snap.coverage||[]};
}

function withBudget(promise,ms){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("This target took too long to search; try it again on its own.")),ms);})]).finally(()=>clearTimeout(timer));
}

const categoryNames=new Set(SNIPER_CATEGORIES.map(x=>x.name));
const conditionNames=new Set(SNIPER_CONDITIONS.map(x=>x.value));
const marketplaceIds=new Set(SNIPER_MARKETPLACES.map(x=>x.id));

function cleanTarget(raw,index){
  const category=categoryNames.has(raw?.category)?raw.category:"GPU";
  const query=String(raw?.query||"").trim().slice(0,160);
  const condition=!allowsUsed(category)?"new":conditionNames.has(raw?.condition)?raw.condition:"any";
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
      message:"No market data provider is configured. Add SERPER_API_KEY and/or SEARCHAPI_API_KEY to the server environment.",
      sources:providerStatus(providerKeys)
    });
  }

  const deepScan=true; // every scan is a full multi-source scan
  const results=await Promise.all(targets.map(async target=>{
    const searchInput={
      query:target.query,
      category:target.category,
      condition:target.condition,
      partBudget:target.maxPrice,
      buildBudget:target.buildBudget,
      committed:target.committed,
      sortBy:"lowest",
      deepScan,
      marketplaces,
      providerKeys
    };
    try{
      const data=await fromSaved(target,marketplaces)||await withBudget(searchPartsSniper(searchInput),TARGET_BUDGET_MS);
      const affordable=data.ranked.filter(x=>!target.maxPrice || x.totalPrice<=target.maxPrice);
      // Best match = highest Best Value score within the price cap.
      const best=sortDeals(affordable.length?affordable:data.ranked,"best")[0]||null;
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
          conditionMedians:data.market.conditionMedians,
          confidence:data.market.confidence
        },
        bestDeal:best,
        resultCount:data.ranked.length,
        results:data.ranked.slice(0,200),
        errors:data.errors,
        providers:data.providers,
        coverage:data.coverage
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
