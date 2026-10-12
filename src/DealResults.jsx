import React,{useMemo,useState} from "react";
import {ExternalLink,Bookmark,BookmarkCheck,AlertTriangle,Truck,TrendingDown,TrendingUp,ArrowDownWideNarrow,Sparkles,Percent,Store,PackageSearch,ChevronDown} from "lucide-react";
import {sortDeals} from "../shared/dealSort.js";
import {SNIPER_MARKETPLACES} from "../shared/sniper.js";
import {finalPrice} from "./pricing.js";
import {useTaxState} from "./taxContext.js";

export function money(v,digits=0){
  if(v===null||v===undefined||Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v);
}

// Sorting only reorders what is already loaded; it never triggers a search.
export const RESULT_SORTS=[
  {value:"lowest",label:"Lowest price",Icon:ArrowDownWideNarrow},
  {value:"best",label:"Best value (vs market & MSRP)",Icon:Sparkles},
  {value:"under",label:"Most under market",Icon:Percent}
];

const CONDITION_FILTERS=[
  {value:"all",label:"All"},
  {value:"new",label:"New"},
  {value:"open-box",label:"Open box"},
  {value:"refurbished",label:"Refurbished"},
  {value:"used",label:"Used"}
];
const conditionGroup=c=>c==="renewed"?"refurbished":c;
const CONDITION_LABEL={new:"New","open-box":"Open box",refurbished:"Refurbished",renewed:"Renewed",used:"Used",unknown:"Check condition"};

function storeKey(item){return item.marketplace&&item.marketplace!=="other"?item.marketplace:"other";}
function storeLabel(id,item){return SNIPER_MARKETPLACES.find(x=>x.id===id)?.name||item?.source||"Other stores";}

export function StoreBadge({id,name}){
  return <span className={"storeBadge store-"+id}><i></i>{name}</span>;
}

export function ProviderNotes({providers,coverage,errors}){
  const rows=providers||[];
  const missing=(coverage||[]).filter(x=>!x.listings);
  if(!rows.length&&!errors?.length)return null;
  const problems=rows.filter(x=>x.status!=="ok").length;
  return <details className="sourceNotes">
    <summary><PackageSearch size={14}/>Sources searched · {rows.length} provider{rows.length===1?"":"s"}{problems?" · "+problems+" with problems":""}{missing.length?" · "+missing.length+" store"+(missing.length===1?"":"s")+" with no match":""}<ChevronDown size={14} className="chev"/></summary>
    <div className="sourceNotesBody">
      {rows.map((x,i)=><div className={"sourceRow "+(x.status==="ok"?"ok":"bad")} key={"p"+i}>
        <b>{x.name}</b>
        {x.status==="ok"
          ?<span>{x.raw} found → <strong>{x.kept} kept</strong>{x.duplicates?" · "+x.duplicates+" duplicates":""}{Object.keys(x.dropped||{}).length?" · filtered: "+Object.entries(x.dropped).sort((a,b)=>b[1]-a[1]).map(([r,n])=>n+" "+r.replace(/-/g," ")).join(", "):""}</span>
          :<span>{x.message}</span>}
      </div>)}
      {missing.map(x=><div className="sourceRow muted" key={"c"+x.id}><b>{x.name}</b><span>no matching listing · {x.note}</span></div>)}
      {!rows.length&&(errors||[]).map((e,i)=><div className="sourceRow bad" key={"e"+i}><b>{e.provider}</b><span>{e.message}</span></div>)}
    </div>
  </details>;
}

export function MarketPulse({market,results}){
  if(!market)return null;
  const list=results||[];
  const cheapest=list.reduce((m,x)=>!m||x.totalPrice<m.totalPrice?x:m,null);
  const st=useTaxState();
  const stores=new Set(list.map(storeKey)).size;
  return <div className="pulse">
    <div><span>Lowest price (tax & ship)</span><b className="dealText">{cheapest?money(finalPrice(cheapest,st).total,2):"—"}</b><small>{cheapest?storeLabel(storeKey(cheapest),cheapest)+" · "+(CONDITION_LABEL[cheapest.condition]||cheapest.condition):"—"}</small></div>
    <div><span>Market median (pre-tax)</span><b>{money(market.median)}</b><small>{money(market.low)} – {money(market.high)} typical</small></div>
    <div><span>Valid listings</span><b>{list.length}</b><small>broken & mismatched removed</small></div>
    <div><span>Stores</span><b>{stores}</b><small>{market.confidence} confidence</small></div>
  </div>;
}

export function PriceTotal({item,big=true}){
  const st=useTaxState();
  const fp=finalPrice(item,st);
  return <div className="priceTotal">
    <strong className={big?"":"small"}>{money(fp.total,2)}</strong>
    <span>{money(fp.base,2)} + {fp.shipNote} + ~{money(fp.tax,2)} tax{st?" ("+st+")":""}</span>
  </div>;
}

function DealCard({item,rank,watched,onWatch,cheapest,msrp}){
  const vsLaunch=msrp?Math.round((item.totalPrice-msrp)/msrp*100):null;
  const id=storeKey(item);
  const under=Number(item.percentVsMarket||0);
  const isCheapest=cheapest&&item.totalPrice===cheapest;
  const storeName=storeLabel(id,item);
  // Shipping status is already shown next to the price.
  const risks=(item.riskFlags||[]).filter(r=>!/^Shipping cost is unknown/.test(r));
  const sellerDiffers=item.seller&&!String(item.seller).toLowerCase().replace(/[^a-z]/g,"").startsWith(storeName.toLowerCase().replace(/[^a-z]/g,""));
  return <article className={"dealTile"+(isCheapest?" cheapest":"")} style={{"--d":Math.min(rank,12)*35+"ms"}}>
    <div className="tileTop">
      <StoreBadge id={id} name={storeName}/>
      <span className={"condTag cond-"+conditionGroup(item.condition)}>{CONDITION_LABEL[item.condition]||item.condition}</span>
      {isCheapest&&<span className="cheapTag">Lowest price</span>}
    </div>
    <h4 title={item.title}>{item.title}</h4>
    <PriceTotal item={item}/>
    <div className="tileStats">
      <span className={under>=5?"pill good":under<=-5?"pill bad":"pill"}>{under>=0?<TrendingDown size={12}/>:<TrendingUp size={12}/>}{Math.abs(under)}% {under>=0?"under":"over"} market</span>
      {vsLaunch!=null&&<span className={vsLaunch<0?"pill good":"pill bad"}>{vsLaunch>0?"+":""}{vsLaunch}% vs MSRP</span>}
      {item.soldCount>0&&<span className="pill">{item.soldCount}+ sold</span>}
      {sellerDiffers&&<span className="pill subtle"><Store size={12}/>{String(item.seller).slice(0,22)}</span>}
    </div>
    <div className="valueMeter" title={"Best value score "+item.score+"/100"}>
      <span>Value</span><div><i style={{width:Math.max(4,item.score)+"%"}}></i></div><b>{item.score}</b>
    </div>
    {risks.length>0&&<div className="tileRisks">{risks.slice(0,2).map((r,j)=><span key={j}><AlertTriangle size={11}/>{r}</span>)}</div>}
    <div className="tileActions">
      {item.url?<a className="openBtn" href={item.url} target="_blank" rel="noreferrer">View listing <ExternalLink size={13}/></a>:<span className="mutedText">No link</span>}
      {onWatch&&<button className={"iconBtn"+(watched?" on":"")} onClick={()=>onWatch(item)} aria-label={watched?"Stop watching":"Watch"}>{watched?<BookmarkCheck size={16}/>:<Bookmark size={16}/>}</button>}
    </div>
  </article>;
}

export function ScanSkeleton({label="Scanning stores"}){
  return <div className="scanning">
    <div className="scanBar"><span className="scanPulse"></span>{label}<em>Loading live listings…</em></div>
    <div className="tileGrid">{Array.from({length:6},(_,i)=><div className="dealTile skeleton" key={i}><i></i><i></i><i></i><i></i></div>)}</div>
  </div>;
}

export default function DealResults({results,isWatched,onWatch,pageSize=24,msrp=null}){
  const [sortBy,setSortBy]=useState("lowest");
  const [cond,setCond]=useState("all");
  const [stores,setStores]=useState([]);
  const [shown,setShown]=useState(pageSize);
  const all=results||[];

  const condCounts=useMemo(()=>{const m={all:all.length};for(const x of all){const g=conditionGroup(x.condition);m[g]=(m[g]||0)+1;}return m;},[all]);
  const storeCounts=useMemo(()=>{const m=new Map();for(const x of all){const k=storeKey(x);m.set(k,{id:k,name:storeLabel(k,x),n:(m.get(k)?.n||0)+1});}return [...m.values()].sort((a,b)=>b.n-a.n);},[all]);
  const sorts=RESULT_SORTS;
  const visible=useMemo(()=>{
    const list=all.filter(x=>(cond==="all"||conditionGroup(x.condition)===cond)&&(!stores.length||stores.includes(storeKey(x))));
    return sortDeals(list,sortBy);
  },[all,cond,stores,sortBy]);
  const cheapest=visible.length?Math.min(...visible.map(x=>x.totalPrice)):null;

  function toggleStore(id){setStores(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);setShown(pageSize);}

  if(!all.length)return <div className="emptyState">No listing survived the filters for this search.</div>;
  return <div className="results">
    <div className="toolbar">
      <div className="segmented" role="radiogroup" aria-label="Sort results">
        {sorts.map(({value,label,Icon})=><button key={value} role="radio" aria-checked={sortBy===value} className={sortBy===value?"on":""} onClick={()=>setSortBy(value)}><Icon size={14}/>{label}</button>)}
      </div>
      <div className="chipRow">
        {CONDITION_FILTERS.filter(x=>x.value==="all"||condCounts[x.value]).map(x=><button key={x.value} className={"chip"+(cond===x.value?" on":"")} onClick={()=>{setCond(x.value);setShown(pageSize);}}>{x.label}<em>{condCounts[x.value]||0}</em></button>)}
      </div>
    </div>
    <div className="chipRow stores">
      {storeCounts.map(s=><button key={s.id} className={"chip store-"+s.id+(stores.includes(s.id)?" on":"")} onClick={()=>toggleStore(s.id)}><i></i>{s.name}<em>{s.n}</em></button>)}
      {stores.length>0&&<button className="chip clear" onClick={()=>setStores([])}>All stores</button>}
      <span className="countNote">{visible.length} listing{visible.length===1?"":"s"}</span>
    </div>
    <div className="tileGrid">
      {visible.slice(0,shown).map((x,i)=><DealCard key={x.id||i} item={x} rank={i} cheapest={cheapest} watched={isWatched?.(x)} onWatch={onWatch} msrp={msrp}/>)}
    </div>
    {visible.length>shown&&<button className="moreBtn" onClick={()=>setShown(n=>n+pageSize)}>Show {Math.min(pageSize,visible.length-shown)} more <span>{visible.length-shown} remaining</span></button>}
  </div>;
}
