'use strict';
// Builds one self-contained HTML file (the MCP App view) from the Space-at-Scale sources.
const fs=require('fs'),path=require('path'),D=__dirname;
const rd=f=>fs.readFileSync(path.join(D,f),'utf8'),esc=s=>s.replace(/<\/script/gi,'<\\/script');
let html=rd('app/index.html'),app=rd('app/app.js'),gview=rd('app/galaxy-view.js');
{const g0=gview;gview=gview.replace("fetch('galaxy.json').then(r=>r.json())","Promise.resolve(window.__GALAXY)");if(gview===g0)throw new Error('galaxy fetch hook not found in galaxy-view.js')}
const before=app;app=app.replace("fetch('stars.json').then(r=>r.json())","Promise.resolve(window.__STARS)");if(app===before)throw new Error('stars fetch hook not found in app.js');
const bridge=`(function(){if(window.parent===window)return;let id=1;const send=m=>window.parent.postMessage(m,'*');
window.addEventListener('message',e=>{const m=e.data;if(m&&m.id===1&&m.result){send({jsonrpc:'2.0',method:'ui/notifications/initialized'});size()}});
const size=()=>send({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:Math.ceil(document.documentElement.scrollHeight)}});
send({jsonrpc:'2.0',id:id++,method:'ui/initialize',params:{appInfo:{name:'space-at-scale',version:'0.15.3'},appCapabilities:{availableDisplayModes:['inline','fullscreen']},protocolVersion:'2026-01-26'}});
new ResizeObserver(size).observe(document.body)})();`;
const parts={'<script src="three.min.js"></script>':'<script>'+esc(rd('app/three.min.js'))+'</script>','<script src="OrbitControls.js"></script>':'<script>'+esc(rd('app/OrbitControls.js'))+'</script>','<script src="physics-core.js"></script>':'<script>'+esc(rd('physics-core.js'))+'</script>','<script src="galaxy-core.js"></script>':'<script>'+esc(rd('galaxy-core.js'))+'</script>','<script src="galaxy-view.js"></script>':'<script>window.__GALAXY='+esc(rd('galaxy.json'))+';</script>\n<script>'+esc(gview)+'</script>','<script src="app.js"></script>':'<script>window.__STARS='+esc(rd('stars.json'))+';</script>\n<script>'+esc(app)+'</script>'};
html=html.replace('</body>','<script>'+bridge+'</script>\n</body>');
for(const [k,v] of Object.entries(parts)){if(!html.includes(k))throw new Error('missing tag '+k);html=html.split(k).join(v)}
// Two builds from one source. The plugin's app has no Claude panel and no network code (its PRIVACY.md depends on that);
// the web build (app.maxey0.com/apps/space-at-scale/) adds the bring-your-own-key Claude panel.
const CP='<script src="claude-panel.js"></script>';if(!html.includes(CP))throw new Error('missing tag '+CP);
const web=process.env.WEB_OUT?html.split(CP).join('<script>'+esc(fs.readFileSync(process.env.CLAUDE_PANEL||path.join(D,'..','..','lb-site','claude-panel.js'),'utf8'))+'</script>'):'';html=html.split(CP).join('');
if(html.includes('api.anthropic.com'))throw new Error('plugin build must not contain the Claude panel');
fs.mkdirSync(path.join(D,'dist'),{recursive:true});fs.writeFileSync(path.join(D,'dist','space-at-scale.html'),html);if(process.env.WEB_OUT){fs.mkdirSync(path.dirname(process.env.WEB_OUT),{recursive:true});fs.writeFileSync(process.env.WEB_OUT,web);console.log('built web '+process.env.WEB_OUT,(web.length/1048576).toFixed(2)+' MB')}
console.log('built dist/space-at-scale.html',(html.length/1048576).toFixed(2)+' MB');
