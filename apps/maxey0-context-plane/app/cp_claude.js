// clipboard writes are best-effort: a refused permission must not raise (it is a promise rejection, not a throw)
function cpCopy(t){try{const p=navigator.clipboard&&navigator.clipboard.writeText(t);if(p&&p.catch)p.catch(()=>{})}catch(e){}}
// ======================================================================================================================
// Claude connection (website only; inside Claude, as an MCP App, the host already is Claude).
//  - first visit: "Connect Maxey0 to Claude?"  Not now -> Maxey0 only;  Connect -> (a) Maxey0 inside your Claude (custom
//    connector: the address and the steps) or (b) your own Claude API key + model.
//  - the API key lives only in this page's memory (cpClaude.key): never in browser storage, saved state, URLs or logs, and
//    never sent to the Maxey0 server; calls go from the browser straight to api.anthropic.com. Reload or close = forgotten.
//  - only the choice (none / connector / api — never the key) is remembered in this browser, so the question is not repeated.
const cpClaude={mode:null,key:null,model:null,models:[]};
function cpLS(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null}
async function cpAnthropic(path,body,key){const r=await fetch('https://api.anthropic.com'+path,{method:body?'POST':'GET',
  headers:{'x-api-key':key||cpClaude.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));return j}
function cpClaudeLabel(){return cpClaude.mode==='api'&&cpClaude.key?'Claude: API · '+cpClaude.model:'Connect to Claude'}
// The Connect button sits in a dock: top right on wide screens, bottom right on phones, where it can also be hidden to a
// small tab on the right edge and brought back (the choice is kept for this browser only).
function cpClaudeBtn(){let b=$('cpClaudeBtn'),k=$('cpClaudeDock');if(cpHost.on){if(k)k.remove();return}
 if(!b){k=hh('div','',null,{id:'cpClaudeDock'});
  b=hh('button','',cpClaudeLabel(),{type:'button',id:'cpClaudeBtn',title:'Connect Maxey0 to Claude: use it inside your Claude, or with your own API key'});b.onclick=()=>cpClaudeOpen('how');
  const x=hh('button','','\u00d7',{type:'button',id:'cpClaudeHide',title:'Hide the Claude button','aria-label':'Hide the Claude button'});x.onclick=()=>cpClaudeDock(true);
  const t=hh('button','','Claude',{type:'button',id:'cpClaudeTab',title:'Show the Claude button','aria-label':'Show the Claude button'});t.onclick=()=>cpClaudeDock(false);
  k.append(b,x,t);document.body.append(k);cpClaudeDock(cpLS('mx0.claudeHidden')==='1',true);cpClaudeDrag(k)}
 b.textContent=cpClaudeLabel()}
// Phones: drag the button anywhere; on release it snaps to the nearer side edge, and its place is kept for this browser.
// A press that moves less than 8 px is a tap (opens the dialog); a drag never opens it.
const cpNarrow=()=>matchMedia('(max-width:700px)').matches;
function cpClaudePlace(k,p){k._pos=p;if(!p||!cpNarrow()){k.style.left=k.style.right=k.style.top=k.style.bottom='';return}
 const h=k.offsetHeight||48,y=Math.max(8,Math.min(innerHeight-h-8,p.y*innerHeight));k.style.top=y+'px';k.style.bottom='auto';
 const e=k.classList.contains('cphid')?0:null;k.classList.toggle('cpleft',p.side==='left');
 if(p.side==='left'){k.style.left=(e??8)+'px';k.style.right='auto'}else{k.style.right=(e??12)+'px';k.style.left='auto'}}
function cpClaudeDrag(k){let pos=null;try{pos=JSON.parse(cpLS('mx0.claudePos')||'null')}catch(e){}cpClaudePlace(k,pos);
 addEventListener('resize',()=>cpClaudePlace(k,pos));let st=null,moved=false;
 k.addEventListener('pointerdown',e=>{if(!cpNarrow()||e.target.id==='cpClaudeHide')return;const r=k.getBoundingClientRect();st={x:e.clientX,y:e.clientY,l:r.left,t:r.top};moved=false});
 addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(!moved&&Math.hypot(dx,dy)<8)return;
  moved=true;e.preventDefault();
  k.style.left=Math.max(0,Math.min(innerWidth-k.offsetWidth,st.l+dx))+'px';k.style.right='auto';k.style.top=Math.max(0,Math.min(innerHeight-k.offsetHeight,st.t+dy))+'px';k.style.bottom='auto'});
 const end=()=>{if(!st)return;st=null;if(!moved)return;const r=k.getBoundingClientRect();pos={y:r.top/innerHeight,side:r.left+r.width/2<innerWidth/2?'left':'right'};
  cpLS('mx0.claudePos',JSON.stringify(pos));cpClaudePlace(k,pos)};
 addEventListener('pointerup',end);addEventListener('pointercancel',end);
 k.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false}},true)}
function cpClaudeDock(hide,init){const k=$('cpClaudeDock');if(!k)return;k.classList.toggle('cphid',!!hide);if(!init)cpClaudePlace(k,k._pos);if(!init)cpLS('mx0.claudeHidden',hide?'1':'0');
 const f=$(hide?'cpClaudeTab':'cpClaudeBtn');if(f&&!init)f.focus()}
function cpClaudeClose(){const d=$('cpClaude');if(d)d.remove();cpClaudeBtn();const b=$('cpClaudeBtn');if(b)b.focus()}
function cpClaudeOpen(step){let d=$('cpClaude');if(d)d.remove();
 d=hh('div','');d.id='cpClaude';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-labelledby','cpClaudeT');
 const box=hh('div','cpdlg');d.append(box);d.onclick=e=>{if(e.target===d)cpClaudeClose()};d.onkeydown=e=>{if(e.key==='Escape')cpClaudeClose()};
 const B=(t,id,f,cls)=>{const b=hh('button',cls||'',t,{type:'button',id});b.onclick=f;return b};
 if(step==='ask'){const t=hh('h2','','Connect Maxey0 to Claude?');t.id='cpClaudeT';box.append(t);
  box.append(hh('p','','Maxey0 works here on its own: routing, the observer lens, drift, embeddings. Connecting Claude adds topic generation on this site, or Maxey0 inside your own Claude conversations.'));
  const r=hh('div','cpdrow');r.append(B('Not now','cpClaudeNo',()=>{cpClaude.mode='none';cpLS('mx0.connect','none');cpClaudeClose()}),B('Connect','cpClaudeYes',()=>cpClaudeOpen('how'),'on'));box.append(r)}
 else{const origin=__CP.api||location.origin,url=origin+'/mcp',t=hh('h2','','Connect Maxey0 to Claude');t.id='cpClaudeT';box.append(t);
  // (a) connector
  const a=hh('section','cpdcard');a.append(hh('h3','','Use Maxey0 inside your Claude (recommended, free)'));
  a.append(hh('p','','Add it once as a custom connector. Then ask Claude to route a task or open the graph in your conversation. Works on every Claude plan (Free: one custom connector).'));
  const u=hh('code','',url);u.id='cpClaudeUrl';const cp=B('Copy address','cpClaudeCopy',()=>{cpCopy(url);cp.textContent='Copied'});
  const ol=hh('ol','');['In Claude: Customize → Connectors → + Add → Add custom connector','Name: Maxey0 Context Plane','URL: the address above','Sign-in: none (the server is read-only) → Add'].forEach(x=>ol.append(hh('li','',x)));
  a.append(u,document.createTextNode(' '),cp,ol,B('Done','cpClaudeConn',()=>{cpClaude.mode='connector';cpLS('mx0.connect','connector');cpClaudeClose()},'on'));box.append(a);
  // (b) API key
  const k=hh('section','cpdcard');k.append(hh('h3','','Use my own Claude API key'));
  k.append(hh('p','','For topic generation on this site. The key stays in this page’s memory only: it is not saved in your browser or in saved state, and it is not sent to the Maxey0 server — calls go straight from your browser to api.anthropic.com. Reloading or closing the page forgets it. Anyone able to run code in this page (for example a browser extension) could read it, so use a key with a spending limit. You pay Anthropic for what you use.'));
  const lab=hh('label','','API key ');const inp=hh('input','',null,{type:'password',id:'cpClaudeKey',autocomplete:'off',spellcheck:'false',placeholder:'sk-ant-…'});lab.append(inp);
  const sel=hh('select','',null,{id:'cpClaudeModel','aria-label':'Model'});
  const fill=()=>{sel.innerHTML='';for(const m of cpClaude.models){const o=hh('option','',m.display_name||m.id,{value:m.id});if(m.id===cpClaude.model)o.selected=true;sel.append(o)}sel.disabled=!cpClaude.models.length};fill();
  const msg=hh('div','cpdmsg','');msg.id='cpClaudeMsg';msg.setAttribute('role','status');
  const chk=B('Check key and load models','cpClaudeCheck',async()=>{const key=inp.value.trim();if(!key){msg.textContent='Enter a key first.';return}msg.textContent='Checking…';
   try{const j=await cpAnthropic('/v1/models?limit=100',null,key);cpClaude.models=(j.data||[]).map(m=>({id:m.id,display_name:m.display_name}));if(!cpClaude.models.length)throw new Error('no models available to this key');
    cpClaude.model=cpClaude.model&&cpClaude.models.some(m=>m.id===cpClaude.model)?cpClaude.model:cpClaude.models[0].id;fill();msg.textContent='Key works: '+cpClaude.models.length+' models. Choose one and press Use this key.'}
   catch(e){msg.textContent='Key not accepted: '+e.message}});
  const use=B('Use this key','cpClaudeUse',()=>{const key=inp.value.trim()||cpClaude.key;if(!key||!cpClaude.models.length){msg.textContent='Check the key first.';return}cpClaude.key=key;cpClaude.model=sel.value;cpClaude.mode='api';inp.value='';cpLS('mx0.connect','api');cpClaudeClose()},'on');
  const forget=B('Forget key','cpClaudeForget',()=>{cpClaude.key=null;cpClaude.models=[];cpClaude.model=null;cpClaude.mode=null;inp.value='';fill();msg.textContent='Key forgotten.';cpClaudeBtn()});
  const r2=hh('div','cpdrow');r2.append(chk,sel,use,forget);k.append(lab,r2,msg);if(cpClaude.key)k.append(hh('p','','In use: '+cpClaude.model+' (key held in this page’s memory).'));box.append(k);
  const r=hh('div','cpdrow');r.append(B('Close','cpClaudeNo',()=>{if(!cpClaude.key&&cpClaude.mode!=='connector'){cpClaude.mode='none';cpLS('mx0.connect','none')}cpClaudeClose()}));box.append(r)}
 document.body.append(d);const f=d.querySelector('button.on')||d.querySelector('button');if(f)f.focus()}
// topic generation with the key: the same request the app builds, answered by the chosen model, put in the paste box
async function cpGenerateApi(text){const m=$('tpMsg');tpSt.msg='Generating with '+cpClaude.model+'…';tpSt.cls='';if(m)m.textContent=tpSt.msg;
 try{const j=await cpAnthropic('/v1/messages',{model:cpClaude.model,max_tokens:16000,
   system:'You write one human0.topic-pack/1 JSON object and nothing else. You have no tools in this call: you cannot verify MCP servers, so return "mcp": [] and say so in mcp_notes.',
   messages:[{role:'user',content:text}]});
  const out=(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join(''),a=out.indexOf('{'),b=out.lastIndexOf('}');if(a<0||b<a)throw new Error('the answer has no JSON object');
  tpSt.txt=out.slice(a,b+1);tpSt.msg='Generated with '+cpClaude.model+'. Press Validate, then Add to graph.';tpSt.cls=''}
 catch(e){tpSt.msg='Generation failed: '+e.message;tpSt.cls='bad'}renderTopics()}
setTimeout(()=>{if(window.parent!==window)return;const seen=cpLS('mx0.connect');if(seen==='connector')cpClaude.mode='connector';cpClaudeBtn();
 if(location.hash==='#connect'){cpClaudeOpen('how');return}if(new URLSearchParams(location.search).get('connect')==='0')return;if(!seen)cpClaudeOpen('ask')},400);
// ======================================================================================================================
// Send to Claude Code: the current route as a ready-to-run project folder (zip): CLAUDE.md (task, route, agents and
// roles, servers, acceptance criteria), one subagent per chosen agent (.claude/agents), .mcp.json (the Maxey0 Context
// Plane server; the route's servers are listed for you to connect — the map holds no addresses for them), route.json
// (route + drift record), README.md. A one-line command to start Claude Code in it is copied.
const CP_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function cpZip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 for(const[name,text]of files){const nb=enc.encode(name),db=enc.encode(text);let c=0xFFFFFFFF;for(const x of db)c=CP_CRC[(c^x)&255]^(c>>>8);c=(c^0xFFFFFFFF)>>>0;
  const h=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0)]);
  parts.push(h,nb,db);cen.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
  off+=h.length+nb.length+db.length}
 const csz=cen.reduce((s,x)=>s+x.length,0),end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csz),...u32(off),...u16(0)]);
 return new Blob([...parts,...cen,end],{type:'application/zip'})}
const cpSlug=t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'task';
function cpHarness(t){if(!t||!t.matched)return null;const g=__CP.graph,skills=t.skills.slice(0,3).map(x=>x[0]).filter(id=>N[id]);if(!skills.length)return null;
 const pathOf=sid=>{const s=N[sid],c=N['c:'+s.concept],tp=N[cTopic[s.concept]],d=tp&&N['d:'+__CP.tDom[tp.id.slice(2)]];return{domain:d?d.label:'',topic:tp?tp.label:'',concept:c?c.label:'',skill:s.label,skill_id:sid.slice(2),desc:s.desc||''}};
 const agents={},servers={};for(const sid of skills)for(const e of E)if(e.kind==='agent'&&e.a===sid&&N[e.b]){const a=agents[e.b]=agents[e.b]||{key:e.b.slice(2),name:N[e.b].label,roles:[]};a.roles.push({role:e.role,skill:N[sid].label});
  for(const gt of G)if(gt.a===e.b&&N[gt.b]){const m=g.mcp[+gt.b.slice(2)];if(m){const sv=servers[m.id]=servers[m.id]||{name:m.name,uuid:m.uuid||null,source:m.source||'',tools:m.tools||[],desc:m.desc||'',held_by:[]};if(!sv.held_by.includes(a.name))sv.held_by.push(a.name)}}}
 const routes=skills.map(pathOf),signal=cpSignal&&cpSignal.dense>0?'TF-IDF + '+cpSignal.model+' (β '+cpSignal.dense+')':'TF-IDF',origin=__CP.api||location.origin,sv=Object.values(servers);
 const L=['# '+t.text,'','Built from a Maxey0 Context Plane route ('+(t.lens?'observer lens':'flat ranking')+', '+signal+'). The route is a candidate, not an authorization: check it before acting.','','## Task',t.text,'','## Route'];
 routes.forEach((r,i)=>L.push((i+1)+'. '+[r.domain,r.topic,r.concept,r.skill].filter(Boolean).join(' → '),'   '+r.desc));
 L.push('','## Agents (subagents in .claude/agents)');for(const a of Object.values(agents))L.push('- **'+a.name+'** ('+a.key+'): '+a.roles.map(r=>r.role+' for '+r.skill).join('; '));
 L.push('','How to work: the **primary** agent of each skill does the work; the **checker** reviews it against the acceptance criteria below before anything is reported done; **support** agents help on request.','',
  '## MCP servers on this route','These are directory listings from the map, not installed connectors. Connect the ones you need yourself (Claude Code: `claude mcp add`), following each server’s own instructions.');
 if(!sv.length)L.push('- none on this route');sv.forEach(s=>L.push('- **'+s.name+'**'+(s.uuid?' (directory id '+s.uuid+')':'')+' — held by '+s.held_by.join(', ')+'. '+s.desc+(s.tools.length?' Tools: '+s.tools.slice(0,10).join(', '):'')));
 L.push('','## Acceptance criteria');routes.forEach(r=>L.push('- '+r.skill+': '+(r.desc||'does what the task asks')));
 L.push('- the result is reviewed by the checker agent and the review is reported','- anything not done, assumed or untested is stated','',
  '## Retrieval sources','If retrieval (RAG) servers are connected, scope each search to this route: the topic and concept names above are the search scopes, the skill descriptions the query intent.','',
  '## Context Plane','The Maxey0 Context Plane server is in .mcp.json (read-only): use `route_task`, `get_skill` and `get_agent` to look up more of the map. Source: '+origin);
 const files=[['CLAUDE.md',L.join('\n')+'\n'],['.mcp.json',JSON.stringify({mcpServers:{'maxey0-context-plane':{type:'http',url:origin+'/mcp'}}},null,2)+'\n']];
 for(const a of Object.values(agents)){const sl=cpSlug(a.name),prim=a.roles.some(r=>r.role==='primary'),chk=a.roles.some(r=>r.role==='checker');
  files.push(['.claude/agents/'+sl+'.md','---\nname: '+sl+'\ndescription: '+(a.name+' ('+a.key+'), '+a.roles.map(r=>r.role+' for '+r.skill).join('; ')).replace(/[:\n]/g,' ')+'. Use for this route’s '+(prim?'work':chk?'review':'support')+'.\n---\n\nYou are '+a.name+', '+a.roles.map(r=>'the '+r.role+' agent for the skill "'+r.skill+'"').join(' and ')+' on the route in CLAUDE.md.\n'+
   (prim?'\nDo the work for your skill. Hand the result to the checker with what you did and what you did not do.\n':'')+(chk?'\nCheck the result against the acceptance criteria in CLAUDE.md. Report each criterion as met, not met or not checked, with evidence. Do not fix the work yourself; send it back.\n':'')+
   (!prim&&!chk?'\nHelp the primary agent on request, within your skill.\n':'')])}
 const route={schema:'maxey0.harness/1',task:t.text,router:t.lens?'lens':'flat',signal,digest:__CP.digest,source:origin,route:routes,agents:Object.values(agents),servers:sv};
 if(t.lens){try{route.drift=cpDriftScw()}catch(e){}}
 const cmd='claude "Read CLAUDE.md and build the task it describes, using the subagents in .claude/agents."';
 files.push(['route.json',JSON.stringify(route,null,1)+'\n'],['README.md','# Maxey0 harness: '+t.text+'\n\n1. Unzip this folder and open a terminal in it.\n2. Run:\n\n       '+cmd+'\n\nCreated by the Maxey0 Context Plane ('+origin+'/app).\n']);
 return{name:'maxey0-harness-'+cpSlug(t.text),files,cmd}}
function cpSendCode(){const h=cpHarness(typeof task!=='undefined'?task:null),m=$('cpCCMsg');if(!h){if(m)m.textContent='Route a task first: the harness is built from its route.';return null}
 const blob=cpZip(h.files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=h.name+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
 cpCopy(h.cmd)
 if(m)m.textContent='Downloaded '+h.name+'.zip ('+h.files.length+' files). Unzip it, open a terminal in the folder and run (copied): '+h.cmd;return h}
