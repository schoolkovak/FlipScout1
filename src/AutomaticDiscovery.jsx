import React,{useEffect,useMemo,useRef,useState} from "react";
import {CORE_DISCOVERY_TARGETS as TARGETS,CORE_PC_CATEGORIES as PARTS} from "../shared/discovery.js";
import {SNIPER_MARKETPLACES as STORES} from "../shared/sniper.js";
import {dedupeOffers,filterOffers,offerReference,offerTotal,savingsPercent,sortOffers} from "./dealSort.js";

const CACHE_NAME="flipscout-deals-catalog-v2";
const PROVIDER_COOLDOWN="flipscout-searchapi-cooldown-v1";
function readProviderCooldown(){
  try{return Number(localStorage.getItem(PROVIDER_COOLDOWN)||0)}catch{return 0}
}
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
export function ItemCard({item}){
  const [details,setDetails]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const reference=offerReference(item);
  const saved=savingsPercent(item);
  const isBelow=saved!==null&&saved>=0;
  return <article className="fsProduct" data-store={item.marketplace}>
    <div className="fsProductHeading">
      <b>{item.subtype||item.category}</b>
      {reference&&isBelow&&<span className="fsSaveBadge">BELOW {item.msrp?"MSRP":"MARKET"}</span>}
    </div>
    <div className="fsProductVisual">
      {item.imageUrl&&!imageFailed?
        <img src={item.imageUrl} alt={item.title||"PC part"} loading="lazy" referrerPolicy="no-referrer"
          onError={()=>setImageFailed(true)}/>:
        <div className="fsImageFallback"><span>NO IMAGE</span><small>Check retailer photos</small></div>}
    </div>
    <div className="fsProductInfo">
      <div className="fsStoreLine"><span>{item.source||item.marketplace}</span><b>{item.condition||"VERIFY CONDITION"}</b></div>
      <h3 title={item.title}>{item.title}</h3>
      <div className="fsProductDesc">{item.category} · {item.subtype}</div>
      {item.category==="GPU"&&<div className="fsHardwareSpecs">{(item.title||"").match(/\b(\d{1,2})\s?GB\b/i)&&<span>VRAM <b>{(item.title||"").match(/\b(\d{1,2})\s?GB\b/i)[1]} GB</b></span>}</div>}
      <div className="fsPrice"><strong>{money(offerTotal(item))}</strong>
        {saved!==null&&<b className={isBelow?"fsPositive":"fsNegative"}>{Math.abs(saved).toFixed(1)}% {isBelow?"below":"above"} {item.msrp?"MSRP":"market"}</b>}
      </div>
      <div className="fsPriceExtra">
        <span>{reference?reference.type+": "+money(reference.price):"No verified MSRP or comparable price"}</span>
        <span>{item.shippingKnown?"Delivered total":"Shipping not confirmed"}</span>
        {item.linkType==="shopping"&&<span className="fsIndirectLabel">Google Shopping link — final retailer price must be verified</span>}
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
        {item.linkType==="shopping"?"COMPARE VIA GOOGLE SHOPPING":"VIEW AT "+String(item.source||item.marketplace||"RETAILER").toUpperCase()} <span>↗</span>
      </a>
    </div>
  </article>;
}
export default function AutomaticDiscovery({providerKeys,onOpenScanner}){
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

  const [searchApiUntil,setSearchApiUntil]=useState(readProviderCooldown);
  const [brand,setBrand]=useState("all");
  const [minVram,setMinVram]=useState("");
  const [overclocked,setOverclocked]=useState(false);
  const [cooling,setCooling]=useState("all");
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
  function chooseBatch(category,group=null){
    const options=TARGETS.filter(t=>(!category||t.category===category)&&(!group||group==="All"||(
      group==="Arc"?/\barc\b/i.test(t.query):
      t.query.toLowerCase().includes(group.toLowerCase().replace("rx ","rx ").replace("rtx ","rtx "))
    )));
    // Always scan missing models first; then the oldest model in the selected part.
    return [...options].sort((a,b)=>targetAge(a)-targetAge(b)).slice(0,category?FOCUSED_BATCH:CATALOG_BATCH);
  }
  async function runScan(category=null,deep=false,group=null){
    if(busyRef.current){
      pendingRef.current={category,deep,group};
      if(mountedRef.current)setQueued(category||"next component batch");
      return;
    }
    if(!deep&&typeof document!=="undefined"&&document.visibilityState==="hidden")return;
    const targets=chooseBatch(category,group);
    if(!targets.length)return;
    busyRef.current=true;
    setBusy(true);setMessage("");setQueued("");
    try{
      const response=await fetch("/api/parts/sniper",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          targets,marketplaces:STORES.map(s=>s.id),deepScan:deep,providerKeys,
          skipSearchApi:searchApiUntil>Date.now()
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
      setCatalog(prev=>{
        const merged={...prev};
        for(const [id,row] of Object.entries(updates)){
          // A failed refresh must not erase an earlier usable offer set.
          if(!row.results.length&&row.errors.length&&prev[id]?.results?.length){
            merged[id]={...prev[id],lastError:row.errors[0]?.message};
          }else merged[id]=row;
        }
        return merged;
      });
      const reports=data.results.flatMap(group=>group.providerReports||[]);
      const byProvider=new Map();
      for(const p of reports){
        const prior=byProvider.get(p.provider)||{provider:p.provider,returned:0,failures:0,status:"empty",message:null};
        prior.returned+=p.returned||0;
        if(p.status==="error"){prior.failures++;prior.status="error";prior.message=p.message}
        else if(prior.status!=="error"&&p.status==="results")prior.status="results";
        byProvider.set(p.provider,prior);
      }
      setRecentProviders([...byProvider.values()]);
      const rejected={};
      for(const group of data.results)for(const [reason,count] of Object.entries(group.funnel?.discarded||{}))
        rejected[reason]=(rejected[reason]||0)+count;
      setDiagnostics({targets:targets.length,received:reports.reduce((n,x)=>n+x.returned,0),
        eligible:Object.values(updates).reduce((n,x)=>n+x.results.length,0),rejected});
      const providerErrors=data.results.flatMap(group=>group.errors||[]);
      if(providerErrors.length){
        const first=providerErrors[0];
        setMessage("Some sources failed: "+first.provider+" — "+first.message+". Open Source Details below.");
        if(providerErrors.some(e=>/searchapi/i.test(e.provider||"")&&/429|quota|credits|rate.limit/i.test(e.message||""))||
           providerErrors.some(e=>/searchapi/i.test(e.message||"")&&/429/i.test(e.message||""))){
          const until=Date.now()+6*60*60*1000;
          setSearchApiUntil(until);
          try{localStorage.setItem(PROVIDER_COOLDOWN,String(until))}catch{}
          setMessage("SearchAPI has hit its 429 limit and is paused for six hours. Available Serper searches will continue; no repeated SearchAPI charges.");
        }
        if(providerErrors.some(e=>/serper/i.test(e.message||"")&&/429|quota/i.test(e.message||"")))setAuto(false);
      }else if(!Object.values(updates).some(x=>x.results.length)){
        setMessage("No qualifying priced listings from connected search sources. Check Source Details for model, link, and price rejections.");
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
      if(pending&&mountedRef.current)Promise.resolve().then(()=>scanRef.current?.(pending.category,pending.deep,pending.group));
    }
  }
  scanRef.current=runScan;
  // Start with the model group users are actually looking at, rather than
  // spending initial requests on hundreds of unrelated queries.
  useEffect(()=>{scanRef.current?.("GPU",false)},[]);
  useEffect(()=>{
    if(!auto)return;
    const timer=window.setInterval(()=>{
      if(document.visibilityState==="visible")scanRef.current?.(
        partRef.current==="All"?null:partRef.current,false
      );
    },60*60*1000);
    return ()=>window.clearInterval(timer);
  },[auto]);

  function choosePart(next){
    setPart(next);setSeries("All");setModel("all");setBrand("all");setLimit(24);
    if(next!=="All")scanRef.current?.(next,false);
  }
  function chooseSeries(value){
    setSeries(value);setModel("all");setLimit(24);
    if(value!=="All"&&!TARGETS.some(t=>t.category==="GPU"&&catalogRef.current[t.id]&&t.query.toLowerCase().includes(value.toLowerCase()))){
      scanRef.current?.("GPU",false,value);
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
  }).filter(item=>stores.includes(item.marketplace)&&
    (series==="All"||part!=="GPU"||seriesMatch({query:item.subtype||""}))&&
    (brand==="all"||new RegExp("\\b"+brand+"\\b","i").test(item.title||""))&&
    (!minVram||part!=="GPU"||Number((item.title||"").match(/(\d+)\s?GB/i)?.[1]||0)>=Number(minVram))&&
    (!overclocked||/\boc\b|overclock/i.test(item.title||""))&&
    (cooling==="all"||!(part==="GPU")||
      (cooling==="liquid"?/water.block|liquid.cool/i.test(item.title||""):
         !/water.block|liquid.cool/i.test(item.title||"")))
  );
  const offers=sortOffers(dedupeOffers(filtered),sort);
  const shown=offers.slice(0,limit);
  const coverage=STORES.map(s=>({...s,count:new Set(
    all.filter(x=>x.marketplace===s.id&&(part==="All"||x.category===part)).map(x=>x.url)
  ).size}));
  const latest=Object.values(catalog).map(row=>row.checkedAt).sort().at(-1);
  const scannedAll=TARGETS.filter(t=>catalog[t.id]).length;
  const pageStatus=busy?"SEARCHING":auto?"HOURLY AUTO-SCAN ON":"PROVIDER SCAN PAUSED";

  return <div className="fsDealLayout">
    <aside className="fsSidebar" aria-label="PC parts and deal filters">
      <div className="fsSidePanel">
        <h3>⚙ PART GROUP <span className="fsPanelChevron">⌄</span></h3>
        {part==="GPU"?<>
          {GPU_SERIES.map(([value,name])=><button key={value}
            className={"fsSidePick "+(series===value?"chosen":"")}
            onClick={()=>chooseSeries(value)}><span>{name}</span><span>{value==="All"?"☰":value.startsWith("RTX")?"⚡":value.startsWith("RX")?"♨":"★"}</span></button>)}
        </>:<>
          <button className="fsSidePick" onClick={()=>choosePart("GPU")}>← All GPUs</button>
          <button className={"fsSidePick "+(model==="all"?"chosen":"")} onClick={()=>setModel("all")}>Show all {part}</button>
          {modelChoices.slice(0,15).map(t=><button key={t.id} className={"fsSidePick "+(model===t.id?"chosen":"")}
            onClick={()=>setModel(t.id)}>{t.query}</button>)}
        </>}
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
        <h3>⚑ FILTERS <span className="fsPanelChevron">⌄</span></h3>
        {part==="GPU"&&<>
          <label className="fsInputLabel">Minimum VRAM (GB)
            <input min="0" type="number" placeholder="e.g. 12" value={minVram} onChange={e=>setMinVram(e.target.value)}/>
          </label>
          <label className="fsInputLabel">Cooling type
            <select value={cooling} onChange={e=>setCooling(e.target.value)}>
              <option value="all">Any cooler</option><option value="air">Air cooled</option>
              <option value="liquid">Liquid cooled</option>
            </select>
          </label>
          <label className="fsRetailer"><input type="checkbox" checked={overclocked} onChange={e=>setOverclocked(e.target.checked)}/>Overclocked (OC)</label>
        </>}
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
        <h3>◈ RETAILERS <span className="fsPanelChevron">⌄</span></h3>
        {coverage.map(s=><label className="fsRetailer" key={s.id}>
          <input type="checkbox" checked={stores.includes(s.id)} onChange={e=>
            setStores(prev=>e.target.checked?[...prev,s.id]:prev.filter(id=>id!==s.id))}/>
          <span>{s.name}</span><small>{s.count||"—"}</small>
        </label>)}
      </div>
      {part==="GPU"&&<div className="fsSidePanel">
        <h3>▣ MANUFACTURERS <span className="fsPanelChevron">⌄</span></h3>
        {["all","ASUS","MSI","Gigabyte","Zotac","EVGA","PNY","Sapphire","PowerColor","XFX","NVIDIA","Intel"].map(name=>
          <label className="fsRetailer" key={name}><input type="radio" name="gpu-brand" value={name}
            checked={brand===name} onChange={()=>setBrand(name)}/>{name==="all"?"All manufacturers":name}</label>)}
      </div>}
    </aside>

    <section className="fsDealMain">
      <div className="fsCategoryStrip">
        {QUICK.map(([cat,title])=><button key={cat} className={part===cat?"chosen":""} onClick={()=>choosePart(cat)}>{title}</button>)}
      </div>
      <header className="fsDealTitle">
        <div><span className="fsEyebrow">FLIPSCOUT / LIVE PRICE INTELLIGENCE</span>
          <h1>{part==="All"?"TRACK THE BEST PC HARDWARE DEALS":part==="GPU"&&series!=="All"?"TRACK "+series+" SERIES GPU PRICES":part==="GPU"?"TRACK GRAPHICS CARD PRICES":"TRACK "+part.toUpperCase()+" PRICES"}</h1>
          <div className="fsHeroLine" aria-hidden="true"></div>
          <h2>The best hardware deal is the one you can actually buy.</h2>
          <p>Compare real seller offers, their condition and current prices. Our scanner excludes incomplete hardware and shows where every result came from.</p>
          <div className="fsHeroLine" aria-hidden="true"></div>
          <p className="fsHeroCaution">Always verify the seller, images, working condition and final delivered price before purchasing.</p>
        </div>
        <div className="fsHeaderStat"><strong>{offers.length}</strong><small>DISPLAYED DEALS</small></div>
      </header>
      {part==="GPU"&&<nav className="fsSeriesNav" aria-label="GPU series">{GPU_SERIES.map(([id,name])=>
        <button key={id} onClick={()=>chooseSeries(id)} className={series===id?"chosen":""}>{name}</button>
      )}</nav>}
      <div className="fsBreadcrumb"><strong>{part==="GPU"?"GPU":part}</strong>
        <span>›</span> <span>{series==="All"?"All models":series}</span>
        {model!=="all"&&<><span>›</span><b>{TARGETS.find(t=>t.id===model)?.query}</b></>}
      </div>
      <div className="fsScanControls">
        <div className="fsScanLive"><span className={"fsPulse "+(auto?"enabled":"")}></span>
          <div><b>{pageStatus}</b><small>{scannedAll}/{TARGETS.length} model searches checked · Last {timestamp(latest)}</small></div></div>
        <button className="fsSmallButton" onClick={()=>setAuto(a=>!a)}>{auto?"PAUSE":"RESUME"}</button>
        <span className="fsHourlyLabel">Auto refresh · every hour</span>
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
      <p className="fsMarketNote">Auto-watch checks a rotating batch automatically once per hour while the tab is open and visible. It does not continuously scan when the browser is closed. Store availability depends on provider access. Sorting, retailer filters, manufacturer and price controls rearrange existing offers without new searches.</p>
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
      <button type="button" className="fsOpenScanner" onClick={onOpenScanner}>OPEN MANUAL PART SCANNER →</button>
      <details className="fsSourceDetails">
        <summary>SOURCE DETAILS & DIAGNOSTICS</summary>
        <p>Last scan: {diagnostics?diagnostics.targets+" model(s), "+diagnostics.received+" raw candidates and "+diagnostics.eligible+" saved offers":"No scan completed yet"}. Only priced, model-matched complete hardware is retained.</p>
        {diagnostics?.rejected&&<p>Filtered out: {Object.entries(diagnostics.rejected).filter(([,n])=>n>0).map(([name,n])=>name+" "+n).join(" · ")||"none"}.</p>}
        {searchApiUntil>Date.now()&&<p>SearchAPI cooldown active. Checks continue on other connected sources.</p>}
        {recentProviders.length?recentProviders.map((p,i)=><div key={i} className="fsProviderRow">
          <b>{p.provider}</b><span>{p.status} · {p.returned} candidates</span>
          {p.message&&<small>{p.message}</small>}</div>):<p>Run a scan for provider-specific results.</p>}
      </details>
    </section>
  </div>;
}
