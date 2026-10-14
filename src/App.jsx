import React,{useEffect,useState} from "react";
import {Search,Target,Bookmark,ExternalLink,Trash2,Radar,Eye,DollarSign,BarChart3} from "lucide-react";
import {track} from "@vercel/analytics";
import {PART_GROUPS,findCatalogModel,normalizePartQuery} from "../shared/partCatalog.js";
import {getWatchlist,toggleWatchItem,getSavedSearches,deleteSavedSearch} from "./storage";
import {BrowsePage,ModelPage,CategoryPills} from "./Browse.jsx";
import DealHunt from "./DealHunt.jsx";
import Flipper from "./Flipper.jsx";
import Analytics from "./Analytics.jsx";
import {money} from "./DealResults.jsx";
import {STATE_TAX,loadTaxState,saveTaxState,finalPrice} from "./pricing.js";
import {TaxContext} from "./taxContext.js";

const EMPTY_KEYS={SERPER_API_KEY:"",SEARCHAPI_API_KEY:""};
function loadProviderKeys(){
  try{return {...EMPTY_KEYS,...JSON.parse(localStorage.getItem("flipscout-provider-keys")||"{}")};}
  catch{return {...EMPTY_KEYS};}
}

// Route lives in the URL hash so back/forward and shared links work.
function parseRoute(){
  const p=new URLSearchParams(location.hash.replace(/^#\/?/,""));
  return {page:p.get("page")||"browse",group:p.get("group")||"gpu",series:p.get("series")||"",model:p.get("model")||"",query:p.get("q")||""};
}
function routeHash(r){
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries({page:r.page,group:r.group,series:r.series,model:r.model,q:r.query}))if(v)p.set(k,v);
  return "#/"+p.toString();
}

function Logo(){
  return <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true" className="logoMark">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1cf2a6"/><stop offset="1" stopColor="#19b6ff"/></linearGradient></defs>
    <circle cx="20" cy="20" r="15" fill="none" stroke="url(#lg)" strokeWidth="3"/>
    <circle cx="20" cy="20" r="6" fill="none" stroke="url(#lg)" strokeWidth="2.5"/>
    <path d="M20 1v9M20 30v9M1 20h9M30 20h9" stroke="url(#lg)" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

function TopNav({route,go,watchCount,taxState,setTaxState}){
  const [q,setQ]=useState("");
  function submit(e){e.preventDefault();const query=q.trim();if(!query)return;track("nav_search",{query});const hit=findCatalogModel(query);if(hit)go({page:"model",group:hit.group.id,series:hit.series.id,model:hit.item.name});else go({page:"model",query:normalizePartQuery(query)});}
  const links=[["browse","Browse Parts",Radar],["flip","Flipper Deals",DollarSign],["hunt","Deal Hunt",Target],["watch","Watchlist",Eye],["analytics","Analytics",BarChart3]];
  return <nav className="topNav">
    <button className="brand" onClick={()=>go({page:"browse",group:"gpu"})}><Logo/><span>FlipScout</span></button>
    <div className="navLinks">{links.map(([id,label,Icon])=><button key={id} className={(route.page===id||(id==="browse"&&route.page==="model"))?"on":""} onClick={()=>go({page:id,group:route.group})}><Icon size={15}/>{label}{id==="watch"&&watchCount>0&&<em>{watchCount}</em>}</button>)}</div>
    <form className="navSearch" onSubmit={submit} role="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search any part… e.g. RTX 4070 Super"/></form>
    <label className="taxPick" title="Sales tax is estimated from your state">Tax<select value={taxState} onChange={e=>setTaxState(e.target.value)}><option value="">Avg 7.5%</option>{Object.entries(STATE_TAX).map(([k,v])=><option key={k} value={k}>{k} {v}%</option>)}</select></label>
    <span className="livePill"><i></i>LIVE</span>
  </nav>;
}

function Watchlist({refresh,onChange,go}){
  const [items,setItems]=useState(()=>getWatchlist());
  const [searches,setSearches]=useState(()=>getSavedSearches());
  useEffect(()=>{setItems(getWatchlist());setSearches(getSavedSearches());},[refresh]);
  return <div className="watchPage">
    <h1 className="pageTitle">Your Watchlist</h1>
    <p className="pageSub">Listings you bookmarked and searches you saved. Stored on this device.</p>
    <section className="panelBox">
      <h3><Bookmark size={16}/>Watched listings</h3>
      {!items.length?<div className="emptyState">Bookmark a listing from any results page and it shows up here.</div>:
      <div className="watchGrid">{items.map((x,i)=><div className="watchItem" key={x.url||x.id||i}>
        {x.image?<img src={x.image} alt="" referrerPolicy="no-referrer"/>:<span className="imgPh"></span>}
        <div><b>{x.title}</b><span>{x.source} · {x.condition}{x.watchedAt?" · watched "+new Date(x.watchedAt).toLocaleDateString():""}</span></div>
        <strong>{money(x.totalPrice,2)}</strong>
        <div className="watchBtns">{x.url&&<a href={x.url} target="_blank" rel="noreferrer" aria-label="Open listing"><ExternalLink size={15}/></a>}<button onClick={()=>{setItems(toggleWatchItem(x).items);onChange();}} aria-label="Remove"><Trash2 size={15}/></button></div>
      </div>)}</div>}
    </section>
    <section className="panelBox">
      <h3><Search size={16}/>Saved searches</h3>
      {!searches.length?<div className="emptyState">Save a search from any model page to re-run it in one click.</div>:
      <div className="savedGrid">{searches.map(s=><div className="savedItem" key={s.id}>
        <button onClick={()=>go({page:"model",query:s.query})}><b>{s.query}</b><span>{s.category} · {s.condition}</span></button>
        <button className="iconBtn" onClick={()=>setSearches(deleteSavedSearch(s.id))} aria-label="Delete"><Trash2 size={14}/></button>
      </div>)}</div>}
    </section>
  </div>;
}

function Footer({providerKeys}){
  const [sources,setSources]=useState([]);
  useEffect(()=>{
    fetch("/api/sources",{headers:{"x-serper-key":providerKeys.SERPER_API_KEY||"","x-searchapi-key":providerKeys.SEARCHAPI_API_KEY||""}})
      .then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});
  },[]);
  const live=sources.filter(x=>x.status==="Connected");
  return <footer className="siteFooter">
    <div><b>FlipScout</b><span>Prices from trusted US retailers and marketplaces. Listings change fast — always confirm price, condition and seller before buying.</span></div>
    <div className="footerLive">{live.length?live.map(x=><span key={x.id}><i></i>{x.name}</span>):<span className="off"><i></i>No live data source configured</span>}</div>
  </footer>;
}

export default function App(){
  const [route,setRoute]=useState(parseRoute);
  const [providerKeys]=useState(loadProviderKeys);
  const [refresh,setRefresh]=useState(0);
  const [watchCount,setWatchCount]=useState(()=>getWatchlist().length);
  const [taxState,setTax]=useState(loadTaxState);
  const setTaxState=v=>{setTax(v);saveTaxState(v);};
  const bump=()=>{setRefresh(x=>x+1);setWatchCount(getWatchlist().length);};

  useEffect(()=>{const on=()=>setRoute(parseRoute());window.addEventListener("hashchange",on);return()=>window.removeEventListener("hashchange",on);},[]);
  function go(next){
    const group=PART_GROUPS.find(g=>g.id===next.group)||PART_GROUPS[0];
    const r={page:next.page||"browse",group:group.id,series:next.series||"",model:next.model||"",query:next.query||""};
    location.hash=routeHash(r);
    setRoute(r);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  const showPills=route.page==="browse"||route.page==="model";

  return <TaxContext.Provider value={taxState}><div className="appShell">
    <TopNav route={route} go={go} watchCount={watchCount} taxState={taxState} setTaxState={setTaxState}/>
    {showPills&&<CategoryPills groupId={route.query?"":route.group} onPick={g=>go({page:"browse",group:g.id,series:g.series[0].id})}/>}
    <main className="mainWrap">
      {route.page==="browse"&&<BrowsePage providerKeys={providerKeys} groupId={route.group} seriesId={route.series} setRoute={go}/>}
      {route.page==="model"&&<ModelPage key={route.model+route.query} providerKeys={providerKeys} route={route} setRoute={go} onWatchChange={bump}/>}
      {route.page==="flip"&&<Flipper/>}
      {route.page==="hunt"&&<DealHunt providerKeys={providerKeys} onWatchChange={bump}/>}
      {route.page==="watch"&&<Watchlist refresh={refresh} onChange={bump} go={go}/>}
      {route.page==="analytics"&&<Analytics/>}
    </main>
    <Footer providerKeys={providerKeys}/>
  </div></TaxContext.Provider>;
}
