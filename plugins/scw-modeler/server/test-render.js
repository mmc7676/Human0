'use strict';
// Renders the standalone graph in headless Chrome and checks it draws every SCW, folds levels and zooms.
// Needs puppeteer-core and a Chrome binary: CHROME=/path/to/chrome node test-render.js
const fs=require('fs'),path=require('path');
let p;try{p=require('puppeteer-core')}catch(e){try{p=require('/tmp/pt/node_modules/puppeteer-core')}catch(e2){console.log('NOT RUN: puppeteer-core not installed');process.exit(0)}}
const M=require('./model.js'),H=require('./app-html.js'),EX=require('../examples/milky-way.json');
(async()=>{let pass=0,fail=0;const ok=(n,c,d)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(d?': '+d:''))};
 const f=path.join(require('os').tmpdir(),'scw-render-test.html');
 fs.writeFileSync(f,H.replace('<script>','<script>window.__SCW_MODEL__='+JSON.stringify(Object.assign({},EX,{text:M.toText(EX)})).replace(/</g,'\\u003c')+';</script><script>'));
 const b=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.setViewport({width:1280,height:760});await pg.goto('file://'+f);await new Promise(r=>setTimeout(r,600));
 ok('No page errors',errs.length===0,errs.join('; '));
 ok('Every SCW drawn',await pg.evaluate(()=>document.querySelectorAll('g.scw').length)===EX.scws.length);
 await pg.select('#lv','1');await new Promise(r=>setTimeout(r,200));ok('Levels 1 folds to the root',await pg.evaluate(()=>document.querySelectorAll('g.scw').length)===1);
 await pg.select('#lv','99');const k0=await pg.evaluate(()=>view.k);await pg.evaluate(()=>zoomTo('SCW-Sun'));ok('Zoom to an SCW enlarges it',await pg.evaluate(()=>view.k)>k0);
 await b.close();console.log((fail?'FAILED ':'ALL PASSED ')+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});
