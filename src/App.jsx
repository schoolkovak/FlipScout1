import React,{useEffect,useMemo,useState} from "react";
import {
  Search,Cpu,Gauge,ShoppingCart,ExternalLink,Database,AlertTriangle,RefreshCw,
  CheckCircle2,ShieldCheck,MapPin,TrendingUp,Bookmark,BookmarkCheck,Copy,
  Sparkles,History,Trash2,Target,WalletCards,BarChart3,Zap,Settings2,Trophy,
  ArrowRight,Save,Layers,SlidersHorizontal,Eye,ChevronDown,ChevronUp
} from "lucide-react";
import {fallbackPcEstimate} from "./valuation";
import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,
  CASE_OPTIONS,COOLER_OPTIONS,SCANNER_CATEGORIES,MARKET_SNAPSHOT
} from "../shared/catalog.js";
import {buildOpportunitySummary} from "./intelligence";
import {parseListingText} from "./listingParser";
import { track } from "@vercel/analytics";
import {
  getHistory,saveAnalysis,deleteAnalysis,clearHistory,
  getWatchlist,toggleWatchItem,getSavedSearches,saveSearch,deleteSavedSearch
} from "./storage";

function money(v){
  if(v===null||v===undefined||Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}
function pct(v){return Number.isFinite(Number(v))?Math.round(Number(v))+"%":"—";}
function Datalist({id,items}){return <datalist id={id}>{items.map(x=><option key={x.name} value={x.name}/>)}</datalist>;}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}

const EMPTY_KEYS={SERPER_API_KEY:"",SEARCHAPI_API_KEY:""};
function loadProviderKeys(){
  try{return {...EMPTY_KEYS,...JSON.parse(localStorage.getItem("flipscout-provider-keys")||"{}")};}
  catch{return {...EMPTY_KEYS};}
}
function statusTone(status){return status==="Connected"?"goodText":"mutedText";}

function TopNav({tab,setTab}){
  const items=[
    ["analyze","Analyze",Gauge],
    ["scan","Deal Scanner",Search],
    ["workspace","Workspace",Layers],
    ["pro","FlipScout Pro",Trophy]
  ];
  return <nav className="topNav">
    <div className="navBrand" onClick={()=>setTab("analyze")}><div className="logo">FS</div><div><b>FlipScout</b><span>PC flip intelligence</span></div></div>
    <div className="navTabs">{items.map(([id,label,Icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
    <div className="betaPill">BETA · PRO UNLOCKED</div>
  </nav>;
}

function Hero({tab,setTab}){
  return <section className="heroNew">
    <div className="heroCopy">
      <span className="eyebrow">BUILT FOR PC FLIPPERS</span>
      <h1>Know the <em>real margin</em> before you buy.</h1>
      <p>Validate the parts, compare live market evidence, estimate local vs. online resale, calculate selling costs, and get a negotiation number in one place.</p>
      <div className="heroActions">
        <button className="primary large" onClick={()=>setTab("analyze")}><Gauge size={18}/>Analyze a PC</button>
        <button className="secondary large" onClick={()=>setTab("scan")}><Search size={18}/>Find part deals</button>
      </div>
    </div>
    <div className="heroProof">
      <div><b>Real comps</b><span>Current listings, not AI guesses</span></div>
      <div><b>Sell strategy</b><span>Quick / likely / stretch pricing</span></div>
      <div><b>Profit by channel</b><span>Local, eBay, Jawa</span></div>
      <div><b>Bad-data guardrails</b><span>Fake and ambiguous parts rejected</span></div>
    </div>
  </section>;
}

function ProviderSetup({providerKeys,setProviderKeys}){
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(providerKeys);
  const [testing,setTesting]=useState(false);
  const [verification,setVerification]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("flipscout-provider-verification")||"null");}
    catch{return null;}
  });
  const configured=Boolean(providerKeys.SERPER_API_KEY||providerKeys.SEARCHAPI_API_KEY);
  const verified=Boolean(verification?.serper?.verified||verification?.searchapi?.verified);

  async function verify(clean){
    setTesting(true);
    try{
      const r=await fetch("/api/providers/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({providerKeys:clean})});
      const data=await r.json();
      setVerification(data);
      localStorage.setItem("flipscout-provider-verification",JSON.stringify(data));
    }catch{
      setVerification({error:"Could not reach provider verification."});
    }finally{setTesting(false);}
  }
  async function save(){
    const clean={
      SERPER_API_KEY:String(draft.SERPER_API_KEY||"").trim(),
      SEARCHAPI_API_KEY:String(draft.SEARCHAPI_API_KEY||"").trim()
    };
    localStorage.setItem("flipscout-provider-keys",JSON.stringify(clean));
    setProviderKeys(clean);
    await verify(clean);
  }
  function clear(){
    localStorage.removeItem("flipscout-provider-keys");
    localStorage.removeItem("flipscout-provider-verification");
    setDraft({...EMPTY_KEYS});setProviderKeys({...EMPTY_KEYS});setVerification(null);
  }

  return <div className="dataSetup">
    <button className="dataSetupToggle" onClick={()=>setOpen(!open)}>
      <span className={verified?"sourceDot live":"sourceDot"}></span>
      <span>{verified?"Live data verified":configured?"Market keys configured":"Data source settings"}</span>
      <Settings2 size={15}/>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
    </button>
    {open&&<div className="dataSetupBody">
      <p>Normal users never need their own keys once provider credentials are configured server-side. This local setup is an owner/development fallback.</p>
      <div className="keyGrid">
        <label>Serper API key<input type="password" value={draft.SERPER_API_KEY} onChange={e=>setDraft({...draft,SERPER_API_KEY:e.target.value})}/></label>
        <label>SearchAPI key<input type="password" value={draft.SEARCHAPI_API_KEY} onChange={e=>setDraft({...draft,SEARCHAPI_API_KEY:e.target.value})}/></label>
      </div>
      {verification&&<div className="verificationGrid">
        <div className={verification.serper?.verified?"verifyGood":"verifyBad"}><b>Serper</b><span>{verification.serper?.verified?"Verified · "+verification.serper.resultCount+" results":verification.serper?.configured?"Not verified":"Not configured"}</span></div>
        <div className={verification.searchapi?.verified?"verifyGood":"verifyBad"}><b>SearchAPI</b><span>{verification.searchapi?.verified?"Verified · "+verification.searchapi.resultCount+" results":verification.searchapi?.configured?"Not verified":"Not configured"}</span></div>
      </div>}
      <div className="rowActions"><button className="primary small" onClick={save} disabled={testing}>{testing?<><RefreshCw className="spin" size={15}/>Testing</>:<>Save & verify</>}</button>{configured&&<button className="ghost small" onClick={clear}>Clear</button>}</div>
    </div>}
  </div>;
}

function IdentityNotice({live,result}){
  const validation=live?.validation||result?.compatibility?.resolved;
  if(!validation)return null;
  return <div className="identityGrid">
    {[["CPU",validation.cpu],["GPU",validation.gpu]].map(([label,x])=><div className={"identityRow "+(x?.item?"identityGood":"identityBad")} key={label}>
      <b>{label}</b>
      {x?.item
        ? <span><CheckCircle2 size={15}/>{x.status==="fuzzy"?"Interpreted as ":"Recognized: "}<strong>{x.canonical}</strong></span>
        : <span><AlertTriangle size={15}/>{x?.status==="ambiguous"?"Exact variant required":"Unknown part"}<small>{x?.suggestions?.length?(x.status==="ambiguous"?"Choose: ":"Try: ")+x.suggestions.join(", "):x?.input}</small></span>}
    </div>)}
  </div>;
}

function ScoreRing({value}){
  return <div className="scoreRing" style={{"--score":Math.max(0,Math.min(100,Number(value||0)))+"%"}}><div><strong>{value}</strong><span>/100</span></div></div>;
}

function VerdictHero({summary,result,live}){
  if(!summary)return null;
  return <div className={"verdictHero "+summary.verdict.tone}>
    <div className="verdictLeft">
      <span className="eyebrow">FLIPSCOUT VERDICT</span>
      <div className="verdictTitle">{summary.verdict.label}</div>
      <p>{summary.verdict.reason}</p>
      <div className="verdictBadges">
        <span><Zap size={14}/>{summary.tier.label}</span>
        <span><Eye size={14}/>Buyer appeal {summary.appeal}/100</span>
        <span><TrendingUp size={14}/>Liquidity {summary.liquidity}/100</span>
        <span><Database size={14}/>{live?.resale?.online?.salesBacked?"Sales-backed evidence":"Market-model evidence"}</span>
      </div>
    </div>
    <ScoreRing value={result.score}/>
  </div>;
}

function ScoreBreakdown({summary}){
  const b=summary?.scoreBreakdown;
  if(!b)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">WHY THIS SCORE?</span><h3>Transparent deal-quality breakdown</h3></div><BarChart3/></div>
    <div className="scoreFactorGrid">{b.factors.map(x=><div className="scoreFactor" key={x.name}>
      <div className="scoreFactorHead"><span>{x.name}</span><b>{x.score}/100</b><em>{x.weight}</em></div>
      <div className="factorBar"><i style={{width:Math.max(2,x.score)+"%"}}></i></div>
    </div>)}</div>
    <div className="riskStrip">{b.risks.length?b.risks.map((x,i)=><span key={i}><AlertTriangle size={13}/>{x}</span>):<span className="riskGood"><CheckCircle2 size={13}/>No major model risk flags</span>}</div>
  </section>;
}

function StrategyStrip({summary}){
  if(!summary?.saleStrategy)return null;
  const s=summary.saleStrategy;
  return <div className="strategyStrip">
    <div><span>Quick sale</span><b>{money(s.quick)}</b><small>Price to move</small></div>
    <div className="featured"><span>Likely sale</span><b>{money(s.likely)}</b><small>Best balance</small></div>
    <div><span>Stretch ask</span><b>{money(s.stretch)}</b><small>Leave room to negotiate</small></div>
    <div><span>Negotiation floor</span><b>{money(s.negotiationFloor)}</b><small>Don't casually go below</small></div>
  </div>;
}

function ChannelProfit({summary}){
  if(!summary)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">CHANNEL ECONOMICS</span><h3>Where should you sell it?</h3></div><WalletCards/></div>
    <div className="channelGrid">
      {Object.entries(summary.channels).map(([key,x])=><div className={"channelCard "+(summary.best?.channel===x.channel?"winner":"")} key={key}>
        {summary.best?.channel===x.channel&&<span className="bestBadge">BEST PROJECTED NET</span>}
        <b>{x.channel}</b>
        <strong className={x.profit>=0?"goodText":"badText"}>{money(x.profit)} profit</strong>
        <div className="miniStats"><span>Sale {money(x.salePrice)}</span><span>Fees {money(x.fee)}</span><span>Ship {money(x.shipping)}</span><span>ROI {pct(x.roi)}</span></div>
        <small>{x.note}</small>
      </div>)}
    </div>
  </section>;
}

function BuyTargets({summary}){
  if(!summary?.buyTargets)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">BUY DISCIPLINE</span><h3>What should you actually pay?</h3></div><Target/></div>
    <div className="buyTargets">
      <div><span>15% ROI target</span><b>{money(summary.buyTargets.target15)}</b></div>
      <div className="featured"><span>20% ROI target</span><b>{money(summary.buyTargets.target20)}</b></div>
      <div><span>25% ROI target</span><b>{money(summary.buyTargets.target25)}</b></div>
      <div><span>30% ROI target</span><b>{money(summary.buyTargets.target30)}</b></div>
    </div>
    {summary.negotiation&&<div className="negotiationBox">
      <div><span>Open at</span><b>{money(summary.negotiation.opening)}</b></div>
      <div><span>Try to land at</span><b>{money(summary.negotiation.target)}</b></div>
      <div><span>Walk away above</span><b>{money(summary.negotiation.walkAway)}</b></div>
      <button className="copyButton" onClick={()=>copyText(summary.negotiation.script)}><Copy size={14}/>Copy offer message</button>
      <p>{summary.negotiation.script}</p>
    </div>}
  </section>;
}

function UpgradeIdeas({summary}){
  if(!summary?.upgrades?.length)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">VALUE-ADD IDEAS</span><h3>Cheap upgrades that may improve the flip</h3></div><Sparkles/></div>
    <div className="upgradeGrid">{summary.upgrades.map((x,i)=><div className="upgradeCard" key={i}>
      <b>{x.title}</b><p>{x.reason}</p>
      <div className="upgradeMath"><span>Est. cost {money(x.cost)}</span><span>Est. resale lift {money(x.resaleLift)}</span><strong>Net lift +{money(x.estimatedNetLift)}</strong></div>
      <small>Heuristic opportunity — verify the upgrade cost and local buyer demand before spending.</small>
    </div>)}</div>
  </section>;
}

function ListingStudio({summary,input}){
  const [copied,setCopied]=useState("");
  if(!summary?.listing)return null;
  const l=summary.listing;
  async function doCopy(kind,text){if(await copyText(text)){setCopied(kind);setTimeout(()=>setCopied(""),1200);}}
  return <section className="resultSection listingStudio">
    <div className="sectionHeading"><div><span className="eyebrow">LISTING STUDIO</span><h3>Turn the analysis into a better listing</h3></div><Sparkles/></div>
    <div className="listingField"><div><span>Suggested title</span><b>{l.title}</b></div><button onClick={()=>doCopy("title",l.title)}><Copy size={14}/>{copied==="title"?"Copied":"Copy"}</button></div>
    <div className="listingColumns">
      <div><span className="fieldLabel">Buyer-facing bullets</span><ul>{l.bullets.map((x,i)=><li key={i}>{x}</li>)}</ul><button className="copyButton" onClick={()=>doCopy("bullets",l.bullets.map(x=>"• "+x).join("\n"))}><Copy size={14}/>Copy bullets</button></div>
      <div><span className="fieldLabel">Description starter</span><p>{l.description}</p><button className="copyButton" onClick={()=>doCopy("description",l.description)}><Copy size={14}/>Copy description</button></div>
    </div>
    <div className="sellerChecklist"><b>Before listing</b><span>✓ Clean dust & fingerprints</span><span>✓ Show Task Manager / specs</span><span>✓ Include benchmark screenshot</span><span>✓ Show temps under load</span><span>✓ Photograph ports & internals</span><span>✓ State Windows activation / Wi-Fi clearly</span></div>
  </section>;
}

function SalesEvidence({evidence}){
  if(!evidence)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">EVIDENCE</span><h3>What is the market signal based on?</h3></div><Database/></div>
    {!evidence.listingCount
      ? <div className="emptyEvidence"><AlertTriangle size={17}/><div><b>No sales-backed listings found for this exact combination.</b><p>FlipScout will not pretend active asking prices are completed sales.</p></div></div>
      : <><div className="evidenceSummary"><div><span>Sales-backed median</span><b>{money(evidence.median)}</b></div><div><span>Qualifying listings</span><b>{evidence.listingCount}</b></div><div><span>Reported units sold</span><b>{evidence.totalReportedUnitsSold}</b></div><div><span>Confidence</span><b>{evidence.confidence}</b></div></div>
        <div className="evidenceList">{(evidence.listings||[]).slice(0,6).map((x,i)=><div className="evidenceItem" key={i}><div><b>{x.title}</b><small>{x.soldCount} reported sold · {x.condition||"unknown condition"}</small></div><strong>{money(x.price)}</strong>{x.url&&<a href={x.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a>}</div>)}</div>
        <p className="finePrint">“Sales-backed” means an active listing publicly reports prior units sold. It is not the same as a historical completed-sale record.</p></>}
  </section>;
}

function Compatibility({result}){
  if(!result)return null;
  const positives=result.compatibility?.positives||[];
  const warnings=result.compatibility?.warnings||[];
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">BUILD CHECK</span><h3>Compatibility & buyer-readiness</h3></div><ShieldCheck/></div>
    <div className="checkGrid">
      <div>{positives.map((x,i)=><p className="positiveLine" key={i}><CheckCircle2 size={15}/>{x}</p>)}{!positives.length&&<p className="mutedText">No positive checks available.</p>}</div>
      <div>{warnings.map((x,i)=><p className="warningLine" key={i}><AlertTriangle size={15}/>{x}</p>)}{!warnings.length&&<p className="positiveLine"><CheckCircle2 size={15}/>No obvious compatibility problems detected.</p>}</div>
    </div>
  </section>;
}

function Analyze({providerKeys,onSaved}){
  const [form,setForm]=useState({
    price:950,cpu:"Ryzen 5 5600X",gpu:"RTX 4060",ram:"16GB DDR4-3600 (2x8GB)",
    storage:"1TB NVMe SSD",motherboard:"B550 AM4 Motherboard",psu:"650W 80+ Gold PSU",
    caseType:"Midrange Tempered Glass RGB Case",cooler:"Basic Tower Air Cooler",
    postalCode:"",distanceRadius:50,purpose:"flip"
  });
  const [result,setResult]=useState(null);
  const [live,setLive]=useState(null);
  const [summary,setSummary]=useState(null);
  const [pasteOpen,setPasteOpen]=useState(false);
  const [listingText,setListingText]=useState("");
  const [parseResult,setParseResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [saved,setSaved]=useState(false);
  const update=(key,value)=>setForm(v=>({...v,[key]:value}));

  function parseListing(){
    const parsed=parseListingText(listingText);
    setParseResult(parsed);
    setForm(v=>({
      ...v,
      ...(parsed.price!=null?{price:parsed.price}:{}),
      ...(parsed.cpu?{cpu:parsed.cpu}:{}),
      ...(parsed.gpu?{gpu:parsed.gpu}:{}),
      ...(parsed.ram?{ram:parsed.ram}:{}),
      ...(parsed.storage?{storage:parsed.storage}:{}),
      ...(parsed.motherboard?{motherboard:parsed.motherboard}:{}),
      ...(parsed.psu?{psu:parsed.psu}:{}),
      ...(parsed.cooler?{cooler:parsed.cooler}:{}),
      ...(parsed.caseType?{caseType:parsed.caseType}:{})
    }));
  }

  async function analyze(){
    track("analyze_pc",{gpu:form.gpu,cpu:form.cpu,hasZip:Boolean(form.postalCode)});
    const input={...form,providerKeys};
    const fallback=fallbackPcEstimate(input);
    setResult(fallback);setLive(null);setSummary(null);setLoading(true);setSaved(false);
    try{
      const r=await fetch("/api/market/pc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      const d=await r.json();
      setLive(d);
      if(d.valid===false){
        const invalid={...fallback,score:0,identityValid:false};
        setResult(invalid);
        return;
      }
      let finalResult=fallback;
      if(d.available){
        const resale=d.resale?.online?.likely||d.market.median;
        const sellingCosts=d.resale?.online?.costs?.estimatedTotal??Math.round(resale*.0735+.40);
        const profit=resale-Number(form.price||0)-sellingCosts;
        const targetProfit=Math.max(120,Math.round(resale*.15));
        const maxBuy=Math.max(0,resale-sellingCosts-targetProfit);
        const discount=resale?(resale-Number(form.price||0))/resale:0;
        const warningPenalty=(fallback.compatibility?.warnings?.length||0)*12;
        const evidenceBoost=d.resale?.online?.salesBacked?7:0;
        const score=Math.max(0,Math.min(100,Math.round(54+discount*92-warningPenalty+evidenceBoost)));
        finalResult={...fallback,low:d.market.low,high:d.market.high,resale,sellingCosts,profit,maxBuy,score,identityValid:true};
      }
      setResult(finalResult);
      setSummary(buildOpportunitySummary(form,finalResult,d));
    }catch{
      setLive({available:false,valid:fallback.identityValid,message:"Live market service unavailable; fallback shown."});
      setSummary(buildOpportunitySummary(form,fallback,null));
    }finally{setLoading(false);}
  }

  function saveCurrent(){
    if(!result||!summary)return;
    track("save_analysis",{verdict:summary.verdict?.label||"unknown",score:Number(result.score||0)});
    saveAnalysis({input:form,result,live,summary,label:form.gpu+" + "+form.cpu});
    setSaved(true);onSaved?.();
  }

  return <div className="pageStack">
    <section className="panel analyzerPanel">
      <div className="sectionHeading">
        <div><span className="eyebrow">DEAL ANALYZER</span><h2>Would you actually make money on this PC?</h2><p>Enter the build. FlipScout validates it before calculating the deal.</p></div>
        <SlidersHorizontal/>
      </div>
      <Datalist id="cpu-options" items={CPUS}/><Datalist id="gpu-options" items={GPUS}/>
      <div className="pasteListing">
        <button className="pasteToggle" onClick={()=>setPasteOpen(!pasteOpen)}><Sparkles size={16}/><span><b>Paste a listing instead</b><small>Auto-detect specs from messy Marketplace/eBay text</small></span>{pasteOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
        {pasteOpen&&<div className="pasteBody">
          <textarea value={listingText} onChange={e=>setListingText(e.target.value)} placeholder="Example: $850 gaming PC, Ryzen 5 5600X, RTX 4060, 16GB DDR4, 1TB NVMe, B550, 650W PSU..."/>
          <div className="rowActions"><button className="primary small" onClick={parseListing} disabled={!listingText.trim()}><Sparkles size={15}/>Auto-fill specs</button>{parseResult&&<span className="parseConfidence">Detected {parseResult.confidence}% of fields{parseResult.notes?.length?" · "+parseResult.notes.join(" · "):""}</span>}</div>
        </div>}
      </div>
      <div className="formGrid">
        <label>Purchase / asking price<input type="number" value={form.price} onChange={e=>update("price",e.target.value)}/></label>
        <label>CPU<input list="cpu-options" value={form.cpu} onChange={e=>update("cpu",e.target.value)} placeholder="Ryzen5-5600X"/></label>
        <label>GPU<input list="gpu-options" value={form.gpu} onChange={e=>update("gpu",e.target.value)} placeholder="RTX5070-Ti"/></label>
        <label>RAM<select value={form.ram} onChange={e=>update("ram",e.target.value)}>{RAM_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Storage<select value={form.storage} onChange={e=>update("storage",e.target.value)}>{STORAGE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Motherboard<select value={form.motherboard} onChange={e=>update("motherboard",e.target.value)}>{MOTHERBOARDS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Power supply<select value={form.psu} onChange={e=>update("psu",e.target.value)}>{PSU_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Case<select value={form.caseType} onChange={e=>update("caseType",e.target.value)}>{CASE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>CPU cooler<select value={form.cooler} onChange={e=>update("cooler",e.target.value)}>{COOLER_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>ZIP for local comps<input inputMode="numeric" maxLength={5} value={form.postalCode} onChange={e=>update("postalCode",e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="Optional"/></label>
        <label>Local radius<select value={form.distanceRadius} onChange={e=>update("distanceRadius",Number(e.target.value))}><option value={25}>25 miles</option><option value={50}>50 miles</option><option value={100}>100 miles</option></select></label>
        <label>Goal<select value={form.purpose} onChange={e=>update("purpose",e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
      </div>
      <div className="analyzeActions">
        <button className="primary large" onClick={analyze} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Building real-market case...</>:<><Gauge size={18}/>Analyze this deal</>}</button>
        <span>Fake or ambiguous parts are rejected instead of guessed.</span>
      </div>
      {(result||live)&&<IdentityNotice live={live} result={result}/>}
    </section>

    {result?.identityValid!==false&&summary&&<>
      <VerdictHero summary={summary} result={result} live={live}/>
      <ScoreBreakdown summary={summary}/>
      <StrategyStrip summary={summary}/>
      <div className="saveBar"><div><b>{form.gpu} + {form.cpu}</b><span>{money(form.price)} acquisition · {summary.verdict.label}</span></div><button className={saved?"secondary":"primary"} onClick={saveCurrent}>{saved?<><CheckCircle2 size={16}/>Saved</>:<><Save size={16}/>Save to workspace</>}</button></div>
      <ChannelProfit summary={summary}/>
      <BuyTargets summary={summary}/>
      <UpgradeIdeas summary={summary}/>
      <ListingStudio summary={summary} input={form}/>
      <SalesEvidence evidence={live?.salesEvidence}/>
      <Compatibility result={result}/>
    </>}
  </div>;
}

function DealScanner({providerKeys,onWatchChange,onSearchSaved}){
  const [category,setCategory]=useState("GPU");
  const [query,setQuery]=useState("RTX 5070");
  const [condition,setCondition]=useState("any");
  const [partBudget,setPartBudget]=useState(600);
  const [buildBudget,setBuildBudget]=useState(1100);
  const [committed,setCommitted]=useState(350);
  const [sortBy,setSortBy]=useState("best");
  const [deepScan,setDeepScan]=useState(false);
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [watched,setWatched]=useState(()=>getWatchlist());

  function changeCategory(value){
    setCategory(value);
    setQuery(SCANNER_CATEGORIES.find(x=>x.name===value)?.example||"");
  }
  async function scan(){
    track("scan_parts",{category,condition,deepScan});
    setLoading(true);setData(null);
    try{
      const r=await fetch("/api/deals/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed,sortBy,deepScan,providerKeys})});
      setData(await r.json());
    }catch{setData({available:false,message:"Live search backend is unavailable."});}
    finally{setLoading(false);}
  }
  function toggle(item){
    track("toggle_watch",{category,source:item.source||"unknown"});
    const out=toggleWatchItem({...item,category,query});
    setWatched(out.items);onWatchChange?.();
  }
  function watchedNow(item){
    const key=item.url||item.id||item.title;
    return watched.some(x=>(x.url||x.id||x.title)===key);
  }
  function saveThisSearch(){
    track("save_search",{category,condition,deepScan});
    saveSearch({category,query,condition,partBudget,buildBudget,committed,sortBy,deepScan});
    onSearchSaved?.();
  }

  return <div className="pageStack">
    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">DEAL SCANNER</span><h2>Find underpriced parts before other flippers do.</h2><p>Rank by delivered cost, market discount, flip appeal, and how the part fits the rest of your budget.</p></div><ShoppingCart/></div>
      <div className="formGrid">
        <label>Part type<select value={category} onChange={e=>changeCategory(e.target.value)}>{SCANNER_CATEGORIES.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Part / requirement<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="any">Any</option><option value="new">New</option><option value="used">Used</option><option value="open-box">Open box</option></select></label>
        <label>Max part budget<input type="number" value={partBudget} onChange={e=>setPartBudget(e.target.value)}/></label>
        <label>Total build budget<input type="number" value={buildBudget} onChange={e=>setBuildBudget(e.target.value)}/></label>
        <label>Already committed<input type="number" value={committed} onChange={e=>setCommitted(e.target.value)}/></label>
        <label>Rank by<select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="best">Best Deal</option><option value="lowest">Lowest Price</option><option value="under">Most Under Market</option><option value="flip">Best for Flip</option><option value="budget">Best Fit for Budget</option></select></label>
      </div>
      <label className="toggleLine"><input type="checkbox" checked={deepScan} onChange={e=>setDeepScan(e.target.checked)}/><span><b>Deep multi-source scan</b><small>Uses additional direct retailer/marketplace sources when configured.</small></span></label>
      <div className="rowActions"><button className="primary large" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Scanning market...</>:<><Search size={18}/>Find live deals</>}</button><button className="secondary" onClick={saveThisSearch}><Bookmark size={16}/>Save search</button></div>
    </section>

    {data&&!data.available&&<div className="notice"><AlertTriangle size={20}/><div><b>Live provider data unavailable</b><p>{data.message}</p></div></div>}
    {data?.available&&<>
      <div className="marketHeadline">
        <div><span>{data.market.valueLabel}</span><strong>{money(data.market.median)}</strong><small>{money(data.market.low)}–{money(data.market.high)} trimmed range</small></div>
        <div><span>Relevant comps</span><strong>{data.market.sampleSize}</strong><small>{data.market.rawSampleSize} raw listings checked</small></div>
        <div><span>Confidence</span><strong>{data.market.confidence}</strong><small>{data.market.shippingKnownPct}% with known shipping</small></div>
      </div>
      <div className="dealList">{(data.results||[]).map((x,i)=><article className="dealCard" key={x.id||i}>
        <div className="dealTop"><div><div className="dealBadges"><span className="source">{x.source}</span>{x.soldCount>0&&<span className="soldChip">{x.soldCount}+ sold</span>}</div><h3>{x.title}</h3></div><div className="dealScore">{x.score}</div></div>
        <div className="dealPriceRow"><strong>{x.shippingKnown?money(x.totalPrice):money(x.itemPrice)}</strong><span>{x.shippingKnown?"delivered":"shipping unknown"}</span></div>
        <div className="dealMeta"><span>{x.condition}</span><span className={x.percentVsMarket>=10?"goodText":x.percentVsMarket<0?"badText":""}>{x.percentVsMarket>=0?x.percentVsMarket+"% under market":Math.abs(x.percentVsMarket)+"% over market"}</span><span>Build left {money(x.budgetLeft)}</span><span>{x.withinPartBudget?"Fits part budget":"Over part budget"}</span></div>
        <div className="dealActions">{x.url&&<a className="listingLink" href={x.url} target="_blank" rel="noreferrer">Open listing <ExternalLink size={14}/></a>}<button className="watchButton" onClick={()=>toggle(x)}>{watchedNow(x)?<BookmarkCheck size={16}/>:<Bookmark size={16}/>} {watchedNow(x)?"Watching":"Watch"}</button></div>
      </article>)}</div>
    </>}
  </div>;
}

function Workspace({refreshKey}){
  const [history,setHistory]=useState(()=>getHistory());
  const [watchlist,setWatchlist]=useState(()=>getWatchlist());
  const [searches,setSearches]=useState(()=>getSavedSearches());
  useEffect(()=>{setHistory(getHistory());setWatchlist(getWatchlist());setSearches(getSavedSearches());},[refreshKey]);

  function removeAnalysis(id){setHistory(deleteAnalysis(id));}
  function removeSearch(id){setSearches(deleteSavedSearch(id));}
  function removeWatch(item){setWatchlist(toggleWatchItem(item).items);}
  const ranked=[...history].sort((a,b)=>(b.summary?.best?.profit||b.result?.profit||0)-(a.summary?.best?.profit||a.result?.profit||0)).slice(0,3);

  return <div className="pageStack">
    <section className="workspaceHeader"><div><span className="eyebrow">FLIP WORKSPACE</span><h2>Your deal pipeline</h2><p>Keep the deals worth remembering and compare them before you spend money.</p></div><History size={28}/></section>
    <div className="workspaceStats"><div><span>Saved analyses</span><b>{history.length}</b></div><div><span>Watched listings</span><b>{watchlist.length}</b></div><div><span>Saved searches</span><b>{searches.length}</b></div></div>

    {ranked.length>=2&&<section className="panel comparePanel">
      <div className="sectionHeading"><div><span className="eyebrow">COMPARE DEALS</span><h3>Your strongest saved opportunities</h3><p>Ranked by projected best-channel profit.</p></div><BarChart3/></div>
      <div className="compareGrid">{ranked.map((x,i)=>{
        const profit=x.summary?.best?.profit||x.result?.profit||0;
        const roi=x.summary?.best?.roi||0;
        return <div className={"compareCard "+(i===0?"compareWinner":"")} key={x.id}>
          {i===0&&<span className="winnerTag">TOP DEAL</span>}
          <h4>{x.label}</h4>
          <div className="compareRows"><span><em>Buy</em><b>{money(x.input?.price)}</b></span><span><em>Likely sale</em><b>{money(x.summary?.onlineLikely||x.result?.resale)}</b></span><span><em>Best profit</em><b className={profit>=0?"goodText":"badText"}>{money(profit)}</b></span><span><em>ROI</em><b>{pct(roi)}</b></span><span><em>Score</em><b>{x.result?.score}/100</b></span></div>
        </div>;
      })}</div>
    </section>}

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">SAVED PCS</span><h3>Best opportunities</h3></div>{history.length>0&&<button className="ghost small" onClick={()=>{clearHistory();setHistory([])}}><Trash2 size={14}/>Clear</button>}</div>
      {!history.length?<div className="emptyState">Save an analysis and it will appear here.</div>:<div className="historyGrid">{history.map(x=><div className="historyCard" key={x.id}>
        <div className="historyTop"><span>{new Date(x.savedAt).toLocaleDateString()}</span><button onClick={()=>removeAnalysis(x.id)}><Trash2 size={14}/></button></div>
        <h3>{x.label}</h3>
        <div className="historyMetrics"><div><span>Buy</span><b>{money(x.input?.price)}</b></div><div><span>Likely sale</span><b>{money(x.summary?.onlineLikely||x.result?.resale)}</b></div><div><span>Best profit</span><b className={(x.summary?.best?.profit||0)>=0?"goodText":"badText"}>{money(x.summary?.best?.profit||x.result?.profit)}</b></div><div><span>Score</span><b>{x.result?.score}</b></div></div>
        <div className={"verdictMini "+(x.summary?.verdict?.tone||"")}>{x.summary?.verdict?.label||"Saved"}</div>
      </div>)}</div>}
    </section>

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">WATCHLIST</span><h3>Listings you don't want to lose</h3></div><Eye/></div>
      {!watchlist.length?<div className="emptyState">Watch a deal in Deal Scanner and it will stay here.</div>:<div className="watchList">{watchlist.map((x,i)=><div className="watchRow" key={x.url||x.id||i}><div><b>{x.title}</b><span>{x.source} · {money(x.totalPrice||x.itemPrice)} · score {x.score}</span></div><div>{x.url&&<a href={x.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a>}<button onClick={()=>removeWatch(x)}><Trash2 size={15}/></button></div></div>)}</div>}
    </section>

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">SAVED SEARCHES</span><h3>Repeat your sourcing playbook</h3></div><Bookmark/></div>
      {!searches.length?<div className="emptyState">Save a scanner setup to remember your best sourcing targets.</div>:<div className="savedSearchGrid">{searches.map(x=><div className="savedSearchCard" key={x.id}><b>{x.query}</b><span>{x.category} · {x.condition} · max {money(x.partBudget)}</span><button onClick={()=>removeSearch(x.id)}><Trash2 size={14}/></button></div>)}</div>}
    </section>
  </div>;
}

function ProPage(){
  useEffect(()=>{track("view_pro_pricing");},[]);
  return <div className="pageStack">
    <section className="proHero">
      <span className="eyebrow">FLIPSCOUT PRO</span>
      <h2>One good avoided mistake can pay for the tool for months.</h2>
      <p>The product is in founders beta, so Pro features are currently unlocked while the workflow is being proven with real flippers.</p>
      <div className="proBadge"><Sparkles size={17}/>Founders beta: all features unlocked</div>
    </section>

    <div className="pricingGrid">
      <div className="priceCard"><span>FREE</span><h3>$0</h3><p>For checking an occasional PC.</p><ul><li>Basic build valuation</li><li>Compatibility checks</li><li>Limited live scans</li><li>Basic profit estimate</li></ul><button className="secondary">Current free tier</button></div>
      <div className="priceCard featuredPrice"><div className="popular">BEST FOR FLIPPERS</div><span>PRO</span><h3>$9<span>/mo</span></h3><p>For people buying and selling every month.</p><ul><li>Unlimited PC analyses</li><li>Sales-backed evidence</li><li>Local vs online pricing</li><li>Deep deal scanner</li><li>Negotiation targets</li><li>Channel profit calculator</li><li>Listing Studio</li><li>Saved deal workspace</li></ul><button className="primary">Included in beta</button></div>
      <div className="priceCard"><span>POWER SELLER</span><h3>$19<span>/mo</span></h3><p>For repeat sellers and small shops.</p><ul><li>Everything in Pro</li><li>Batch analysis</li><li>Price-history alerts</li><li>Advanced inventory tracking</li><li>CSV export</li><li>Priority new-marketplace integrations</li></ul><button className="secondary">Planned</button></div>
    </div>

    <section className="panel valueProof">
      <div><b>$200</b><span>If FlipScout helps you avoid one bad $800 PC with a hidden $200 margin problem, that's more than a year of a $9 plan.</span></div>
      <div><b>Faster sourcing</b><span>The paid value isn't “a calculator.” It's fewer tabs, fewer bad buys, faster offers, and a repeatable selling process.</span></div>
      <div><b>Trust matters</b><span>Evidence type, sample size, confidence, live links, and fallback labeling stay visible instead of hiding uncertainty.</span></div>
    </section>
  </div>;
}

function Sources({providerKeys}){
  const [sources,setSources]=useState([]);
  useEffect(()=>{
    fetch("/api/sources",{headers:{"x-serper-key":providerKeys.SERPER_API_KEY||"","x-searchapi-key":providerKeys.SEARCHAPI_API_KEY||""}})
      .then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});
  },[providerKeys.SERPER_API_KEY,providerKeys.SEARCHAPI_API_KEY]);
  return <footer className="sourceFooter">
    <div><b>Market source health</b><span>FlipScout labels fallbacks instead of pretending they are live.</span></div>
    <div className="footerSources">{sources.slice(0,5).map(x=><span key={x.id}><i className={x.status==="Connected"?"on":""}></i>{x.name} <em className={statusTone(x.status)}>{x.status}</em></span>)}</div>
  </footer>;
}

export default function App(){
  const [tab,setTab]=useState("analyze");
  const [providerKeys,setProviderKeys]=useState(()=>loadProviderKeys());
  const [refreshKey,setRefreshKey]=useState(0);
  const bump=()=>setRefreshKey(x=>x+1);

  return <div className="appShell">
    <TopNav tab={tab} setTab={setTab}/>
    <main className="mainWrap">
      {tab==="analyze"&&<><Hero tab={tab} setTab={setTab}/><ProviderSetup providerKeys={providerKeys} setProviderKeys={setProviderKeys}/><Analyze providerKeys={providerKeys} onSaved={bump}/></>}
      {tab==="scan"&&<><Hero tab={tab} setTab={setTab}/><DealScanner providerKeys={providerKeys} onWatchChange={bump} onSearchSaved={bump}/></>}
      {tab==="workspace"&&<Workspace refreshKey={refreshKey}/>}
      {tab==="pro"&&<ProPage/>}
      <Sources providerKeys={providerKeys}/>
    </main>
  </div>;
}
