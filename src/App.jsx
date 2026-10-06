import React,{useEffect,useMemo,useState,useRef} from "react";
import {
  Search,Cpu,Gauge,ShoppingCart,ExternalLink,Database,AlertTriangle,RefreshCw,
  CheckCircle2,ShieldCheck,MapPin,TrendingUp,Bookmark,BookmarkCheck,Copy,
  Sparkles,History,Trash2,Target,WalletCards,BarChart3,Zap,Settings2,Trophy,
  ArrowRight,Save,Layers,SlidersHorizontal,Eye,ChevronDown,ChevronUp
} from "lucide-react";
import {fallbackPcEstimate} from "./valuation";
import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,
  CASE_OPTIONS,COOLER_OPTIONS,SCANNER_CATEGORIES,MARKET_SNAPSHOT,groupedCatalog
} from "../shared/catalog.js";
import { SNIPER_CATEGORIES, SNIPER_MARKETPLACES, SNIPER_CONDITIONS, groupedSniperCategories } from "../shared/sniper.js";
import {buildOpportunitySummary} from "./intelligence";
import {parseListingText} from "./listingParser";
import { track } from "@vercel/analytics";
import {
  getHistory,saveAnalysis,deleteAnalysis,clearHistory,
  getWatchlist,toggleWatchItem,getSavedSearches,saveSearch,deleteSavedSearch
} from "./storage";
import {saveMarketSnapshot} from "./marketHistory";

function money(v){
  if(v===null||v===undefined||Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}
function pct(v){return v!=null&&Number.isFinite(Number(v))?Math.round(Number(v))+"%":"—";}
function Datalist({id,items}){return <datalist id={id}>{items.map(x=><option key={x.name} value={x.name}/>)}</datalist>;}

function SpecDropdown({type,value,onChange}){
  const [filter,setFilter]=useState("");
  const allGroups=useMemo(()=>groupedCatalog(type),[type]);
  const groups=Object.fromEntries(Object.entries(allGroups).map(([name,items])=>[name,items.filter(x=>x.name===value || x.name.toLowerCase().replace(/[^a-z0-9]/g,"").includes(filter.toLowerCase().replace(/[^a-z0-9]/g,"")))]).filter(([,items])=>items.length));
  const total=Object.values(groups).reduce((n,items)=>n+items.length,0);
  return <div className="specDropdownWrap">
    <input aria-label={"Filter "+type.toUpperCase()+" models"} type="search" placeholder={"Find "+type.toUpperCase()+" model…"} value={filter} onChange={e=>setFilter(e.target.value)}/>
    <select aria-label={type.toUpperCase()+" model"} value={value} onChange={e=>onChange(e.target.value)}>
      <option value="" disabled>Choose exact model</option>
      {Object.entries(groups).map(([group,items])=><optgroup label={group} key={group}>
        {items.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}
      </optgroup>)}
    </select>
    <small>{total} matching desktop {type==="gpu"?"GPU":"CPU"} models in catalog</small>
  </div>;
}
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
    ["sniper","Parts & Sniper",Target],
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
      <div><b>300+ CPU/GPU SKUs</b><span>Grouped desktop catalog through current 2026 generations</span></div>
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
      {summary.hasLiveResale&&<div className="decisionMetrics"><div><span>Projected profit</span><b>{money(summary.best?.profit)}</b></div><div><span>Likely online resale</span><b>{money(summary.onlineLikely)}</b></div><div><span>20% ROI buy limit</span><b>{money(summary.buyTargets?.target20)}</b></div></div>}
      {summary.shippingAssumed&&summary.hasLiveResale&&<p className="finePrint">Shipping unknown: online profit includes a $75 planning allowance. Verify a packed shipping quote.</p>}
      <div className="verdictBadges">
        <span><Zap size={14}/>{summary.tier.label}</span>
        <span><Eye size={14}/>Buyer appeal {summary.appeal}/100</span>
        <span><TrendingUp size={14}/>Liquidity {summary.liquidity}/100</span>
        <span><Database size={14}/>Evidence grade {summary.scoreBreakdown?.evidenceGrade||live?.evidence?.grade||"F"}</span>
      </div>
    </div>
    <ScoreRing value={summary.scoreBreakdown?.finalScore??result.score}/>
  </div>;
}

function ScoreBreakdown({summary}){
  const b=summary?.scoreBreakdown;
  if(!b)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">WHY THIS SCORE?</span><h3>Transparent deal-quality breakdown</h3><p>Evidence grade {b.evidenceGrade} caps this deal at {b.cap}/100 until stronger real-market data exists.</p></div><div className={"evidenceGrade grade"+b.evidenceGrade}>{b.evidenceGrade}</div></div>
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
  if(!summary?.hasLiveResale)return null;
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

function SensitivityPanel({summary}){
  const s=summary?.sensitivity;
  if(!s)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">STRESS TEST</span><h3>Does the deal survive a weaker sale?</h3><p>Downside matters more than the optimistic case when you're tying up cash.</p></div><ShieldCheck/></div>
    <div className="stressHeadline">
      <div><span>Online break-even sale</span><b>{money(s.onlineBreakEven)}</b></div>
      <div><span>Margin of safety</span><b className={s.marginOfSafetyPct>=15?"goodText":s.marginOfSafetyPct>=5?"":"badText"}>{s.marginOfSafetyPct}%</b></div>
      <div><span>10% downside test</span><b className={s.survivesOnlineDownside?"goodText":"badText"}>{s.survivesOnlineDownside?"Still profitable":"Turns negative"}</b></div>
    </div>
    <div className="stressGrid">
      <div><span className="fieldLabel">Online / eBay scenario</span>{s.online.map((x,i)=><div className="stressRow" key={i}><span>{x.label}</span><b>{money(x.sale)}</b><strong className={x.profit>=0?"goodText":"badText"}>{money(x.profit)} profit</strong></div>)}</div>
      <div><span className="fieldLabel">Local cash scenario</span>{s.local.length?s.local.map((x,i)=><div className="stressRow" key={i}><span>{x.label}</span><b>{money(x.sale)}</b><strong className={x.profit>=0?"goodText":"badText"}>{money(x.profit)} profit</strong></div>):<div className="emptyState">Add a ZIP and enough local comps to stress-test local resale.</div>}</div>
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

function EvidenceDashboard({live,summary}){
  const e=live?.evidence;
  if(!e)return null;
  const online=live?.resale?.online;
  const local=live?.resale?.local;
  const observed=e.observedAt?new Date(e.observedAt).toLocaleString():null;
  const fallbackCount=e.fallbackComponents?.length||0;
  return <section className="resultSection evidenceDashboard">
    <div className="sectionHeading">
      <div><span className="eyebrow">REAL-DATA AUDIT</span><h3>Exactly what supports this valuation</h3><p>{e.reason}</p></div>
      <div className={"evidenceGrade grade"+e.grade}>{e.grade}</div>
    </div>
    <div className="auditGrid">
      <div><span>Online likely resale</span><b>{money(online?.likely)}</b><small>{online?.method}</small></div>
      <div><span>Observed range</span><b>{money(online?.low)}–{money(online?.high)}</b><small>{online?.confidence||"Unknown"} confidence</small></div>
      <div><span>Complete-PC comps</span><b>{e.completePcCompCount}</b><small>filtered relevant listings</small></div>
      <div><span>Sales-backed listings</span><b>{e.salesBackedListingCount}</b><small>{e.reportedUnitsSold} reported prior units sold</small></div>
      <div><span>Live components</span><b>{e.liveComponentCount}/{e.componentCount}</b><small>{e.componentCoveragePct}% live-backed · {e.componentCompTotal} component comps</small></div>
      <div><span>Local comps</span><b>{e.localCompCount}</b><small>{local?money(local.low)+"–"+money(local.high):e.localRequested?"Not enough nearby evidence":"Add ZIP to check"}</small></div>
    </div>
    <div className="auditFoot">
      <span><Database size={13}/>Evidence grade {e.grade} · score cap {e.scoreCap}/100</span>
      <span><RefreshCw size={13}/>{observed?"Checked "+observed:"Timestamp unavailable"}</span>
      <span className={fallbackCount?"warnText":"goodText"}>{fallbackCount?fallbackCount+" component fallback"+(fallbackCount===1?"":"s")+": "+e.fallbackComponents.join(", "):"All component inputs live-backed"}</span>
    </div>
    {summary?.hasLiveResale?<div className="realInsightBox">
      <div><Sparkles size={18}/><b>FlipScout read</b></div>
      <p>With {summary.localLikely?money(summary.localLikely)+" in local asking evidence":"insufficient local evidence"} and a {money(summary.onlineLikely)} online target, the strongest modeled channel is <strong>{summary.best?.channel}</strong> at about <strong className={summary.best?.profit>=0?"goodText":"badText"}>{money(summary.best?.profit)}</strong> projected profit ({pct(summary.best?.roi)} ROI). {e.grade==="A"||e.grade==="B"?"The evidence is strong enough to use this as a serious buy/no-buy input.":"The evidence is usable but still thin; use the buy target and downside test conservatively."}</p>
    </div>:<div className="insufficientEvidence"><AlertTriangle size={18}/><div><b>Insufficient live evidence for a resale/profit recommendation.</b><p>FlipScout is intentionally withholding the likely-sale and profit numbers instead of filling the gaps with static guesses.</p></div></div>}
  </section>;
}

function ComponentEvidence({live}){
  const entries=Object.entries(live?.components||{});
  if(!entries.length)return null;
  return <section className="resultSection">
    <div className="sectionHeading"><div><span className="eyebrow">COMPONENT EVIDENCE</span><h3>See the comps behind each part value</h3><p>Live medians, trimmed ranges, sample counts, and example listings are shown separately from fallback data.</p></div><Database/></div>
    <div className="componentEvidenceGrid">{entries.map(([name,x])=><details className={"componentEvidence "+(x.live?"live":"fallback")} key={name}>
      <summary>
        <div><span>{name}</span><b>{x.value==null?"No trusted fallback":money(x.value)}</b></div>
        <div className="componentEvidenceMeta">{x.live?<><strong>{x.sampleSize} comps</strong><small>{money(x.rawLow)}–{money(x.rawHigh)} observed</small></>:<><strong>Fallback only</strong><small>Not used as real-market evidence</small></>}</div>
      </summary>
      {x.live?<div className="componentEvidenceBody">
        <div className="sourceMini">{Object.entries(x.bySource||{}).map(([source,count])=><span key={source}>{source}: {count}</span>)}</div>
        {(x.examples||[]).map((item,i)=><div className="miniComp" key={i}><div><b>{item.title}</b><small>{item.source} · {item.condition}</small></div><strong>{money(item.price)}</strong>{item.url&&<a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/></a>}</div>)}
      </div>:<div className="componentEvidenceBody"><p className="mutedText">This component did not have enough qualifying live comps. FlipScout marks it as fallback instead of counting it toward the evidence grade.</p></div>}
    </details>)}</div>
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
  const requestBusy=useRef(false);
  const [formError,setFormError]=useState("");
  const update=(key,value)=>{setForm(v=>({...v,[key]:value}));setSummary(null);setResult(null);setLive(null);setSaved(false);};

  function parseListing(){
    setSummary(null);setResult(null);setLive(null);
    const parsed=parseListingText(listingText);
    setParseResult(parsed);
    setForm(v=>({
      ...v,
      ...(parsed.price!=null?{price:parsed.price}:{}),
      cpu:parsed.cpu||"",
      gpu:parsed.gpu||"",
      ...(parsed.ram?{ram:parsed.ram}:{}),
      ...(parsed.storage?{storage:parsed.storage}:{}),
      ...(parsed.motherboard?{motherboard:parsed.motherboard}:{}),
      ...(parsed.psu?{psu:parsed.psu}:{}),
      ...(parsed.cooler?{cooler:parsed.cooler}:{}),
      ...(parsed.caseType?{caseType:parsed.caseType}:{})
    }));
  }

  async function analyze(){
    if(requestBusy.current)return;
    if(!Number.isFinite(Number(form.price))||Number(form.price)<=0||Number(form.price)>100000){setFormError("Enter a purchase price between $0.01 and $100,000.");return;}
    if(form.postalCode&&!/^\d{5}$/.test(form.postalCode)){setFormError("Enter a five-digit ZIP or leave it blank.");return;}
    requestBusy.current=true;setFormError("");
    track("analyze_pc",{gpu:form.gpu,cpu:form.cpu,hasZip:Boolean(form.postalCode)});
    const input={...form,providerKeys};
    const fallback=fallbackPcEstimate(input);
    setResult(fallback);setLive(null);setSummary(null);setLoading(true);setSaved(false);
    try{
      const r=await fetch("/api/market/pc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(40000)});
      const d=await r.json();
      setLive(d);
      if(!r.ok){setFormError(d.message||"Unable to analyze this input.");return;}
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
      const builtSummary=buildOpportunitySummary(form,finalResult,d);
      if(builtSummary?.scoreBreakdown?.finalScore!=null){
        finalResult={...finalResult,score:builtSummary.scoreBreakdown.finalScore};
      }
      setResult(finalResult);
      setSummary(builtSummary);
      track(builtSummary?.hasLiveResale?"successful_live_analysis":"insufficient_evidence_analysis");
    }catch{
      const unavailable={available:false,valid:fallback.identityValid,message:"Live market service unavailable; fallback-only screening."};
      setLive(unavailable);
      const builtSummary=buildOpportunitySummary(form,fallback,unavailable);
      const capped={...fallback,score:builtSummary?.scoreBreakdown?.finalScore??Math.min(Number(fallback.score||0),45)};
      setResult(capped);
      setSummary(builtSummary);
    }finally{requestBusy.current=false;setLoading(false);}
  }

  function saveCurrent(){
    if(!result||!summary)return;
    track("save_analysis",{verdict:summary.verdict?.label||"unknown",score:Number(result.score||0)});
    try{saveAnalysis({input:form,result,live,summary,label:form.gpu+" + "+form.cpu});}
    catch{setFormError("Could not save this analysis: browser storage is full or disabled. Your current result is still visible.");return;}
    setSaved(true);onSaved?.();
  }

  return <div className="pageStack">
    <section className="panel analyzerPanel">
      <div className="sectionHeading">
        <div><span className="eyebrow">DEAL ANALYZER</span><h2>Would you actually make money on this PC?</h2><p>Enter the build. FlipScout validates it before calculating the deal.</p></div>
        <SlidersHorizontal/>
      </div>
      <div className="pasteListing">
        <button className="pasteToggle" onClick={()=>setPasteOpen(!pasteOpen)}><Sparkles size={16}/><span><b>Paste a listing instead</b><small>Auto-detect specs from messy Marketplace/eBay text</small></span>{pasteOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
        {pasteOpen&&<div className="pasteBody">
          <textarea value={listingText} onChange={e=>setListingText(e.target.value)} placeholder="Example: $850 gaming PC, Ryzen 5 5600X, RTX 4060, 16GB DDR4, 1TB NVMe, B550, 650W PSU..."/>
          <div className="rowActions"><button className="primary small" onClick={parseListing} disabled={loading||!listingText.trim()}><Sparkles size={15}/>Auto-fill specs</button>{parseResult&&<span className="parseConfidence">Detected {parseResult.confidence}% of fields{parseResult.notes?.length?" · "+parseResult.notes.join(" · "):""}</span>}</div>
        </div>}
      </div>
      <fieldset className="formGrid" disabled={loading}>
        <label>Purchase / asking price<input type="number" value={form.price} onChange={e=>update("price",e.target.value)}/></label>
        <label>CPU<SpecDropdown type="cpu" value={form.cpu} onChange={v=>update("cpu",v)}/></label>
        <label>GPU<SpecDropdown type="gpu" value={form.gpu} onChange={v=>update("gpu",v)}/></label>
        <label>RAM<select value={form.ram} onChange={e=>update("ram",e.target.value)}>{RAM_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Storage<select value={form.storage} onChange={e=>update("storage",e.target.value)}>{STORAGE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Motherboard<select value={form.motherboard} onChange={e=>update("motherboard",e.target.value)}>{MOTHERBOARDS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Power supply<select value={form.psu} onChange={e=>update("psu",e.target.value)}>{PSU_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Case<select value={form.caseType} onChange={e=>update("caseType",e.target.value)}>{CASE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>CPU cooler<select value={form.cooler} onChange={e=>update("cooler",e.target.value)}>{COOLER_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>ZIP for local comps<input inputMode="numeric" maxLength={5} value={form.postalCode} onChange={e=>update("postalCode",e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="Optional"/></label>
        <label>Local radius<select value={form.distanceRadius} onChange={e=>update("distanceRadius",Number(e.target.value))}><option value={25}>25 miles</option><option value={50}>50 miles</option><option value={100}>100 miles</option></select></label>
        <label>Goal<select value={form.purpose} onChange={e=>update("purpose",e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
      </fieldset>
      {formError&&<p role="alert" className="warningLine">{formError}</p>}
      <div className="analyzeActions">
        <button className="primary large" onClick={analyze} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Building real-market case...</>:<><Gauge size={18}/>Analyze this deal</>}</button>
        <span>Fake or ambiguous parts are rejected instead of guessed.</span>
      </div>
      {(result||live)&&<IdentityNotice live={live} result={result}/>}
    </section>

    {result?.identityValid!==false&&summary&&<>
      <VerdictHero summary={summary} result={result} live={live}/>
      <ScoreBreakdown summary={summary}/>
      <EvidenceDashboard live={live} summary={summary}/>
      <ComponentEvidence live={live}/>
      <StrategyStrip summary={summary}/>
      <div className="saveBar"><div><b>{form.gpu} + {form.cpu}</b><span>{money(form.price)} acquisition · {summary.verdict.label}</span></div><button className={saved?"secondary":"primary"} onClick={saveCurrent}>{saved?<><CheckCircle2 size={16}/>Saved</>:<><Save size={16}/>Save to workspace</>}</button></div>
      <ChannelProfit summary={summary}/>
      <SensitivityPanel summary={summary}/>
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
  const [trend,setTrend]=useState(null);
  const [watched,setWatched]=useState(()=>getWatchlist());

  function changeCategory(value){
    setCategory(value);
    setQuery(SCANNER_CATEGORIES.find(x=>x.name===value)?.example||"");
  }
  async function scan(){
    track("scan_parts",{category,condition,deepScan});
    setLoading(true);setData(null);
    try{
      const r=await fetch("/api/deals/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed,sortBy,deepScan,providerKeys}),signal:AbortSignal.timeout(40000)});
      const d=await r.json();
      setData(d);
      if(d.available)setTrend(saveMarketSnapshot({category,query,condition},d.market));
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
        <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}>{SNIPER_CONDITIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
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
      {trend&&<div className="trendCard">
        <div><span className="eyebrow">PRICE MEMORY</span><b>{trend.count<2?"First market snapshot saved":(trend.changeSinceLast>=0?"+":"")+trend.changeSinceLast.toFixed(1)+"% vs last scan"}</b><small>{trend.count} snapshot{trend.count===1?"":"s"} stored on this device</small></div>
        <div className="sparkBars">{trend.series.slice(-12).map((v,i)=>{const max=Math.max(...trend.series.slice(-12)),min=Math.min(...trend.series.slice(-12));const h=max===min?50:20+((v-min)/(max-min))*80;return <i key={i} style={{height:h+"%"}} title={money(v)}></i>})}</div>
      </div>}
      <div className="marketHeadline">
        <div><span>{data.market.valueLabel}</span><strong>{money(data.market.median)}</strong><small>{money(data.market.low)}–{money(data.market.high)} trimmed range</small></div>
        <div><span>Relevant comps</span><strong>{data.market.sampleSize}</strong><small>{data.market.rawSampleSize} raw listings checked · {Object.keys(data.market.bySource||{}).length} source{Object.keys(data.market.bySource||{}).length===1?"":"s"}</small></div>
        <div><span>Confidence</span><strong>{data.market.confidence}</strong><small>{data.market.shippingKnownPct}% with known shipping</small></div>
      </div>
      <div className="dealList">{(data.results||[]).map((x,i)=><article className="dealCard" key={x.id||i}>
        <div className="dealTop"><div><div className="dealBadges"><span className="source">{x.source}</span>{x.soldCount>0&&<span className="soldChip">{x.soldCount}+ sold</span>}</div><h3>{x.title}</h3></div><div className="dealScore"><b>{x.score}</b><small>cap {x.scoreCap||100}</small></div></div>
        <div className="dealPriceRow"><strong>{x.shippingKnown?money(x.totalPrice):money(x.itemPrice)}</strong><span>{x.shippingKnown?"delivered":"shipping unknown"}</span></div>
        <div className="dealMeta"><span>{x.condition} · {x.seller}</span><span className={x.percentVsMarket>=10?"goodText":x.percentVsMarket<0?"badText":""}>{x.percentVsMarket>=0?x.percentVsMarket+"% under market":Math.abs(x.percentVsMarket)+"% over market"}</span><span>Build left {money(x.budgetLeft)}{!x.shippingKnown?" before shipping":""}</span><span>{x.withinPartBudget?(x.shippingKnown?"Fits part budget":"Check shipping for budget"):"Over part budget"}</span></div>
        {x.riskFlags?.length>0&&<div className="dealRisks">{x.riskFlags.slice(0,3).map((risk,j)=><span key={j}><AlertTriangle size={12}/>{risk}</span>)}</div>}
        <div className="dealActions">{x.url&&<a className="listingLink" href={x.url} target="_blank" rel="noreferrer">Open listing <ExternalLink size={14}/></a>}<button className="watchButton" onClick={()=>toggle(x)}>{watchedNow(x)?<BookmarkCheck size={16}/>:<Bookmark size={16}/>} {watchedNow(x)?"Watching":"Watch"}</button></div>
      </article>)}</div>
    </>}
  </div>;
}

function PartsSniper({providerKeys,onWatchChange}){
  const categoryGroups=useMemo(()=>groupedSniperCategories(),[]);
  const [targets,setTargets]=useState(()=>[
    {id:"target-1",category:"GPU",query:"RTX 5070",condition:"used",maxPrice:550,buildBudget:1000,committed:300}
  ]);
  const [marketplaces,setMarketplaces]=useState(["amazon","newegg","ebay","mercari"]);
  const [deepScan,setDeepScan]=useState(false);
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [watched,setWatched]=useState(()=>getWatchlist());

  function updateTarget(id,key,value){
    setTargets(rows=>rows.map(x=>x.id===id?{...x,[key]:value}:x));
    setData(null);setError("");
  }
  function changeCategory(id,category){
    const example=SNIPER_CATEGORIES.find(x=>x.name===category)?.example||"";
    setTargets(rows=>rows.map(x=>x.id===id?{...x,category,query:example}:x));
    setData(null);setError("");
  }
  function addTarget(){
    if(targets.length>=5)return;
    const item=SNIPER_CATEGORIES[(targets.length*3)%SNIPER_CATEGORIES.length];
    setTargets(rows=>[...rows,{
      id:"target-"+Date.now(),
      category:item.name,
      query:item.example,
      condition:"any",
      maxPrice:0,
      buildBudget:1000,
      committed:0
    }]);
  }
  function removeTarget(id){
    if(targets.length===1)return;
    setTargets(rows=>rows.filter(x=>x.id!==id));
    setData(null);
  }
  function toggleMarketplace(id){
    setMarketplaces(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
    setData(null);setError("");
  }
  function toggleWatch(item,target){
    const out=toggleWatchItem({...item,category:target.category,query:target.query});
    setWatched(out.items);onWatchChange?.();
  }
  function isWatched(item){
    const key=item.url||item.id||item.title;
    return watched.some(x=>(x.url||x.id||x.title)===key);
  }

  async function scan(){
    if(loading)return;
    if(!marketplaces.length){setError("Choose at least one marketplace.");return;}
    const invalid=targets.find(x=>!String(x.query||"").trim());
    if(invalid){setError("Every target needs a part or model.");return;}
    setLoading(true);setError("");setData(null);
    track("sniper_scan",{targets:targets.length,marketplaces:marketplaces.length,deepScan});
    try{
      const r=await fetch("/api/parts/sniper",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({targets,marketplaces,deepScan,providerKeys}),
        signal:AbortSignal.timeout(45000)
      });
      const d=await r.json();
      if(!r.ok){setError(d.message||"Parts & Sniper could not run this scan.");return;}
      setData(d);
      if(!d.available)setError(d.message||"No qualifying live listings were found.");
    }catch{
      setError("Parts & Sniper could not reach the live marketplace service. Try again.");
    }finally{setLoading(false);}
  }

  return <div className="pageStack">
    <section className="sniperHero">
      <div><span className="eyebrow">PARTS & SNIPER</span><h2>Hunt several PC parts at once.</h2><p>Track up to five targets across Amazon, Newegg, eBay, and Mercari. FlipScout filters junk results, compares delivered prices, and ranks the listings that deserve attention.</p></div>
      <div className="sniperHeroStats"><div><b>38</b><span>part categories</span></div><div><b>4</b><span>marketplaces</span></div><div><b>5</b><span>targets per scan</span></div><div><b>6</b><span>condition filters</span></div></div>
    </section>

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">MARKETPLACES</span><h3>Where should FlipScout hunt?</h3><p>Retail sources use shopping search; eBay uses direct structured marketplace results when available.</p></div><Target/></div>
      <div className="marketplacePicker">
        {SNIPER_MARKETPLACES.map(m=><button key={m.id} className={marketplaces.includes(m.id)?"marketplaceChip active":"marketplaceChip"} onClick={()=>toggleMarketplace(m.id)}><span className="marketplaceInitial">{m.name.slice(0,1)}</span><span><b>{m.name}</b><small>{marketplaces.includes(m.id)?"Included":"Tap to include"}</small></span></button>)}
      </div>
      <label className="toggleLine"><input type="checkbox" checked={deepScan} onChange={e=>setDeepScan(e.target.checked)}/><span><b>Deep scan</b><small>Uses additional direct marketplace calls where available. More thorough, but uses more provider quota.</small></span></label>
    </section>

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">TARGETS</span><h3>What are you trying to snipe?</h3><p>Each target can have its own category, condition, and ceiling price.</p></div><span className="targetCounter">{targets.length}/5</span></div>
      <div className="targetList">
        {targets.map((target,index)=><div className="targetCard" key={target.id}>
          <div className="targetNumber">#{index+1}</div>
          <label>Category<select value={target.category} onChange={e=>changeCategory(target.id,e.target.value)}>{Object.entries(categoryGroups).map(([group,items])=><optgroup label={group} key={group}>{items.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</optgroup>)}</select></label>
          <label className="targetQuery">Part / model / requirement<input value={target.query} onChange={e=>updateTarget(target.id,"query",e.target.value)} placeholder="e.g. RTX 5070 Ti 16GB"/></label>
          <label>Condition<select value={target.condition} onChange={e=>updateTarget(target.id,"condition",e.target.value)}>{SNIPER_CONDITIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label>Max delivered price<input type="number" min="0" value={target.maxPrice} onChange={e=>updateTarget(target.id,"maxPrice",e.target.value)} placeholder="0 = no cap"/></label>
          <button className="targetRemove" disabled={targets.length===1} onClick={()=>removeTarget(target.id)} aria-label={"Remove target "+(index+1)}><Trash2 size={16}/></button>
        </div>)}
      </div>
      <div className="sniperActions"><button className="secondary" onClick={addTarget} disabled={targets.length>=5}><span className="plusText">+</span>Add target</button><button className="primary large" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Scanning marketplaces...</>:<><Target size={18}/>Run sniper scan</>}</button></div>
      {error&&<div className="notice"><AlertTriangle size={18}/><div><b>{error}</b>{data?.sources&&<p>Check the source-health footer for provider status.</p>}</div></div>}
    </section>

    {data?.available&&<section className="sniperResults">
      <div className="sniperResultsHead"><div><span className="eyebrow">LIVE RESULTS</span><h2>{data.successfulTargets}/{data.targetCount} targets found qualifying listings</h2><p>Scanned {data.marketplaces.map(id=>SNIPER_MARKETPLACES.find(x=>x.id===id)?.name||id).join(", ")}.</p></div><div className="scanTime">{new Date(data.searchedAt).toLocaleTimeString()}</div></div>
      {(data.results||[]).map(group=><section className="panel sniperTargetResults" key={group.id}>
        <div className="targetResultHeader">
          <div><span className="eyebrow">{group.target.category}</span><h3>{group.target.query}</h3><p>{SNIPER_CONDITIONS.find(x=>x.value===group.target.condition)?.label||group.target.condition}{group.target.maxPrice>0?" · max "+money(group.target.maxPrice):" · no price cap"}</p></div>
          {group.available?<div className="marketMini"><span>Market median</span><b>{money(group.market.median)}</b><small>{group.market.sampleSize} comps · {group.market.confidence}</small></div>:<div className="marketMini weak"><span>Evidence</span><b>Too thin</b><small>No trustworthy market range</small></div>}
        </div>

        {group.bestDeal&&<div className="sniperWinner">
          <div className="sniperWinnerBadge"><Zap size={15}/>BEST MATCH</div>
          <div><b>{group.bestDeal.title}</b><span>{group.bestDeal.source} · {group.bestDeal.condition} · score {group.bestDeal.score}/{group.bestDeal.scoreCap||100}</span></div>
          <strong>{money(group.bestDeal.totalPrice)}</strong>
          {group.bestDeal.url&&<a href={group.bestDeal.url} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a>}
        </div>}

        {!group.results?.length?<div className="emptyState">No relevant priced listings survived FlipScout's filters for this target.</div>:<div className="sniperDealGrid">{group.results.slice(0,12).map((item,i)=><article className="sniperDeal" key={item.id||i}>
          <div className="sniperDealTop"><div><span className="source">{item.source}</span>{item.soldCount>0&&<span className="soldChip">{item.soldCount}+ sold</span>}</div><div className="dealScore"><b>{item.score}</b><small>cap {item.scoreCap||100}</small></div></div>
          <h4>{item.title}</h4>
          <div className="sniperPrice"><b>{money(item.totalPrice)}</b><span>{item.shippingKnown?"delivered":"shipping not confirmed"}</span></div>
          <div className="dealMeta"><span>{item.condition}</span><span className={item.percentVsMarket>=10?"goodText":item.percentVsMarket<0?"badText":""}>{item.percentVsMarket>=0?item.percentVsMarket+"% under market":Math.abs(item.percentVsMarket)+"% over market"}</span>{item.seller&&<span>{item.seller}</span>}</div>
          {item.riskFlags?.length>0&&<div className="dealRisks">{item.riskFlags.slice(0,2).map((risk,j)=><span key={j}><AlertTriangle size={12}/>{risk}</span>)}</div>}
          <div className="dealActions">{item.url&&<a className="listingLink" href={item.url} target="_blank" rel="noreferrer">Open listing <ExternalLink size={14}/></a>}<button className="watchButton" onClick={()=>toggleWatch(item,group.target)}>{isWatched(item)?<BookmarkCheck size={15}/>:<Bookmark size={15}/>} {isWatched(item)?"Watching":"Watch"}</button></div>
        </article>)}</div>}
        {group.errors?.length>0&&<details className="providerDetails"><summary>Provider notes ({group.errors.length})</summary>{group.errors.map((e,i)=><p key={i}>{e.provider}: {e.message}</p>)}</details>}
      </section>)}
    </section>}
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
  const ranked=history.filter(x=>x.summary?.hasLiveResale).sort((a,b)=>(b.summary?.best?.profit??0)-(a.summary?.best?.profit??0)).slice(0,3);

  return <div className="pageStack">
    <section className="workspaceHeader"><div><span className="eyebrow">FLIP WORKSPACE</span><h2>Your deal pipeline</h2><p>Keep the deals worth remembering and compare them before you spend money.</p></div><History size={28}/></section>
    <div className="workspaceStats"><div><span>Saved analyses</span><b>{history.length}</b></div><div><span>Watched listings</span><b>{watchlist.length}</b></div><div><span>Saved searches</span><b>{searches.length}</b></div></div>

    {ranked.length>=2&&<section className="panel comparePanel">
      <div className="sectionHeading"><div><span className="eyebrow">COMPARE DEALS</span><h3>Your strongest saved opportunities</h3><p>Ranked by projected best-channel profit.</p></div><BarChart3/></div>
      <div className="compareGrid">{ranked.map((x,i)=>{
        const profit=x.summary?.hasLiveResale?x.summary?.best?.profit:null;
        const roi=x.summary?.best?.roi??null;
        return <div className={"compareCard "+(i===0?"compareWinner":"")} key={x.id}>
          {i===0&&<span className="winnerTag">TOP DEAL</span>}
          <h4>{x.label}</h4>
          <div className="compareRows"><span><em>Buy</em><b>{money(x.input?.price)}</b></span><span><em>Likely sale</em><b>{money(x.summary?.onlineLikely)}</b></span><span><em>Best profit</em><b className={profit>=0?"goodText":"badText"}>{money(profit)}</b></span><span><em>ROI</em><b>{pct(roi)}</b></span><span><em>Score</em><b>{x.result?.score}/100</b></span></div>
        </div>;
      })}</div>
    </section>}

    <section className="panel">
      <div className="sectionHeading"><div><span className="eyebrow">SAVED PCS</span><h3>Best opportunities</h3></div>{history.length>0&&<button className="ghost small" onClick={()=>{clearHistory();setHistory([])}}><Trash2 size={14}/>Clear</button>}</div>
      {!history.length?<div className="emptyState">Save an analysis and it will appear here.</div>:<div className="historyGrid">{history.map(x=><div className="historyCard" key={x.id}>
        <div className="historyTop"><span>{new Date(x.savedAt).toLocaleDateString()}</span><button onClick={()=>removeAnalysis(x.id)}><Trash2 size={14}/></button></div>
        <h3>{x.label}</h3>
        <div className="historyMetrics"><div><span>Buy</span><b>{money(x.input?.price)}</b></div><div><span>Likely sale</span><b>{money(x.summary?.onlineLikely)}</b></div><div><span>Best profit</span><b className={(x.summary?.best?.profit||0)>=0?"goodText":"badText"}>{money(x.summary?.hasLiveResale?x.summary?.best?.profit:null)}</b></div><div><span>Score</span><b>{x.summary?.scoreBreakdown?.finalScore??x.result?.score}</b></div></div>
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
      {tab==="sniper"&&<PartsSniper providerKeys={providerKeys} onWatchChange={bump}/>}
      {tab==="workspace"&&<Workspace refreshKey={refreshKey}/>} 
      {tab==="pro"&&<ProPage/>}
      <Sources providerKeys={providerKeys}/>
    </main>
  </div>;
}
