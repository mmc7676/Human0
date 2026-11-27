const fs=require('fs');require(process.argv[2]);const C=globalThis.WineCore;
const rows=JSON.parse(fs.readFileSync(process.argv[3]));const out={};
const S=o=>Object.assign(C.emptyState(),o);
out.total=C.filterRows(rows,S({})).length;
out.color=C.facetCounts(rows,S({}),'color');
out.red_under20=C.filterRows(rows,S({color:['red'],priceMax:20})).length;
out.na=C.filterRows(rows,S({alcohol:'only_na'})).length;
out.chard_us=C.filterRows(rows,S({varietal:['Chardonnay'],country:['United States']})).length;
out.q_pinot_oregon=C.filterRows(rows,S({q:'pinot oregon'})).length;
out.q_rose_accent=C.filterRows(rows,S({q:'rose'})).length;
out.price_15_25=C.filterRows(rows,S({priceMin:15,priceMax:25})).length;
out.facet_varietal_given_red=C.facetCounts(rows,S({color:['red']}),'varietal')['Cabernet Sauvignon'];
out.facet_color_given_red=C.facetCounts(rows,S({color:['red']}),'color')['white'];
const sp=C.sortRows(rows,'price','asc').map(r=>r.price);out.sorted_ok=sp.every((v,i)=>!i||sp[i-1]<=v);
const so=C.sortRows(rows,'off','desc').map(r=>r.off_pct||0);out.off_sorted=so.every((v,i)=>!i||so[i-1]>=v);
const g=C.groupRows(rows,'varietal');out.group_sum=g.reduce((a,x)=>a+x.count,0);out.groups=g.length;
const cab=g.find(x=>x.key==='Cabernet Sauvignon');out.cab=[cab.count,cab.min,cab.median,cab.max];
console.log(JSON.stringify(out));
// Vivino: counts and sorts must agree with what data/wines.json stores (checked again in python below)
const V={};
V.matched=C.filterRows(rows,S({vivino:'matched'})).length;
V.unmatched=C.filterRows(rows,S({vivino:'unmatched'})).length;
V.rated=rows.filter(r=>r.v_rating!=null).length;
V.min40=C.filterRows(rows,S({minRating:4})).length;
V.min40_ok=C.filterRows(rows,S({minRating:4})).every(r=>r.v_rating>=4);
V.red_min38=C.filterRows(rows,S({color:['red'],minRating:3.8})).length;
const sr=C.sortRows(rows,'rating','desc').map(r=>r.v_rating==null?-1:r.v_rating);V.rating_sorted=sr.every((v,i)=>!i||sr[i-1]>=v);
V.ratings_sum=rows.reduce((a,r)=>a+(r.v_count||0),0);
V.with_cloud=rows.filter(r=>r.v_cloud&&r.v_cloud.length).length;
V.cloud_on_unmatched=rows.filter(r=>r.v_status!=='matched'&&r.v_cloud).length;
const stripped=rows.map(r=>{const o={};for(const k in r)if(!k.startsWith('v_'))o[k]=r[k];return o;});
const base=JSON.stringify(Object.fromEntries(['total','na','red_under20','price_15_25'].map(k=>[k,out[k]])));
const s2={total:C.filterRows(stripped,S({})).length,na:C.filterRows(stripped,S({alcohol:'only_na'})).length,
  red_under20:C.filterRows(stripped,S({color:['red'],priceMax:20})).length,price_15_25:C.filterRows(stripped,S({priceMin:15,priceMax:25})).length};
V.old_counts_unchanged=JSON.stringify(s2)===base;
console.log(JSON.stringify(V));
// Beer: node test_core.js core.js wines.json beers.json
if(process.argv[4]){
  C.configure(C.BEER);const B=JSON.parse(fs.readFileSync(process.argv[4]));const S2=o=>Object.assign(C.emptyState(),o);const R={};
  R.total=C.filterRows(B,S2({})).length;
  R.family=C.facetCounts(B,S2({}),'family');R.pack=C.facetCounts(B,S2({}),'pack');R.container=C.facetCounts(B,S2({}),'container');
  R.ipa_cans=C.filterRows(B,S2({family:['IPA'],container:['Can']})).length;
  R.six_under15=C.filterRows(B,S2({pack:['6-pack'],priceMax:15})).length;
  R.abv7=C.filterRows(B,S2({abvMin:7})).length;R.abv_lt5=C.filterRows(B,S2({abvMax:5})).length;R.abv5_7=C.filterRows(B,S2({abvMin:5,abvMax:7})).length;
  R.na=C.filterRows(B,S2({alcohol:'only_na'})).length;R.no_na=C.filterRows(B,S2({alcohol:'exclude_na'})).length;
  R.q_stella=C.filterRows(B,S2({q:'stella'})).length;R.q_hazy=C.filterRows(B,S2({q:'hazy'})).length;
  R.has_onSale=('onSale' in C.emptyState());
  const po=C.sortRows(B,'per_oz','asc').map(r=>r.per_oz==null?Infinity:r.per_oz);R.per_oz_sorted=po.every((v,i)=>!i||po[i-1]<=v);
  const g=C.groupRows(B,'style');R.style_group_sum=g.reduce((a,x)=>a+x.count,0);
  R.pack_order=C.facetValues(B,'pack').map(x=>x.value);
  console.log(JSON.stringify(R));
}
// Cheese: node test_core.js core.js wines.json beers.json cheeses.json
if(process.argv[5]){
  C.configure(C.CHEESE);const K=JSON.parse(fs.readFileSync(process.argv[5]));const S3=o=>Object.assign(C.emptyState(),o);const Q={};
  Q.total=C.filterRows(K,S3({})).length;
  Q.style=C.facetCounts(K,S3({}),'style');Q.milk=C.facetCounts(K,S3({}),'milk');Q.form=C.facetCounts(K,S3({}),'form');
  Q.blue_fr=C.filterRows(K,S3({style:['Blue'],country:['France']})).length;
  Q.under15=C.filterRows(K,S3({priceMax:15})).length;Q.p20_30=C.filterRows(K,S3({priceMin:20,priceMax:30})).length;
  Q.q_truffle=C.filterRows(K,S3({q:'truffle'})).length;Q.q_comte=C.filterRows(K,S3({q:'comte'})).length;
  Q.no_alcohol_state=!('abvMin' in C.emptyState())&&!('minRating' in C.emptyState());
  Q.facet_milk_given_blue=C.facetCounts(K,S3({style:['Blue']}),'milk');
  const sp=C.sortRows(K,'price','desc').map(r=>r.price);Q.price_desc_ok=sp.every((v,i)=>!i||sp[i-1]>=v);
  const ss=C.sortRows(K,'style','asc').map(r=>C.CHEESE.typeOrder.indexOf(C.val(r,'style')));Q.style_sort_ok=ss.every((v,i)=>!i||ss[i-1]<=v);
  const g=C.groupRows(K,'style');Q.group_sum=g.reduce((a,x)=>a+x.count,0);Q.group_order=g.map(x=>x.key);
  Q.form_order=C.facetValues(K,'form').map(x=>x.value);
  console.log(JSON.stringify(Q));
}
// Winery (Vivino winery pages): node test_core.js core.js wines.json
{
  C.configure(C.WINE);const S4=o=>Object.assign(C.emptyState(),o);const W={};
  W.matched=rows.filter(r=>r.w_status==='matched').length;
  W.region_facet_sum=Object.values(C.facetCounts(rows,S4({}),'w_region')).reduce((a,b)=>a+b,0);
  W.paso=C.filterRows(rows,S4({w_region:['Paso Robles']})).length;
  W.paso_ok=C.filterRows(rows,S4({w_region:['Paso Robles']})).every(r=>r.w_region==='Paso Robles');
  W.q_daou=C.filterRows(rows,S4({q:'daou'})).length;
  const wr=C.sortRows(rows,'wrating','desc').map(r=>r.w_rating==null?-1:r.w_rating);W.wrating_sorted=wr.every((v,i)=>!i||wr[i-1]>=v);
  W.no_w_on_unmatched=rows.filter(r=>r.w_status!=='matched'&&(r.w_name||r.w_url)).length===0;
  W.links_vivino_only=rows.every(r=>(r.w_more||[]).every(m=>m[1].startsWith('https://www.vivino.com/'))&&(!r.w_url||r.w_url.startsWith('https://www.vivino.com/')));
  W.base_counts_unchanged=C.filterRows(rows,S4({})).length===out.total&&C.filterRows(rows,S4({color:['red'],priceMax:20})).length===out.red_under20;
  console.log(JSON.stringify(W));
}
