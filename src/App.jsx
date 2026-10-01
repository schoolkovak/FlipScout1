import React, { useEffect, useState } from "react";
import { Search, Cpu, Gauge, ShoppingCart, ExternalLink, Database, AlertTriangle, RefreshCw } from "lucide-react";
import { cpuValues, gpuValues, fallbackPcEstimate } from "./valuation";

const categories = ["GPU","CPU","SSD / Storage","RAM","Motherboard","PSU","Case","Cooler","Complete PC"];

function money(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}

function Analyzer() {
  const [price,setPrice] = useState(525);
  const [cpu,setCpu] = useState("Ryzen 5 5600");
  const [gpu,setGpu] = useState("RTX 4060");
  const [ram,setRam] = useState("16");
  const [storage,setStorage] = useState("1000");
  const [purpose,setPurpose] = useState("flip");
  const [result,setResult] = useState(null);

  function analyze() {
    setResult(fallbackPcEstimate({cpu,gpu,ram,storage,price,purpose}));
  }

  return <section className="panel">
    <div className="sectionTitle">
      <div><span className="eyebrow">PC ANALYZER</span><h2>Analyze a complete build</h2></div>
      <button className="ghost" onClick={()=>{setPrice(525);setCpu("Ryzen 5 5600");setGpu("RTX 4060");setRam("16");setStorage("1000");}}>Load sample</button>
    </div>
    <div className="formGrid">
      <label>Asking price<input type="number" value={price} onChange={e=>setPrice(e.target.value)} /></label>
      <label>CPU<select value={cpu} onChange={e=>setCpu(e.target.value)}>{Object.keys(cpuValues).map(x=><option key={x}>{x}</option>)}</select></label>
      <label>GPU<select value={gpu} onChange={e=>setGpu(e.target.value)}>{Object.keys(gpuValues).map(x=><option key={x}>{x}</option>)}</select></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}><option value="8">8 GB</option><option value="16">16 GB</option><option value="32">32 GB</option><option value="64">64 GB</option></select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}><option value="500">500 GB SSD</option><option value="1000">1 TB SSD</option><option value="2000">2 TB SSD</option><option value="4000">4 TB SSD</option></select></label>
      <label>Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
    </div>
    <button className="primary" onClick={analyze}><Gauge size={18}/> Analyze deal</button>

    {result && <div className="resultsGrid">
      <div className="scoreCard"><span>FLIP SCORE</span><strong>{result.score}</strong><small>/100</small></div>
      <div className="metric"><span>Market value</span><b>{money(result.low)}–{money(result.high)}</b><small>Fallback estimate until live comps are connected</small></div>
      <div className="metric"><span>Expected resale</span><b>{money(result.resale)}</b></div>
      <div className="metric"><span>Selling costs</span><b>{money(result.sellingCosts)}</b></div>
      <div className="metric"><span>Potential profit</span><b className={result.profit>=0?"good":"bad"}>{money(result.profit)}</b></div>
      <div className="metric"><span>Max buy price</span><b>{money(result.maxBuy)}</b></div>
    </div>}
    {result && <div className="why"><h3>Why FlipScout likes it</h3><p>GPU value drives the score heavily, while CPU, RAM, storage, selling costs and resale headroom affect the result. Newer model-number appeal receives a small resale boost. Live comps will replace these fallback estimates when providers are configured.</p></div>}
  </section>
}

function Scanner() {
  const [category,setCategory] = useState("GPU");
  const [query,setQuery] = useState("RTX 4070");
  const [condition,setCondition] = useState("any");
  const [partBudget,setPartBudget] = useState(450);
  const [buildBudget,setBuildBudget] = useState(850);
  const [committed,setCommitted] = useState(300);
  const [loading,setLoading] = useState(false);
  const [data,setData] = useState(null);

  async function scan() {
    setLoading(true);
    setData(null);
    try {
      const r = await fetch("/api/deals/search", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed})
      });
      setData(await r.json());
    } catch {
      setData({available:false,message:"Live search server is not available yet."});
    } finally {
      setLoading(false);
    }
  }

  return <section className="panel">
    <div className="sectionTitle"><div><span className="eyebrow">LIVE PARTS SCANNER</span><h2>Find underpriced hardware</h2></div><ShoppingCart/></div>
    <div className="formGrid">
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>What are you looking for?<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="RTX 4070, 2TB NVMe..." /></label>
      <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="any">Any</option><option value="new">New</option><option value="used">Used</option><option value="open-box">Open box</option></select></label>
      <label>Max part budget<input type="number" value={partBudget} onChange={e=>setPartBudget(e.target.value)} /></label>
      <label>Total build budget<input type="number" value={buildBudget} onChange={e=>setBuildBudget(e.target.value)} /></label>
      <label>Already committed<input type="number" value={committed} onChange={e=>setCommitted(e.target.value)} /></label>
    </div>
    <button className="primary" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Scanning...</>:<><Search size={18}/>Scan live deals</>}</button>

    {data && !data.available && <div className="notice"><AlertTriangle size={20}/><div><b>Live providers not connected</b><p>{data.message}</p></div></div>}
    {data && data.available && <div>
      <div className="marketBar"><span>Market median <b>{money(data.market.median)}</b></span><span>Comps <b>{data.market.sampleSize}</b></span><span>Confidence <b>{data.market.confidence}</b></span></div>
      <div className="dealList">{data.results.map((x,i)=><article className="dealCard" key={i}>
        <div className="dealTop"><div><span className="source">{x.source}</span><h3>{x.title}</h3></div><div className="dealScore">{x.score}</div></div>
        <div className="dealMeta"><span>{x.condition}</span><span>{money(x.itemPrice)} + {money(x.shipping)} ship</span><strong>{money(x.totalPrice)} delivered</strong></div>
        <div className="dealMeta"><span>{x.percentVsMarket >= 0 ? x.percentVsMarket + "% under market" : Math.abs(x.percentVsMarket) + "% over market"}</span><span>Budget left: {money(x.budgetLeft)}</span></div>
        {x.url && <a className="listingLink" href={x.url} target="_blank" rel="noreferrer">View listing <ExternalLink size={15}/></a>}
      </article>)}</div>
    </div>}
  </section>
}

function Sources() {
  const [sources,setSources] = useState([]);
  useEffect(()=>{
    fetch("/api/sources").then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});
  },[]);
  return <section className="panel sourcePanel">
    <div className="sectionTitle"><div><span className="eyebrow">DATA SOURCES</span><h2>Live provider status</h2></div><Database/></div>
    <div className="sourceGrid">{sources.length?sources.map(s=><div className="sourceRow" key={s.name}><span>{s.name}</span><b className={s.status==="Connected"?"good":""}>{s.status}</b></div>):<p>Run the backend to see provider status.</p>}</div>
  </section>
}

export default function App() {
  const [tab,setTab] = useState("analyze");
  return <div className="app">
    <header className="hero">
      <div className="brand"><div className="logo">FS</div><div><h1>FlipScout</h1><p>Find undervalued gaming hardware.</p></div></div>
      <div className="heroText">{tab==="analyze"?"Know what a PC is worth before you buy it.":"Search current listings, compare real market comps, and protect your build budget."}</div>
    </header>
    <nav className="tabs">
      <button className={tab==="analyze"?"active":""} onClick={()=>setTab("analyze")}><Cpu size={17}/>PC Analyzer</button>
      <button className={tab==="scan"?"active":""} onClick={()=>setTab("scan")}><Search size={17}/>Parts Deal Scanner</button>
    </nav>
    <main>{tab==="analyze"?<Analyzer/>:<Scanner/>}<Sources/></main>
  </div>
}
