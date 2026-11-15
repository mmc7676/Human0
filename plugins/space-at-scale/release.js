#!/usr/bin/env node
'use strict';
// Space at Scale release orchestration. Reusable: point SITE at the canonical app sources.
//   node release.js            sync -> build -> bundle -> provenance -> test -> package -> verify package
// Steps are mechanical; each one fails loudly. Nothing here deploys or publishes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const ROOT=__dirname,SRV=path.join(ROOT,'server'),SITE=process.env.SITE||path.join(ROOT,'..','lb-site'),OUT=process.env.OUT||'/tmp/space-at-scale.plugin',STAGE=process.env.STAGE||'/tmp/space-at-scale-stage';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),size=f=>fs.statSync(f).size,run=(c,a,o)=>execFileSync(c,a,Object.assign({stdio:['ignore','pipe','pipe'],encoding:'utf8',maxBuffer:64<<20},o||{}));
const MIRRORS=[['index.html','server/app/index.html'],['app.js','server/app/app.js'],['galaxy-view.js','server/app/galaxy-view.js'],['three.min.js','server/app/three.min.js'],['OrbitControls.js','server/app/OrbitControls.js'],['physics-core.js','server/physics-core.js'],['galaxy-core.js','server/galaxy-core.js'],['stars.json','server/stars.json'],['galaxy.json','server/galaxy.json']];
const mirrors=[];
// 1. sync: copy canonical bytes, then prove byte identity
if(fs.existsSync(SITE)){for(const [a,b] of MIRRORS){const src=path.join(SITE,a),dst=path.join(ROOT,b);fs.copyFileSync(src,dst);const s1=sha(src),s2=sha(dst);if(s1!==s2||size(src)!==size(dst))throw new Error('byte parity failed for '+a);mirrors.push({canonical:a,mirror:b,sha256:s1,bytes:size(src),identical:true})}console.log('1 sync: '+mirrors.length+' files byte-identical to '+SITE)}
else console.log('1 sync: SKIPPED (no canonical site at '+SITE+'); using the files already in server/');
// 2. build the inline app, 3. bundle the server
console.log('2 '+run('node',['build-app.js'],{cwd:SRV}).trim());
run('npx',['-y','esbuild@0.24.0','server.js','--bundle','--platform=node','--target=node18','--outfile=server.bundle.js','--log-level=warning'],{cwd:SRV});console.log('3 bundled server.bundle.js '+size(path.join(SRV,'server.bundle.js'))+' bytes');
// 4. provenance: every shipped file
const SKIP=new Set(['PROVENANCE.json','TEST-REPORT.md']),list=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='.DS_Store')continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else{const rel=path.relative(ROOT,f).split(path.sep).join('/');if(!SKIP.has(rel))list.push(rel)}}})(ROOT);list.sort();
const html=fs.readFileSync(path.join(SRV,'dist','space-at-scale.html'),'utf8'),embeds=['physics-core.js','galaxy-core.js','galaxy.json','stars.json'].map(f=>({file:'server/'+f,sha256:sha(path.join(SRV,f)),embedded_byte_for_byte_in_app_html:html.includes(fs.readFileSync(path.join(SRV,f),'utf8'))}));
if(embeds.some(e=>!e.embedded_byte_for_byte_in_app_html))throw new Error('embed parity failed: '+JSON.stringify(embeds));
const GAL=JSON.parse(fs.readFileSync(path.join(SRV,'galaxy.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'.claude-plugin','plugin.json'),'utf8'));
const prov={plugin:manifest.name,version:manifest.version,built_utc:new Date().toISOString(),rule:'SHA-256 and byte length of every shipped file. A matching hash shows the bytes are the same; it does not show the content is correct.',artifacts:list.map(p=>({path:p,sha256:sha(path.join(ROOT,p)),bytes:size(path.join(ROOT,p))})),mirrors,embeds,data_sources:GAL.provenance,galaxy_counts:GAL.counts};
fs.writeFileSync(path.join(ROOT,'PROVENANCE.json'),JSON.stringify(prov,null,1));console.log('4 provenance: '+prov.artifacts.length+' artifacts, '+embeds.length+' embeds verified');
// 5. tests (stdio + HTTP); the report is what actually ran
let rep='# Test report\n\nBuilt '+prov.built_utc+' · version '+prov.version+'\n',fail=false;
for(const t of ['test.js','test-http.js']){let o;try{o=run('node',[t],{cwd:SRV})}catch(e){o=(e.stdout||'')+(e.stderr||'');fail=true}const pass=(o.match(/^PASS /gm)||[]).length,bad=(o.match(/^FAIL /gm)||[]).length,nr=(o.match(/^NOT RUN/gm)||[]).length;rep+='\n## '+t+': '+pass+' passed, '+bad+' failed, '+nr+' not run\n\n```\n'+o.trim()+'\n```\n';console.log('5 '+t+': '+pass+' passed, '+bad+' failed, '+nr+' not run');if(bad)fail=true}
rep+='\n## Not covered by this script\n\n- Browser interaction (run separately in headless Chrome; see INTEGRATION.md)\n- Rendering inside a Claude conversation\n- Docker image and Cloud Run deployment\n';
fs.writeFileSync(path.join(ROOT,'TEST-REPORT.md'),rep);if(fail)throw new Error('tests failed; see TEST-REPORT.md');
// 6. package without node_modules, 7. verify the package against provenance
fs.rmSync(STAGE,{recursive:true,force:true});fs.mkdirSync(STAGE,{recursive:true});(function cp(d,to){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='.DS_Store')continue;const s=path.join(d,e.name),t=path.join(to,e.name);if(e.isDirectory()){fs.mkdirSync(t,{recursive:true});cp(s,t)}else fs.copyFileSync(s,t)}})(ROOT,STAGE);
fs.rmSync(OUT,{force:true});run('zip',['-qr',OUT,'.'],{cwd:STAGE});
const names=run('unzip',['-Z1',OUT]).trim().split('\n'),badName=names.filter(n=>/[^A-Za-z0-9._\/\-]/.test(n));if(badName.length)throw new Error('invalid path characters: '+badName.join(', '));
const V='/tmp/space-at-scale-verify';fs.rmSync(V,{recursive:true,force:true});fs.mkdirSync(V);run('unzip',['-q',OUT,'-d',V]);const diff=prov.artifacts.filter(a=>!fs.existsSync(path.join(V,a.path))||sha(path.join(V,a.path))!==a.sha256);if(diff.length)throw new Error('package differs from provenance: '+diff.map(a=>a.path).join(', '));
console.log('6 packaged '+OUT+' '+size(OUT)+' bytes, sha256 '+sha(OUT));console.log('7 package verified: '+names.length+' entries, valid path characters, '+prov.artifacts.length+' files match PROVENANCE.json');
