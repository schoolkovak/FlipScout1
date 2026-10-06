import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/market/pc.js';
import {parseListingText} from '../src/listingParser.js';
import {GPUS,CPUS,resolveCatalogPart} from '../shared/catalog.js';
import {buildMarket,liveSearch,relevanceScore,rankDeals,searchPartsSniper} from '../api/_lib/market.js';
import {buildOpportunitySummary,channelEconomics,marginBuyTargets,sensitivityAnalysis,scoreBreakdown,verdict} from '../src/intelligence.js';
import {fallbackPcEstimate} from '../src/valuation.js';
import {SNIPER_CATEGORIES,SNIPER_CONDITIONS,SNIPER_MARKETPLACES} from '../shared/sniper.js';
const build={price:500,cpu:'Ryzen 5 5600X',gpu:'RTX 4060',ram:'16GB DDR4-3600 (2x8GB)',storage:'1TB NVMe SSD',motherboard:'B550 AM4 Motherboard',psu:'650W 80+ Gold PSU',caseType:'Midrange Tempered Glass RGB Case',cooler:'Basic Tower Air Cooler'};
async function call(body){let status,result;await handler({method:'POST',body},{status(n){status=n;return this},json(x){result=x;return x}});return {status,result};}
test('API: invalid hardware returns validation instead of ReferenceError',async()=>{const {result}=await call({...build,gpu:'RTX 9090'});assert.equal(result.valid,false);});
test('API: valid build without providers returns F evidence without crashing',async()=>{const {result}=await call(build);assert.equal(result.valid,true);assert.equal(result.evidence.grade,'F');assert.equal(result.available,false);const summary=buildOpportunitySummary(build,fallbackPcEstimate(build),result);assert.equal(summary.hasLiveResale,false);assert.equal(summary.best,null);assert.equal(summary.verdict.label,'VERIFY');});
test('API: negative/blank/nonfinite prices and malformed ZIP rejected',async()=>{for(const price of [-5,'',null,'NaN',Infinity])assert.equal((await call({...build,price})).status,400);assert.equal((await call({...build,postalCode:'123'})).status,400);});
test('catalog has unique desktop names and required coverage',()=>{assert.equal(new Set(GPUS.map(x=>x.name)).size,GPUS.length);assert.equal(new Set(CPUS.map(x=>x.name)).size,CPUS.length);assert.ok(!GPUS.some(x=>/6600M/.test(x.name)));assert.ok(CPUS.length>=200);assert.ok(GPUS.length>=110);});
test('model variants remain ambiguous; fake suffix/capacity rejected',()=>{for(const name of ['RTX 3060','RTX 4060 Ti','RTX 5060 Ti','RX 9060 XT'])assert.equal(resolveCatalogPart('gpu',name).status,'ambiguous',name);for(const name of ['RTX 4060 Ti 32GB','RTX 5070 XTX'])assert.equal(resolveCatalogPart('gpu',name).item,null,name);assert.equal(resolveCatalogPart('cpu','i7 14700kf').canonical,'Intel i7-14700KF');});
test('parser never silently downgrades ambiguous Ti and reads comma prices',()=>{const a=parseListingText('$1,250 RTX4060Ti, Ryzen5 5600X');assert.equal(a.price,1250);assert.equal(a.gpu,null);assert.equal(a.cpu,'Ryzen 5 5600X');assert.equal(parseListingText('RTX 4060 Ti 16GB').gpu,'RTX 4060 Ti 16GB');assert.equal(parseListingText('RTX 9090').gpu,null);});
test('accessories, laptops and wrong variants cannot become comps',()=>{for(const title of ['RTX 4060 Ti 8GB graphics card','RTX 4060 laptop GPU','RTX 4060 replacement fan','RTX 4060 broken for parts','RTX 4060 empty box'])assert.equal(relevanceScore(title,'RTX 4060','GPU'),0,title);assert.equal(relevanceScore('RTX 3060 8GB graphics card','RTX 3060 12GB','GPU'),0);});
test('market filters invalid values and duplicate observations',()=>{const item={title:'GPU',url:'https://example.com/1',totalPrice:200,relevance:1,shippingKnown:true};assert.equal(buildMarket([item,item,{...item,totalPrice:NaN}]).sampleSize,1);});
test('scanner hard-caps unknown shipping and suspicious discounts',()=>{const item={title:'RTX 4060',totalPrice:20,itemPrice:20,shippingKnown:false,condition:'used',relevance:1};const ranked=rankDeals([item],{median:200,sampleSize:100,comps:[item]},{query:'RTX 4060',partBudget:100,buildBudget:1000,committed:0});assert.ok(ranked[0].score<=59);assert.ok(ranked[0].scoreCap<=59);});
test('channel math, break-even and conservative ROI targets agree',()=>{const e=channelEconomics({salePrice:1000,acquisitionCost:500,shippingCost:75,channel:'ebay'});assert.ok(Math.abs(e.profit-351.1)<1e-8);const target=marginBuyTargets({resale:1000,shipping:75});assert.ok(channelEconomics({salePrice:1000,acquisitionCost:target.target20,shippingCost:75,channel:'ebay'}).roi>=20);const stress=sensitivityAnalysis({onlineLikely:1000,acquisitionCost:500,shippingMedian:75});assert.ok(Math.abs(channelEconomics({salePrice:stress.onlineBreakEven,acquisitionCost:500,shippingCost:75,channel:'ebay'}).profit)<1);});
test('no invented local channel; unknown shipping gets explicit allowance',()=>{const live={available:true,evidence:{grade:'C',scoreCap:75,completePcCompCount:5},resale:{online:{likely:1000,costs:{shippingMedian:null}}}};const s=buildOpportunitySummary(build,fallbackPcEstimate(build),live);assert.equal(s.channels.local,undefined);assert.equal(s.shipping,75);assert.equal(s.shippingAssumed,true);assert.ok(s.scoreBreakdown.finalScore<=69);});
test('thin evidence and insufficient confidence cannot yield strong buy',()=>{for(const grade of ['C','D','F'])assert.notEqual(verdict({score:100,profit:500,roi:100,evidenceGrade:grade,hasLiveResale:true}).label,'STRONG BUY');assert.notEqual(verdict({score:100,profit:500,roi:100,evidenceGrade:'A',evidenceConfidence:'Insufficient'}).label,'STRONG BUY');});
test('concurrent requests coalesce, cache and sanitize unsafe links',async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,10));return {ok:true,status:200,json:async()=>({shopping:[{title:'RTX 4060 new graphics card',price:'$200',link:'javascript:alert(1)'}]})}};try{const input={query:'RTX 4060',category:'GPU',condition:'new',providerKeys:{SERPER_API_KEY:'test-only-key'}};const [a,b]=await Promise.all([liveSearch(input),liveSearch(input)]);assert.equal(calls,1);assert.equal(a.items[0].url,null);assert.equal(b.market.sampleSize,1);assert.equal((await liveSearch(input)).cached,true);assert.equal(calls,1);}finally{globalThis.fetch=original;}});
test('live API computes and returns evidence after parallel provider calls',async()=>{const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{const u=new URL(url);const q=u.searchParams.get('q')||JSON.parse(options?.body||'{}').q||'';return {ok:true,status:200,json:async()=>({organic_results:Array.from({length:12},(_,i)=>({title:q+' used',extracted_price:q.includes('gaming PC')?850+i*10:180+i,extracted_shipping:30,condition:'Used',extracted_items_sold:3,item_id:q+i,link:'https://www.ebay.com/itm/'+(100000000000+i)+encodeURIComponent(q)}))})}};try{const {result}=await call({...build,providerKeys:{SEARCHAPI_API_KEY:'integration-test-only'}});assert.equal(result.available,true);assert.ok(result.evidence.completePcCompCount>=6);assert.equal(result.evidence.grade,'B');assert.equal(result.evidence.completedSaleCount,0);assert.equal(result.evidence.evidenceType,'active-with-prior-sales');assert.ok(result.resale.online.likely>0);assert.ok(buildOpportunitySummary(build,fallbackPcEstimate(build),result).hasLiveResale);}finally{globalThis.fetch=original;}});

test('Parts & Sniper exposes exactly 38 categories, four marketplaces, and six conditions',()=>{
  assert.equal(SNIPER_CATEGORIES.length,38);
  assert.deepEqual(SNIPER_MARKETPLACES.map(x=>x.id),['amazon','newegg','ebay','mercari']);
  assert.deepEqual(SNIPER_CONDITIONS.map(x=>x.value),['any','new','open-box','renewed','refurbished','used']);
});

test('Parts & Sniper keeps marketplace identity and filters junk results',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('google.serper.dev')){
      return {ok:true,status:200,json:async()=>({shopping:[
        {title:'RTX 5070 used graphics card',price:'$510',source:'Amazon',link:'https://www.amazon.com/dp/test1',delivery:'Free shipping'},
        {title:'RTX 5070 used graphics card',price:'$520',source:'Newegg',link:'https://www.newegg.com/p/test2',delivery:'$9.99 shipping'},
        {title:'RTX 5070 used graphics card',price:'$500',source:'Mercari',link:'https://www.mercari.com/us/item/test3',delivery:'$12 shipping'},
        {title:'RTX 5070 laptop GPU',price:'$200',source:'Amazon',link:'https://www.amazon.com/dp/junk',delivery:'Free shipping'}
      ]})};
    }
    if(String(url).includes('searchapi.io')){
      return {ok:true,status:200,json:async()=>({organic_results:[
        {title:'RTX 5070 used graphics card',extracted_price:505,extracted_shipping:15,condition:'Used',item_id:'1',link:'https://www.ebay.com/itm/123456789012',seller:{name:'seller',positive_feedback_percent:99.5}}
      ]})};
    }
    throw new Error('unexpected provider');
  };
  try{
    const result=await searchPartsSniper({
      query:'RTX 5070',category:'GPU',condition:'used',
      marketplaces:['amazon','newegg','ebay','mercari'],
      partBudget:550,buildBudget:1100,committed:300,
      providerKeys:{SERPER_API_KEY:'test-serper',SEARCHAPI_API_KEY:'test-searchapi'}
    });
    assert.ok(result.market.sampleSize>=4);
    const sources=new Set(result.items.map(x=>x.source));
    for(const source of ['Amazon','Newegg','eBay','Mercari'])assert.ok(sources.has(source),source);
    assert.ok(!result.items.some(x=>/laptop/i.test(x.title)));
    assert.ok(result.ranked.every(x=>x.score<=x.scoreCap));
  }finally{globalThis.fetch=original;}
});
