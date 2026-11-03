const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
p.on('pageerror',e=>console.log('PE',e.message.slice(0,300)));p.on('console',m=>console.log('C',m.text().slice(0,200)));
await p.route(/^https?:/,r=>r.request().url().startsWith('http://127.0.0.1:8794/')?r.continue():r.abort());
await p.goto('file://'+path.resolve('maxey0-context-plane-graph.html')+'?api=http://127.0.0.1:8794',{waitUntil:'commit'});
await p.waitForTimeout(15000);console.log(await p.evaluate(()=>[!!window.__l5,document.querySelector('.h0n')&&document.querySelector('.h0n').textContent]));await b.close()})()
