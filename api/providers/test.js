import { searchSerperShopping, searchSearchApiEbay, searchApiAccount, providerStatus } from "../_lib/market.js";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST required"});
  const providerKeys={
    SERPER_API_KEY:req.body?.providerKeys?.SERPER_API_KEY||"",
    SEARCHAPI_API_KEY:req.body?.providerKeys?.SEARCHAPI_API_KEY||""
  };
  const status=Object.fromEntries(providerStatus(providerKeys).map(x=>[x.id,x.status==="Connected"]));

  const result={
    checkedAt:new Date().toISOString(),
    serper:{configured:status.serper,verified:false,resultCount:0},
    searchapi:{configured:status.searchapi,verified:false,resultCount:0,account:null}
  };

  const jobs=[];

  if(result.serper.configured){
    jobs.push(
      searchSerperShopping({query:"RTX 4060",category:"GPU",condition:"new",providerKeys}).then(items=>{
        result.serper.verified=items.length>0;
        result.serper.resultCount=items.length;
      }).catch(error=>{
        result.serper.error=String(error.message||error).slice(0,200);
      })
    );
  }

  if(result.searchapi.configured){
    jobs.push(
      searchSearchApiEbay({query:"RTX 4060",category:"GPU",condition:"used",providerKeys}).then(items=>{
        result.searchapi.verified=items.length>0;
        result.searchapi.resultCount=items.length;
      }).catch(error=>{
        result.searchapi.error=String(error.message||error).slice(0,200);
      })
    );
    // Remaining-credit check; does not consume a search.
    jobs.push(
      searchApiAccount({providerKeys}).then(account=>{
        const a=account?.account||account||{};
        result.searchapi.account={
          plan:a.current_plan||a.plan||null,
          monthlyAllowance:a.monthly_allowance??a.searches_per_month??null,
          remaining:a.remaining_credits??a.remaining_searches??a.searches_left??null,
          used:a.current_month_usage??a.this_month_usage??null
        };
      }).catch(error=>{
        result.searchapi.accountError=String(error.message||error).slice(0,200);
      })
    );
  }

  await Promise.all(jobs);
  return res.status(200).json(result);
}
