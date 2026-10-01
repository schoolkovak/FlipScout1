import React,{useEffect,useMemo,useState} from "react";
import {
  Search,Cpu,Gauge,ShoppingCart,ExternalLink,Database,AlertTriangle,
  RefreshCw,CheckCircle2,ShieldCheck,MapPin,TrendingUp
} from "lucide-react";
import {fallbackPcEstimate} from "./valuation";
import {
  GPUS,CPUS,RAM_OPTIONS,STORAGE_OPTIONS,MOTHERBOARDS,PSU_OPTIONS,
  CASE_OPTIONS,COOLER_OPTIONS,SCANNER_CATEGORIES,MARKET_SNAPSHOT
} from "../shared/catalog.js";

function money(v){
  if(v===null||v===undefined||Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}

function Datalist({id,items}){
  return <datalist id={id}>{items.map(x=><option key={x.name} value={x.name}/>)}</datalist>;
}

const EMPTY_KEYS={SERPER_API_KEY:"",SEARCHAPI_API_KEY:""};

function loadProviderKeys(){
  try{
    const saved=JSON.parse(localStorage.getItem("flipscout-provider-keys")||"{}");
    return {...EMPTY_KEYS,...saved};
  }catch{
    return {...EMPTY_KEYS};
  }
}

function ProviderSetup({providerKeys,setProviderKeys}){
  const [draft,setDraft]=useState(providerKeys);
  const [saved,setSaved]=useState(false);
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
      const r=await fetch("/api/providers/test",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({providerKeys:clean})
      });
      const data=await r.json();
      setVerification(data);
      localStorage.setItem("flipscout-provider-verification",JSON.stringify(data));
      return data;
    }catch{
      const data={error:"Could not reach the provider test endpoint."};
      setVerification(data);
      return data;
    }finally{
      setTesting(false);
    }
  }

  async function save(){
    const clean={
      SERPER_API_KEY:String(draft.SERPER_API_KEY||"").trim(),
      SEARCHAPI_API_KEY:String(draft.SEARCHAPI_API_KEY||"").trim()
    };
    localStorage.setItem("flipscout-provider-keys",JSON.stringify(clean));
    setProviderKeys(clean);
    setDraft(clean);
    await verify(clean);
    setSaved(true);
    setTimeout(()=>setSaved(false),1800);
  }

  function clear(){
    localStorage.removeItem("flipscout-provider-keys");
    localStorage.removeItem("flipscout-provider-verification");
    setDraft({...EMPTY_KEYS});
    setProviderKeys({...EMPTY_KEYS});
    setVerification(null);
  }

  return <section className={"panel keyPanel "+(verified?"keyConnected":"")}>
    <div className="sectionTitle">
      <div><span className="eyebrow">LIVE DATA CONNECTION</span><h2>{verified?"Live market data verified":configured?"Keys saved — verification needed":"Connect live market data"}</h2></div>
      {verified?<CheckCircle2 className="good"/>:<Database/>}
    </div>
    <p className="keyIntro">Keys are stored only in this browser and sent to FlipScout's own API when you run a search. Saving them performs one real test request to each configured provider.</p>
    <div className="keyGrid">
      <label>Serper API key<input type="password" autoComplete="off" value={draft.SERPER_API_KEY} onChange={e=>setDraft({...draft,SERPER_API_KEY:e.target.value})} placeholder="Paste Serper key"/></label>
      <label>SearchAPI key<input type="password" autoComplete="off" value={draft.SEARCHAPI_API_KEY} onChange={e=>setDraft({...draft,SEARCHAPI_API_KEY:e.target.value})} placeholder="Paste SearchAPI key"/></label>
    </div>
    {verification&&<div className="verificationGrid">
      <div className={verification.serper?.verified?"verifyGood":"verifyBad"}><b>Serper</b><span>{verification.serper?.verified?"Verified · "+verification.serper.resultCount+" results":verification.serper?.configured?"Not verified":"Not configured"}</span>{verification.serper?.error&&<small>{verification.serper.error}</small>}</div>
      <div className={verification.searchapi?.verified?"verifyGood":"verifyBad"}><b>SearchAPI</b><span>{verification.searchapi?.verified?"Verified · "+verification.searchapi.resultCount+" results":verification.searchapi?.configured?"Not verified":"Not configured"}</span>{verification.searchapi?.error&&<small>{verification.searchapi.error}</small>}</div>
    </div>}
    <div className="keyActions"><button className="primary" onClick={save} disabled={testing}>{testing?<><RefreshCw className="spin" size={17}/>Testing keys...</>:saved?"Verified & saved":"Save and test keys"}</button>{configured&&<button className="ghost" onClick={()=>verify(providerKeys)} disabled={testing}>Re-test</button>}{configured&&<button className="ghost" onClick={clear}>Clear</button>}</div>
  </section>;
}

function IdentityNotice({live,result}){
  const validation=live?.validation||result?.compatibility?.resolved;
  if(!validation) return null;
  const rows=[["CPU",validation.cpu],["GPU",validation.gpu]];
  return <div className="identityGrid">
    {rows.map(([label,x])=><div className={"identityRow "+(x?.status==="unknown"?"identityBad":"identityGood")} key={label}>
      <b>{label}</b>
      {!x?.item
        ? <span><AlertTriangle size={15}/>{x?.status==="ambiguous"?"Exact variant needed":"Unknown"}: “{x?.input}”{x?.suggestions?.length?<small>{x.status==="ambiguous"?"Choose one: ":"Did you mean "}{x.suggestions.join(", ")}?</small>:null}</span>
        : <span><CheckCircle2 size={15}/>{x?.status==="fuzzy"?"Interpreted as ":"Recognized: "}<strong>{x?.canonical}</strong></span>}
    </div>)}
  </div>;
}

function ResaleCards({live,price}){
  if(!live?.valid) return null;
  const online=live.resale?.online;
  const local=live.resale?.local;
  const onlineCosts=online?.costs?.estimatedTotal??null;
  const onlineProfit=online?.likely&&onlineCosts!=null?online.likely-Number(price||0)-onlineCosts:null;
  const localProfit=local?.likely?local.likely-Number(price||0):null;

  return <div className="resaleSection">
    <div className="resaleHeader"><TrendingUp size={20}/><div><h3>Likely resale prices from real-market evidence</h3><p>Online and local are calculated separately because buyers and costs differ.</p></div></div>
    <div className="resaleGrid">
      <div className="resaleCard">
        <span>ONLINE LIKELY SALE</span>
        <strong>{money(online?.likely)}</strong>
        <small>{online?.low!=null?money(online.low)+"–"+money(online.high):"Range unavailable"}</small>
        <p>{online?.method||"No online evidence yet."}</p>
        {online?.salesBacked&&<div className="evidenceBadge">Sales-backed · {online.confidence} confidence</div>}
        {online?.costs&&<div className="costBreakdown"><span>eBay fee estimate: {money(online.costs.platformFee)}</span><span>Median comp shipping: {money(online.costs.shippingMedian)}</span><span>Total estimated online selling cost: {money(online.costs.estimatedTotal)}</span></div>}
        {onlineProfit!=null&&<div className={onlineProfit>=0?"profitLine good":"profitLine bad"}>Approx. online profit after estimated fees/shipping: {money(onlineProfit)}</div>}
      </div>
      <div className="resaleCard">
        <span><MapPin size={13}/> LOCAL LIKELY SALE</span>
        <strong>{money(local?.likely)}</strong>
        {local
          ? <>
              <small>{money(local.low)}–{money(local.median)} likely zone · {local.sampleSize} nearby comps</small>
              <p>Within {local.distanceRadius} miles of ZIP {local.postalCode}. {local.method}</p>
              {localProfit!=null&&<div className={localProfit>=0?"profitLine good":"profitLine bad"}>Approx. local cash profit before travel/time: {money(localProfit)}</div>}
            </>
          : <p>Add a ZIP code and connect SearchAPI to calculate a real nearby local-pickup market.</p>}
      </div>
    </div>
  </div>;
}

function SalesEvidence({evidence}){
  if(!evidence) return null;
  if(!evidence.listingCount) return <div className="evidenceEmpty"><b>No sales-backed listings found for this exact CPU/GPU combo.</b><span>FlipScout will use current asking comps and component data, but it will not pretend those are completed sales.</span></div>;
  return <div className="salesEvidence">
    <div className="salesEvidenceHead">
      <div><span className="eyebrow">REAL SALES EVIDENCE</span><h3>{evidence.listingCount} eBay listings reporting prior sales</h3></div>
      <div className="salesStat"><b>{money(evidence.median)}</b><span>sales-backed median</span></div>
      <div className="salesStat"><b>{evidence.totalReportedUnitsSold}</b><span>reported units sold</span></div>
    </div>
    <p className="evidenceCaveat">These are active eBay listings that report real prior units sold. Their displayed price is the current listing price; eBay no longer exposes public completed-listing history without signed-in/limited-release access.</p>
    <div className="evidenceList">
      {(evidence.listings||[]).slice(0,8).map((x,i)=><div className="evidenceItem" key={i}>
        <div><b>{x.title}</b><small>{x.soldCount} reported sold · {x.condition||"condition unknown"} · {x.seller||"seller"}</small></div>
        <div className="evidencePrice">{money(x.price)}</div>
        {x.url&&<a href={x.url} target="_blank" rel="noreferrer" aria-label="View sales-backed listing"><ExternalLink size={15}/></a>}
      </div>)}
    </div>
  </div>;
}

function Analyzer({providerKeys}){
  const [price,setPrice]=useState(950);
  const [cpu,setCpu]=useState("Ryzen 5 5600");
  const [gpu,setGpu]=useState("RTX 4060");
  const [ram,setRam]=useState("16GB DDR4-3600 (2x8GB)");
  const [storage,setStorage]=useState("1TB NVMe SSD");
  const [motherboard,setMotherboard]=useState("B550 AM4 Motherboard");
  const [psu,setPsu]=useState("650W 80+ Gold PSU");
  const [caseType,setCaseType]=useState("Midrange Tempered Glass RGB Case");
  const [cooler,setCooler]=useState("Basic Tower Air Cooler");
  const [postalCode,setPostalCode]=useState("");
  const [distanceRadius,setDistanceRadius]=useState(50);
  const [purpose,setPurpose]=useState("flip");
  const [result,setResult]=useState(null);
  const [live,setLive]=useState(null);
  const [loading,setLoading]=useState(false);

  function sample(){
    setPrice(950);setCpu("Ryzen 5 5600");setGpu("RTX 4060");
    setRam("16GB DDR4-3600 (2x8GB)");setStorage("1TB NVMe SSD");
    setMotherboard("B550 AM4 Motherboard");setPsu("650W 80+ Gold PSU");
    setCaseType("Midrange Tempered Glass RGB Case");setCooler("Basic Tower Air Cooler");
  }

  async function analyze(){
    const input={price,cpu,gpu,ram,storage,motherboard,psu,caseType,cooler,postalCode,distanceRadius,purpose,providerKeys};
    const fallback=fallbackPcEstimate(input);
    setResult(fallback);setLive(null);setLoading(true);
    try{
      const r=await fetch("/api/market/pc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      if(r.ok){
        const d=await r.json();
        setLive(d);
        if(d.valid===false){
          setResult({...fallback,score:0,identityValid:false});
          return;
        }
        if(d.available){
          const resale=d.resale?.online?.likely||d.market.median;
          const sellingCosts=d.resale?.online?.costs?.estimatedTotal??Math.round(resale*.0735+.40);
          const profit=resale-Number(price||0)-sellingCosts;
          const targetProfit=Math.max(120,Math.round(resale*.15));
          const maxBuy=Math.max(0,resale-sellingCosts-targetProfit);
          const discount=resale?(resale-Number(price||0))/resale:0;
          const warningPenalty=(fallback.compatibility?.warnings?.length||0)*12;
          const evidenceBoost=d.resale?.online?.salesBacked?7:0;
          const score=Math.max(0,Math.min(100,Math.round(54+discount*92-warningPenalty+evidenceBoost)));
          setResult({...fallback,low:d.market.low,high:d.market.high,resale,sellingCosts,profit,maxBuy,score,identityValid:true});
        }
      }
    }catch{
      setLive({available:false,valid:fallback.identityValid,message:"Live market service is unavailable; showing fallback only."});
    }finally{setLoading(false);}
  }

  return <section className="panel">
    <div className="sectionTitle">
      <div><span className="eyebrow">COMPLETE PC ANALYZER</span><h2>Price the whole build against the real market</h2></div>
      <button className="ghost" onClick={sample}>Load sample</button>
    </div>

    <Datalist id="cpu-options" items={CPUS}/>
    <Datalist id="gpu-options" items={GPUS}/>

    <div className="formGrid">
      <label>Asking price<input type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>CPU<input list="cpu-options" value={cpu} onChange={e=>setCpu(e.target.value)} placeholder="e.g. Ryzen5-5600X"/></label>
      <label>GPU<input list="gpu-options" value={gpu} onChange={e=>setGpu(e.target.value)} placeholder="e.g. RTX5070-Ti"/></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}>{RAM_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}>{STORAGE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Motherboard<select value={motherboard} onChange={e=>setMotherboard(e.target.value)}>{MOTHERBOARDS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Power supply<select value={psu} onChange={e=>setPsu(e.target.value)}>{PSU_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Case<select value={caseType} onChange={e=>setCaseType(e.target.value)}>{CASE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>CPU cooling<select value={cooler} onChange={e=>setCooler(e.target.value)}>{COOLER_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>ZIP for local comps<input inputMode="numeric" maxLength={5} value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="Optional"/></label>
      <label>Local radius<select value={distanceRadius} onChange={e=>setDistanceRadius(Number(e.target.value))}><option value={25}>25 miles</option><option value={50}>50 miles</option><option value={100}>100 miles</option></select></label>
      <label>Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
    </div>

    <button className="primary" onClick={analyze} disabled={loading}>
      {loading?<><RefreshCw className="spin" size={18}/>Searching live comps & sales evidence...</>:<><Gauge size={18}/>Analyze build</>}
    </button>

    {(result||live)&&<IdentityNotice live={live} result={result}/>}

    {result&&result.identityValid!==false&&<div className="resultsGrid">
      <div className="scoreCard"><span>FLIP SCORE</span><strong>{result.score}</strong><small>/100</small></div>
      <div className="metric"><span>Blended market range</span><b>{money(result.low)}–{money(result.high)}</b><small>{live?.available?"Live-market adjusted":"Fallback snapshot "+MARKET_SNAPSHOT}</small></div>
      <div className="metric"><span>Online likely resale</span><b>{money(live?.resale?.online?.likely||result.resale)}</b><small>{live?.resale?.online?.salesBacked?"Sales-backed":"Asking/model based"}</small></div>
      <div className="metric"><span>Local likely resale</span><b>{money(live?.resale?.local?.likely)}</b><small>{postalCode?"Nearby pickup comps":"Add ZIP"}</small></div>
      <div className="metric"><span>Potential online profit</span><b className={result.profit>=0?"good":"bad"}>{money(result.profit)}</b></div>
      <div className="metric"><span>Max buy price</span><b>{money(result.maxBuy)}</b></div>
    </div>}

    {live?.valid&&<ResaleCards live={live} price={price}/>}
    {live?.valid&&<SalesEvidence evidence={live.salesEvidence}/>}

    {result&&<div className="analysisColumns">
      <div className="compatCard">
        <h3><ShieldCheck size={18}/>Compatibility & part identity</h3>
        {(result.compatibility?.positives||[]).map((x,i)=><p className="positiveLine" key={"p"+i}><CheckCircle2 size={15}/>{x}</p>)}
        {(result.compatibility?.warnings||[]).map((x,i)=><p className="warningLine" key={"w"+i}><AlertTriangle size={15}/>{x}</p>)}
        {!result.compatibility?.warnings?.length&&<p className="muted">No obvious compatibility problems found from the selected parts.</p>}
      </div>

      {live?.components&&<div className="liveBreakdown">
        <h3><CheckCircle2 size={18}/>Component value inputs</h3>
        <div className="breakdownGrid">
          {Object.entries(live.components||{}).map(([name,x])=><div key={name}><span>{name}</span><b>{money(x.value)}</b><small>{x.source} · {x.sampleSize||0} comps</small></div>)}
        </div>
        {live.completePc?.sampleSize>0&&<p className="muted">Also checked {live.completePc.sampleSize} comparable complete-PC listings.</p>}
      </div>}
    </div>}

    {result&&<div className="why"><h3>How FlipScout values the build</h3><p>Part identity is validated first, including typo and hyphen normalization. Real live comps and sales-backed eBay evidence take priority. If a market source is unavailable, FlipScout labels the fallback instead of presenting it as live data.</p></div>}
  </section>
}

function Scanner({providerKeys}){
  const [category,setCategory]=useState("GPU");
  const firstExample=SCANNER_CATEGORIES.find(x=>x.name==="GPU")?.example||"RTX 5070";
  const [query,setQuery]=useState(firstExample);
  const [condition,setCondition]=useState("any");
  const [partBudget,setPartBudget]=useState(500);
  const [buildBudget,setBuildBudget]=useState(1000);
  const [committed,setCommitted]=useState(350);
  const [sortBy,setSortBy]=useState("best");
  const [deepScan,setDeepScan]=useState(false);
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);

  function changeCategory(value){
    setCategory(value);
    const ex=SCANNER_CATEGORIES.find(x=>x.name===value)?.example;
    if(ex) setQuery(ex);
  }

  async function scan(){
    setLoading(true);setData(null);
    try{
      const r=await fetch("/api/deals/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed,sortBy,deepScan,providerKeys})});
      setData(await r.json());
    }catch{
      setData({available:false,message:"Live search backend is not reachable yet."});
    }finally{setLoading(false);}
  }

  return <section className="panel">
    <div className="sectionTitle"><div><span className="eyebrow">LIVE PARTS SCANNER</span><h2>Scan real listings against the current market</h2></div><ShoppingCart/></div>
    <div className="formGrid">
      <label>Part type<select value={category} onChange={e=>changeCategory(e.target.value)}>{SCANNER_CATEGORIES.map(c=><option key={c.name}>{c.name}</option>)}</select></label>
      <label>Specific part / requirement<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="RTX 5070 Ti 16GB"/></label>
      <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="any">Any</option><option value="new">New</option><option value="used">Used</option><option value="open-box">Open box</option></select></label>
      <label>Max part budget<input type="number" value={partBudget} onChange={e=>setPartBudget(e.target.value)}/></label>
      <label>Total build budget<input type="number" value={buildBudget} onChange={e=>setBuildBudget(e.target.value)}/></label>
      <label>Already committed<input type="number" value={committed} onChange={e=>setCommitted(e.target.value)}/></label>
      <label>Rank by<select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="best">Best Deal</option><option value="lowest">Lowest Price</option><option value="under">Most Under Market</option><option value="flip">Best for Flip</option><option value="budget">Best Fit for Budget</option></select></label>
    </div>

    <label className="toggleLine"><input type="checkbox" checked={deepScan} onChange={e=>setDeepScan(e.target.checked)}/><span><b>Deep multi-source scan</b><small>Also query direct Walmart / Best Buy / eBay providers when configured. Uses more API credits.</small></span></label>

    <button className="primary" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Scanning real listings...</>:<><Search size={18}/>Scan live deals</>}</button>

    {data&&!data.available&&<div className="notice"><AlertTriangle size={20}/><div><b>Live search needs at least one connected market source</b><p>{data.message}</p></div></div>}

    {data?.available&&<div>
      <div className="marketHeadline">
        <div><span>{data.market.valueLabel}</span><strong>{money(data.market.median)}</strong><small>{money(data.market.low)}–{money(data.market.high)} trimmed range</small></div>
        <div><span>Relevant comps</span><strong>{data.market.sampleSize}</strong><small>{data.market.rawSampleSize} raw listings scanned</small></div>
        <div><span>Confidence</span><strong>{data.market.confidence}</strong><small>{data.market.shippingKnownPct}% with known shipping</small></div>
      </div>
      <div className="sourceChips">
        {Object.entries(data.market.bySource||{}).map(([k,v])=><span key={"s"+k}>{k}: {v}</span>)}
        {Object.entries(data.market.byCondition||{}).map(([k,v])=><span key={"c"+k}>{k}: {v}</span>)}
      </div>
      <div className="dealList">{(data.results||[]).map((x,i)=><article className="dealCard" key={x.id||i}>
        <div className="dealTop"><div><span className="source">{x.source}</span><h3>{x.title}</h3></div><div className="dealScore">{x.score}</div></div>
        <div className="dealMeta"><span>{x.condition}</span><span>{money(x.itemPrice)} + {x.shippingKnown?money(x.shipping):"shipping unknown"}</span><strong>{x.shippingKnown?money(x.totalPrice)+" delivered":money(x.itemPrice)+" + shipping"}</strong></div>
        <div className="dealMeta"><span className={x.percentVsMarket>=10?"good":x.percentVsMarket<0?"bad":""}>{x.percentVsMarket>=0?x.percentVsMarket+"% under market":Math.abs(x.percentVsMarket)+"% over market"}</span><span>Build budget left: {money(x.budgetLeft)}</span><span>{x.withinPartBudget?"Within part budget":"Over part budget"}</span>{x.soldCount>0&&<span className="soldChip">{x.soldCount}+ reported sold</span>}</div>
        {x.seller&&<div className="seller">Seller/store: {x.seller}</div>}
        {x.url&&<a className="listingLink" href={x.url} target="_blank" rel="noreferrer">View real listing <ExternalLink size={15}/></a>}
      </article>)}</div>
      {data.errors?.length>0&&<div className="providerErrors">{data.errors.map((e,i)=><p key={i}>{e.provider}: {e.message}</p>)}</div>}
    </div>}
  </section>
}

function Sources({providerKeys}){
  const [sources,setSources]=useState([]);
  useEffect(()=>{
    fetch("/api/sources",{headers:{
      "x-serper-key":providerKeys.SERPER_API_KEY||"",
      "x-searchapi-key":providerKeys.SEARCHAPI_API_KEY||""
    }}).then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});
  },[providerKeys.SERPER_API_KEY,providerKeys.SEARCHAPI_API_KEY]);
  return <section className="panel sourcePanel">
    <div className="sectionTitle"><div><span className="eyebrow">MARKET DATA</span><h2>Live source status & free setup</h2></div><Database/></div>
    <div className="sourceGrid">{sources.length?sources.map(s=><div className="sourceRow" key={s.name}>
      <div><span>{s.name}</span><small>{s.coverage}</small>{s.freeAllowance&&<small className="allowance">{s.freeAllowance}</small>}{s.id==="bestbuy"&&s.status==="Connected"&&<a className="bestBuyAttribution" href="https://developers.bestbuy.com/" target="_blank" rel="noreferrer"><img src="https://developer.bestbuy.com/images/bestbuy-logo.png" alt="Best Buy Developer API"/></a>}</div>
      <div className="sourceActions"><b className={s.status==="Connected"?"good":""}>{s.status}</b>{s.status!=="Connected"&&s.signupUrl&&<a href={s.signupUrl} target="_blank" rel="noreferrer">Get key <ExternalLink size={13}/></a>}</div>
    </div>):<p>Preview mode is running without live provider credentials.</p>}</div>
    <div className="providerPlan"><b>Recommended setup:</b> Save your Serper and SearchAPI keys above. Serper handles high-volume shopping comps; SearchAPI is reserved for direct eBay/Best Buy/Walmart data, sales-backed evidence, and local pickup comps.</div>
  </section>
}

export default function App(){
  const [tab,setTab]=useState("analyze");
  const [providerKeys,setProviderKeys]=useState(()=>loadProviderKeys());
  const subtitle=useMemo(()=>tab==="analyze"?"Validate parts, check real sales evidence, and estimate local vs online resale.":"Search current listings, compare real asking-market comps, and protect your build budget.",[tab]);
  return <div className="app">
    <header className="hero"><div className="brand"><div className="logo">FS</div><div><h1>FlipScout</h1><p>Real-market PC flip intelligence.</p></div></div><div className="heroText">{subtitle}</div></header>
    <nav className="tabs"><button className={tab==="analyze"?"active":""} onClick={()=>setTab("analyze")}><Cpu size={17}/>PC Analyzer</button><button className={tab==="scan"?"active":""} onClick={()=>setTab("scan")}><Search size={17}/>Parts Deal Scanner</button></nav>
    <main><ProviderSetup providerKeys={providerKeys} setProviderKeys={setProviderKeys}/>{tab==="analyze"?<Analyzer providerKeys={providerKeys}/>:<Scanner providerKeys={providerKeys}/>}<Sources providerKeys={providerKeys}/></main>
  </div>;
}
