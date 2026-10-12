import { searchMarketplaces, providerStatus } from "../_lib/market.js";

const RESULT_LIMIT = 200;

export default async function handler(req,res) {
  if (req.method!=="POST") return res.status(405).json({error:"POST required"});
  const input={
    category:req.body?.category||"GPU",
    query:String(req.body?.query||"").trim().slice(0,160),
    condition:req.body?.condition||"any",
    partBudget:Number(req.body?.partBudget||0),
    buildBudget:Number(req.body?.buildBudget||0),
    committed:Number(req.body?.committed||0),
    sortBy:req.body?.sortBy||"lowest",
    deepScan:true,
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
      message:"No market data provider is configured. Add SERPER_API_KEY and/or SEARCHAPI_API_KEY to the server environment.",
      sources:providerStatus(input.providerKeys)
    });
  }

  // Deal Scanner searches every supported marketplace plus any other store
  // Google Shopping returns.
  const result=await searchMarketplaces(input,{includeOtherMerchants:true});
  if (!result.market.sampleSize) {
    const failed=result.providers.filter(p=>p.status!=="ok");
    return res.status(200).json({
      available:false,
      message:failed.length===result.providers.length&&failed.length
        ?"Every market data provider failed for this search: "+failed.map(p=>p.name+" — "+p.message).join("; ")
        :"Providers responded, but no listing matched this exact part and condition. See provider notes for what was filtered out.",
      errors:result.errors,
      providers:result.providers,
      coverage:result.coverage,
      sources:providerStatus(input.providerKeys)
    });
  }

  res.status(200).json({
    available:true,
    searchedAt:result.observedAt,
    cached:result.cached,
    stale:result.stale,
    market:{
      median:result.market.median,
      low:result.market.low,
      high:result.market.high,
      sampleSize:result.market.sampleSize,
      rawSampleSize:result.market.rawSampleSize,
      byCondition:result.market.byCondition,
      bySource:result.market.bySource,
      conditionMedians:result.market.conditionMedians,
      shippingKnownPct:result.market.shippingKnownPct,
      confidence:result.market.confidence,
      valueLabel:"Current asking-market value"
    },
    resultCount:result.ranked.length,
    results:result.ranked.slice(0,RESULT_LIMIT),
    errors:result.errors,
    providers:result.providers,
    coverage:result.coverage,
    sources:providerStatus(input.providerKeys)
  });
}
