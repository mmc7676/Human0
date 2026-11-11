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
 if(!cpHarness._inCost){cpHarness._inCost=1;try{const c=cpCost(t);if(c){files.push(['cost.json',JSON.stringify(c,null,1)+'\n']);files[0][1]+='\n## Estimated cost (before running)\nAbout '+cpFmt(c.total.in)+' input + '+cpFmt(c.total.out)+' output tokens, ≈ '+cpUsd(c.total.usd)+' on '+CP_PRICES[c.model].name+' at list prices with no caching. Per agent, skill and MCP server: cost.json. Assumptions are in cost.json → params.\n'}}finally{cpHarness._inCost=0}}
 files.push(['route.json',JSON.stringify(route,null,1)+'\n'],['README.md','# Maxey0 harness: '+t.text+'\n\n1. Unzip this folder and open a terminal in it.\n2. Run:\n\n       '+cmd+'\n\nCreated by the Maxey0 Context Plane ('+origin+'/app).\n']);
 return{name:'maxey0-harness-'+cpSlug(t.text),files,cmd}}
function cpSendCode(){const h=cpHarness(typeof task!=='undefined'?task:null),m=$('cpCCMsg');if(!h){if(m)m.textContent='Route a task first: the harness is built from its route.';return null}
 const blob=cpZip(h.files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=h.name+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
 cpCopy(h.cmd)
 if(m)m.textContent='Downloaded '+h.name+'.zip ('+h.files.length+' files). Unzip it, open a terminal in the folder and run (copied): '+h.cmd;return h}

// ---- Cost estimate for a route's harness (before anything runs) -------------------------------------------------------
// What is fixed and what depends on the task:
//  skill  — FIXED: the tokens of its spec in the harness (route line, description, acceptance line), carried in every turn.
//  agent  — its own prompt file (fixed) + the shared CLAUDE.md + the tool definitions of the servers it holds, re-sent each
//           turn; turns depend on role and on loops (primary: work turns × loops; checker: review turns × loops; support:
//           only on request, 0 by default). Conversation history grows each turn (earlier outputs and tool results).
//  MCP    — DYNAMIC by task: tool definitions (tools × tokens per tool) for every holder, plus expected calls = the server's
//           tools whose names share a word with the task (at least 1), each returning a result of a set size.
// Tokens are counted from the real harness text (about 4 characters per token). Prices are Anthropic's list prices
// (platform.claude.com/docs/en/about-claude/pricing, checked 2026-11-10), with no prompt caching: an upper estimate.
const CP_PRICES={'claude-opus-5-5':{name:'Opus 5.5',in:4,out:20},'claude-sonnet-5-5':{name:'Sonnet 5.5',in:2,out:10},'claude-haiku-5-5':{name:'Haiku 5.5',in:0.10,out:0.50,inLong:0.50,outLong:2.50},'claude-fable-5-1':{name:'Fable 5.1',in:10,out:50}};
const cpCostP={model:'claude-sonnet-5-5',workTurns:4,reviewTurns:1,loops:1,outWork:1500,outReview:500,tokPerTool:120,callResult:1000};
let cpCostOn=true;
const cpTok=s=>Math.ceil((s||'').length/4);
function cpPrice(model,inTok,outTok,perTurnIn){const p=CP_PRICES[model]||CP_PRICES['claude-sonnet-5-5'],long=p.inLong&&perTurnIn>100000;
 return (inTok*(long?p.inLong:p.in)+outTok*(long?p.outLong:p.out))/1e6}
function cpCost(t,P){P=Object.assign({},cpCostP,P||{});const h=cpHarness(t);if(!h)return null;const files=Object.fromEntries(h.files),C=cpTok(files['CLAUDE.md']);
 const skills=t.skills.slice(0,3).map(x=>x[0]).filter(id=>N[id]),words=new Set((t.text||'').toLowerCase().match(/[a-z]{3,}/g)||[]);
 const out={params:P,model:CP_PRICES[P.model]?P.model:'claude-sonnet-5-5',shared:{claude_md:C},skills:{},agents:{},mcp:{},total:{in:0,out:0,usd:0}};
 for(const sid of skills){const s=N[sid];out.skills[sid]={label:s.label,fixed:cpTok(s.label+' '+(s.desc||''))*2+12}}
 const ag={};for(const sid of skills)for(const e of E)if(e.kind==='agent'&&e.a===sid&&N[e.b]){const a=ag[e.b]=ag[e.b]||{roles:new Set(),servers:new Set()};a.roles.add(e.role);
  for(const gt of G)if(gt.a===e.b&&N[gt.b])a.servers.add(gt.b)}
 for(const mid of new Set(Object.values(ag).flatMap(a=>[...a.servers]))){const m=__CP.graph.mcp[+mid.slice(2)]||{},tools=m.tools||[];
  const hit=tools.filter(x=>x.toLowerCase().split(/[^a-z]+/).some(w=>w.length>2&&words.has(w)));
  out.mcp[mid]={label:m.name||N[mid].label,tools:tools.length,defs:tools.length*P.tokPerTool,calls:Math.max(1,hit.length),called:hit.slice(0,6),result:Math.max(1,hit.length)*P.callResult,holders:0}}
 for(const [id,a] of Object.entries(ag)){const f=h.files.find(x=>x[0].startsWith('.claude/agents/')&&x[1].includes('('+id.slice(2)+')')),prompt=cpTok(f?f[1]:'');
  const prim=a.roles.has('primary'),chk=a.roles.has('checker'),T=(prim?P.workTurns:0)+(chk?P.reviewTurns:0),loopT=T*P.loops,o=prim?P.outWork:P.outReview;
  let defs=0,res=0;for(const mid of a.servers){const m=out.mcp[mid];defs+=m.defs;m.holders++;if(prim){res+=m.result}}
  const skillCtx=skills.reduce((s,k)=>s+out.skills[k].fixed,0),base=C+prompt+defs+skillCtx;
  const inTok=loopT?loopT*base+o*loopT*(loopT-1)/2+res*Math.max(1,loopT-1)/2*1:0,outTok=loopT*o;
  const usd=cpPrice(out.model,inTok,outTok,base+o*loopT+res);
  out.agents[id]={label:N[id].label,roles:[...a.roles],turns:loopT,prompt,base,in:Math.round(inTok),out:outTok,usd};
  out.total.in+=Math.round(inTok);out.total.out+=outTok;out.total.usd+=usd}
 for(const m of Object.values(out.mcp))m.usd=cpPrice(out.model,m.defs*Math.max(1,m.holders)*P.workTurns*P.loops+m.result,0,0);
 return out}
const cpFmt=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+'k':String(Math.round(n));
const cpUsd=x=>x<0.01?'<$0.01':'$'+x.toFixed(x<1?2:2);
let cpCostCache=null;
function cpCostNow(){const t=typeof task!=='undefined'?task:null;if(!t||!t.matched)return null;const k=t.text+'|'+t.skills.slice(0,3).map(x=>x[0]).join(',')+'|'+JSON.stringify(cpCostP);
 if(!cpCostCache||cpCostCache.k!==k)cpCostCache={k,v:cpCost(t)};return cpCostCache.v}
// draw: a small label on an orbit just outside each routed skill, agent and MCP node
function cpDrawCost(w,h){cpCostOut();if(!cpCostOn)return;const c=cpCostNow();if(!c)return;cx.save();cx.font='600 10px system-ui';cx.textBaseline='middle';
 const tag=(id,txt,col,ang)=>{const n=N[id];if(!n||!vis[n.kind])return;const o=project(n,w,h),r=(typeof cpNodeR==='function'?cpNodeR(n.kind,1):6)+7,x=o.sx+Math.cos(ang)*r,y=o.sy+Math.sin(ang)*r;
  const tw=cx.measureText(txt).width;cx.strokeStyle=col;cx.lineWidth=1;cx.setLineDash([2,2]);cx.beginPath();cx.arc(o.sx,o.sy,r-3,0,6.2832);cx.stroke();cx.setLineDash([]);
  cx.fillStyle='rgba(7,19,33,.88)';cx.fillRect(x-2,y-7,tw+6,14);cx.fillStyle=col;cx.fillText(txt,x+1,y)};
 let i=0;const A=()=>-0.6+(i++%5)*1.25;
 for(const [id,s] of Object.entries(c.skills))tag(id,cpFmt(s.fixed)+' tok · fixed','#a5f3fc',A());
 for(const [id,a] of Object.entries(c.agents))tag(id,a.turns?cpFmt(a.in+a.out)+' tok · '+cpUsd(a.usd)+(c.params.loops>1?' · '+c.params.loops+' loops':''):'on request','#fdba74',A());
 for(const [id,m] of Object.entries(c.mcp))tag(id,(m.tools?'':'tools not listed · ')+'~'+m.calls+' call'+(m.calls>1?'s':'')+' · '+cpFmt(m.defs+m.result)+' tok','#fde68a',A());
 cx.restore()}
function cpCostOut(){const el=$('cpCost');if(!el)return;const c=cpCostNow();
 if(!c){el.textContent='Cost estimate: route a task to see what its harness would cost.';return}
 const p=CP_PRICES[c.model];el.textContent='Estimated harness cost ('+p.name+', no caching): '+cpFmt(c.total.in)+' input + '+cpFmt(c.total.out)+' output tokens ≈ '+cpUsd(c.total.usd)+' · '+Object.keys(c.agents).length+' agents, '+Object.keys(c.mcp).length+' MCP servers, '+Object.values(c.mcp).reduce((s,m)=>s+m.calls,0)+' expected tool calls.'}

// ---- Coverage and "Fill the gap" ----------------------------------------------------------------------------------------
// After a route: which words of the task the chosen path explains, which it does not, and for each uncovered phrase where
// the hierarchy breaks (no fitting topic → propose a new topic under the best domain; a topic fits but no concept →
// propose a new concept under that topic). Pure TF-IDF over the map: no model and no network.
const CP_GAP_VERBS=new Set('turn make build create add get set run put take give help want need like into onto about from that this then than which what when where how why who our your their some more most very just also only into out off over under between through within without track tracks keep'.split(' '));
const CP_GAP_TOPIC=0.2,CP_GAP_ELSE=0.2;
function cpPathText(t){const ids=new Set();for(const [sid] of (t.skills||[]).slice(0,3)){const s=N[sid];if(!s)continue;ids.add(sid);const c='c:'+s.concept;ids.add(c);const tp=cTopic[s.concept];if(tp){ids.add(tp);const d=__CP.tDom[tp.slice(2)];if(d)ids.add('d:'+d)}}
 const g=__CP.graph,txt=[];for(const id of ids){const n=N[id];if(!n)continue;txt.push(n.label);const k=id.slice(2),o=id[0]==='s'?g.skills.find(x=>x.id===k):id[0]==='c'?g.concepts.find(x=>x.id===k):id[0]==='t'?g.topics.find(x=>x.id===k):null;if(o&&o.desc)txt.push(o.desc)}
 return txt.join(' ')}
function cpGap(t){if(!t||!t.text)return null;const words=(t.text.match(/[A-Za-z0-9][A-Za-z0-9+#.-]*/g)||[]);
 const pathTok=new Set(__CP.tokens(t.matched?cpPathText(t):'')),parts=[];
 words.forEach((w,wi)=>{const tk=__CP.tokens(w)[0];if(!tk||CP_GAP_VERBS.has(tk))return;parts.push({word:w,wi,tok:tk,known:__CP.inVocab(tk),covered:pathTok.has(tk)})});
 const best=(L,lv)=>{const l=L.chain.find(x=>x.level===lv);return l&&l.selected[0]?{id:l.selected[0].app,flat:l.selected[0].drift.flat}:null},lab=x=>x&&N[x.id]?N[x.id].label:null;
 const covered=parts.filter(p=>p.covered),miss=parts.filter(p=>!p.covered),elsewhere=[],gapIdx=[];
 // an uncovered word the map knows well (a concept fits it) is "in the map, not on this route"; the rest is the gap
 for(const p of miss){if(p.known){const c=best(__CP.lens(p.word,[]),'concept');if(c&&c.flat>=CP_GAP_ELSE){elsewhere.push({word:p.word,concept:lab(c),score:+c.flat.toFixed(3)});continue}}gapIdx.push(parts.indexOf(p))}
 const out={task:t.text,covered:covered.map(p=>p.word),uncovered:miss.map(p=>p.word),unknown:miss.filter(p=>!p.known).map(p=>p.word),elsewhere,gap:null};
 if(!gapIdx.length)return out;
 // the gap phrase: the gap words plus the content word right after each (or before, at the end), in task order: "android app"
 const take=new Set(),adj=(i,j)=>j>=0&&j<parts.length&&Math.abs(parts[j].wi-parts[i].wi)===1;for(const i of gapIdx){take.add(i);if(adj(i,i+1))take.add(i+1);else if(adj(i,i-1))take.add(i-1)}
 const phrase=[...take].sort((x,y)=>x-y).map(i=>parts[i].word).join(' '),L=__CP.lens(phrase,[]);
 const d=best(L,'domain'),tp=best(L,'topic'),c=best(L,'concept');
 let dom=d&&d.id;if(!dom&&tp)dom='d:'+__CP.tDom[tp.id.slice(2)];if(!dom){const sd=__CP.suggestDomain(phrase);if(sd)dom='d:'+sd.domain}
 const level=!tp||tp.flat<CP_GAP_TOPIC?'topic':'concept';
 out.gap={phrase,words:gapIdx.map(i=>parts[i].word),level,domain:dom?{id:dom,label:lab({id:dom})}:null,topic:tp?{id:tp.id,label:lab(tp),score:+tp.flat.toFixed(3)}:null,concept:c?{id:c.id,label:lab(c),score:+c.flat.toFixed(3)}:null};
 return out}
let cpGapState=null,cpGapNote='';
function cpTitle(s){return s.replace(/\b[a-z]/g,m=>m.toUpperCase())}
function cpGapReq(){const g=cpGapState&&cpGapState.gap;if(!g||!g.level)return null;const task=cpGapState.task;
 const head=g.level==='topic'?genRequest(cpTitle(g.phrase),''):genRequest('',cpTitle(g.phrase));
 const tail=g.level==='topic'
  ?['','FILL THE GAP: the task "'+task+'" has no route for "'+g.phrase+'".'+(g.domain?' Place the new topic in the domain "'+g.domain.label+'".':''),
    'Name the topic after the general area "'+g.phrase+'" belongs to (broader than the task words, e.g. a field or product category), change topic.id and the pack id to match, and include a concept that covers "'+g.phrase+'" and skills that would do the uncovered part of the task. Use the task’s own words in skill descriptions.']
  :['','FILL THE GAP: the task "'+task+'" has no concept for "'+g.phrase+'". Add it under the existing topic id "'+g.topic.id.slice(2)+'" ('+g.topic.label+'): set topic.id to exactly that id and topic.label to "'+g.topic.label+'".',
    'Include skills that would do the uncovered part of the task, in the task’s own words.'];
 return head+'\n'+tail.join('\n')}
async function cpGapFill(){const req=cpGapReq(),m=$('cpGapMsg');if(!req)return;tpSt.req=req;tpSt.topic=cpTitle(cpGapState.gap.phrase);tpSt.concept='';
 const tb=$('topicsBox');if(tb){tb.open=true;renderTopics()}
 if(cpClaude.mode==='api'&&cpClaude.key){if(m)m.textContent='Generating the missing '+cpGapState.gap.level+' with '+cpClaude.model+'…';await cpGenerateApi(req);
  if(/^\s*\{/.test(tpSt.txt||''))return cpGapAddRoute();if(m)m.textContent=tpSt.msg;return}
 const how=cpAskHost(req);
 if(m)m.textContent=how==='sent'?'Sent to Claude. When it returns the pack JSON, paste it into the pack box (Topics panel) and press “Add pack and route again”.':
  'Request copied. Paste it into Claude, paste the JSON it returns into the pack box (Topics panel), then press “Add pack and route again”. Or enter an API key under Connect to Claude to do this in one step.'}
function cpGapAddRoute(){const m=$('cpGapMsg'),st=cpGapState;let p;try{p=JSON.parse(tpSt.txt)}catch(e){if(m)m.textContent='The pack box has no valid JSON yet: '+e.message;return{ok:false}}
 const r=addPack(p);if(!r.ok){if(m)m.textContent=r.problems.length+' problem(s) in the pack: '+r.problems.slice(0,4).join(' | ');return r}
 if(r.topicIsNew&&st&&st.gap&&st.gap.domain){const id=p.topic.id;__CP.tDom[id]=st.gap.domain.id.slice(2);if(typeof TOPIC_META!=='undefined'&&TOPIC_META[id])TOPIC_META[id].domain=st.gap.domain.id.slice(2);refreshGraph()}
 tpSt.msg='ADDED · '+r.topic;tpSt.cls='good';renderTopics();
 cpGapNote='Added “'+r.topic+'” to this graph and routed the task again.';const text=st?st.task:(typeof task!=='undefined'&&task?task.text:'');if(text){$('taskIn').value=text;submitTask(text)}
 const g2=cpGapState,m2=$('cpGapMsg');if(m2&&!g2.gap)m2.textContent='';if(m2&&g2.gap)m2.textContent='Added “'+r.topic+'” and routed again. '+(g2&&g2.gap?'Still not covered: '+g2.gap.words.join(', ')+'.':'Nothing is missing from the map for this task now.');return r}
function cpGapRender(){const b=$('exec');if(!b||b.style.display==='none')return;const t=typeof task!=='undefined'?task:null;if(!t)return;
 const g=cpGapState=cpGap(t);if(!g)return;const box=hh('div','cpgap',null,{id:'cpGap'});
 box.append(hh('strong','','Coverage'));
 box.append(hh('p','','Covered by this route: '+(g.covered.length?g.covered.join(', '):'nothing')+'.'));
 if(!g.gap){if(cpGapNote){box.append(hh('p','good',cpGapNote));cpGapNote=''}box.append(hh('p','good',g.uncovered.length?'Nothing is missing from the map for this task.':'Every part of the task is covered.'));if(g.elsewhere.length)box.append(hh('p','','In the map but not on this route: '+g.elsewhere.map(e=>e.word+' → '+e.concept+' ('+e.score+')').join('; ')+'.'));b.append(box);return}
 if(g.elsewhere.length)box.append(hh('p','','In the map but not on this route: '+g.elsewhere.map(e=>e.word+' → '+e.concept+' ('+e.score+')').join('; ')+'. Try the Observer lens or say more about that part.'));
 const gw=g.gap?g.gap.words:[];if(gw.length)box.append(hh('p','','Not covered: '+gw.join(', ')+(g.unknown.length?' (not in the map at all: '+g.unknown.join(', ')+')':'')+'.'));
 const G=g.gap;if(G&&G.level){
  box.append(hh('p','',G.level==='topic'
   ?'Where it breaks: no topic fits “'+G.phrase+'”'+(G.topic?' (best: '+G.topic.label+', '+G.topic.score+')':'')+'. Proposal: a new topic'+(G.domain?' in '+G.domain.label:'')+', with its concepts, skills and agents.'
   :'Where it breaks: the topic '+G.topic.label+' fits ('+G.topic.score+') but no concept covers “'+G.phrase+'”'+(G.concept?' (best: '+G.concept.label+', '+G.concept.score+')':'')+'. Proposal: a new concept under '+G.topic.label+', with skills and agents.'));
  const r=hh('div','row');const f=hh('button','scwb','Fill the gap',{type:'button',id:'cpGapFill',title:'Generate only the missing levels, add them to this graph and route the task again'});f.onclick=()=>cpGapFill();
  const a=hh('button','','Add pack and route again',{type:'button',id:'cpGapAdd',title:'Add the pack JSON from the Topics panel and route the task again'});a.onclick=()=>cpGapAddRoute();r.append(f,a);box.append(r)}
 box.append(hh('small','',cpGapNote||null,{id:'cpGapMsg',role:'status'}));cpGapNote='';b.append(box)}
{const _re=renderExec;renderExec=function(){const r=_re.apply(this,arguments);try{cpGapRender()}catch(e){}return r}}

// ---- Copy buttons on every output field ---------------------------------------------------------------------------------
const CP_COPY_SEL='#topicsBox textarea, #exec, #detail, #cpCost, #taskMsg, #lensOut, #tpMsg, #cpCCMsg, #cpEmb, #cpGapMsg';
function cpCopyText(el){if(el.tagName==='TEXTAREA'||el.tagName==='INPUT')return el.value;const c=el.cloneNode(true);c.querySelectorAll('.cpcopy,button,select').forEach(x=>x.remove());return c.innerText||c.textContent||''}
function cpCopyDecorate(){for(const el of document.querySelectorAll(CP_COPY_SEL)){if(el.hidden||el.style.display==='none')continue;
  const isField=el.tagName==='TEXTAREA'||['tpMsg','taskMsg','cpCCMsg','cpGapMsg','cpCost'].includes(el.id),has=isField?(el.nextElementSibling&&el.nextElementSibling.classList.contains('cpcopy')):el.querySelector(':scope > .cpcopy');if(has)continue;
  if(el.tagName!=='TEXTAREA'&&!(el.textContent||'').trim())continue;
  const b=hh('button','cpcopy','Copy',{type:'button',title:'Copy this text','aria-label':'Copy this text'});
  b.onclick=e=>{e.stopPropagation();cpCopy(cpCopyText(el));b.textContent='Copied';setTimeout(()=>{b.textContent='Copy'},1200)};
  if(isField)el.after(b);else{if(getComputedStyle(el).position==='static')el.style.position='relative';el.prepend(b)}}}
{let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;cpCopyDecorate()})}).observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(cpCopyDecorate,500)}
// generated packs join the routing index while they are in the graph
{const _a=addPack;addPack=function(p){const r=_a.apply(this,arguments);if(r&&r.ok&&r.added)try{__CP.indexPack(p)}catch(e){}return r}}
{const _r=removePack;removePack=function(id){try{__CP.unindexPack(id)}catch(e){}return _r.apply(this,arguments)}}
for(const id of Object.keys(packs))try{__CP.indexPack(packs[id].pack)}catch(e){}
