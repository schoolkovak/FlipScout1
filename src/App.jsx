import React,{useEffect,useMemo,useState} from "react";
import {Search,Cpu,Gauge,ShoppingCart,ExternalLink,Database,AlertTriangle,RefreshCw,CheckCircle2,ShieldCheck} from "lucide-react";
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

function Analyzer(){
  const [price,setPrice]=useState(950);
  const [cpu,setCpu]=useState("Ryzen 5 5600");
  const [gpu,setGpu]=useState("RTX 4060");
  const [ram,setRam]=useState("16GB DDR4-3600 (2x8GB)");
  const [storage,setStorage]=useState("1TB NVMe SSD");
  const [motherboard,setMotherboard]=useState("B550 AM4 Motherboard");
  const [psu,setPsu]=useState("650W 80+ Gold PSU");
  const [caseType,setCaseType]=useState("Midrange Tempered Glass RGB Case");
  const [cooler,setCooler]=useState("Basic Tower Air Cooler");
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
    const input={price,cpu,gpu,ram,storage,motherboard,psu,caseType,cooler,purpose};
    const fallback=fallbackPcEstimate(input);
    setResult(fallback);setLive(null);setLoading(true);
    try{
      const r=await fetch("/api/market/pc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      if(r.ok){
        const d=await r.json();
        if(d.available){
          setLive(d);
          const resale=d.market.median;
          const sellingCosts=Math.round(resale*.08+15);
          const profit=resale-Number(price||0)-sellingCosts;
          const targetProfit=Math.max(120,Math.round(resale*.15));
          const maxBuy=Math.max(0,resale-sellingCosts-targetProfit);
          const discount=resale?(resale-Number(price||0))/resale:0;
          const warningPenalty=(fallback.compatibility?.warnings?.length||0)*10;
          const score=Math.max(0,Math.min(100,Math.round(58+discount*82-warningPenalty)));
          setResult({...fallback,low:d.market.low,high:d.market.high,resale,sellingCosts,profit,maxBuy,score});
        }
      }
    }catch{}
    finally{setLoading(false);}
  }

  return <section className="panel">
    <div className="sectionTitle">
      <div><span className="eyebrow">COMPLETE PC ANALYZER</span><h2>Price the whole build, not just the GPU</h2></div>
      <button className="ghost" onClick={sample}>Load sample</button>
    </div>

    <Datalist id="cpu-options" items={CPUS}/>
    <Datalist id="gpu-options" items={GPUS}/>

    <div className="formGrid">
      <label>Asking price<input type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>CPU<input list="cpu-options" value={cpu} onChange={e=>setCpu(e.target.value)} placeholder="Any desktop CPU"/></label>
      <label>GPU<input list="gpu-options" value={gpu} onChange={e=>setGpu(e.target.value)} placeholder="Any desktop GPU"/></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}>{RAM_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}>{STORAGE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Motherboard<select value={motherboard} onChange={e=>setMotherboard(e.target.value)}>{MOTHERBOARDS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Power supply<select value={psu} onChange={e=>setPsu(e.target.value)}>{PSU_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Case<select value={caseType} onChange={e=>setCaseType(e.target.value)}>{CASE_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>CPU cooling<select value={cooler} onChange={e=>setCooler(e.target.value)}>{COOLER_OPTIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
    </div>

    <button className="primary" onClick={analyze} disabled={loading}>
      {loading?<><RefreshCw className="spin" size={18}/>Checking current market...</>:<><Gauge size={18}/>Analyze build</>}
    </button>

    {result&&<div className="resultsGrid">
      <div className="scoreCard"><span>FLIP SCORE</span><strong>{result.score}</strong><small>/100</small></div>
      <div className="metric"><span>Market range</span><b>{money(result.low)}–{money(result.high)}</b><small>{live?"Live-market adjusted":"Fallback snapshot "+MARKET_SNAPSHOT}</small></div>
      <div className="metric"><span>Expected resale</span><b>{money(result.resale)}</b></div>
      <div className="metric"><span>Selling costs</span><b>{money(result.sellingCosts)}</b></div>
      <div className="metric"><span>Potential profit</span><b className={result.profit>=0?"good":"bad"}>{money(result.profit)}</b></div>
      <div className="metric"><span>Max buy price</span><b>{money(result.maxBuy)}</b></div>
    </div>}

    {result&&<div className="analysisColumns">
      <div className="compatCard">
        <h3><ShieldCheck size={18}/>Compatibility & flip quality</h3>
        {(result.compatibility?.positives||[]).map((x,i)=><p className="positiveLine" key={"p"+i}><CheckCircle2 size={15}/>{x}</p>)}
        {(result.compatibility?.warnings||[]).map((x,i)=><p className="warningLine" key={"w"+i}><AlertTriangle size={15}/>{x}</p>)}
        {!result.compatibility?.warnings?.length&&<p className="muted">No obvious compatibility problems found from the selected parts.</p>}
      </div>

      {live&&<div className="liveBreakdown">
        <h3><CheckCircle2 size={18}/>Live value inputs</h3>
        <div className="breakdownGrid">
          {Object.entries(live.components||{}).map(([name,x])=><div key={name}><span>{name}</span><b>{money(x.value)}</b><small>{x.source} · {x.sampleSize||0} comps</small></div>)}
        </div>
        {live.completePc?.sampleSize>0&&<p className="muted">Also blended with {live.completePc.sampleSize} comparable complete-PC listings.</p>}
      </div>}
    </div>}

    {result&&<div className="why"><h3>How FlipScout values the build</h3><p>Live comparable listings take priority. GPU and CPU use current used asking-market comps; storage, RAM and supporting hardware use current retail or marketplace comps with resale-contribution adjustments. When live data is thin, the dated fallback snapshot is used and clearly identified.</p></div>}
  </section>
}

function Scanner(){
  const [category,setCategory]=useState("GPU");
  const firstExample=SCANNER_CATEGORIES.find(x=>x.name==="GPU")?.example||"RTX 5070";
  const [query,setQuery]=useState(firstExample);
  const [condition,setCondition]=useState("any");
  const [partBudget,setPartBudget]=useState(500);
  const [buildBudget,setBuildBudget]=useState(1000);
  const [committed,setCommitted]=useState(350);
  const [sortBy,setSortBy]=useState("best");
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
      const r=await fetch("/api/deals/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed,sortBy})});
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
        <div className="dealMeta"><span className={x.percentVsMarket>=10?"good":x.percentVsMarket<0?"bad":""}>{x.percentVsMarket>=0?x.percentVsMarket+"% under market":Math.abs(x.percentVsMarket)+"% over market"}</span><span>Build budget left: {money(x.budgetLeft)}</span><span>{x.withinPartBudget?"Within part budget":"Over part budget"}</span></div>
        {x.seller&&<div className="seller">Seller/store: {x.seller}</div>}
        {x.url&&<a className="listingLink" href={x.url} target="_blank" rel="noreferrer">View real listing <ExternalLink size={15}/></a>}
      </article>)}</div>
      {data.errors?.length>0&&<div className="providerErrors">{data.errors.map((e,i)=><p key={i}>{e.provider}: {e.message}</p>)}</div>}
    </div>}
  </section>
}

function Sources(){
  const [sources,setSources]=useState([]);
  useEffect(()=>{fetch("/api/sources").then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});},[]);
  return <section className="panel sourcePanel">
    <div className="sectionTitle"><div><span className="eyebrow">MARKET DATA</span><h2>Live source status</h2></div><Database/></div>
    <div className="sourceGrid">{sources.length?sources.map(s=><div className="sourceRow" key={s.name}><div><span>{s.name}</span><small>{s.coverage}</small>{s.id==="bestbuy"&&s.status==="Connected"&&<a className="bestBuyAttribution" href="https://developers.bestbuy.com/" target="_blank" rel="noreferrer"><img src="https://developer.bestbuy.com/images/bestbuy-logo.png" alt="Best Buy Developer API"/></a>}</div><b className={s.status==="Connected"?"good":""}>{s.status}</b></div>):<p>Preview mode is running without live provider credentials.</p>}</div>
  </section>
}

export default function App(){
  const [tab,setTab]=useState("analyze");
  const subtitle=useMemo(()=>tab==="analyze"?"Price complete builds with compatibility-aware market logic.":"Search current listings, compare real asking-market comps, and protect your build budget.",[tab]);
  return <div className="app">
    <header className="hero"><div className="brand"><div className="logo">FS</div><div><h1>FlipScout</h1><p>Real-market PC flip intelligence.</p></div></div><div className="heroText">{subtitle}</div></header>
    <nav className="tabs"><button className={tab==="analyze"?"active":""} onClick={()=>setTab("analyze")}><Cpu size={17}/>PC Analyzer</button><button className={tab==="scan"?"active":""} onClick={()=>setTab("scan")}><Search size={17}/>Parts Deal Scanner</button></nav>
    <main>{tab==="analyze"?<Analyzer/>:<Scanner/>}<Sources/></main>
  </div>;
}
