import React,{useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,TrendingDown,TrendingUp,DollarSign,ExternalLink,Info} from "lucide-react";
import {money} from "./DealResults.jsx";

// Analytics: what FlipScout tracks, where prices are moving, where the flip
// margins are. Built from the summary the background job saves after every
// refresh, so opening it costs no API credits.
const KEY="fs-analytics-v1";
const ago=iso=>{if(!iso)return "";const m=Math.round((Date.now()-Date.parse(iso))/60000);return m<60?Math.max(1,m)+"m ago":m<2880?Math.round(m/60)+"h ago":Math.round(m/1440)+"d ago";};
const fmtDate=iso=>new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const pct=n=>(n>0?"+":"")+n+"%";

function Tile({label,value,sub}){
  return <div className="anTile"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>;
}

// Horizontal bars, one series: value labels in text ink, hover tooltip.
function Bars({rows,unit="listings"}){
  const [hover,setHover]=useState(null);
  const max=Math.max(1,...rows.map(r=>r[1]));
  return <div className="anBars" onMouseLeave={()=>setHover(null)}>
    {rows.map(([label,v],i)=><div key={label} className={"anBarRow"+(hover===i?" on":"")} onMouseEnter={()=>setHover(i)}>
      <span className="anBarLabel" title={label}>{label}</span>
      <span className="anBarTrack"><i style={{width:Math.max(1.5,v/max*100)+"%"}}/></span>
      <span className="anBarVal">{v.toLocaleString()}</span>
      {hover===i&&<span className="anTip" role="tooltip"><b>{label}</b>{v.toLocaleString()} {unit}</span>}
    </div>)}
  </div>;
}

// Price history for one model: two series on one axis (dollars), legend +
// end labels, crosshair tooltip on hover.
function HistoryChart({trend}){
  const ref=useRef(null),box=useRef(null);
  const [hi,setHi]=useState(null);
  // Drawn at the container's real width so text stays its real size.
  const [W,setW]=useState(640);
  useEffect(()=>{const el=box.current;if(!el)return;const ro=new ResizeObserver(e=>setW(Math.max(300,Math.round(e[0].contentRect.width))));ro.observe(el);return()=>ro.disconnect();},[]);
  const H=W<520?200:240,P={l:52,r:70,t:14,b:28};
  const useMed=trend.points.filter(p=>p[3]!=null).length>=2;
  const series=[
    {name:useMed?"Typical used":"Lowest used",cls:"s1",vals:trend.points.map(p=>useMed?p[3]:p[1])},
    {name:"Lowest new",cls:"s2",vals:trend.points.map(p=>p[2])}
  ].filter(s=>s.vals.some(v=>v!=null));
  const times=trend.points.map(p=>Date.parse(p[0]));
  const all=series.flatMap(s=>s.vals).filter(v=>v!=null);
  if(all.length<2)return <div ref={box} className="emptyState">Not enough price history yet for {trend.model}.</div>;
  let lo=Math.min(...all),hi2=Math.max(...all);const pad=(hi2-lo)*0.12||hi2*0.05||1;lo=Math.max(0,lo-pad);hi2+=pad;
  const t0=times[0],t1=times[times.length-1]||t0+1;
  const x=t=>P.l+(t-t0)/Math.max(1,t1-t0)*(W-P.l-P.r);
  const y=v=>P.t+(1-(v-lo)/(hi2-lo))*(H-P.t-P.b);
  const ticks=[0,1,2,3].map(i=>lo+(hi2-lo)*i/3);
  const path=vals=>{let d="",pen=false;vals.forEach((v,i)=>{if(v==null){pen=false;return;}d+=(pen?"L":"M")+x(times[i]).toFixed(1)+","+y(v).toFixed(1);pen=true;});return d;};
  function move(e){
    const r=ref.current.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W;
    let best=0,bd=Infinity;times.forEach((t,i)=>{const d=Math.abs(x(t)-px);if(d<bd){bd=d;best=i;}});setHi(best);
  }
  const last=series.map(s=>{for(let i=s.vals.length-1;i>=0;i--)if(s.vals[i]!=null)return {i,v:s.vals[i]};return null;});
  // Keep the two end labels from colliding.
  const labelY=last.map(l=>l?y(l.v):0);if(labelY.length===2&&Math.abs(labelY[0]-labelY[1])<14){const m=(labelY[0]+labelY[1])/2;const up=labelY[0]<=labelY[1]?0:1;labelY[up]=m-8;labelY[1-up]=m+8;}
  return <div className="anChartWrap" ref={box}>
    <div className="anLegend">{series.map(s=><span key={s.name}><i className={"sw "+s.cls}/>{s.name}</span>)}{trend.msrp>0&&<span><i className="sw msrp"/>Launch MSRP {money(trend.msrp,0)}</span>}</div>
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="anChart" onMouseMove={move} onMouseLeave={()=>setHi(null)} role="img" aria-label={"Price history for "+trend.model}>
      {ticks.map((v,i)=><g key={i}><line x1={P.l} x2={W-P.r} y1={y(v)} y2={y(v)} className="grid"/><text x={P.l-8} y={y(v)+4} textAnchor="end" className="axis">{money(v,0)}</text></g>)}
      <text x={P.l} y={H-8} className="axis">{fmtDate(trend.points[0][0])}</text>
      <text x={W-P.r} y={H-8} textAnchor="end" className="axis">{fmtDate(trend.points[trend.points.length-1][0])}</text>
      {trend.msrp>0&&trend.msrp>=lo&&trend.msrp<=hi2&&<line x1={P.l} x2={W-P.r} y1={y(trend.msrp)} y2={y(trend.msrp)} className="msrpLine"/>}
      {series.map(s=><path key={s.name} d={path(s.vals)} className={"line "+s.cls}/>)}
      {series.map((s,k)=>last[k]&&<g key={s.name}><circle cx={x(times[last[k].i])} cy={y(last[k].v)} r="4" className={"dot "+s.cls}/><text x={W-P.r+8} y={labelY[k]+4} className="endLabel">{money(last[k].v,0)}</text></g>)}
      {hi!=null&&<g><line x1={x(times[hi])} x2={x(times[hi])} y1={P.t} y2={H-P.b} className="cross"/>{series.map(s=>s.vals[hi]!=null&&<circle key={s.name} cx={x(times[hi])} cy={y(s.vals[hi])} r="4.5" className={"dot "+s.cls}/>)}</g>}
    </svg>
    {hi!=null&&<div className="anTip fixed" style={{left:Math.min(78,Math.max(8,x(times[hi])/W*100))+"%"}} role="tooltip"><b>{fmtDate(trend.points[hi][0])}</b>{series.map(s=><span key={s.name}><i className={"sw "+s.cls}/>{s.name}: {s.vals[hi]!=null?money(s.vals[hi],2):"—"}</span>)}</div>}
    <details className="anTable"><summary>Show as table</summary><table><thead><tr><th>Time</th>{series.map(s=><th key={s.name}>{s.name}</th>)}</tr></thead><tbody>{trend.points.slice().reverse().map((p,i)=><tr key={i}><td>{fmtDate(p[0])}</td>{series.map(s=>{const v=s.vals[trend.points.length-1-i];return <td key={s.name}>{v!=null?money(v,2):"—"}</td>;})}</tr>)}</tbody></table></details>
  </div>;
}

function Movers({data}){
  const [win,setWin]=useState("d1");
  const drops=data.drops?.[win]||[],rises=data.rises?.[win]||[];
  const Row=({m})=><tr><td>{m.model}</td><td>{money(m.was,0)}</td><td>{money(m.now,0)}</td><td className={m.pct<0?"down":"up"}>{pct(m.pct)}</td></tr>;
  return <section className="panelBox anPanel">
    <h3><TrendingDown size={16}/>Price moves<span className="anSeg">{[["d1","24 hours"],["d7","7 days"]].map(([k,l])=><button key={k} className={win===k?"on":""} onClick={()=>setWin(k)}>{l}</button>)}</span></h3>
    <p className="flipBlurb">Typical used price per model now vs {win==="d1"?"a day":"a week"} ago.</p>
    {!drops.length&&!rises.length?<div className="emptyState">Price history is still building — moves show up after {win==="d1"?"a day":"a week"} of updates.</div>:
    <div className="anTwo">
      <table className="anTbl"><caption>Biggest drops</caption><thead><tr><th>Model</th><th>Was</th><th>Now</th><th>Change</th></tr></thead><tbody>{drops.map(m=><Row key={m.model} m={m}/>)}</tbody></table>
      <table className="anTbl"><caption>Biggest rises</caption><thead><tr><th>Model</th><th>Was</th><th>Now</th><th>Change</th></tr></thead><tbody>{rises.map(m=><Row key={m.model} m={m}/>)}</tbody></table>
    </div>}
  </section>;
}

export default function Analytics(){
  const [data,setData]=useState(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null");}catch{return null;}});
  const [error,setError]=useState("");
  const [model,setModel]=useState("");
  useEffect(()=>{
    fetch("/api/analytics",{signal:AbortSignal.timeout(20000)}).then(r=>r.json()).then(d=>{
      if(d.available){setData(d);try{localStorage.setItem(KEY,JSON.stringify(d));}catch{}}
      else if(!data)setError(d.message||"No analytics yet.");
    }).catch(()=>{if(!data)setError("Could not load analytics. Try again in a minute.");});
  },[]);
  const trends=data?.trends||[];
  const trend=useMemo(()=>trends.find(t=>t.model===model)||trends[0],[trends,model]);
  const stores=useMemo(()=>Object.entries(data?.totals?.byStore||{}).sort((a,b)=>b[1]-a[1]).slice(0,8),[data]);
  const groups=useMemo(()=>Object.entries(data?.groups||{}).map(([k,v])=>[k,v.listings]).sort((a,b)=>b[1]-a[1]),[data]);
  return <div className="anPage">
    <h1 className="pageTitle">Analytics</h1>
    <p className="pageSub">What FlipScout is tracking, where prices are moving and where the flip margins are.{data?.updatedAt?" Updated "+ago(data.updatedAt)+".":""}</p>
    {error&&<div className="notice"><Info size={18}/><div><p>{error}</p></div></div>}
    {!data&&!error&&<div className="emptyState">Loading…</div>}
    {data&&<>
      <div className="anTiles">
        <Tile label="Listings tracked" value={(data.totals?.listings||0).toLocaleString()} sub={(data.totals?.byCondition?.used||0).toLocaleString()+" used · "+(data.totals?.byCondition?.new||0).toLocaleString()+" new"}/>
        <Tile label="Models" value={data.totals?.models||0} sub={stores.length+" stores"}/>
        <Tile label="Great deals now" value={data.deals?.count||0} sub="≥10% under used market"/>
        <Tile label="Alerts sent" value={data.alertsSent||0} sub="live-checked, to your phone"/>
      </div>
      <div className="anGrid">
        <section className="panelBox anPanel"><h3><BarChart3 size={16}/>Listings by store</h3><Bars rows={stores}/></section>
        <section className="panelBox anPanel"><h3><BarChart3 size={16}/>Listings by part type</h3><Bars rows={groups}/></section>
      </div>
      {trends.length>0&&<section className="panelBox anPanel">
        <h3><TrendingUp size={16}/>Price history<select value={trend?.model||""} onChange={e=>setModel(e.target.value)} aria-label="Model">{trends.map(t=><option key={t.model} value={t.model}>{t.model}</option>)}</select></h3>
        {trend&&<HistoryChart key={trend.model} trend={trend}/>}
      </section>}
      <Movers data={data}/>
      <section className="panelBox anPanel">
        <h3><DollarSign size={16}/>Best flip spreads</h3>
        <p className="flipBlurb">Cheapest used listing (not a bait price) vs that model's typical used price — the room to buy low and resell.</p>
        <table className="anTbl wide"><thead><tr><th>Model</th><th>Typical used</th><th>Cheapest used</th><th>Spread</th><th></th></tr></thead><tbody>
          {(data.margins||[]).slice(0,15).map(m=><tr key={m.model}><td>{m.model}</td><td>{money(m.market,0)}</td><td>{money(m.cheapest,0)}</td><td className="down">{money(m.margin,0)} ({m.pct}%)</td><td>{m.url&&<a href={m.url} target="_blank" rel="noreferrer" title={m.title}>{m.source}<ExternalLink size={12}/></a>}</td></tr>)}
        </tbody></table>
      </section>
      {data.deals?.top?.length>0&&<section className="panelBox anPanel">
        <h3><DollarSign size={16}/>Top deals right now</h3>
        <div className="flipList">{data.deals.top.map(d=><a key={d.url} className="flipRow" href={d.url} target="_blank" rel="noreferrer">{d.image?<img src={d.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.visibility="hidden";}}/>:<span className="imgPh"></span>}<div className="flipMain"><b title={d.title}>{d.title}</b><span className="flipDeal">{d.underPct}% under used market (~{money(d.market,0)}) · est. profit ~{money(d.profit,0)}</span></div><b>{money(d.price,2)}</b><ExternalLink size={14}/></a>)}</div>
      </section>}
    </>}
  </div>;
}
