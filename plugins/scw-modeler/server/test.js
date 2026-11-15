'use strict';
// Runs the bundled server over stdio and checks every tool, plus the model rules.
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const M=require('./model.js'),EX=require('../examples/milky-way.json'),path=require('path'),fs=require('fs');
let pass=0,fail=0;const ok=(name,c,d)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+name+(d?': '+d:''))};
const clone=o=>JSON.parse(JSON.stringify(o));
(async()=>{
 // model rules (unit)
 ok('Example model validates',M.validate(EX).ok,M.validate(EX).errors.join('; '));
 let b=clone(EX);b.scws[1].parent=undefined;b.scws[1].relation=undefined;ok('Two roots rejected',!M.validate(b).ok);
 b=clone(EX);b.scws[2].relation='orbits';ok('Unknown relation rejected',!M.validate(b).ok);
 b=clone(EX);b.scws[3].parent='SCW-Nope';ok('Unknown parent rejected',!M.validate(b).ok);
 b=clone(EX);b.scws.push({id:'SCW-A',name:'A',role:'a',parent:'SCW-B',relation:'contains'},{id:'SCW-B',name:'B',role:'b',parent:'SCW-A',relation:'contains'});ok('Cycle rejected',!M.validate(b).ok);
 b=clone(EX);b.scws[0].laws[0].state='maybe';ok('Bad law state rejected',!M.validate(b).ok);
 b=clone(EX);b.scws[3].data[0].source='';ok('Data row without a source rejected',!M.validate(b).ok);
 b=clone(EX);b.scws[1].id='SCW-MW';ok('Duplicate id rejected',!M.validate(b).ok);
 const want=['SCW-MW    Milky Way       container; holds the ordinary (baryonic) field itself',' ├─ superposes ──── SCW-SgrA  Sagittarius A*  (field component, horizon)',' ├─ superposes ──── SCW-DM    Dark matter     (field component, inferred)',' └─ contains ────── SCW-Sun   the Sun         (bound child)'];
 ok('Text tree matches the reference layout',M.tree(EX)===want.join('\n'),'\n'+M.tree(EX));
 const t=M.toText(EX);for(const h of ['### What each SCW holds','### How they interact','### Share of the pull at the Sun','### Who leads, by radius','### Data and sources','### Context Plane','### The one-line answer'])ok('Text has section '+h.slice(4),t.includes(h));
 // server over stdio (bundle)
 const c=new Client({name:'test',version:'1'});await c.connect(new StdioClientTransport({command:'node',args:[path.join(__dirname,'server.bundle.js')]}));
 const tools=(await c.listTools()).tools.map(x=>x.name).sort();ok('5 tools listed',tools.join()==='render_scw_model,scw_model_html,scw_model_text,scw_relations,validate_scw_model',tools.join(', '));
 const rel=JSON.parse((await c.callTool({name:'scw_relations',arguments:{}})).content[0].text);ok('7 relation types',Object.keys(rel.relations).length===7);
 const v=JSON.parse((await c.callTool({name:'validate_scw_model',arguments:{model:EX}})).content[0].text);ok('validate_scw_model ok',v.ok);
 const bad=await c.callTool({name:'scw_model_text',arguments:{model:{title:'x',scws:[]}}});ok('Invalid model returns an error',bad.isError===true);
 const tx=(await c.callTool({name:'scw_model_text',arguments:{model:EX}})).content[0].text;ok('scw_model_text equals the core renderer',tx===t);
 const rt=(await c.listTools()).tools.find(x=>x.name==='render_scw_model');ok('render_scw_model declares its MCP App view',rt._meta&&rt._meta.ui&&rt._meta.ui.resourceUri==='ui://scw-modeler/app.html');
 const r=await c.callTool({name:'render_scw_model',arguments:{model:EX}});ok('render returns the model and text as structured content',r.structuredContent&&r.structuredContent.model.scws.length===4&&r.structuredContent.text===t);
 const res=(await c.readResource({uri:'ui://scw-modeler/app.html'})).contents[0];ok('App resource is self-contained mcp-app HTML',res.mimeType==='text/html;profile=mcp-app'&&!/src="http|href="http/.test(res.text),Math.round(res.text.length/1024)+' KB');
 ok('App carries the Human0 logo, byte-identical',res.text.includes(fs.readFileSync(path.join(__dirname,'..','docs','human0-logo.png')).toString('base64')));
 const html=(await c.callTool({name:'scw_model_html',arguments:{model:EX}})).content[0].text;fs.writeFileSync('/tmp/scw-modeler-example.html',html);ok('Standalone HTML embeds the model',html.includes('window.__SCW_MODEL__=')&&html.includes('SCW-SgrA'));
 await c.close();console.log((fail?'FAILED ':'ALL PASSED ')+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});
