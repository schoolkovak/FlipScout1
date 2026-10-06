const HISTORY_KEY="flipscout-history-v2";
const WATCHLIST_KEY="flipscout-watchlist-v1";
const SAVED_SEARCH_KEY="flipscout-saved-searches-v1";

function read(key,fallback=[]){
  try{return JSON.parse(localStorage.getItem(key)||"null")||fallback;}
  catch{return fallback;}
}

function write(key,value){
  localStorage.setItem(key,JSON.stringify(value));
  return value;
}

export function getHistory(){ return read(HISTORY_KEY,[]); }

export function saveAnalysis(entry){
  const current=getHistory();
  const id=entry.id||crypto.randomUUID?.()||String(Date.now());
  const saved={...entry,id,savedAt:new Date().toISOString()};
  const next=[saved,...current.filter(x=>x.id!==id)].slice(0,50);
  write(HISTORY_KEY,next);
  return saved;
}

export function deleteAnalysis(id){
  const next=getHistory().filter(x=>x.id!==id);
  write(HISTORY_KEY,next);
  return next;
}

export function clearHistory(){
  write(HISTORY_KEY,[]);
}

export function getWatchlist(){ return read(WATCHLIST_KEY,[]); }

export function toggleWatchItem(item){
  const current=getWatchlist();
  const key=item.url||item.id||item.title;
  const exists=current.some(x=>(x.url||x.id||x.title)===key);
  const next=exists
    ? current.filter(x=>(x.url||x.id||x.title)!==key)
    : [{...item,watchedAt:new Date().toISOString()},...current].slice(0,100);
  write(WATCHLIST_KEY,next);
  return {items:next,added:!exists};
}

export function isWatched(item){
  const key=item.url||item.id||item.title;
  return getWatchlist().some(x=>(x.url||x.id||x.title)===key);
}

export function getSavedSearches(){ return read(SAVED_SEARCH_KEY,[]); }

export function saveSearch(search){
  const current=getSavedSearches();
  const id=search.id||crypto.randomUUID?.()||String(Date.now());
  const saved={...search,id,savedAt:new Date().toISOString()};
  const next=[saved,...current.filter(x=>x.id!==id)].slice(0,30);
  write(SAVED_SEARCH_KEY,next);
  return saved;
}

export function deleteSavedSearch(id){
  const next=getSavedSearches().filter(x=>x.id!==id);
  write(SAVED_SEARCH_KEY,next);
  return next;
}
