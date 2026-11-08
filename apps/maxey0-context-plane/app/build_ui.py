#!/usr/bin/env python3
"""Build the Maxey0 Context Plane Graph UI (a Human0 MCP app) from the v0.6 page.

Input  : app/source/Human0 - Context Plane Control Graph v0.6.html   (fixed, never edited)
Output : app/maxey0-context-plane-graph.html

What changes (every edit is an anchor asserted to occur exactly once):
  1. Data: the embedded v0.6 graph (const D / M), the 96 built-in topic packs and the
     physics example pack are removed. The page loads the live graph from the Maxey0
     Context Plane server (GET /graph.json) and converts it to the page's own D / M shapes.
  2. Gates: agent -> MCP gates come from the server (agent_mcp: derived, inherited,
     declared). The page's own lexicon-cosine gating and its "gates per agent" and
     "min similarity" sliders are retired (the sliders are disabled and say why).
     Manual gate toggles still work on top of the server's gates.
  3. Topics carry their domain and priority (shown in the topic's description).
  4. State files record the graph digest; app-1 and whole-app state saved against a
     different graph is refused with a message instead of being loaded wrong.
  5. Names: Maxey0 Context Plane Graph (a Human0 MCP app).
  6. One app, not the Human0 shell: v0.6 hosted four MCP apps (this graph, File Graph, Pong,
     Human0.chat dev) inside the Human0 frame with a whole-app state bar. Those three apps
     (their panels, code, state and test hooks), the MCP-apps toolbar and frame, and the
     whole-app state bar are removed. The app's own state bar is folded into one line.
  7. Task result panel: reports the best route only, in the server's method; can be hidden
     to one line while the route stays highlighted on the graph.
Kept: Human0 logo (the maker's mark), topic / concept selectors, details, SCW labels,
uploads, decision nodes, app full screen.

Server address: https://maxey0-context-plane-mcp.maxey0.workers.dev, or ?api=<origin>.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source", "Human0 - Context Plane Control Graph v0.6.html")
OUT = os.path.join(HERE, "maxey0-context-plane-graph.html")
VERSION = "1.0"
DEFAULT_API = "https://maxey0-context-plane-mcp.maxey0.workers.dev"


def once(h, old, new, what):
    n = h.count(old)
    if n != 1:
        sys.exit(f"FAIL {what}: anchor found {n} times")
    return h.replace(old, new)


def cut_json(h, marker, replacement, what):
    i = h.find(marker)
    if i < 0 or h.count(marker) != 1:
        sys.exit(f"FAIL {what}: marker count {h.count(marker)}")
    j = json.JSONDecoder().raw_decode(h, i + len(marker))[1]
    return h[:i] + marker + replacement + h[j:]


CP_VIEW_JS = r"""// ---------- Maxey0 Context Plane Graph v1.0: readable paths, node drag, generated topics
let cpField=false,cpFan=true,cpDrag=true,cpOnlyNew=false,cpOff={},cpFanPos={},cpNewCache=null,cpNewKey='';
// The observer: where the field is read from. Above the graph (no selection) every node sits at its field location;
// a routed task (lens), a chosen domain, topic or concept moves the observer into the graph, and every plane below it is
// laid out from there (lensLayout). Same state on the server: route_task mode "lens".
let cpDomOn=true,cpLensKey='',cpLensPos=null,cpObsLabel='above the graph';
function cpObserver(){if(typeof task!=='undefined'&&task&&task.lens&&task.lens.chain.length){const st={};
  if(task.doms&&task.doms.length)st.domain=task.doms.map(d=>['d:'+d,1/Math.sqrt(task.doms.length)]);
  for(const l of task.lens.chain)st[l.level]=l.selected.map(x=>[x.app,x.weight]);
  return{st,label:'routed task (lens): '+task.lens.chain.map(l=>l.selected.map(x=>N[x.app]?N[x.app].label:x.id)[0]).join(' › ')}}
 const bf=(typeof V3!=='undefined'&&V3.bf)||{},st={};let lab='';
 if(bf.domain){st.domain=[['d:'+bf.domain,1]];lab=(__CP.domains.find(d=>d.id===bf.domain)||{}).label||bf.domain}
 if(bf.topic){st.topic=[['t:'+bf.topic,1]];lab=(N['t:'+bf.topic]||{}).label||bf.topic}
 if(bf.concept){st.concept=[['c:'+bf.concept,1]];lab=(N['c:'+bf.concept]||{}).label||bf.concept}
 return Object.keys(st).length?{st,label:lab}:null}
function cpLensSync(){const o=cpObserver(),k=o?JSON.stringify(o.st):'';if(k===cpLensKey)return;cpLensKey=k;cpLensPos=o?__CP.lensLayout(o.st):null;cpObsLabel=o?o.label:'above the graph';
 const el=$('cpObs');if(el)el.textContent='Observer: '+cpObsLabel}
function cpFieldXY(n){if(!cpField)return null;const q=(cpLensPos&&cpLensPos[n.id])||__CP.field[n.id];return q?{x:q[0]*cpOut()*.97,y:q[1]*cpOut()*.97}:null}
// domains: one hue per domain; topics carry their domain's ring, and each domain is labelled where its topics are
const DOMCOL=['#f2a65a','#5ec2b7','#9db4ff','#e58fb8','#a8d672','#7fc8f8','#f6d55c','#c49bff','#ff8f70','#6fe0a6','#d9b38c'];
function cpDomCol(d){const i=__CP.domains.findIndex(x=>x.id===d);return DOMCOL[(i<0?0:i)%DOMCOL.length]}
function cpDrawDomains(P){if(!cpDomOn)return;const acc={},sel=(typeof V3!=='undefined'&&V3.bf&&V3.bf.domain)||'';
 for(const id in P){const n=N[id];if(!n||n.kind!=='topic')continue;const d=__CP.tDom[id.slice(2)];if(!d)continue;(acc[d]=acc[d]||[]).push(P[id])}
 cx.save();cx.textAlign='center';for(const d in acc){if(!cpField&&d!==sel)continue;const ps=acc[d],x=ps.reduce((s,p)=>s+p.sx,0)/ps.length,y=Math.min(...ps.map(p=>p.sy))-16;
  cx.font=(d===sel?'bold 12px':'600 10px')+' system-ui';cx.fillStyle=cpDomCol(d)+(sel&&d!==sel?'66':'ee');cx.fillText(((__CP.domains.find(x=>x.id===d)||{}).label||d).toUpperCase(),x,y)}cx.restore()}
// the task panel's readout of a lens route: per level, what was chosen, with what weight and signed support, and what was ruled out
function cpLensOut(){const el=$('lensOut');if(!el)return;const L=typeof task!=='undefined'&&task&&task.lens;if(!L){el.hidden=true;el.textContent='';return}
 el.hidden=false;el.textContent='';const nm=a=>N[a]?N[a].label:a;
 if(!L.chain.length){el.append(hh('div','','Observer lens: no topic shares words with this task.'));return}
 el.append(hh('div','','Observer lens'+(task.doms&&task.doms.length?' from '+task.doms.map(d=>(__CP.domains.find(x=>x.id===d)||{}).label||d).join(' + '):' from above the graph')+' · remaining task '+L.remaining_task));
 for(const l of L.chain){const row=hh('div','');row.append(hh('b','',l.level[0].toUpperCase()+l.level.slice(1)+'s (λ '+l.lambda+'): '));
  row.append(document.createTextNode(l.selected.map(x=>nm(x.app)+' w '+x.weight+' ψ '+x.psi+(Object.keys(x.contributions).length>1?' ['+Object.entries(x.contributions).map(([k,v])=>(v>=0?'+':'')+v).join(' ')+']':'')).join(' · ')));
  if(l.suppressed.length)row.append(document.createTextNode(' — ruled out: '+l.suppressed.map(x=>x.id+' (opposed by '+x.opposed_by.join(', ')+')').join('; ')));el.append(row)}}
function cpPos(n){const f=cpFanPos[n.id],b=f||cpFieldXY(n)||n,o=cpOff[n.id];if(!o)return{x:b.x,y:b.y};let x=b.x+o.x,y=b.y+o.y;if(cpField&&!f)return{x,y};
 const r=Math.hypot(x,y),lo=cpIn(),hi=cpOut();if(r>hi){x*=hi/r;y*=hi/r}else if(r<lo&&r>1e-9){x*=lo/r;y*=lo/r}return{x,y}}  // a dragged node stays inside its level's donut
// screen-horizontal direction in the level plane (inverse of project's rotation)
// ---- all-axis orientation: one 3x3 rotation matrix cpM maps world (x, y, z) to view (X right, Y down, D depth).
// Every node and every donut goes through it, so the graph can face any direction; nothing is clamped.
const cpM0=(r=-.35,t=1.0)=>[Math.cos(r),-Math.sin(r),0, Math.sin(r)*Math.cos(t),Math.cos(r)*Math.cos(t),-Math.sin(t), Math.sin(r)*Math.sin(t),Math.cos(r)*Math.sin(t),Math.cos(t)];
let cpM=cpM0(),cpAnim=null;
const cpMul=(A,B)=>{const C=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return C};
function cpAxisAngle(x,y,z,a){const l=Math.hypot(x,y,z)||1;x/=l;y/=l;z/=l;const c=Math.cos(a),s=Math.sin(a),t=1-c;
 return[t*x*x+c,t*x*y-s*z,t*x*z+s*y, t*x*y+s*z,t*y*y+c,t*y*z-s*x, t*x*z-s*y,t*y*z+s*x,t*z*z+c]}
function cpOrtho(M){const r=[M.slice(0,3),M.slice(3,6)];const n=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
 const a=n(r[0]),d=a[0]*r[1][0]+a[1]*r[1][1]+a[2]*r[1][2],b=n(r[1].map((x,i)=>x-d*a[i])),c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];return[...a,...b,...c]}
function cpView(x,y,z,a){cpM=cpOrtho(cpMul(cpAxisAngle(x,y,z,a),cpM))}          // rotate about an axis fixed to the screen
function cpWorldZ(a){cpM=cpOrtho(cpMul(cpM,cpAxisAngle(0,0,1,a)))}            // spin about the graph's own vertical axis
// trackball: a drag turns the graph about the screen axis at right angles to the drag; Shift+drag rolls it
function cpTrack(dx,dy,roll){if(roll){cpView(0,0,1,dx*.008);return}const d=Math.hypot(dx,dy);if(d<1e-9)return;cpView(dy,-dx,0,d*.008)}
function cp720(ms){if(cpAnim)return;const M0=cpM.slice(),t0=performance.now(),T=ms||2400,ax=[.55,.75,.36];
 const step=now=>{const f=Math.min(1,(now-t0)/T),e=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;cpM=f<1?cpMul(cpAxisAngle(...ax,e*4*Math.PI),M0):M0.slice();draw();cpAnim=f<1?requestAnimationFrame(step):null};cpAnim=requestAnimationFrame(step)}
// The spread is laid out in WORLD coordinates on each level's plane: it is computed once per isolated path
// (its line starts parallel to the screen) and then rotates, tilts and zooms with the 3D graph like every other node.
let cpFanKey='',cpFanAxis=null,cpPanX=0,cpPanY=0;
// Level rings: every level is a flat donut (annulus) of the same size, stacked on one vertical axis.
const cpOut=()=>RAD.mcp*1.15,cpIn=()=>cpOut()*.14,cpRing=()=>cpOut()*.72;
function cpFanCompute(rel){if(!cpFan||!iso||!rel||rel.size>600){cpFanPos={};cpFanKey='';return}
 const key=[...rel].sort().join('|');if(key===cpFanKey)return;cpFanKey=key;cpFanPos={};
 // start the fan on the arc facing the viewer; afterwards it lives in world coordinates and turns with the graph
 const a0=Math.atan2(-cpM[7],-cpM[6]),R=cpRing(),gap=RAD.mcp*.2/R,lv=['topic','concept','skill','agent','mcp'],ang={};
 const parents=id=>{const n=N[id];if(n.kind==='concept')return[cTopic[n.raw]];if(n.kind==='skill')return['c:'+n.concept];
  if(n.kind==='agent')return E.filter(e=>e.kind==='agent'&&e.b===id&&rel.has(e.a)).map(e=>e.a);
  if(n.kind==='mcp')return G.filter(g=>g.b===id&&rel.has(g.a)).map(g=>g.a);return[]};
 for(const k of lv){const ids=[...rel].filter(id=>N[id]&&N[id].kind===k&&vis[k]);if(!ids.length)continue;
  // wanted angle = mean angle of its parents on the level above (as an offset from a0)
  const want=id=>{const ps=parents(id).filter(p=>p in ang);return ps.length?ps.reduce((s,p)=>s+ang[p],0)/ps.length:0};
  ids.sort((x,y)=>want(x)-want(y)||N[x].label.localeCompare(N[y].label));
  const step=Math.min(gap,2*Math.PI/ids.length);const w=ids.map(want),t=w.slice();
  for(let i=1;i<t.length;i++)t[i]=Math.max(t[i],t[i-1]+step);          // keep a minimum arc gap
  const shift=(w.reduce((s,x)=>s+x,0)-t.reduce((s,x)=>s+x,0))/t.length;  // re-centre under the parents
  ids.forEach((id,i)=>{const d=t[i]+shift;ang[id]=d;cpFanPos[id]={x:Math.cos(a0+d)*R,y:Math.sin(a0+d)*R}})}}
// Everything below a node on the path: its concepts, skills, agents and their MCP servers (each stays on its own level).
function cpDownstream(id){const rel=relNow(),inPath=x=>!rel||rel.has(x),out=new Set([id]),q=[id];
 while(q.length){const x=q.shift();for(const e of E)if(e.a===x&&inPath(e.b)&&!out.has(e.b)){out.add(e.b);q.push(e.b)}
  if(N[x]&&N[x].kind==='agent')for(const g of G)if(g.a===x&&inPath(g.b)&&!out.has(g.b)){out.add(g.b);q.push(g.b)}}
 return out}
// Drag: the screen movement is converted to a movement inside the level plane (z never changes);
// the node and everything downstream of it move by the same amount on their own parallel planes.
function cpMoveNode(id,dx,dy){const n=N[id];if(!n)return;const r=cv.getBoundingClientRect(),o=project(n,r.width,r.height),k=zoom*1.15*o.p,
 a=cpM[0],b=cpM[1],c=cpM[3],d=cpM[4],det=a*d-b*c;if(Math.abs(det)<.05)return;   // level seen edge-on: no sideways move is visible
 const X=dx/k,Y=dy/k,mx=(d*X-b*Y)/det,my=(-c*X+a*Y)/det;
 for(const x of cpDownstream(id)){const q=cpOff[x]||{x:0,y:0};cpOff[x]={x:q.x+mx,y:q.y+my}}}
function cpNewSet(){const ids=Object.keys(packs).join(',');if(cpNewCache&&cpNewKey===ids)return cpNewCache;const s=new Set();
 Object.values(packs).forEach(r=>{const A=r.added,pid=r.pack.topic.id;s.add('t:'+pid);A.concepts.forEach(c=>s.add('c:'+c));A.skills.forEach(k=>{s.add('s:'+k);
  E.forEach(e=>{if(e.kind==='agent'&&e.a==='s:'+k){s.add(e.b);G.forEach(g=>{if(g.a===e.b)s.add(g.b)})}})})});
 cpNewCache=s;cpNewKey=ids;return s}
function cpSetBtns(){const t=(id,on)=>{const b=$(id);if(b){b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)}};t('cpFanBtn',cpFan);t('cpFieldBtn',cpField);t('cpDomBtn',cpDomOn);t('cpDragBtn',cpDrag);t('cpAllBtn',!cpOnlyNew);t('cpNewBtn',cpOnlyNew)}
function cpViewInit(){const on=(id,f)=>{const b=$(id);if(b)b.onclick=()=>{f();cpSetBtns();draw()}};
 on('cpFanBtn',()=>{cpFan=!cpFan;cpFanKey=''});on('cpFieldBtn',()=>{cpField=!cpField;cpFanKey=''});on('cpDomBtn',()=>{cpDomOn=!cpDomOn});on('cpDragBtn',()=>{cpDrag=!cpDrag});on('cpResetBtn',()=>{cpOff={}});
 on('cpAllBtn',()=>{cpOnlyNew=false});on('cpNewBtn',()=>{cpOnlyNew=true;cpNewCache=null;if(!Object.keys(packs).length){tpSt.msg='No generated topics yet: build a request below, generate the pack in Claude, paste it and Add to graph.';tpSt.cls='';const tb=$('topicsBox');if(tb){tb.open=true;renderTopics();tb.scrollIntoView({block:'nearest'})}}});
 cpSetBtns();
 // layout and view are part of the app state
 const g0=APPS.app1.get,s0=APPS.app1.set;
 APPS.app1.get=function(){const r=g0.apply(this,arguments);r.view={off:cpOff,fan:cpFan,drag:cpDrag,onlyNew:cpOnlyNew,orient:cpM.slice(),zoom,pan:[cpPanX,cpPanY]};return r};
 APPS.app1.set=function(st){const r=s0.apply(this,arguments);const v=st&&st.view;if(v&&typeof v==='object'){cpOff={};
  if(v.off&&typeof v.off==='object')for(const[k,o]of Object.entries(v.off))if(N[k]&&o&&isFinite(o.x)&&isFinite(o.y))cpOff[k]={x:+o.x,y:+o.y};
  if(Array.isArray(v.orient)&&v.orient.length===9&&v.orient.every(isFinite))cpM=cpOrtho(v.orient.map(Number));if(isFinite(v.zoom))zoom=Math.max(.08,Math.min(8,+v.zoom));if(Array.isArray(v.pan)&&v.pan.every(isFinite)){cpPanX=+v.pan[0];cpPanY=+v.pan[1]}
  cpFan=v.fan!==false;cpDrag=v.drag!==false;cpOnlyNew=!!v.onlyNew;cpSetBtns();draw()}return r}}
// ---- MCP Apps bridge (spec 2026-01-26): when this page runs inside a host (Claude, other MCP Apps hosts) it
// shakes hands with ui/initialize, applies the tool arguments (task / topic_id), asks for a size, and can send
// a message to the conversation or switch to full screen. In a normal browser tab none of this runs.
const cpHost={on:false,seq:0,wait:{},mode:'inline'};
function cpHostReq(method,params){return new Promise((res,rej)=>{const id='cp-'+(++cpHost.seq);cpHost.wait[id]={res,rej};
 window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*');setTimeout(()=>{if(cpHost.wait[id]){delete cpHost.wait[id];rej(new Error(method+': no answer from the host'))}},15000)})}
function cpHostNote(method,params){window.parent.postMessage({jsonrpc:'2.0',method,params},'*')}
function cpApplyArgs(a){if(!a||typeof a!=='object')return;
 if(typeof a.topic_id==='string'&&N['t:'+a.topic_id]){select('t:'+a.topic_id);draw()}
 if(typeof a.task==='string'&&a.task.trim()){const ti=$('taskIn'),go=$('taskGo');if(ti&&go){ti.value=a.task.slice(0,500);go.click()}}}
window.addEventListener('message',e=>{if(e.source!==window.parent||window.parent===window)return;const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
 if(m.id!==undefined&&cpHost.wait[m.id]&&(('result' in m)||('error' in m))){const w=cpHost.wait[m.id];delete cpHost.wait[m.id];m.error?w.rej(m.error):w.res(m.result);return}
 if(m.method==='ui/notifications/tool-input')cpApplyArgs((m.params||{}).arguments);
 else if(m.method==='ui/notifications/host-context-changed'&&m.params&&m.params.displayMode){cpHost.mode=m.params.displayMode;cpHostBtn()}
 else if(m.method&&m.id!==undefined)window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*')});   // e.g. ui/resource-teardown
function cpHostBtn(){const b=$('cpHostFs');if(b){b.hidden=!cpHost.on;b.textContent=cpHost.mode==='fullscreen'?'Exit full screen':'Full screen'}}
async function cpHostInit(){if(window.parent===window)return;
 try{const r=await cpHostReq('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'maxey0-context-plane-graph',version:'1.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}});
  cpHost.on=true;cpHost.ctx=(r&&r.hostContext)||{};cpHost.mode=cpHost.ctx.displayMode||'inline';cpHostNote('ui/notifications/initialized',{});
  cpHostNote('ui/notifications/size-changed',{height:900});cpHostBtn();
  const b=$('cpHostFs');if(b)b.onclick=async()=>{try{const x=await cpHostReq('ui/request-display-mode',{mode:cpHost.mode==='fullscreen'?'inline':'fullscreen'});cpHost.mode=(x&&x.mode)||cpHost.mode;cpHostBtn()}catch(e){}}}
 catch(e){cpHost.on=false}}
// ask the host model: inside an MCP Apps host the request goes to the conversation (ui/message); elsewhere it is copied
function cpAskHost(text){if(cpHost.on){cpHostReq('ui/message',{role:'user',content:[{type:'text',text}]}).catch(()=>{});return'sent'}
 try{navigator.clipboard.writeText(text);return'copied'}catch(e){return'select'}}
function cpGenerateFor(task){const tb=$('topicsBox');tpSt.topic=String(task||'').slice(0,80);tpSt.concept='';tpSt.req=genRequest(tpSt.topic,'')+'\nThe pack must cover this task, which found no route: "'+String(task||'').slice(0,300)+'". Use the task’s own words in skill descriptions.';
 tpSt.msg='Request built for this task. Ask Claude to run it (button below), then paste the JSON it returns.';tpSt.cls='';if(tb){tb.open=true;renderTopics();tb.scrollIntoView({block:'nearest'})}}
{const _rt=renderTopics;renderTopics=function(){const r=_rt.apply(this,arguments);const ta=$('tpReq');if(ta&&!$('cpAsk')){const b=hh('button','','Ask Claude to generate it',{type:'button',id:'cpAsk',title:'Inside Claude (MCP app) the request is sent to the conversation; in a browser it is copied for you to paste into Claude'});
  b.onclick=()=>{const how=cpAskHost(ta.value);tpSt.msg=how==='sent'?'Sent to Claude. Paste the JSON it returns below (or it may add it for you).':how==='copied'?'Copied. Paste it into Claude (with the Maxey0 Context Plane connector or plugin), then paste the JSON it returns below.':'Select the request text and copy it into Claude.';tpSt.cls='';const m=$('tpMsg');if(m)m.textContent=tpSt.msg};ta.after(b)}
 cpNewCache=null;return r}}
{const _rg=refreshGraph;refreshGraph=function(){cpNewCache=null;return _rg.apply(this,arguments)}}
function cpDrawRings(w,h){const O=cpOut(),I=cpIn(),S=72,lv=['mcp','agent','skill','concept','topic'];
 const ring=(r,z)=>{const pts=[];for(let i=0;i<=S;i++){const a=i/S*2*Math.PI;pts.push(project({z},w,h,{x:Math.cos(a)*r,y:Math.sin(a)*r}))}return pts};
 const path=pts=>pts.forEach((o,i)=>i?cx.lineTo(o.sx,o.sy):cx.moveTo(o.sx,o.sy));
 // far levels first so nearer donuts paint over them
 const order=lv.filter(k=>vis[k]).map(k=>({k,zz:project({z:ZP[k]},w,h,{x:0,y:0}).zz})).sort((a,b)=>b.zz-a.zz);
 for(const {k} of order){const o=ring(O,ZP[k]),i=ring(I,ZP[k]),c=COL[k];
  cx.beginPath();path(o);cx.closePath();path(i.slice().reverse());cx.closePath();
  cx.fillStyle=c+'14';cx.fill('evenodd');cx.lineWidth=1.2;cx.strokeStyle=c+'88';cx.beginPath();path(o);cx.stroke();cx.strokeStyle=c+'55';cx.beginPath();path(i);cx.stroke();
  // the ring's middle line, where a spread path sits
  cx.setLineDash([2,4]);cx.strokeStyle=c+'33';cx.beginPath();path(ring(cpRing(),ZP[k]));cx.stroke();cx.setLineDash([]);
  const lab=o.reduce((m,p)=>p.sx>m.sx?p:m,o[0]);cx.fillStyle=c;cx.font='10px system-ui';cx.textAlign='start';cx.fillText(k==='mcp'?'MCP SERVERS (GATES)':LBL[k].toUpperCase()+'S',lab.sx+6,lab.sy+3)}
 // the vertical axis through every level
 const top=project({z:ZP.topic+90},w,h,{x:0,y:0}),bot=project({z:ZP.mcp-90},w,h,{x:0,y:0});cx.beginPath();cx.moveTo(top.sx,top.sy);cx.lineTo(bot.sx,bot.sy);cx.strokeStyle='#ffffff22';cx.lineWidth=1;cx.stroke()}
function cpFit(){const r=cv.getBoundingClientRect();if(cpAnim){cancelAnimationFrame(cpAnim);cpAnim=null}cpM=cpM0();cpPanX=0;cpPanY=0;
 // zoom so the full stack (top donut to bottom donut) fits the canvas height and the donut fits its width
 const span=(ZP.topic-ZP.mcp)*Math.sin(1.0)+2*cpOut()*Math.cos(1.0)+80;zoom=Math.max(.08,Math.min(8,Math.min(r.height/(span*1.15),r.width/(2.3*cpOut()*1.15))));draw()}
cv.addEventListener('contextmenu',e=>e.preventDefault());
setTimeout(()=>{const b=$('cpFitBtn');if(b)b.onclick=cpFit;const t=$('cp720Btn');if(t)t.onclick=()=>cp720();cpFit()},0);
setTimeout(cpViewInit,0);
setTimeout(cpHostInit,0);
window.__cpv={graph:()=>__CP.graph,observer:()=>({label:cpObsLabel,n:cpLensPos?Object.keys(cpLensPos).length:0,dom:cpDomOn}),lens:(t,d)=>__CP.lens(t,d||[]),field:()=>({on:cpField,n:Object.keys(__CP.field).length,pos:id=>cpPos(N[id])}),labels:()=>({on:{...lbl},off:{...lblX},strict}),fanPos:()=>({...cpFanPos}),off:()=>({...cpOff}),newSet:()=>[...cpNewSet()],move:cpMoveNode,ask:cpAskHost,gen:cpGenerateFor,
 screen:id=>{const r=cv.getBoundingClientRect(),o=project(N[id],r.width,r.height);return{x:o.sx+r.left,y:o.sy+r.top}},state:()=>({fan:cpFan,drag:cpDrag,onlyNew:cpOnlyNew}),host:()=>({on:cpHost.on,mode:cpHost.mode}),
 select:id=>{select(id);draw()},node:id=>N[id]?{kind:N[id].kind,z:N[id].z,label:N[id].label}:null,packs:()=>Object.keys(packs),app:()=>APPS.app1.get(),rotate:d=>{cpWorldZ(d);draw()},tiltBy:d=>{cpView(1,0,0,d);draw()},track:(dx,dy,roll)=>{cpTrack(dx,dy,roll);draw()},spin720:ms=>cp720(ms),orient:m=>{if(m!==undefined){if(!Array.isArray(m)||m.length!==9||!m.every(isFinite))return false;cpM=cpOrtho(m.map(Number));draw()}return cpM.slice()},view:()=>({M:cpM.slice(),zoom,panX:cpPanX,panY:cpPanY}),fit:()=>cpFit(),ringR:()=>[cpIn(),cpRing(),cpOut()],pos:id=>cpPos(N[id]),down:id=>[...cpDownstream(id)]};
"""

LOADER = r"""<style>
/* h0-notice: reusable closeable notice (Human0 UI object). One line, sits where it is mounted, x closes it,
   a dismissed notice stays closed in this browser (per id). Tones: info (default), warn, bad. */
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.h0n-host{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:100%}
.h0n{display:flex;align-items:center;gap:10px;white-space:nowrap;padding:6px 8px 6px 12px;border-radius:999px;font:12px/1.35 system-ui,sans-serif;
  background:rgba(102,217,232,.10);color:#cfeff4;border:1px solid rgba(102,217,232,.35)}
.h0n.warn{background:rgba(243,201,105,.12);color:#f6e2b0;border-color:rgba(243,201,105,.45)}
.h0n.bad{background:rgba(255,90,90,.14);color:#ffd6d6;border-color:rgba(255,110,110,.55);border-radius:10px;white-space:normal}
.h0n b{font-weight:600}
.h0n-x{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid currentColor;background:transparent;color:inherit;
  font:14px/1 system-ui,sans-serif;cursor:pointer;opacity:.75;padding:0}
.h0n-x:hover,.h0n-x:focus-visible{opacity:1;outline:none;background:rgba(255,255,255,.08)}
@media (max-width:1000px){.h0n-host{margin-left:0;flex-basis:100%;align-items:flex-start}.h0n{white-space:normal}}
/* app state bar folded to one line */
details.cpfold{border-bottom:1px solid var(--line)}
details.cpfold>summary{cursor:pointer;list-style:none;padding:4px 12px;font:11px/1.6 system-ui,sans-serif;color:var(--muted);user-select:none}
details.cpfold>summary::-webkit-details-marker{display:none}
details.cpfold>summary::before{content:'\25B8  '}details.cpfold[open]>summary::before{content:'\25BE  '}
details.cpfold>.statebar{border-bottom:0}
.cpview{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px}
.cpview button.on{outline:1px solid #22d3ee;color:#e6fbff}
.cpview .cpsep{width:12px}.cpview .cpobs{font-size:11px;opacity:.8;margin-right:4px}#lensOut{margin-top:6px;font-size:12px;line-height:1.5}#lensOut b{color:#e6fbff}.taskbar select{max-width:150px}.cpview .cplbl{font-size:11px;opacity:.7}
/* task result: hide to one line */
#taskMsg .cphide{float:right;margin:0 0 4px 8px}
#taskMsg.slim{padding:4px 8px;display:flex;align-items:center;gap:8px;font-size:12px}
#taskMsg.slim span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cpnote{font-size:11px;opacity:.8;margin:2px 0 6px}
</style>
<script>
/* h0Notice({id, html|text, tone, host, dismissible}) -> element. Reusable: mount anywhere by passing host. */
window.h0Notice = function (o) {
  const key = 'h0.notice.closed.' + o.id;
  if (o.dismissible !== false && o.remember !== false) { try { if (localStorage.getItem(key) === '1') return null } catch (e) {} }
  let host = o.host;
  if (!host) {
    const hd = document.querySelector('header');
    host = hd && hd.querySelector('.h0n-host');
    if (hd && !host) { host = document.createElement('div'); host.className = 'h0n-host'; hd.append(host) }
    if (!host) host = document.body;
  }
  let el = host.querySelector('.h0n[data-id="' + o.id + '"]');
  if (!el) { el = document.createElement('div'); el.dataset.id = o.id; host.append(el) }
  el.className = 'h0n' + (o.tone ? ' ' + o.tone : '');
  el.setAttribute('role', o.tone === 'bad' ? 'alert' : 'status');
  el.textContent = '';
  const body = document.createElement('span');
  if (o.html) body.innerHTML = o.html; else body.textContent = o.text || '';
  el.append(body);
  if (o.title) el.title = o.title;
  if (o.dismissible !== false) {
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'h0n-x'; x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Close');
    x.onclick = () => { el.remove(); if (o.remember !== false) { try { localStorage.setItem(key, '1') } catch (e) {} } };
    el.append(x);
  }
  return el;
};
/* cpFold(bar): put an app state bar in a one-line fold (closed by default). */
window.cpFold = function (bar) {
  const d = document.createElement('details'); d.className = 'cpfold';
  const s = document.createElement('summary'); s.textContent = 'App state & full screen';
  d.append(s, bar); return d;
};
/* Maxey0 Context Plane Graph: load the live graph and convert it to the page's shapes. */
window.__cpLoad = async function () {
  const qs = new URLSearchParams(location.search);
  const API = (qs.get('api') || '__DEFAULT_API__').replace(/\/+$/, '');
  h0Notice({ id: 'cp-load', text: 'Loading live data from the Maxey0 Context Plane...', dismissible: false });
  let g;
  try {
    const r = await fetch(API + '/graph.json?index=1', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    g = await r.json();
    if (!/^maxey0\.scw1-graph\//.test(g.schema || '')) throw new Error('unexpected schema ' + g.schema);
  } catch (e) {
    h0Notice({ id: 'cp-load', tone: 'bad', remember: false,
      text: 'Could not load live data from the Maxey0 Context Plane (' + (e.message || e) + '). This app needs a connection to ' +
        API + '. Reload to try again.' });
    throw e;
  }
  const dom = Object.fromEntries(g.domains.map(d => [d.id, d.label]));
  const D = {
    concepts: g.concepts.map(c => [c.id, c.label, c.topic, c.desc, c.keywords]),
    skills: g.skills.map(s => [s.id, s.concept, s.label, s.desc, s.type, s.agents.map(a => [a.key, a.role])]),
    agents: Object.fromEntries(g.agents.map(a => [a.key, a.name])),
    version: g.snapshot_digest
  };
  const M = g.mcp.map(m => [m.name, m.id, m.desc, m.tools, m.state]);
  const midx = Object.fromEntries(g.mcp.map((m, i) => [m.id, 'm:' + i]));
  const gates = {}, scores = {};
  for (const l of g.agent_mcp) {
    const a = 'a:' + l.agent, m = midx[l.mcp];
    if (!m) continue;
    (gates[a] = gates[a] || []).push(m);
    (scores[a] = scores[a] || {})[m] = { score: l.score, basis: l.basis, via: l.via || null };
  }
  const meta = Object.fromEntries(g.topics.map(t => [t.id, {
    label: t.label,
    desc: t.desc + ' [Domain: ' + (dom[t.domain] || t.domain) + (t.priority ? ' - priority ' + t.priority + ' (owner-declared)' : '') + ']',
    domain: t.domain, priority: t.priority
  }]));
  { const ld = document.querySelector('.h0n[data-id="cp-load"]'); if (ld) ld.remove(); }
  // ---- the one similarity method (mirror of the server's sim.ts) ----
  const STOP = new Set(('a an and the of in on for to with by from as at or into over across its their this that is are be ' +
    'using use used via per each all any not no new data').split(' '));
  const tokens = s => { const out = []; for (const w of String(s).replace(/_/g, ' ').toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (STOP.has(w) || w.length <= 2) continue; out.push(w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w) } return out };
  const idf = g.similarity.idf, V = g.similarity.vectors, TH = g.similarity.thresholds;
  const vec = text => { const tf = new Map(); for (const w of tokens(text)) if (w in idf) tf.set(w, (tf.get(w) || 0) + 1);
    const v = {}; let n = 0; for (const [w, c] of tf) { const x = (1 + Math.log(c)) * idf[w]; v[w] = x; n += x * x }
    n = Math.sqrt(n) || 1; for (const w in v) v[w] /= n; return v };
  const cos = (a, b) => { const [x, y] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b];
    let s = 0, k = 0; for (const w in x) if (w in y) { s += x[w] * y[w]; k++ } return k < Math.min(2, Object.keys(x).length) ? 0 : s };
  const prio = Object.fromEntries(g.topics.map(t => [t.id, t.priority || 0]));
  const cTop = Object.fromEntries(g.concepts.map(c => [c.id, c.topic]));
  const firstSkill = {}; for (const s of g.skills) if (!(s.concept in firstSkill)) firstSkill[s.concept] = s.id;
  /** route(text) -> [['s:'+skillId, score], ...] ranked exactly like the server's route_task. */
  const route = (text, limit) => {
    const q = vec(text); if (!Object.keys(q).length) return [];
    const hits = [];
    for (const c of g.concepts) { const s = cos(q, V['c:' + c.id] || {}); if (s >= TH.search_min) hits.push([s, 'c', c.id, c.topic]) }
    for (const k of g.skills) { const s = cos(q, V['s:' + k.id] || {}); if (s >= TH.search_min) hits.push([s, 's', k.id, cTop[k.concept]]) }
    const r4 = x => Math.round(x * 1e4);
    const ord = hits.map((h, i) => [h, i]).sort((a, b) => r4(b[0][0]) - r4(a[0][0]) || prio[b[0][3]] - prio[a[0][3]] || a[1] - b[1]).map(x => x[0]);
    const out = [], seen = new Set();
    for (const [s, kind, id] of ord.slice(0, Math.min(limit * 3, 50))) {
      const sid = kind === 'c' ? firstSkill[id] : id; if (!sid || seen.has(sid)) continue;
      seen.add(sid); out.push(['s:' + sid, s]); if (out.length >= limit) break }
    return out };
  // the shared embedding field: one location per node, the same space and scale on every level
  const field = {};
  for (const [k, xy] of Object.entries((g.field && g.field.xy) || {})) {
    const p = k.indexOf(':'), lv = k.slice(0, p), id = k.slice(p + 1);
    const app = lv === 'm' ? midx[id] : lv + ':' + id;
    if (app) field[app] = xy;
  }
  // ---- the observer lens: a mirror of the server's lens.ts (same equations, same lambda, same order) ----
  const appKey = k => { const p = k.indexOf(':'), lv = k.slice(0, p), id = k.slice(p + 1); return lv === 'm' ? midx[id] : lv + ':' + id };
  const U = {};
  for (const k in V) { const a = appKey(k); if (!a) continue; let n = 0; for (const w in V[k]) n += V[k][w] * V[k][w]; n = Math.sqrt(n) || 1;
    const u = {}; for (const w in V[k]) u[w] = V[k][w] / n; U[a] = u }
  const dotu = (a, b) => { const [x, y] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b]; let s = 0;
    for (const w in x) { const v = y[w]; if (v !== undefined) s += x[w] * v } return s };
  const nrm = a => Math.sqrt(dotu(a, a));
  const unitv = a => { const n = nrm(a); if (!n) return a; const o = {}; for (const w in a) o[w] = a[w] / n; return o };
  const minus = (a, b, k) => { const o = { ...a }; for (const w in b) o[w] = (o[w] ?? 0) - k * b[w]; return o };
  const LAMBDA = { topic: 0, concept: 0.5, skill: 0.3 }, BEAM = 3, KEEP = 0.6, DAMP = 0.1, r4 = x => Math.round(x * 1e4) / 1e4;
  const LEVELS = [['topic', 't', g.topics.map(t => t.id)], ['concept', 'c', g.concepts.map(c => c.id)], ['skill', 's', g.skills.map(s => s.id)]];
  const tDom = Object.fromEntries(g.topics.map(t => [t.id, t.domain]));
  /** lens(text, domains) -> {chain, skills, remaining_task}, the same chain the server's route_task returns with mode "lens". */
  const lens = (text, domains) => {
    const doms = domains || [], q0 = unitv(vec(text)), chain = [];
    if (!Object.keys(q0).length) return { chain, skills: [], remaining_task: 0 };
    let q = q0, state = null;
    for (const [level, pre, ids] of LEVELS) {
      const lam = state && state.length > 1 ? LAMBDA[level] * (1 - DAMP * (state.length - 1)) : LAMBDA[level];
      const rows = [];
      for (const id of ids) {
        if (!state && doms.length && !doms.includes(tDom[id])) continue;
        const v = U[pre + ':' + id] || {}, flat = dotu(v, q0);
        if (!state) { rows.push({ id, psi: dotu(v, q), flat, parts: {} }); continue }
        let psi = 0; const parts = {};
        for (const p of state) { const a = dotu(v, p.v), rn = Math.sqrt(Math.max(1 - a * a, 1e-12)), qn = nrm(p.q);
          const sv = qn > 1e-9 ? (dotu(v, p.q) - a * dotu(p.v, p.q)) / (rn * qn) : 0; const phi = p.w * (lam * a + (1 - lam) * sv); psi += phi; parts[p.id] = phi }
        rows.push({ id, psi, flat, parts }) }
      rows.sort((x, y) => y.psi - x.psi || (x.id < y.id ? -1 : 1));
      if (!rows.length || rows[0].psi <= 0) break;
      const best = rows[0].psi, sel = rows.slice(0, BEAM).filter(r => r.psi > 0 && r.psi >= KEEP * best);
      const n = Math.sqrt(sel.reduce((s, r) => s + r.psi * r.psi, 0));
      const next = sel.map(r => { const v = U[pre + ':' + r.id]; return { id: r.id, w: r.psi / n, v, q: minus(q, v, dotu(q, v)) } });
      for (const p of next) q = minus(q, p.v, p.w * p.w * dotu(q, p.v));
      const suppressed = state ? [...rows].sort((x, y) => y.flat - x.flat).slice(0, 15).filter(r => r.psi <= 0.5 * best && Object.values(r.parts).some(x => x < 0)).slice(0, 3)
        .map(r => ({ id: r.id, task_match: r4(r.flat), psi: r4(r.psi), opposed_by: Object.keys(r.parts).filter(k => r.parts[k] < 0) })) : [];
      chain.push({ level, lambda: r4(lam), selected: sel.map((r, i) => ({ id: r.id, app: pre + ':' + r.id, weight: r4(next[i].w), psi: r4(r.psi),
        contributions: Object.fromEntries(Object.entries(r.parts).map(([k, x]) => [k, r4(x)])) })), suppressed });
      state = next }
    return { chain, skills: chain.length === LEVELS.length ? chain[chain.length - 1].selected.map(s => s.id) : [], remaining_task: r4(nrm(q)) } };
  /** lensLayout(state) -> {appId: [x, y]} for every level below the observer. The observer's selected nodes sit at the
   *  centre of the next plane; a node's distance from the centre is how little of it the observer explains (1 - sqrt(a)),
   *  its direction is its direction in the field as seen from the observer. state: {domain|topic|concept|skill: [[appId, weight]]}. */
  const KINDS = [['topic', g.topics.map(t => 't:' + t.id)], ['concept', g.concepts.map(c => 'c:' + c.id)], ['skill', g.skills.map(s => 's:' + s.id)],
    ['agent', g.agents.map(a => 'a:' + a.key)], ['mcp', g.mcp.map(m => midx[m.id])]];
  const ORDER = ['domain', 'topic', 'concept', 'skill', 'agent', 'mcp'];
  const lensLayout = state => {
    const pos = {}; let obs = null;
    for (const [kind, ids] of KINDS) {
      const prev = state[ORDER[ORDER.indexOf(kind) - 1]]; if (prev && prev.length) obs = prev;
      if (!obs) continue;
      const lead = obs.reduce((a, b) => b[1] > a[1] ? b : a)[0], c0 = field[lead] || [0, 0], sw = obs.reduce((s, x) => s + x[1], 0) || 1;
      for (const id of ids) { let a = 0; for (const [p, w] of obs) a += w * dotu(U[id] || {}, U[p] || {}); a = Math.max(0, Math.min(1, a / sw));
        const f = field[id] || [0, 0], ang = Math.atan2(f[1] - c0[1], f[0] - c0[0]), r = 1 - Math.sqrt(a); pos[id] = [r * Math.cos(ang), r * Math.sin(ang)] } }
    return pos };
  const domains = g.domains.map(d => ({ id: d.id, label: d.label, desc: d.desc }));
  return { D, M, gates, scores, meta, graph: g, api: API, digest: g.snapshot_digest, route, field, lens, lensLayout, domains, tDom };
};
</script>
""".replace("__DEFAULT_API__", DEFAULT_API)


def main():
    h = open(SRC, encoding="utf-8").read()

    # 1. data: drop embedded graph + packs, load live
    i = h.find("<script>(()=>{'use strict';\nconst D=")
    if i < 0 or h.count("<script>(()=>{'use strict';\nconst D=") != 1:
        sys.exit("FAIL main script anchor")
    j = json.JSONDecoder().raw_decode(h, i + len("<script>(()=>{'use strict';\nconst D="))[1]
    if not h.startswith(",M=", j):
        sys.exit("FAIL ,M= after D")
    k = json.JSONDecoder().raw_decode(h, j + 3)[1]
    if not h.startswith(";", k):
        sys.exit("FAIL ; after M")
    h = h[:i] + LOADER + "<script>(async()=>{'use strict';\nconst __CP=await window.__cpLoad();const D=__CP.D,M=__CP.M" + h[k:]
    h = cut_json(h, "const BUILTIN_PACKS=", "[]", "built-in packs")
    h = cut_json(h, "const PHYSICS_PACK=", "null", "physics example pack")
    h = once(h, ",\n  btn('Add example: Physics','tpPhys',()=>{tpSt.txt=JSON.stringify(PHYSICS_PACK,null,1);tpSt.msg='Physics example loaded into the box — press Validate or Add to graph.';tpSt.cls='';renderTopics()}));d.append(r2);",
             ");d.append(r2);", "physics example button")

    # 3. topics: label, description with domain and priority
    h = once(h, "const TOPIC_META={};", "const TOPIC_META=Object.assign({},__CP.meta);", "topic meta")

    # 2. gates from the server; server scores replace the page's own cosine where a link exists
    h = once(h, "function autoSet(a){const kk=ovrK[a]!==undefined?ovrK[a]:K;return new Set(mIds.map(m=>[m,S[a][m]]).sort((x,y)=>y[1]-x[1]).filter(r=>r[1]>=TH).slice(0,kk).map(r=>r[0]))}",
             "function autoSet(a){return new Set((__CP.gates[a]||[]).filter(m=>N[m]))}", "gates")
    h = once(h, "S={};aIds.forEach(a=>{S[a]={};mIds.forEach(m=>S[a][m]=dot(N[a].v,N[m].v))});",
             "S={};aIds.forEach(a=>{S[a]={};mIds.forEach(m=>S[a][m]=dot(N[a].v,N[m].v))});"
             "aIds.forEach(a=>{const sc=__CP.scores[a];if(sc)for(const m in sc)if(S[a]&&(m in S[a])&&sc[m].score!=null)S[a][m]=sc[m].score});",
             "server scores")
    h = once(h, "\nbuildModel();\n",
             "\nbuildModel();\n"
             "(()=>{for(const id of['k','t']){const el=document.getElementById(id);const r=el&&el.closest('.row');if(r){r.hidden=true;r.style.display='none'}}"
             "const t=document.getElementById('t');const row=t&&t.closest('.row');if(row){const n=document.createElement('div');n.className='cpnote';"
             "n.textContent='Gates come from the Maxey0 Context Plane server: derived (TF-IDF cosine >= 0.10), inherited (a checker holds its primary\\'s servers) or declared. Manual gate toggles still apply on top.';"
             "row.after(n)}})();\n", "retire sliders")

    # task routing: the server's method (TF-IDF cosine over concepts and skills); agents ranked from those
    # skill scores by role weight only (the old lexicon-embedding term is dropped: one method)
    h = once(h, " const sk=Object.keys(skillVec).map(id=>[id,dot(tv,skillVec[id])]).sort((a,b)=>b[1]-a[1]).slice(0,5);",
             " const sk=__CP.route(text,5);", "task routing")
    h = once(h, "{sc[e.b]=(sc[e.b]||0)+s*({primary:1,checker:.6,support:.4}[e.role]||.4)}));aIds.forEach(a=>sc[a]=(sc[a]||0)+.5*dot(tv,N[a].v));",
             "{sc[e.b]=(sc[e.b]||0)+s*({primary:1,checker:.6,support:.4}[e.role]||.4)}));", "agent ranking")
    h = once(h, " const ok=sk[0][1]>=.08;", " const ok=!!sk.length&&sk[0][1]>=__CP.graph.similarity.thresholds.search_min;", "match threshold")

    h = once(h, "(best cosine '+task.skills[0][1].toFixed(2)+')", "(best cosine '+(task.skills[0]?task.skills[0][1]:0).toFixed(2)+')", "no-match message")

    h = once(h, "const t=task,best=t.skills[0],voc=v04Vocab(t.text)", "const t=task,best=t.skills[0]||['',0],voc=v04Vocab(t.text)", "no-match task message")

    # highlight only the best route (the other candidates stay listed in the task panel)
    h = once(h, "taskSet=new Set();if(ok){sk.slice(0,3).forEach(([id])=>{taskSet.add(id);taskSet.add('c:'+N[id].concept);taskSet.add(cTopic[N[id].concept])});ags.slice(0,3).forEach(([a])=>{taskSet.add(a);G.filter(g=>g.a===a).forEach(g=>taskSet.add(g.b))})}",
             "taskSet=new Set();if(ok){const id=sk[0][0];taskSet.add(id);taskSet.add('c:'+N[id].concept);taskSet.add(cTopic[N[id].concept]);"
             "E.filter(e=>e.kind==='agent'&&e.a===id).forEach(e=>{taskSet.add(e.b);G.filter(g=>g.a===e.b).forEach(g=>taskSet.add(g.b))})}",
             "highlight best route only")

    # 4. state files carry the graph digest; app1 / whole-app state from another graph is refused
    h = once(h, "function stRecord(app){return{schema:'human0.app-state/1',app,version:'0.5',saved:new Date().toISOString(),state:APPS[app].get()}}",
             "function stRecord(app){return{schema:'human0.app-state/1',app,version:'" + VERSION + "',graph:__CP.digest,saved:new Date().toISOString(),state:APPS[app].get()}}",
             "state record")
    h = once(h, " if(rec.app!==app)return{ok:false,error:'this file holds the state of \"'+rec.app+'\", not \"'+app+'\" — use the matching app (or the Human0 bar for a whole-app file)'};",
             " if(rec.app!==app)return{ok:false,error:'this file holds the state of \"'+rec.app+'\", not \"'+app+'\" — use the matching app (or the Human0 bar for a whole-app file)'};\n"
             " if((app==='app1'||app==='human0')&&rec.graph!==__CP.digest)return{ok:false,error:'this state was saved against '+(rec.graph?'a different Maxey0 Context Plane graph ('+String(rec.graph).slice(0,19)+'...)':'an older page without the live graph')+'; topic and agent ids may differ, so it was not loaded'};",
             "state guard")

    # 5. names
    h = once(h, "<title>Human0 - Context Plane Control Graph v0.6</title>", "<title>Maxey0 Context Plane Graph · Human0 v" + VERSION + "</title>", "title")
    h = once(h, "1 · Context Plane Control Graph — Maxey0 OKF (v0.6)", "1 · Maxey0 Context Plane Graph — live (v" + VERSION + ")", "app1 summary")
    h = once(h, "<button data-goto=\"cs_app1\">1 · Context Plane Control Graph</button>", "<button data-goto=\"cs_app1\">1 · Maxey0 Context Plane Graph</button>", "toolbar")
    h = once(h, "APPS.app1={name:'1 · Context Plane Control Graph'", "APPS.app1={name:'1 · Maxey0 Context Plane Graph'", "app name")
    h = once(h, "window.__v01={version:'0.6'", "window.__v01={version:'" + VERSION + "',graph:()=>__CP.digest,api:()=>__CP.api,highlighted:()=>[...taskSet]", "version hook")

    h = once(h, "<div class=\"k\">HUMAN0 · CONTEXT PLANE CONTROL GRAPH · v0.6 · LEVEL 5 · MCP DIRECTORY</div><h1>Agent field locations from semantic MCP gates</h1>\n"
             "<p>Topics → Concepts → Skills → Agents → MCP servers. Agent→MCP links are computed candidates (HYPOTHESIS), not declared in the OKF repo. You set them; the agent field moves.</p>",
             "<div class=\"k\">HUMAN0 · MCP APP · MAXEY0 CONTEXT PLANE GRAPH · v" + VERSION + " · LIVE</div><h1>Maxey0 Context Plane Graph</h1>\n"
             "<p>Domains → Topics → Concepts → Skills → MaxeyN agents → MCP servers, read live from the Maxey0 Context Plane. "
             "Agents are context records (who should handle a skill, with which tools), not running agents. Agent→MCP gates come from the server "
             "(derived by TF-IDF cosine, inherited by checkers, or declared); you can still toggle gates by hand, and the agent field moves.</p>", "header")
    # 593 concept labels drawn at once overlap into an unreadable band: start with topic labels only (C toggles concepts)
    h = once(h, "lbl={topic:true,concept:true,skill:false,agent:false,mcp:false}", "lbl={topic:true,concept:false,skill:false,agent:false,mcp:false}", "label defaults")
    h = once(h, '<button id="lC" class="on">C</button>', '<button id="lC">C</button>', "C button matches label default")

    # 6. one app, not the Human0 shell ------------------------------------------------------
    # page structure: no MCP-apps toolbar, no 4-app frame, no apps 2-4
    h = once(h, '<div class="toolbar"><b>MCP APPS</b><button data-goto="cs_app1">1 · Maxey0 Context Plane Graph</button><button data-goto="cs_app2">2 · File Graph</button><button data-goto="cs_app3">3 · Pong</button><button data-goto="cs_app4">4 · Human0.chat dev</button><span style="flex:1"></span><button id="csAllOpen">Expand all</button><button id="csAllShut">Collapse all</button></div>\n', '', "apps toolbar")
    h = once(h, '<div class="appsframe"><details class="cs frame" id="cs_apps" open><summary>MCP Apps · 4</summary><div class="cs-b">\n<details class="cs app" id="cs_app1" open><summary>1 · Maxey0 Context Plane Graph — live (v' + VERSION + ')</summary>',
             '<div class="appsframe single"><details class="cs app" id="cs_app1" open><summary>Workspace</summary>', "apps frame open")
    h = once(h, '</details>\n<details class="cs app" id="cs_app2"><summary>2 · File Graph — front end for /file-graph</summary><div class="cs-b" id="app2body"></div></details>\n'
             '<details class="cs app" id="cs_app3"><summary>3 · Pong</summary><div class="cs-b" id="app3body"></div></details>\n'
             '<details class="cs app" id="cs_app4"><summary>4 · Human0.chat — development environment (SCW human0-chat-dev)</summary><div class="cs-b" id="app4body"></div></details>\n'
             '</div></details></div>', '</details>\n</div>', "apps 2-4 panels")
    i = h.find('<script type="application/json" id="fgTpl">')
    if i < 0 or h.count('id="fgTpl"') != 1:
        sys.exit("FAIL File Graph template")
    h = h[:i] + h[h.index('</script>', i) + len('</script>'):].lstrip('\n')
    # code: the three app sections, their wiring, their state, their hooks
    a = h.find("\n// ---------- 2. App 2: File Graph front end"); b = h.find("\n// ---------- init + test hooks")
    if a < 0 or b < a or h.count("\n// ---------- 2. App 2: File Graph front end") != 1:
        sys.exit("FAIL app 2-4 code sections")
    h = h[:a] + h[b:]
    h = once(h, "function v7init(){csApply();fgUI();pongUI();renderDev();\n $('csAllOpen').onclick=()=>csAll(true);$('csAllShut').onclick=()=>csAll(false);",
             "function v7init(){csApply();", "v7init")
    h = once(h, "syncHidden($('cs_export'),$('expBox'));pongVis()}", "syncHidden($('cs_export'),$('expBox'))}", "pong visibility")
    h = once(h, "if(d.id==='cs_app3')pongVis()", "", "pong toggle listener")
    h = once(h, "const DV0=JSON.parse(JSON.stringify(dv));\nconst DVKEYS=['threshold','target','name','domain','kind','text','over','auth','route','routeMsg','req','reqTxt','reqMsg','reqCls','reqId','pack','packTxt','decisions','notes','mode','page','scripts','showSrc'];\n", "", "dev-env state defaults")
    h = once(h, "draw();if(appId==='cs_app3')pongVis();return true}", "draw();return true}", "pong in full screen")
    h = once(h, "renderExec();renderTopics();renderDev()}", "renderExec();renderTopics()}", "server detect")
    a = h.find("window.__v7={"); b = h.find("\nconst BUILTIN_PACKS")
    if a < 0 or b < a:
        sys.exit("FAIL __v7 hook")
    h = h[:a] + "window.__v7={version:'7.0',cs:{all:csAll,list:csList,state:()=>({...csState})}};\n" + h[b:]
    a = h.find("APPS.app2="); b = h.find("\n// ---------- (5) full screen")
    if a < 0 or b < a:
        sys.exit("FAIL APPS app2..human0")
    h = h[:a] + h[b:]
    a = h.find("function fsBtnWhole("); b = h.find("'warn')}};return b}\n", a)
    if a < 0 or b < a or h.count("function fsBtnWhole(") != 1:
        sys.exit("FAIL fsBtnWhole")
    h = h[:a] + h[b + len("'warn')}};return b}\n"):]
    h = once(h, " if(!document.querySelector('.statebar.main')){const mb=stBar('human0','main');mb.append(fsBtnWhole());document.querySelector('.toolbar').before(mb)}\n", "", "whole-app state bar")
    h = once(h, " [['app1','cs_app1'],['app2','cs_app2'],['app3','cs_app3'],['app4','cs_app4']].forEach(", " [['app1','cs_app1']].forEach(", "app state bars")
    h = once(h, "d.querySelector(':scope>summary').after(bar)});", "d.querySelector(':scope>summary').after(cpFold(bar))});", "fold app state bar")
    h = once(h, "if((app==='app1'||app==='human0')&&rec.graph!==__CP.digest)", "if(app==='app1'&&rec.graph!==__CP.digest)", "state guard: app1 only")

    # 7. task result panel ---------------------------------------------------------------------
    h = once(h, "taskSet=new Set();if(ok){const id=sk[0][0];", "cpMsgHidden=false;taskSet=new Set();if(ok){const id=sk[0][0];", "show result on new task")
    old_body = h[h.index(" if(t.matched){const tp=topicsOf(t.skills.slice(0,3)"):h.index(" const row=hh('div','tmL',t.matched?'Top skills: ':'Nearest skills: ');")]
    if h.count(old_body) != 1 or "Weak match" not in old_body:
        sys.exit("FAIL result body")
    h = h.replace(old_body,
        " if(t.matched){const sid=best[0],cid='c:'+N[sid].concept,tid=cTopic[N[sid].concept];"
        "m.append(hh('div','tmL','Best route: '+(N[tid]?N[tid].label:'')+' → '+(N[cid]?N[cid].label:'')+' → '+lab(sid)+' (highlighted on the graph with its agents and their MCP servers).'))}\n"
        " else m.append(hh('div','tmL','No concept or skill shares enough words with this task. Rephrase it with the field\\'s own words, or add a topic pack that covers it.'));\n"
        " m.append(hh('div','tmL','Ranked by TF-IDF cosine, the same method as the Maxey0 Context Plane route_task.'));\n")
    h = once(h, " const row=hh('div','tmL',t.matched?'Top skills: ':'Nearest skills: ');\n t.skills.slice(0,t.matched?5:3)",
             " const row=hh('div','tmL',t.matched?'Other candidates: ':'Nearest skills: ');\n t.skills.slice(t.matched?1:0,t.matched?5:3)", "candidates row")
    h = once(h, "function v04Msg(){const m=$('taskMsg');if(!m)return null;m.textContent='';",
             "var cpMsgHidden=false;\n"
             "function v04Msg(){const m=$('taskMsg');if(!m)return null;\n"
             " if(cpMsgHidden&&task){m.textContent='';m.hidden=false;m.className='slim';"
             "m.append(hh('span','','Result for \u201c'+task.text+'\u201d is hidden; the route stays on the graph.'));"
             "const b=hh('button','','Show result',{type:'button',id:'cpShow'});b.onclick=()=>{cpMsgHidden=false;v04Msg()};m.append(b);return null}\n"
             " const r=v04MsgFull();if(task&&!m.hidden){const b=hh('button','cphide','Hide',{type:'button',id:'cpHide',title:'Hide this result; the highlighted route stays on the graph'});"
             "b.onclick=()=>{cpMsgHidden=true;v04Msg()};m.prepend(b)}return r}\n"
             "function v04MsgFull(){const m=$('taskMsg');m.textContent='';", "result hide wrapper")
    h = once(h, " route:text=>{const e=embed(text),tv=e.v;const sk=Object.keys(skillVec).map(id=>[id,dot(tv,skillVec[id])]).sort((x,y)=>y[1]-x[1]).slice(0,5);\n"
             "  return{matched:sk[0][1]>=V4.thr,hits:e.dv.map((x,i)=>x?[DOMS[i],x]:null).filter(Boolean),",
             " route:text=>{const sk=__CP.route(text,5);\n  return{matched:!!sk.length&&sk[0][1]>=__CP.graph.similarity.thresholds.search_min,", "diagnostic route hook")

    # 8. readable paths: spread an isolated path on its levels; drag nodes within their level --------
    h = once(h, "function project(n,w,h,o){const px=o?o.x:n.x,py=o?o.y:n.y,",
             "function project(n,w,h,o){const q=o||cpPos(n),px=q.x,py=q.y,", "project: layout overrides")
    h = once(h, "const rel=relNow(),P={};pts=[];", "const rel=relNow(),P={};pts=[];cpFanCompute(rel);", "draw: fan layout")
    h = once(h, "for(const o of pts){const n=o.n;if(iso&&rel&&!rel.has(n.id))continue;",
             "for(const o of pts){const n=o.n;if(iso&&rel&&!rel.has(n.id))continue;if(cpOnlyNew&&!cpNewSet().has(n.id))continue;", "draw: new-topics-only nodes")
    h = once(h, "for(const e of lines){const a=P[e.a],b=P[e.b];if(!a||!b)continue;",
             "for(const e of lines){const a=P[e.a],b=P[e.b];if(!a||!b)continue;if(cpOnlyNew&&!(cpNewSet().has(e.a)&&cpNewSet().has(e.b)))continue;", "draw: new-topics-only edges")
    h = once(h, "cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,m:false};cv.setPointerCapture(e.pointerId)});",
             "cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),n=cpDrag?pick(e.clientX-r.left,e.clientY-r.top):null;drag={x:e.clientX,y:e.clientY,m:false,node:n?n.id:null};cv.setPointerCapture(e.pointerId)});", "pointerdown: node drag")
    h = once(h, "const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.m=true;rot+=dx*.008;",
             "const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.m=true;if(drag.node){if(drag.m){cpMoveNode(drag.node,dx,dy);drag.x=e.clientX;drag.y=e.clientY;draw()}return}rot+=dx*.008;", "pointermove: node drag")
    h = once(h, "cx.fillText(nodeLabel(n).slice(0,36),o.sx+rad+3,o.sy+4)}}",
             "if(cpFanPos[n.id]&&n.kind!=='topic'){cx.save();cx.translate(o.sx,o.sy);cx.rotate(.62);cx.fillText(nodeLabel(n).slice(0,36),rad+3,4);cx.restore()}else cx.fillText(nodeLabel(n).slice(0,36),o.sx+rad+3,o.sy+4)}}", "slanted labels on a spread path")
    # 9. level donuts, full vertical rotation, pan and wider zoom ---------------------------------
    h = once(h, "for(const k of['mcp','agent','skill','concept','topic']){if(!vis[k])continue;const p=[0,1,2,3].map(i=>{const a=i*Math.PI/2+Math.PI/4;return project({z:ZP[k]},w,h,{x:Math.cos(a)*RAD.mcp*1.15,y:Math.sin(a)*RAD.mcp*1.15})});cx.beginPath();p.forEach((o,i)=>i?cx.lineTo(o.sx,o.sy):cx.moveTo(o.sx,o.sy));cx.closePath();cx.fillStyle=COL[k]+'0c';cx.strokeStyle=COL[k]+'55';cx.fill();cx.stroke();cx.fillStyle=COL[k];cx.font='10px system-ui';cx.textAlign='start';cx.fillText((k==='mcp'?'MCP SERVERS (GATES)':LBL[k].toUpperCase()+'S'),p[3].sx+4,p[3].sy-4)}",
             "cpDrawRings(w,h);", "level planes -> donuts")
    h = once(h, "rot+=dx*.008;tilt=Math.max(.05,Math.min(1.45,tilt+dy*.005));",
             "if(drag.pan){cpPanX+=dx;cpPanY+=dy;drag.x=e.clientX;drag.y=e.clientY;draw();return}cpTrack(dx,dy,e.shiftKey);", "full vertical rotation + pan")
    # 10. all-axis rotation: the projection uses the orientation matrix; drag = trackball, Shift+drag = roll; Spin turns about the graph's own axis
    h = once(h, "x=px*Math.cos(rot)-py*Math.sin(rot),y=px*Math.sin(rot)+py*Math.cos(rot),yy=y*Math.cos(tilt)-n.z*Math.sin(tilt),zz=y*Math.sin(tilt)+n.z*Math.cos(tilt),p=800/(800+zz);",
             "pz=n.z,x=cpM[0]*px+cpM[1]*py+cpM[2]*pz,yy=cpM[3]*px+cpM[4]*py+cpM[5]*pz,zz=cpM[6]*px+cpM[7]*py+cpM[8]*pz,p=800/Math.max(120,800+zz);", "projection through the orientation matrix")
    h = once(h, "{if(!drag){rot+=.006;draw()}}", "{if(!drag&&!cpAnim){cpWorldZ(.006);draw()}}", "spin about the graph axis")
    h = once(h, "<span>Drag rotate · scroll zoom · hover traces · click pins</span>",
             "<span>Drag space: rotate any way · Shift+drag: roll · Right-drag: pan · Drag a node: move it on its level · Scroll: zoom · Click: select</span>", "legend: how to move")
    h = once(h, '<option value="all">all 67 agents</option>', '<option value="all">all agents</option>', "SCW option label")
    h = once(h, "d.append(mk('summary','','Topics → Concepts → Skills → Agents → MCP (v6)'));", "d.append(mk('summary','','Topics → Concepts → Skills → Agents → MCP'));", "topics panel title")
    # published build: the execution panel shows the route only; agent / MCP / model decision nodes and the
    # System One (Jev) calls belong to the Maxey0 orchestrator, and the app may only reach its own server
    h = once(h, "<summary>Task execution (decision nodes, F1–F3)</summary>", "<summary>Task route</summary>", "execution panel title")
    h = once(h, "rt.append(c)});b.append(rt);",
             "rt.append(c)});b.append(rt);b.append(el('p','','Choosing and running the agent, its MCP servers and its model happens in the Maxey0 orchestrator, not in this app.'));return;", "route-only execution panel")
    h = once(h, "zoom=Math.max(.25,Math.min(3,zoom*(e.deltaY<0?1.1:.91)));", "zoom=Math.max(.08,Math.min(8,zoom*(e.deltaY<0?1.1:.91)));", "wider zoom")
    h = once(h, "return{sx:w/2+x*p*zoom*1.15,sy:h/2+yy*p*zoom*1.15+10,p,zz}}", "return{sx:w/2+x*p*zoom*1.15+cpPanX,sy:h/2+yy*p*zoom*1.15+10+cpPanY,p,zz}}", "pan in projection")
    h = once(h, "drag={x:e.clientX,y:e.clientY,m:false,node:n?n.id:null};",
             "drag={x:e.clientX,y:e.clientY,m:false,node:(n&&e.button===0&&!e.altKey)?n.id:null,pan:e.button===2||e.button===1||e.altKey};", "pan with right/middle button or Alt")
    h = once(h, "<div class=\"graphbox\"><canvas id=\"g\"",
             "<div class=\"cpview row\" id=\"cpView\"><button type=\"button\" id=\"cpFieldBtn\" title=\"Place every node by its location in the shared embedding field: one space and one scale on all six levels, so nodes that mean the same thing line up across levels\">Embedding field</button><button type=\"button\" id=\"cpFanBtn\" class=\"on\" title=\"When a path is isolated, spread each level's nodes side by side under their parents so every node and label is readable\">Spread path</button>"
             "<button type=\"button\" id=\"cpDragBtn\" class=\"on\" title=\"Drag a node to move it sideways within its own level; drag empty space to rotate\">Drag nodes</button>"
             "<button type=\"button\" id=\"cpResetBtn\" title=\"Put dragged nodes back\">Reset layout</button>"
             "<button type=\"button\" id=\"cp720Btn\" title=\"Tumble the graph through two full turns about a tilted axis and land back where it started\">720°</button>"
             "<button type=\"button\" id=\"cpHostFs\" hidden title=\"Ask Claude to show the graph full screen\">Full screen</button>"
             "<button type=\"button\" id=\"cpFitBtn\" title=\"Reset rotation, tilt, zoom and pan so the whole graph is in view\">Fit view</button>"
             "<span class=\"cpsep\"></span><span class=\"cplbl\">Show</span><button type=\"button\" id=\"cpAllBtn\" class=\"on\">Full graph</button><button type=\"button\" id=\"cpNewBtn\" title=\"Only the topics you generated and added in this app\">New topics only</button></div>\n"
             "<div class=\"graphbox\"><canvas id=\"g\"", "view toolbar")
    h = once(h, "  'Build the levels recursively:", "  'If the Maxey0 Context Plane connector is available, call its validate_topic_pack tool with the JSON and fix every problem it reports before answering.',\n  'Build the levels recursively:", "generation request: validate step")
    h = once(h, " else m.append(hh('div','tmL','No concept or skill shares enough words with this task. Rephrase it with the field\\'s own words, or add a topic pack that covers it.'));\n",
             " else{m.append(hh('div','tmL','No concept or skill shares enough words with this task. Rephrase it with the field\\'s own words, or generate a topic that covers it.'));"
             "const gb=hh('button','','Generate a topic for this task',{type:'button',id:'cpGenFromTask'});gb.onclick=()=>cpGenerateFor(t.text);m.append(gb)}\n", "no match: generate")
    # labels: a kind switched off stays off, even on the selected path (T/C/A/M kept showing path labels)
    h = once(h, "lbl={topic:true,concept:false,skill:false,agent:false,mcp:false},strict=false,", "lbl={topic:true,concept:false,skill:false,agent:false,mcp:false},strict=false,lblX={},", "label opt-out state")
    h = once(h, "const show=!dim&&(lbl[n.kind]||(!strict&&(", "const show=!dim&&(lbl[n.kind]||(!strict&&!lblX[n.kind]&&(", "label opt-out in draw")
    h = once(h, "lbl[k]=!lbl[k];if(lbl[k])strict=false;", "lbl[k]=!lbl[k];lblX[k]=!lbl[k];if(lbl[k])strict=false;", "label toggle opt-out")
    h = once(h, "$('lOff').onclick=()=>{Object.keys(lbl).forEach(k=>lbl[k]=false);", "$('lOff').onclick=()=>{Object.keys(lbl).forEach(k=>{lbl[k]=false;lblX[k]=false});", "None resets opt-out")
    h = once(h, "$('lAll').onclick=()=>{Object.keys(lbl).forEach(k=>lbl[k]=true);", "$('lAll').onclick=()=>{Object.keys(lbl).forEach(k=>{lbl[k]=true;lblX[k]=false});", "All resets opt-out")
    # domains: a Domain filter above Topic in Browse & select (domains are the top level of the map)
    h = once(h, '<div class="row"><label>Topic</label><select id="bfTopic"', '<div class="row"><label>Domain</label><select id="bfDomain" aria-label="Filter by domain"></select></div><div class="row"><label>Topic</label><select id="bfTopic"', "domain filter control")
    h = once(h, "bf:{topic:'',concept:''}", "bf:{domain:'',topic:'',concept:''}", "domain filter state")
    h = once(h, "function v03Filter(items){const T=V3.bf.topic,C=V3.bf.concept;if(!T&&!C)return items;\n const cOk=cid=>(!C||cid===C)&&(!T||D.concepts.some(c=>c[0]===cid&&c[2]===T));\n return items.filter(n=>{\n  if(n.kind==='topic')return !T||n.id==='t:'+T;",
      "function v03Filter(items){const T=V3.bf.topic,C=V3.bf.concept,DM=V3.bf.domain;if(!T&&!C&&!DM)return items;\n const tOk=t=>!DM||(TOPIC_META[t]&&TOPIC_META[t].domain===DM);\n const cOk=cid=>(!C||cid===C)&&D.concepts.some(c=>c[0]===cid&&(!T||c[2]===T)&&tOk(c[2]));\n return items.filter(n=>{\n  if(n.kind==='topic')return (!T||n.id==='t:'+T)&&tOk(n.id.slice(2));", "domain filter")
    h = once(h, "function v03BrowseOptions(){const bt=$('bfTopic'),bc=$('bfConcept');if(!bt||!bc)return;const tps=[...new Set(D.concepts.map(c=>c[2]))];",
      "function v03BrowseOptions(){const bt=$('bfTopic'),bc=$('bfConcept'),bd=$('bfDomain');if(!bt||!bc)return;\n if(bd){const ds=(__CP.graph.domains||[]);bd.innerHTML='';const d0=hh('option','','All domains');d0.value='';bd.append(d0);ds.forEach(d=>{const o=hh('option','',d.label+' ('+Object.values(TOPIC_META).filter(m=>m.domain===d.id).length+')');o.value=d.id;o.title=d.desc||'';bd.append(o)});bd.value=V3.bf.domain||''}\n const tps=[...new Set(D.concepts.map(c=>c[2]))].filter(t=>!V3.bf.domain||(TOPIC_META[t]&&TOPIC_META[t].domain===V3.bf.domain));", "domain options")
    h = once(h, " const cs=D.concepts.filter(c=>!V3.bf.topic||c[2]===V3.bf.topic);", " const cs=D.concepts.filter(c=>(!V3.bf.topic||c[2]===V3.bf.topic)&&tps.includes(c[2]));", "concepts follow domain")
    h = once(h, "function v03BrowseWire(){const bt=$('bfTopic'),bc=$('bfConcept');if(!bt||bt.dataset.w)return;bt.dataset.w='1';",
      "function v03BrowseWire(){const bt=$('bfTopic'),bc=$('bfConcept');if(!bt||bt.dataset.w)return;bt.dataset.w='1';\n if($('bfDomain'))$('bfDomain').onchange=()=>{V3.bf.domain=$('bfDomain').value;V3.bf.topic='';V3.bf.concept='';v03BrowseApply(false)};", "domain wire")
    # observer lens + domains in the graph and the task panel (server parity: route_task mode "lens")
    h = once(h, " cpDrawRings(w,h);\n const rel=relNow()", " cpDrawRings(w,h);cpLensSync();\n const rel=relNow()", "lens sync before projection")
    h = once(h, " drawSCW(P,w,h);const lines=[];", " drawSCW(P,w,h);cpDrawDomains(P);const lines=[];", "domain labels")
    h = once(h, "  if(!dim&&v03IsUp(n)){cx.beginPath();", "  if(cpDomOn&&n.kind==='topic'){const d=__CP.tDom[n.id.slice(2)];if(d){cx.beginPath();cx.arc(o.sx,o.sy,rad+2.2,0,6.2832);cx.strokeStyle=cpDomCol(d);cx.lineWidth=2;cx.stroke()}}\n  if(!dim&&v03IsUp(n)){cx.beginPath();", "domain ring on topics")
    h = once(h, '<div class="cpview row" id="cpView"><button type="button" id="cpFieldBtn"',
      '<div class="cpview row" id="cpView"><button type="button" id="cpDomBtn" class="on" aria-pressed="true" title="Show each topic\'s domain as a coloured ring and label each domain where its topics are">Domains</button><button type="button" id="cpFieldBtn"', "domains button")
    h = once(h, '<div class="taskbar"><input id="taskIn"', '<div class="taskbar"><select id="taskMode" aria-label="Router" title="Flat: rank every skill against the task. Observer lens: choose topics, then read concepts and skills from the chosen nodes (same as the server\'s route_task mode lens)"><option value="flat">Flat</option><option value="lens">Observer lens</option></select><input id="taskIn"', "router select")
    h = once(h, '<div id="taskMsg" role="status" aria-live="polite" hidden></div>', '<div id="taskMsg" role="status" aria-live="polite" hidden></div><div id="lensOut" class="cpnote" hidden></div>', "lens readout")
    h = once(h, "function submitTask(text){text=(text||$('taskIn').value).trim();if(!text)return null;const tv=embed(text).v;\n const sk=__CP.route(text,5);",
      "function submitTask(text){text=(text||$('taskIn').value).trim();if(!text)return null;const tv=embed(text).v;\n const lensMode=$('taskMode')&&$('taskMode').value==='lens',doms=V3.bf.domain?[V3.bf.domain]:[],LR=lensMode?__CP.lens(text,doms):null;\n const sk=lensMode?LR.chain.length===3?LR.chain[2].selected.map(x=>[x.app,x.psi]):[]:__CP.route(text,5);", "lens router")
    h = once(h, " const ok=!!sk.length&&sk[0][1]>=__CP.graph.similarity.thresholds.search_min;task={id:'run-'+(++runSeq),text,ts:new Date().toISOString(),tv,skills:sk,agents:ags,matched:ok};",
      " const ok=lensMode?!!sk.length:!!sk.length&&sk[0][1]>=__CP.graph.similarity.thresholds.search_min;task={id:'run-'+(++runSeq),text,ts:new Date().toISOString(),tv,skills:sk,agents:ags,matched:ok,lens:LR,doms:lensMode?doms:[]};cpLensOut();", "task carries the lens chain")
    h = once(h, "E.filter(e=>e.kind==='agent'&&e.a===id).forEach(e=>{taskSet.add(e.b);G.filter(g=>g.a===e.b).forEach(g=>taskSet.add(g.b))})}\n renderExec();draw();return task}",
      "E.filter(e=>e.kind==='agent'&&e.a===id).forEach(e=>{taskSet.add(e.b);G.filter(g=>g.a===e.b).forEach(g=>taskSet.add(g.b))});if(LR)LR.chain.forEach(l=>l.selected.forEach(x=>taskSet.add(x.app)))}\n renderExec();draw();return task}", "lens chain highlighted")
    h = once(h, "$('taskClr').onclick=()=>{task=null;", "$('taskClr').onclick=()=>{task=null;cpLensOut();", "clear lens readout")
    h = once(h, '<button type="button" id="cpFieldBtn"', '<span id="cpObs" class="cpobs">Observer: above the graph</span><button type="button" id="cpFieldBtn"', "observer readout")
    h = once(h, "\n// ---------- init + test hooks", "\n" + CP_VIEW_JS + "\n// ---------- init + test hooks", "view + generation code")

    for gone in ("DV0", "DVKEYS", "cs_app2", "cs_app3", "cs_app4", "fgUI", "pongUI", "renderDev", "fsBtnWhole", "MCP APPS", "'human0','main'", "Weak match", "graph vocabulary"):
        if gone in h:
            sys.exit(f"FAIL still present: {gone!r}")

    for leftover in ("Context Plane Control Graph", "CONTEXT PLANE CONTROL GRAPH", "const D={\"concepts\""):
        if leftover in h:
            sys.exit(f"FAIL leftover: {leftover!r}")
    open(OUT, "w", encoding="utf-8").write(h)
    print(json.dumps({"ok": True, "out": os.path.relpath(OUT, HERE), "bytes": len(h), "source_bytes": os.path.getsize(SRC)}))


if __name__ == "__main__":
    main()
