import { liveSearch, providerStatus } from "../_lib/market.js";

export default async function handler(req,res) {
  if (req.method!=="POST") return res.status(405).json({error:"POST required"});
  const input={
    category:req.body?.category||"GPU",
    query:String(req.body?.query||"").trim(),
    condition:req.body?.condition||"any",
    partBudget:Number(req.body?.partBudget||0),
    buildBudget:Number(req.body?.buildBudget||0),
    committed:Number(req.body?.committed||0),
    sortBy:req.body?.sortBy||"best"
  };
  if (!input.query) return res.status(400).json({available:false,message:"Enter a part or model to search."});

  const connected=providerStatus().some(x=>x.status==="Connected");
  if (!connected) {
    return res.status(200).json({
      available:false,
      message:"No live provider credentials are configured yet. Add SerpApi and/or approved eBay production credentials in the hosting environment.",
      sources:providerStatus()
    });
  }

  const result=await liveSearch(input);
  if (!result.market.sampleSize) {
    return res.status(200).json({
      available:false,
      message:"Providers responded, but FlipScout could not find enough relevant comparable listings for this search.",
      errors:result.errors,
      sources:providerStatus()
    });
  }

  res.status(200).json({
    available:true,
    searchedAt:new Date().toISOString(),
    market:{
      median:result.market.median,
      low:result.market.low,
      high:result.market.high,
      sampleSize:result.market.sampleSize,
      rawSampleSize:result.market.rawSampleSize,
      byCondition:result.market.byCondition,
      bySource:result.market.bySource,
      shippingKnownPct:result.market.shippingKnownPct,
      confidence:result.market.confidence,
      valueLabel:"Current asking-market value"
    },
    results:result.ranked.slice(0,75),
    errors:result.errors,
    sources:providerStatus()
  });
}
