import {searchPartsSniper,providerStatus} from "../_lib/market.js";
import {SNIPER_MARKETPLACES} from "../../shared/sniper.js";

export default async function handler(req,res) {
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});
  const query=String(req.body?.query||"").trim().slice(0,160);
  if(!query)return res.status(400).json({available:false,message:"Choose a part or model."});
  const minPrice=Math.max(0,Number(req.body?.minPartPrice)||0);
  const maxPrice=Math.max(0,Number(req.body?.partBudget)||0);
  if(maxPrice&&minPrice>maxPrice)return res.status(400).json({available:false,message:"Minimum price cannot exceed maximum price."});
  const providerKeys={
    SERPER_API_KEY:req.body?.providerKeys?.SERPER_API_KEY||"",
    SEARCHAPI_API_KEY:req.body?.providerKeys?.SEARCHAPI_API_KEY||""
  };
  if(!providerStatus(providerKeys).some(s=>s.status==="Connected")){
    return res.status(200).json({available:false,message:"Connect a search provider to scan live listings.",sources:providerStatus(providerKeys)});
  }
  const input={
    category:req.body?.category||"GPU",query,
    condition:req.body?.condition||"any",
    partBudget:maxPrice,sortBy:"best",
    deepScan:Boolean(req.body?.deepScan),
    marketplaces:SNIPER_MARKETPLACES.map(m=>m.id),providerKeys
  };
  const result=await searchPartsSniper(input);
  const filtered=result.ranked.filter(item=>item.totalPrice>=minPrice&&(!maxPrice||item.totalPrice<=maxPrice));
  return res.status(200).json({
    available:filtered.length>0,
    message:filtered.length?null:"No relevant listings within the chosen price range. Try expanding the range or enabling Deep Scan.",
    searchedAt:result.observedAt,cached:result.cached,stale:result.stale,
    market:{
      ...result.market,valueLabel:"Observed asking-market median"
    },
    results:filtered.slice(0,150),
    sourceCoverage:result.sourceCoverage||[],
    errors:result.errors||[],
    sources:providerStatus(providerKeys)
  });
}
