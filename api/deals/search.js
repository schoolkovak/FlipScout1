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
    sortBy:req.body?.sortBy||"best",
    deepScan:Boolean(req.body?.deepScan),
    providerKeys:{
      SERPER_API_KEY:req.body?.providerKeys?.SERPER_API_KEY||"",
      SEARCHAPI_API_KEY:req.body?.providerKeys?.SEARCHAPI_API_KEY||""
    }
  };
  if (!input.query) return res.status(400).json({available:false,message:"Enter a part or model to search."});

  const connected=providerStatus(input.providerKeys).some(x=>x.status==="Connected");
  if (!connected) {
    return res.status(200).json({
      available:false,
      message:"No live market provider is connected yet. The easiest free starter is Serper (2,500 free queries); SearchAPI is the best optional direct-source backup for eBay, Walmart and Best Buy.",
      sources:providerStatus(input.providerKeys)
    });
  }

  const result=await liveSearch(input);
  if (!result.market.sampleSize) {
    return res.status(200).json({
      available:false,
      message:"Providers responded, but FlipScout could not find enough relevant comparable listings for this search.",
      errors:result.errors,
      sources:providerStatus(input.providerKeys)
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
    sources:providerStatus(input.providerKeys)
  });
}
