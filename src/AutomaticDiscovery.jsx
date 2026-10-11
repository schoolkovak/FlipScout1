import React,{useEffect,useMemo,useRef,useState} from "react";
import {CORE_DISCOVERY_TARGETS as TARGETS,CORE_PC_CATEGORIES as PARTS} from "../shared/discovery.js";
import {SNIPER_MARKETPLACES as STORES} from "../shared/sniper.js";
import {dedupeOffers,filterOffers,offerReference,offerTotal,savingsPercent,sortOffers} from "./dealSort.js";

const CACHE_NAME="flipscout-deals-catalog-v2";
const CACHE_AGE=6*60*60*1000;
const CATALOG_BATCH=2;
const FOCUSED_BATCH=3;
const MODELS=PARTS.map(category=>({category,targets:TARGETS.filter(t=>t.category===category)}));
const QUICK=[
  ["GPU","Graphics Cards"],["CPU","Processors"],["RAM / Memory","Memory"],
  ["NVMe SSD","SSD"],["Motherboard","Motherboards"],["Power Supply / PSU","Power"],
  ["PC Case","Cases"],["CPU Air Cooler","Cooling"]
];
const GPU_SERIES=[
  ["All","All GPUs"],["RTX 50","RTX 50"],["RTX 40","RTX 40"],["RTX 30","RTX 30"],
  ["RTX 20","RTX 20"],["RX 9000","RX 9000"],["RX 7000","RX 7000"],["RX 6000","RX 6000"],["Arc","Intel Arc"]
];
function money(value){
  return Number.isFinite(Number(value))&&value!==null?
    Number(value).toLocaleString("en-US",{style:"currency",currency:"USD"}):"—";
}
function timestamp(value){
  const ms=Date.parse(value||"");
  if(!Number.isFinite(ms))return "Never";
  const minutes=Math.round((Date.now()-ms)/60000);
  return minutes<1?"Just now":minutes<60?minutes+"m ago":minutes<1440?Math.round(minutes/60)+"h ago":new Date(ms).toLocaleDateString();
}
function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(CACHE_NAME)||"{}");
    const ids=new Set(TARGETS.map(t=>t.id));
    return Object.fromEntries(Object.entries(saved).filter(([id,row])=>
      ids.has(id)&&row?.checkedAt&&Date.now()-Date.parse(row.checkedAt)<CACHE_AGE
    ));
  }catch{return {};}
}
function blockedOffer(item){
  return !item?.url?.startsWith("https://")||!Number.isFinite(offerTotal(item));
}
function ItemCard({item}){
  const [details,setDetails]=useState(false);
  const reference=offerReference(item);
  const saved=savingsPercent(item);
  const isBelow=saved!==null&&saved>=0;
  return <article className="fsProduct" data-store={item.marketplace}>
    <div className="fsProductHeading">
      <b>{item.subtype||item.category}</b>
      {reference&&isBelow&&<span className="fsSaveBadge">BELOW {item.msrp?"MSRP":"MARKET"}</span>}
    </div>
    <div className="fsProductVisual">
      {item.imageUrl?
        <img src={item.imageUrl} alt={item.title||"PC part"} loading="lazy" referrerPolicy="no-referrer"
          onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:
        <div className="fsImageFallback"><span>NO IMAGE</span><small>Check retailer photos</small></div>}
    </div>
    <div className="fsProductInfo">
      <div className="fsStoreLine"><span>{item.source||item.marketplace}</span><b>{item.condition||"Condition not specified"}</b></div>
      <h3 title={item.title}>{item.title}</h3>
      <div className="fsProductDesc">{item.category} · {item.subtype}</div>
      <div className="fsPrice"><strong>{money(offerTotal(item))}</strong>
        {saved!==null&&<b className={isBelow?"fsPositive":"fsNegative"}>{Math.abs(saved).toFixed(1)}% {isBelow?"below":"above"} {item.msrp?"MSRP":"market"}</b>}
      </div>
      <div className="fsPriceExtra">
        <span>{reference?reference.type+": "+money(reference.price):"No verified MSRP or comparable price"}</span>
        <span>{item.shippingKnown?"Delivered total":"Shipping not confirmed"}</span>
      </div>
      <div className="fsConditionLine"><small>Checked {timestamp(item.checkedAt)}</small>
        <small>{item.evidenceSampleSize||0} comparisons</small></div>
      <button className="fsMoreButton" type="button" onClick={()=>setDetails(v=>!v)}>
        {details?"HIDE DETAILS":"MORE INFO"} <span aria-hidden="true">{details?"−":"→"}</span>
      </button>
      {details&&<div className="fsMoreDetails">
        <p>Price vs current sampled market: {item.comparedMarketMedian?money(item.comparedMarketMedian):"Not enough comparisons"}</p>
        <p>Condition: {item.condition||"Unverified"}; shipping {item.shippingKnown?"included":"is not confirmed"}.</p>
        {item.riskFlags?.map((risk,i)=><p key={i} className="fsRisk">⚠ {risk}</p>)}
        {item.msrpSource&&<a href={item.msrpSource} target="_blank" rel="noreferrer">Manufacturer starting-price source ↗</a>}
      </div>}
      <a className="fsProductLink" href={item.url} target="_blank" rel="noopener noreferrer">
        VIEW AT {String(item.source||item.marketplace||"RETAILER").toUpperCase()} <span>↗</span>
      </a>
    </div>
  </article>;
}
export default function AutomaticDiscovery({providerKeys}){
  const [catalog,setCatalog]=useState(load);
  const [part,setPart]=useState("GPU");
  const [series,setSeries]=useState("All");
  const [model,setModel]=useState("all");
  const [stores,setStores]=useState(()=>STORES.map(x=>x.id));
  const [condition,setCondition]=useState("any");
  const [minimum,setMinimum]=useState("");
  const [maximum,setMaximum]=useState("");
  const [sort,setSort]=useState("best");
  const [limit,setLimit]=useState(24);
  const [auto,setAuto]=useState(true);
  const [speed,setSpeed]=useState(10);
  const [busy,setBusy]=useState(false);
  const [queued,setQueued]=useState("");
  const [message,setMessage]=useState("");
  const [recentProviders,setRecentProviders]=useState([]);
  const [diagnostics,setDiagnostics]=useState(null);
  const busyRef=useRef(false);
  const mountedRef=useRef(true);
  const pendingRef=useRef(null);
  const scanRef=useRef(null);
  const catalogRef=useRef(catalog);
  const partRef=useRef(part);
  catalogRef.current=catalog;
  partRef.current=part;

  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false}},[]);
  useEffect(()=>{try{localStorage.setItem(CACHE_NAME,JSON.stringify(catalog))}catch{}},[catalog]);

  function targetAge(t){return Date.parse(catalogRef.current[t.id]?.checkedAt||"")||0}
  function chooseBatch(category){
    const options=TARGETS.filter(t=>!category||t.category===category);
    // Always scan missing models first; then the oldest model in the selected part.
    return [...options].sort((a,b)=>targetAge(a)-targetAge(b)).slice(0,category?FOCUSED_BATCH:CATALOG_BATCH);
  }
  async function runScan(category=null,deep=false){
    if(busyRef.current){
      pendingRef.current={category,deep};
      if(mountedRef.current)setQueued(category||"next component batch");
      return;
    }
    if(!deep&&typeof document!=="undefined"&&document.visibilityState==="hidden")return;
    const targets=chooseBatch(category);
    if(!targets.length)return;
    busyRef.current=true;
    setBusy(true);setMessage("");setQueued("");
    try{
      const response=await fetch("/api/parts/sniper",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          targets,marketplaces:STORES.map(s=>s.id),deepScan:deep,providerKeys
        }),signal:AbortSignal.timeout(55000)
      });
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Search failed");
      if(!Array.isArray(data.results))throw Error(data.message||"Search provider returned an unexpected response");
      const updates={};
      const time=new Date().toISOString();
      for(const group of data.results){
        updates[group.id]={
          results:(group.results||[]).filter(x=>!blockedOffer(x)).slice(0,55),
          checkedAt:group.searchedAt||time,
          errors:group.errors||[],sourceCoverage:group.sourceCoverage||[],
          providerReports:group.providerReports||[],funnel:group.funnel||null
        };
      }
      if(!mountedRef.current)return;
      setCatalog(prev=>({...prev,...updates}));
      const reports=data.results.flatMap(group=>group.providerReports||[]);
      setRecentProviders(reports);
      setDiagnostics({targets:targets.length,received:reports.reduce((n,x)=>n+x.returned,0),
        eligible:Object.values(updates).reduce((n,x)=>n+x.results.length,0)});
      const providerErrors=data.results.flatMap(group=>group.errors||[]);
      if(providerErrors.length){
        const first=providerErrors[0];
        setMessage("Some sources failed: "+first.provider+" — "+first.message+". Open Source Details below.");
        if(providerErrors.some(e=>/429|quota|credits|limit exceeded/i.test(e.message||"")))setAuto(false);
      }else if(!Object.values(updates).some(x=>x.results.length)){
        setMessage("No qualifying direct listings were returned for this batch. Try another model or check Source Details.");
      }
    }catch(error){
      if(mountedRef.current){
        setMessage("Scan error: "+(error.message||"Unknown provider error"));
        setAuto(false);
      }
    }finally{
      busyRef.current=false;
      if(mountedRef.current){setBusy(false);setQueued("");}
      const pending=pendingRef.current;
      pendingRef.current=null;
      if(pending&&mountedRef.current)Promise.resolve().then(()=>scanRef.current?.(pending.category,pending.deep));
    }
  }
  scanRef.current=runScan;
  // Start with the model group users are actually looking at, rather than
  // spending initial requests on hundreds of unrelated queries.
  useEffect(()=>{scanRef.current?.("GPU",false)},[]);
  useEffect(()=>{
    if(!auto)return;
    const timer=window.setInterval(()=>scanRef.current?.(null,false),speed*60*1000);
    return ()=>window.clearInterval(timer);
  },[auto,speed]);

  function choosePart(next){
    setPart(next);setSeries("All");setModel("all");setLimit(24);
    if(next!=="All")scanRef.current?.(next,false);
  }
  function chooseSeries(value){
    setSeries(value);setModel("all");setLimit(24);
    if(value!=="All"){
      // A series selection needs no API call to filter; the category scan
      // remains explicit and uses existing cached offers where possible.
    }
  }
  const all=useMemo(()=>TARGETS.flatMap(t=>(catalog[t.id]?.results||[]).map(item=>({
    ...item,category:t.category,subtype:t.query,discoveryId:t.id,
    checkedAt:catalog[t.id].checkedAt
  }))),[catalog]);
  const currentTargets=TARGETS.filter(t=>part==="All"||t.category===part);
  const checkedTargets=currentTargets.filter(t=>catalog[t.id]);
  const seriesMatch=t=>part!=="GPU"||series==="All"||(
    series==="Arc"?/\barc\b/i.test(t.query):
      series==="RTX 50"?/\brtx\s?50/i.test(t.query):
      series==="RTX 40"?/\brtx\s?40/i.test(t.query):
      series==="RTX 30"?/\brtx\s?30/i.test(t.query):
      series==="RTX 20"?/\brtx\s?20/i.test(t.query):
      series==="RX 9000"?/\brx\s?9\d{3}/i.test(t.query):
      series==="RX 7000"?/\brx\s?7\d{3}/i.test(t.query):
      /\brx\s?6\d{3}/i.test(t.query)
  );
  const modelChoices=currentTargets.filter(seriesMatch);
  const filtered=filterOffers(all,{
    category:part,model,condition,minimum,maximum
  }).filter(item=>stores.includes(item.marketplace)&&(
    series==="All"||part!=="GPU"||seriesMatch({query:item.subtype||""})
  ));
  const offers=sortOffers(dedupeOffers(filtered),sort);
  const shown=offers.slice(0,limit);
  const coverage=STORES.map(s=>({...s,count:new Set(
    all.filter(x=>x.marketplace===s.id&&(part==="All"||x.category===part)).map(x=>x.url)
  ).size}));
  const latest=Object.values(catalog).map(row=>row.checkedAt).sort().at(-1);
  const scannedAll=TARGETS.filter(t=>catalog[t.id]).length;
  const pageStatus=busy?"SEARCHING":auto?"AUTO WATCH ON":"PAUSED";

  return <div className="fsDealLayout">
    <aside className="fsSidebar" aria-label="PC parts and deal filters">
      <div className="fsSidePanel">
        <h3>⚙ PC PART GROUPS</h3>
        <button className={"fsSidePick "+(part==="All"?"chosen":"")} onClick={()=>choosePart("All")}>All PC components</button>
        {MODELS.map(x=><button key={x.category} className={"fsSidePick "+(part===x.category?"chosen":"")} onClick={()=>choosePart(x.category)}>
          {x.category}<small>{x.targets.length}</small>
        </button>)}
      </div>
      <div className="fsSidePanel">
        <h3>PRICE RANGE</h3>
        <div className="fsPriceInputs">
          <label>MIN $<input type="number" min="0" value={minimum} onChange={e=>setMinimum(e.target.value)} placeholder="Any"/></label>
          <label>MAX $<input type="number" min="0" value={maximum} onChange={e=>setMaximum(e.target.value)} placeholder="Any"/></label>
        </div>
        <h4>PRICING MODE</h4>
        <div className="fsSegment">
          <button className={sort==="price"?"chosen":""} onClick={()=>setSort("price")}>Cheapest</button>
          <button className={sort==="best"?"chosen":""} onClick={()=>setSort("best")}>Best Deal</button>
          <button className={sort==="newest"?"chosen":""} onClick={()=>setSort("newest")}>Newest</button>
        </div>
      </div>
      <div className="fsSidePanel">
        <h3>CONDITION</h3>
        <label className="fsInputLabel">Listing condition
          <select value={condition} onChange={e=>setCondition(e.target.value)}>
            <option value="any">Any working condition</option>
            <option value="new">New</option><option value="used">Used</option>
            <option value="open-box">Open box</option><option value="refurbished">Refurbished</option>
            <option value="renewed">Renewed</option>
          </select>
        </label>
      </div>
      <div className="fsSidePanel">
        <h3>RETAILERS</h3>
        {coverage.map(s=><label className="fsRetailer" key={s.id}>
          <input type="checkbox" checked={stores.includes(s.id)} onChange={e=>
            setStores(prev=>e.target.checked?[...prev,s.id]:prev.filter(id=>id!==s.id))}/>
          <span>{s.name}</span><small>{s.count||"—"}</small>
        </label>)}
      </div>
    </aside>

    <section className="fsDealMain">
      <div className="fsCategoryStrip">
        {QUICK.map(([cat,title])=><button key={cat} className={part===cat?"chosen":""} onClick={()=>choosePart(cat)}>{title}</button>)}
      </div>
      <header className="fsDealTitle">
        <div><span className="fsEyebrow">FLIPSCOUT / LIVE PC COMPONENTS</span>
          <h1>{part==="All"?"FIND YOUR NEXT BUILD DEAL":part==="GPU"?"GPU PRICE TRACKER":part.toUpperCase()+" DEAL TRACKER"}</h1>
          <p>Real retailer offers · New, used and refurbished · Sorted from loaded results, not a new search</p>
        </div>
        <div className="fsHeaderStat"><strong>{offers.length}</strong><small>DISPLAYED DEALS</small></div>
      </header>
      {part==="GPU"&&<nav className="fsSeriesNav" aria-label="GPU series">{GPU_SERIES.map(([id,name])=>
        <button key={id} onClick={()=>chooseSeries(id)} className={series===id?"chosen":""}>{name}</button>
      )}</nav>}
      <div className="fsScanControls">
        <div className="fsScanLive"><span className={"fsPulse "+(auto?"enabled":"")}></span>
          <div><b>{pageStatus}</b><small>{scannedAll}/{TARGETS.length} model searches checked · Last {timestamp(latest)}</small></div></div>
        <button className="fsSmallButton" onClick={()=>setAuto(a=>!a)}>{auto?"PAUSE":"RESUME"}</button>
        <select aria-label="Automatic refresh interval" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
          <option value={10}>Auto: 10 min</option><option value={5}>Auto: 5 min (high usage)</option>
          <option value={30}>Auto: 30 min</option>
        </select>
        <button className="fsScanButton" disabled={busy} onClick={()=>scanRef.current?.(part==="All"?null:part,true)}>
          {busy?"SCANNING…":part==="All"?"SCAN NEXT MODELS":"DEEP SCAN "+part}
        </button>
      </div>
      <div className="fsSubfilters">
        <label>MODEL / VARIATION
          <select value={model} onChange={e=>setModel(e.target.value)}>
            <option value="all">All {part==="GPU"&&series!=="All"?series+" ":""}models ({modelChoices.length})</option>
            {modelChoices.map(m=><option value={m.id} key={m.id}>{m.query}</option>)}
          </select>
        </label>
        <label>SORT LOADED DEALS
          <select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="best">Best deal / biggest savings</option>
            <option value="price">Lowest total price</option>
            <option value="newest">Newest scanned first</option>
          </select>
        </label>
        <div className="fsLoadedCount">{currentTargets.filter(t=>catalog[t.id]).length}/{currentTargets.length} model searches checked</div>
      </div>
      {message&&<div className="fsMarketWarning" role="status">{message}</div>}
      {queued&&<div className="fsMarketWarning">Queued: {queued}. The current scan must finish first.</div>}
      <p className="fsMarketNote">Auto-watch checks a small rotating batch while this browser tab is open. Five-minute mode consumes more provider credits. Filtering and sorting do not make a search request. Store counts show usable direct offers, not guaranteed inventory.</p>
      {shown.length?
        <div className="fsProducts">{shown.map(item=><ItemCard key={item.url} item={item}/>)}</div>:
        <div className="fsNoDeals">
          <h3>{busy?"Looking for genuine listings…":"No matching listings loaded yet"}</h3>
          <p>{part!=="All"?
            "Try DEEP SCAN "+part+" to search this component now. If none appear, check Source Details below for marketplace errors or link filtering.":
            "A rolling scan starts with core components and fills this board over time."}</p>
          <button className="fsScanButton" disabled={busy} onClick={()=>scanRef.current?.(part==="All"?null:part,true)}>SEARCH {part==="All"?"MORE COMPONENTS":part+" NOW"}</button>
        </div>}
      {limit<offers.length&&<button className="fsShowMore" onClick={()=>setLimit(v=>v+24)}>SHOW MORE ({offers.length-limit} REMAINING) ↓</button>}
      <details className="fsSourceDetails">
        <summary>SOURCE DETAILS & DIAGNOSTICS</summary>
        <p>Last scan: {diagnostics?diagnostics.targets+" model(s), "+diagnostics.received+" raw candidates and "+diagnostics.eligible+" saved offers":"No scan completed yet"}. Results may be rejected for missing direct retailer URLs, incomplete price data, wrong model, or broken condition.</p>
        {recentProviders.length?recentProviders.map((p,i)=><div key={i} className="fsProviderRow">
          <b>{p.provider}</b><span>{p.status} · {p.returned} candidates</span>
          {p.message&&<small>{p.message}</small>}</div>):<p>Run a scan for provider-specific results.</p>}
      </details>
    </section>
  </div>;
}
