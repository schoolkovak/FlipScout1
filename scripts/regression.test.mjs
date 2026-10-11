import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/market/pc.js';
import {parseListingText} from '../src/listingParser.js';
import {GPUS,CPUS,resolveCatalogPart} from '../shared/catalog.js';
import {buildMarket,liveSearch,relevanceScore,rankDeals,searchPartsSniper,searchSearchApiEbay} from '../api/_lib/market.js';
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

test('Deal Hunt exposes 38 categories, trusted shopping sources, and six conditions',()=>{
  assert.equal(SNIPER_CATEGORIES.length,38);
  assert.deepEqual(SNIPER_MARKETPLACES.map(x=>x.id),['amazon','bestbuy','walmart','newegg','ebay','aliexpress','mercari']);
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


test('Deal Hunt isolates cached results by selected store and reports actual coverage',async()=>{
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url)=>{
    if(!String(url).includes('google.serper.dev'))throw new Error('Unexpected provider call');
    calls++;
    return {ok:true,status:200,json:async()=>({shopping:[
      {title:'RTX 5070 used graphics card',source:'Newegg',price:'$460',delivery:'Free shipping',link:'https://www.newegg.com/p/part1'},
      {title:'RTX 5070 used graphics card',source:'Mercari',price:'$470',delivery:'Free shipping',link:'https://www.mercari.com/us/item/part2'}
    ]})};
  };
  try{
    const common={query:'RTX 5070',category:'GPU',condition:'used',providerKeys:{SERPER_API_KEY:'store-cache-test'}};
    const a=await searchPartsSniper({...common,marketplaces:['newegg'],distanceRadius:'newegg'});
    const b=await searchPartsSniper({...common,marketplaces:['mercari'],distanceRadius:'mercari'});
    assert.deepEqual(a.items.map(x=>x.marketplace),['newegg']);
    assert.deepEqual(b.items.map(x=>x.marketplace),['mercari']);
    assert.equal(calls,2);
    assert.equal(b.sourceCoverage.find(x=>x.id==='mercari').count,1);
  } finally{globalThis.fetch=previous;}
});

test('Incomplete GPU assemblies cannot appear as working-card deals',()=>{
  for(const title of ['RTX 4070 GPU bare PCB only','RTX 4070 missing heatsink and backplate',
    'RTX 4070 with no fans','RTX 4070 card not working','RTX 4070 GPU untested']){
    assert.equal(relevanceScore(title,'RTX 4070','GPU'),0,title);
  }
});

test('automatic discovery lists every part category and several important subtype searches',async()=>{
  const {DISCOVERY_TARGETS,DISCOVERY_SUBTYPES}=await import('../shared/discovery.js');
  assert.equal(new Set(DISCOVERY_TARGETS.map(x=>x.category)).size,SNIPER_CATEGORIES.length);
  assert.ok(DISCOVERY_TARGETS.length>=100);
  for(const part of ['GPU','CPU','RAM / Memory','NVMe SSD','Motherboard','Power Supply / PSU']){
    assert.ok(DISCOVERY_SUBTYPES[part]?.length>=3,part);
  }
  assert.equal(new Set(DISCOVERY_TARGETS.map(x=>x.id)).size,DISCOVERY_TARGETS.length);
});


test('eBay deal search prioritizes lowest delivered price and remains possible with used condition',async()=>{
  const previous=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async url=>{
    const parsed=new URL(url);
    seen.push({sort:parsed.searchParams.get('sort_by'),condition:parsed.searchParams.get('condition')});
    return {ok:true,status:200,json:async()=>({organic_results:[
      {title:'RTX 4060 used graphics card complete',extracted_price:190,extracted_shipping:10,condition:'Used',item_id:'cheaper',link:'https://www.ebay.com/itm/111111111111'},
      {title:'RTX 4060 used graphics card complete',extracted_price:230,extracted_shipping:0,condition:'Used',item_id:'other',link:'https://www.ebay.com/itm/222222222222'}
    ]})};
  };
  try{
    const items=await searchSearchApiEbay({query:'RTX 4060',category:'GPU',condition:'used',providerKeys:{SEARCHAPI_API_KEY:'test-only-price-sort'}});
    assert.equal(seen[0].sort,'price_shipping_low_to_high');
    assert.ok((seen[0].condition||'').includes('used'));
    assert.equal(items.length,2);
    assert.equal(Math.min(...items.map(x=>x.totalPrice)),200);
  }finally{globalThis.fetch=previous;}
});

test('discovery has hundreds of subtype searches and each category has variations',async()=>{
  const {DISCOVERY_TARGETS}=await import('../shared/discovery.js');
  assert.ok(DISCOVERY_TARGETS.length>=180);
  assert.equal(new Set(DISCOVERY_TARGETS.map(x=>x.category)).size,SNIPER_CATEGORIES.length);
  assert.equal(new Set(DISCOVERY_TARGETS.map(x=>x.id)).size,DISCOVERY_TARGETS.length);
});


test('core automatic discovery excludes peripherals and scans CPU before all GPUs',async()=>{
  const {CORE_PC_CATEGORIES,CORE_DISCOVERY_TARGETS}=await import('../shared/discovery.js');
  assert.ok(CORE_PC_CATEGORIES.includes('CPU')&&CORE_PC_CATEGORIES.includes('GPU'));
  for(const name of ['Wi-Fi Card','Thermal Paste','Keyboard','Mouse','Monitor','Webcam']){
    assert.ok(!CORE_PC_CATEGORIES.includes(name),name);
  }
  assert.equal(new Set(CORE_DISCOVERY_TARGETS.map(x=>x.category)).size,CORE_PC_CATEGORIES.length);
  assert.ok(CORE_DISCOVERY_TARGETS.slice(0,10).some(x=>x.category==='CPU'));
});

test('reference GPU MSRP requires a grounded model and does not fabricate unknown prices',async()=>{
  const {referenceMsrp}=await import('../shared/msrp.js');
  const price=referenceMsrp('GPU','RTX 4060','Nvidia RTX 4060 graphics card 8GB');
  assert.equal(price?.amount,299);
  assert.ok(price?.source.startsWith('https://'));
  assert.equal(referenceMsrp('CPU','Ryzen 5 5600'),null);
  assert.equal(referenceMsrp('GPU','RTX 5090'),null);
  assert.equal(referenceMsrp('GPU','RTX 4060 Ti 16GB','RTX 4060 Ti 16GB')?.amount,499);
});

test('only seven desired retailers remain selectable',()=>{
  const ids=SNIPER_MARKETPLACES.map(m=>m.id);
  assert.deepEqual(ids,['amazon','bestbuy','walmart','newegg','ebay','aliexpress','mercari']);
});


test('loaded listing sorting and filters are pure, stable and keep lowest-priced offers',async()=>{
  const {sortOffers,filterOffers,dedupeOffers,savingsPercent,offerReference}=await import('../src/dealSort.js');
  const src=[
    {url:'https://www.ebay.com/itm/a',title:'RTX 4060 A',totalPrice:180,msrp:299,marketplace:'ebay',category:'GPU',condition:'used',shippingKnown:true},
    {url:'https://www.newegg.com/p/b',title:'RTX 4060 B',totalPrice:210,msrp:299,marketplace:'newegg',category:'GPU',condition:'new',shippingKnown:true},
    {url:'https://www.amazon.com/dp/c',title:'RTX 4060 C',totalPrice:155,marketplace:'amazon',category:'GPU',condition:'new',shippingKnown:false},
    {url:'https://www.ebay.com/itm/a?ref=duplicate',title:'RTX 4060 A',totalPrice:180,msrp:299,marketplace:'ebay',category:'GPU',condition:'used'}
  ];
  const originals=src.map(x=>x.url);
  assert.equal(dedupeOffers(src).length,3);
  const cheapest=sortOffers(dedupeOffers(src),'price');
  const best=sortOffers(dedupeOffers(src),'best');
  assert.equal(cheapest[0].marketplace,'amazon');
  assert.equal(best[0].marketplace,'ebay'); // Verified reference outranks unknown savings.
  assert.deepEqual(src.map(x=>x.url),originals); // No mutation.
  assert.equal(filterOffers(cheapest,{category:'GPU',condition:'used'}).length,1);
  assert.equal(offerReference(src[2]),null);
  assert.ok(savingsPercent(src[0])>39);
});

test('all seven structured retailer offers survive strict direct-link and pricing checks',async()=>{
  const previous=globalThis.fetch;
  const base='RTX 4060 8GB complete desktop graphics card';
  const seen=[];
  globalThis.fetch=async(url,options)=>{
    const u=new URL(url);
    const engine=u.searchParams.get('engine');
    const q=u.searchParams.get('q')||JSON.parse(options?.body||'{}').q||'';
    seen.push(engine||'serper');
    let payload={};
    if(u.hostname==='google.serper.dev')payload={shopping:[
      {title:base,source:'Newegg',price:'$229.99',delivery:'Free shipping',link:'https://www.newegg.com/p/abc123',thumbnail:'https://images.example.test/a.jpg'}
    ]};
    else if(engine==='google_shopping')payload={shopping_results:[
      {title:base,seller:'Mercari',extracted_price:208,condition:'used',link:'https://www.mercari.com/us/item/m999'},
      {title:base,seller:'AliExpress',extracted_price:240,condition:'new',link:'https://www.aliexpress.com/item/1001.html'}
    ]};
    else if(engine==='ebay_search')payload={organic_results:[
      {title:base,extracted_price:190,extracted_shipping:10,condition:'Used',item_id:'987',link:'https://www.ebay.com/itm/987654321'}
    ]};
    else if(engine==='amazon_search')payload={organic_results:[
      {title:base,extracted_price:260,link:'https://www.amazon.com/dp/B01A02A03',thumbnail:'https://images.example.test/b.jpg'}
    ]};
    else if(engine==='bestbuy_search')payload={organic_results:[
      {title:base,extracted_price:255,link:'https://www.bestbuy.com/product/gpu/123',condition:'new',thumbnail:'https://images.example.test/c.jpg'}
    ]};
    else if(engine==='walmart_search')payload={organic_results:[
      {title:base,extracted_price:245,link:'https://www.walmart.com/ip/12345',thumbnail:'https://images.example.test/d.jpg'}
    ]};
    else if(engine==='google')payload={organic_results:[]};
    else throw Error('Unexpected provider '+engine);
    return {ok:true,status:200,json:async()=>payload};
  };
  try{
    const search=await searchPartsSniper({
      query:'RTX 4060',category:'GPU',condition:'any',
      marketplaces:SNIPER_MARKETPLACES.map(s=>s.id),
      providerKeys:{SERPER_API_KEY:'all-stores-mock',SEARCHAPI_API_KEY:'all-stores-mock'},
      deepScan:false
    });
    assert.deepEqual(new Set(search.ranked.map(x=>x.marketplace)),
      new Set(['amazon','bestbuy','walmart','newegg','ebay','aliexpress','mercari']));
    assert.equal(search.sourceCoverage.reduce((n,x)=>n+x.count,0),7);
    assert.ok(search.ranked.every(x=>x.url.startsWith('https://')));
    assert.ok(search.ranked.some(x=>x.marketplace==='bestbuy'&&x.imageUrl));
    assert.ok(search.providerReports.every(x=>x.status==='results'));
    assert.ok(seen.includes('google_shopping')&&seen.includes('amazon_search'));
  }finally{globalThis.fetch=previous;}
});

test('Part Scanner API enforces price range and returns real multi-store results',async()=>{
  const {default:handler}=await import('../api/deals/search.js');
  const previous=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const u=new URL(url);
    const engine=u.searchParams.get('engine');
    const payload=engine==='ebay_search'?{organic_results:[
      {title:'RTX 4060 8GB desktop GPU complete',extracted_price:190,extracted_shipping:10,condition:'Used',link:'https://www.ebay.com/itm/99887',item_id:'99887'}
    ]}:engine==='bestbuy_search'?{organic_results:[
      {title:'RTX 4060 8GB desktop GPU complete',extracted_price:259,link:'https://www.bestbuy.com/product/gpu/123'}
    ]}:engine==='amazon_search'?{organic_results:[
      {title:'RTX 4060 8GB desktop GPU complete',extracted_price:270,link:'https://www.amazon.com/dp/B000000011'}
    ]}:engine==='google_shopping'?{shopping_results:[]}:
      engine==='walmart_search'?{organic_results:[]}:engine==='google'?{organic_results:[]}:
      {shopping:[]};
    return {ok:true,status:200,json:async()=>payload};
  };
  const reply=async body=>{
    let status,payload;
    await handler({method:'POST',body},{status(n){status=n;return this},json(o){payload=o;return o}});
    return {status,payload};
  };
  try{
    const invalid=await reply({query:'RTX 4060',category:'GPU',minPartPrice:350,partBudget:200});
    assert.equal(invalid.status,400);
    const result=await reply({query:'RTX 4060',category:'GPU',minPartPrice:195,partBudget:300,
      providerKeys:{SEARCHAPI_API_KEY:'part-scanner-mock',SERPER_API_KEY:'part-scanner-mock'}});
    assert.equal(result.status,200);
    assert.equal(result.payload.available,true);
    assert.ok(result.payload.results.some(x=>x.marketplace==='ebay'));
    assert.ok(result.payload.results.some(x=>x.marketplace==='bestbuy'));
    assert.ok(result.payload.results.every(x=>x.totalPrice>=195&&x.totalPrice<=300));
  }finally{globalThis.fetch=previous;}
});


test('valid RTX 4060 VRAM suffix survives, while wrong VRAM, Ti and broken cards do not',()=>{
  assert.ok(relevanceScore('Gigabyte GeForce RTX 4060 8GB Windforce OC desktop GPU','RTX 4060','GPU')>=.72);
  assert.equal(relevanceScore('GeForce RTX 4060 Ti 16GB desktop graphics card','RTX 4060','GPU'),0);
  assert.equal(relevanceScore('RTX 4060 12GB desktop graphics card','RTX 4060','GPU'),0);
  assert.equal(relevanceScore('RTX 4060 8GB bare PCB only','RTX 4060','GPU'),0);
  assert.equal(relevanceScore('RTX 4060 8GB laptop GPU','RTX 4060','GPU'),0);
});

test('valid CPU titles with core count keep relevance without allowing a different CPU',()=>{
  assert.ok(relevanceScore('AMD Ryzen 5 5600 6 Core Desktop CPU Processor','Ryzen 5 5600','CPU')>=.72);
  assert.equal(relevanceScore('AMD Ryzen 5 5600X Processor','Ryzen 5 5600','CPU'),0);
});
