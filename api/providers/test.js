import { searchSerperShopping, searchSearchApiEbay } from "../_lib/market.js";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST required"});
  const providerKeys={
    SERPER_API_KEY:req.body?.providerKeys?.SERPER_API_KEY||"",
    SEARCHAPI_API_KEY:req.body?.providerKeys?.SEARCHAPI_API_KEY||""
  };

  const result={
    checkedAt:new Date().toISOString(),
    serper:{configured:Boolean(providerKeys.SERPER_API_KEY),verified:false,resultCount:0},
    searchapi:{configured:Boolean(providerKeys.SEARCHAPI_API_KEY),verified:false,resultCount:0}
  };

  const jobs=[];

  if(providerKeys.SERPER_API_KEY){
    jobs.push(
      searchSerperShopping({
        query:"RTX 4060",
        category:"GPU",
        condition:"new",
        providerKeys
      }).then(items=>{
        result.serper.verified=items.length>0;
        result.serper.resultCount=items.length;
      }).catch(error=>{
        result.serper.error=String(error.message||error).slice(0,180);
      })
    );
  }

  if(providerKeys.SEARCHAPI_API_KEY){
    jobs.push(
      searchSearchApiEbay({
        query:"RTX 4060",
        category:"GPU",
        condition:"used",
        providerKeys
      }).then(items=>{
        result.searchapi.verified=items.length>0;
        result.searchapi.resultCount=items.length;
      }).catch(error=>{
        result.searchapi.error=String(error.message||error).slice(0,180);
      })
    );
  }

  await Promise.all(jobs);
  return res.status(200).json(result);
}
