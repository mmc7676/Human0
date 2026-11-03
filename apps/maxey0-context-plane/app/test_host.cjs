// MCP Apps host simulation: a parent page embeds the app in an iframe and speaks the 2026-01-26 protocol
// (answers ui/initialize, sends tool-input, records size-changed / ui/message / display-mode requests).
// Needs the server running: (cd ../server && npx wrangler dev --port 8794)   then: node test_host.cjs
const { chromium } = require("playwright");
const API = process.env.API || "http://127.0.0.1:8794";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m) } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  // the host page: served from another origin than the app, like a real sandbox
  const hostHtml = `<!doctype html><body style="margin:0">
<iframe id="f" src="${API}/app" style="width:1300px;height:600px;border:0"></iframe>
<script>
window.log=[];const f=document.getElementById('f');
window.addEventListener('message',e=>{const m=e.data;if(!m||m.jsonrpc!=='2.0')return;log.push(m);
 const reply=r=>f.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:r},'*');
 if(m.method==='ui/initialize')reply({protocolVersion:'2026-01-26',hostInfo:{name:'test-host',version:'1'},hostCapabilities:{},hostContext:{displayMode:'inline',theme:'dark'}});
 if(m.method==='ui/notifications/initialized')f.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{task:'quantum entanglement of two qubits'}}},'*');
 if(m.method==='ui/notifications/size-changed')f.style.height=m.params.height+'px';
 if(m.method==='ui/message')reply({});
 if(m.method==='ui/request-display-mode')reply({mode:m.params.mode});
});
</script></body>`;
  const srv = require("http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end(hostHtml) }).listen(8799);
  await p.goto("http://localhost:8799/");
  const fr = await (await p.waitForSelector("#f")).contentFrame();
  await fr.waitForFunction(() => window.__l5 && window.__l5.nodes() > 0, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const log = await p.evaluate(() => window.log.map(m => m.method || ("reply:" + m.id)));
  ok(log[0] === "ui/initialize", "app opens with ui/initialize: " + log.slice(0, 4).join(","));
  const init = await p.evaluate(() => window.log.find(m => m.method === "ui/initialize").params);
  ok(init.protocolVersion === "2026-01-26" && init.appInfo && init.appCapabilities.availableDisplayModes.includes("fullscreen"), "ui/initialize params follow the spec");
  ok(log.includes("ui/notifications/initialized") && log.includes("ui/notifications/size-changed"), "initialized + size-changed sent");
  const h = await p.evaluate(() => document.getElementById("f").style.height);
  ok(h === "900px", "host resized the iframe to the requested height: " + h);
  const msg = await fr.evaluate(() => document.getElementById("taskMsg").textContent);
  ok(/Best route: Quantum Physics/.test(msg), "tool-input task is routed and highlighted in the app");
  ok(await fr.evaluate(() => window.__cpv.host().on && !document.getElementById("cpHostFs").hidden), "Full screen button shown inside the host");
  await fr.click("#cpHostFs"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.log.some(m => m.method === "ui/request-display-mode" && m.params.mode === "fullscreen")) && await fr.evaluate(() => window.__cpv.host().mode === "fullscreen"), "Full screen asks the host for fullscreen");
  await fr.evaluate(() => window.__cpv.ask("generate a topic for falconry"));
  await p.waitForTimeout(200);
  const um = await p.evaluate(() => window.log.find(m => m.method === "ui/message"));
  ok(um && um.params.role === "user" && Array.isArray(um.params.content) && um.params.content[0].text === "generate a topic for falconry", "Ask Claude sends ui/message to the conversation");
  ok(errs.length === 0, "page errors: " + errs.join(" | "));
  srv.close(); await b.close(); console.log(`# pass ${pass}\n# fail ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log("ERR", e.message); process.exit(1) });
