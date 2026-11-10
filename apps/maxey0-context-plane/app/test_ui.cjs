// Browser test for the Maxey0 Context Plane Graph UI.
// Needs the server running: (cd ../server && npx wrangler dev --port 8794)   then: node test_ui.cjs
// Uses Playwright's Chromium. All network except the local server is blocked.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const API = process.env.API || "http://127.0.0.1:8794";
const PAGE = "file://" + path.join(__dirname, "maxey0-context-plane-graph.html") + "?api=" + API;
const TASKS = ["orbital mechanics trajectory", "translate this contract into japanese", "tiered memory promotion policy",
  "build a marketing email campaign", "quantum entanglement of two qubits", "renaissance painting techniques", "dna transcription",
  "detect drift in agent runs", "kubernetes observability traces", "hello there friend", "IBS versus Crohn disease"];
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL", msg) } };

(async () => {
  const graph = await (await fetch(API + "/graph.json")).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route(/^https?:/, r => r.request().url().startsWith(API + "/") ? r.continue() : r.abort());
  await p.goto(PAGE, { waitUntil: "commit" });
  await p.waitForFunction(() => window.__l5 && window.__l5.nodes() > 0, null, { timeout: 60000 });
  await p.waitForTimeout(800);

  // 1. live load, counts, selectors, shell
  const r = await p.evaluate(() => {
    const sels = [...document.querySelectorAll("select")];
    const ts = sels.find(s => /All topics/.test(s.innerText)), cs = sels.find(s => /All concepts/.test(s.innerText));
    const fold = document.querySelector("#cs_app1 details.cpfold");
    return { intro: !!document.querySelector(".h0n"), shell: ["cs_app2","cs_app3","cs_app4","cs_apps"].filter(i => document.getElementById(i)).length + document.querySelectorAll(".toolbar,.statebar.main").length,
      fold: fold ? { open: fold.open, sticky: getComputedStyle(fold.querySelector(".statebar")).position === "sticky" } : null,
      oldBanner: !!document.getElementById("cpBanner"), headerH: document.querySelector("header").getBoundingClientRect().height, nodes: window.__l5.nodes(), agents: window.__l5.agents(),
      servers: window.__l5.servers(), gates: window.__l5.gates(), topicOpts: ts ? ts.options.length : -1, conceptOpts: cs ? cs.options.length : -1,
      logo: !!document.getElementById("logo"),
      sliders: ["k","t"].every(i => document.getElementById(i).closest(".row").offsetParent === null),
      title: document.title, header: document.querySelector("header .k").textContent, digest: window.__v01.graph() };
  });
  ok(!r.intro, "no intro notice after load");
  ok(r.shell === 0, "one app: no Human0 shell, toolbar, other apps or whole-app state bar (" + r.shell + " left)");
  ok(r.fold && !r.fold.open && !r.fold.sticky, "app state bar folded, closed, not sticky");
  ok(!r.oldBanner && r.headerH <= 100, "no full-width banner; header stays compact (" + Math.round(r.headerH) + "px)");
  ok(r.nodes === graph.domains.length + graph.topics.length + graph.concepts.length + graph.skills.length + graph.agents.length + graph.mcp.length, "node count");
  ok(r.agents === graph.agents.length && r.servers === graph.mcp.length && r.gates === graph.agent_mcp.length, "agents/servers/gates");
  ok(r.topicOpts === graph.topics.length + 1 && r.conceptOpts === graph.concepts.length + 1, "topic and concept selectors");
  ok(r.logo && r.sliders, "Human0 logo shown, retired sliders hidden");
  ok(/Maxey0 Context Plane Graph/.test(r.title) && /MAXEY0 CONTEXT PLANE GRAPH/.test(r.header), "names");
  ok(r.digest === graph.snapshot_digest, "graph digest");

  // 1b. label buttons: every kind turns off on a second click, and None/All reset that
  {
    const lb = await p.evaluate(() => { const out = {}; const c = id => document.getElementById(id).click();
      c('lOff');
      for (const [id, k] of [['lT','topic'],['lC','concept'],['lS','skill'],['lA','agent'],['lM','mcp']]) {
        c(id); const a = window.__cpv.labels(); c(id); const b = window.__cpv.labels();
        out[k] = a.on[k] && !a.off[k] && !b.on[k] && b.off[k] && document.getElementById(id).className === '';
      }
      c('lAll'); const x = window.__cpv.labels(); out.all = Object.values(x.on).every(Boolean) && !Object.values(x.off).some(Boolean);
      c('lOff'); const y = window.__cpv.labels(); out.none = !Object.values(y.on).some(Boolean) && !Object.values(y.off).some(Boolean) && y.strict;
      return out });
    ok(Object.values(lb).every(Boolean), "label toggles T C S A M, None, All: " + JSON.stringify(lb));
  }

  // 1c. shared embedding field: every app node has a location; the toggle places nodes there on every level
  {
    const f = await p.evaluate(() => { const v = window.__cpv, c = id => document.getElementById(id).click();
      const n = v.field().n; c('cpFieldBtn'); const on = v.field().on;
      const ids = ['s:dv-option-pricer', 'a:Maxey0', 't:quantum-physics'];
      const pos = ids.map(id => v.field().pos(id)); c('cpFieldBtn'); return { n, on, pos, off: !v.field().on } });
    const nApp = graph.domains.length + graph.topics.length + graph.concepts.length + graph.skills.length + graph.agents.length + graph.mcp.length;
    const fine = f.n === nApp && f.on && f.off && f.pos.every(q => q && isFinite(q.x) && isFinite(q.y));
    // each level is framed on its own centroid: the direction from the skill level's centroid is kept exactly
    const sk = graph.skills.map(s => graph.field.xy['s:' + s.id]), mx = sk.reduce((t, q) => t + q[0], 0) / sk.length, my = sk.reduce((t, q) => t + q[1], 0) / sk.length;
    const w0 = graph.field.xy['s:dv-option-pricer'], want = [w0[0] - mx, w0[1] - my], got = f.pos[0], sc = Math.hypot(got.x, got.y) / Math.hypot(want[0], want[1]);
    ok(fine && sc > 0 && Math.abs(Math.atan2(got.y, got.x) - Math.atan2(want[1], want[0])) < 1e-6, "embedding field: " + f.n + " located nodes, placement follows field coordinates");
  }

  // 1d. domains: the Domain filter lists every domain and narrows topics and concepts to it
  {
    const r = await p.evaluate(() => { const bd = document.getElementById('bfDomain'), bt = document.getElementById('bfTopic');
      const doms = [...bd.options].map(o => o.value).filter(Boolean);
      bd.value = 'business-finance'; bd.dispatchEvent(new Event('change'));
      const tops = [...bt.options].map(o => o.value).filter(Boolean);
      const out = { doms: doms.length, tops: tops.length };
      bd.value = ''; bd.dispatchEvent(new Event('change')); out.all = [...bt.options].filter(o => o.value).length; return { ...out, tops };
    });
    const want = graph.topics.filter(t => t.domain === 'business-finance').map(t => t.id).sort();
    ok(r.doms === graph.domains.length && JSON.stringify(r.tops.slice().sort()) === JSON.stringify(want) && r.all === graph.topics.length,
      "domain filter: " + r.doms + " domains, " + r.tops.length + " finance topics, " + r.all + " topics when cleared");
  }

  // 1e. observer lens in the app: the same chain as the server's route_task mode "lens" (shared fixture)
  {
    const fx = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../server/test/lens.fixture.json'), 'utf8'));
    const got = await p.evaluate((fx) => fx.map(f => { const r = window.__cpv.lens(f.task); return { levels: r.chain.slice(0, 3).map(l => l.selected.map(s => s.id)), skills: r.skills } }), fx);
    const same = fx.every((f, i) => JSON.stringify(f.levels) === JSON.stringify(got[i].levels) && JSON.stringify(f.skills) === JSON.stringify(got[i].skills));
    ok(same, "app lens = server lens on " + fx.length + " tasks");
    // a lens route from the task panel: chain highlighted, readout shown, observer moves into the graph
    const r = await p.evaluate(() => { const c = id => document.getElementById(id);
      c('taskMode').value = 'lens'; c('taskIn').value = 'translate a paragraph into French'; c('taskGo').click();
      if (!window.__cpv.field().on) c('cpFieldBtn').click();
      const o = window.__cpv.observer(), txt = c('lensOut').textContent, ts = window.__v3.taskSet();
      c('taskClr').click(); c('taskMode').value = 'flat'; const o2 = window.__cpv.observer(); c('cpFieldBtn').click();
      return { o, txt, ts: ts.length, hidden: c('lensOut').hidden, o2 } });
    ok(/routed task \(lens\)/.test(r.o.label) && r.o.n > 3000 && /Topics \(λ 0\)/.test(r.txt) && /Skills \(λ /.test(r.txt) && r.ts >= 9 && r.hidden && r.o2.label === 'above the graph',
      "lens route in the app: " + JSON.stringify({ label: r.o.label.slice(0, 40), n: r.o.n, ts: r.ts }));
    // choosing a topic moves the observer into the topic plane: its own concepts sit nearest the centre of the concept plane
    const t = await p.evaluate(() => { const bt = document.getElementById('bfTopic'); const tid = 'quantum-physics';
      bt.value = tid; bt.dispatchEvent(new Event('change')); if (!window.__cpv.field().on) document.getElementById('cpFieldBtn').click();
      const v = window.__cpv, o = v.observer(), c0 = v.fieldRaw('t:' + tid), D = id => { const q = v.lensPos(id); return Math.hypot(q[0] - c0[0], q[1] - c0[1], q[2] - c0[2]) };
      const own = v.graph().concepts.filter(c => c.topic === tid).map(c => D('c:' + c.id));
      const rest = v.graph().concepts.filter(c => c.topic !== tid).map(c => D('c:' + c.id));
      const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
      bt.value = ''; bt.dispatchEvent(new Event('change')); document.getElementById('cpFieldBtn').click();
      return { label: o.label, own: mean(own), rest: mean(rest) } });
    ok(/Quantum/.test(t.label) && t.own < 0.8 * t.rest, "topic observer: own concepts " + t.own.toFixed(3) + " vs others " + t.rest.toFixed(3) + " from the observer (field units)");
  }

  // 1f. domains are the sixth level; embedding values are shown; host arguments carry domain, mode and field
  {
    const r = await p.evaluate(() => { const v = window.__cpv, g = v.graph(), $ = id => document.getElementById(id);
      const dn = g.domains.map(d => v.node('d:' + d.id)).filter(Boolean);
      const met = [...$('metrics').querySelectorAll('.metric')].map(m => m.textContent);
      v.select('t:quantum-physics'); const det = $('detail').textContent;
      v.select('d:business-finance'); const det2 = $('detail').textContent;
      v.apply({ domain: 'business-finance', mode: 'lens', task: 'price a European call option', field: true });
      const o = v.observer(), mode = $('taskMode').value, field = v.field().on, lo = $('lensOut').textContent;
      $('taskClr').click(); $('taskMode').value = 'flat'; if (v.field().on) $('cpFieldBtn').click();
      $('bfDomain').value = ''; $('bfDomain').dispatchEvent(new Event('change'));
      return { dn: dn.length, z: dn.every(n => n.kind === 'domain' && n.z > v.node('t:quantum-physics').z), met, det, det2, o: o.label, mode, field, lo } });
    ok(r.dn === graph.domains.length && r.z, "domain level: " + r.dn + " domain nodes above the topic plane");
    ok(r.met.some(m => /^11\s*Domains/i.test(m.trim())), "metrics include domains: " + r.met[0]);
    ok(/Embedding values/.test(r.det) && /Field place, 3D/.test(r.det) && /Agents: /.test(r.det) && /Topics: /.test(r.det2), "embedding values in Details");
    ok(r.mode === 'lens' && r.field && /from Business, Finance and Economics/.test(r.lo) && /routed task \(lens\)/.test(r.o), "host args: domain + lens + field: " + r.lo.slice(0, 60));
  }

  // 1g. level edges, domains tab, saved observer state, domains for generated topics, related concepts
  {
    const r = await p.evaluate(() => { const v = window.__cpv, $ = id => document.getElementById(id);
      const btn = ['bDT', 'bTC', 'bCS', 'bRel'].every(id => $(id));
      $('tabD').click(); const dl = document.querySelectorAll('#list > div').length; $('tabA').click();
      $('bCS').click(); $('bRel').click(); $('taskMode').value = 'lens';
      const saved = v.getState(); const ob = saved.observer;
      $('bCS').click(); $('bRel').click(); $('taskMode').value = 'flat';
      v.setState(saved); const back = { cs: $('bCS').className, rel: $('bRel').className, mode: $('taskMode').value };
      $('bCS').click(); $('bRel').click(); $('taskMode').value = 'flat';
      const sd = v.suggestDomain('price swaptions and calibrate a volatility surface for interest rate derivatives');
      return { btn, dl, ob, back, sd, rel: v.related() } });
    ok(r.btn, "level edge toggles: domain→topic, topic→concept, concept→skill, related concepts");
    ok(r.dl === graph.domains.length, "domains tab lists " + r.dl + " domains");
    ok(r.ob && r.ob.mode === 'lens' && r.ob.edges.showCS === false && r.ob.edges.showRel === true && r.back.cs === '' && r.back.rel === 'on' && r.back.mode === 'lens', "observer, router and edges saved and restored");
    ok(r.sd && r.sd.domain === 'business-finance', "generated topic gets a suggested domain: " + JSON.stringify(r.sd));
    ok(r.rel === (graph.related || []).length && r.rel > 0, "related concept pairs available: " + r.rel);
  }

  // 1h. 3D donut levels: every node inside its level's donut (hole + thickness), field depth used, drag follows the pointer in 3D
  {
    await p.evaluate(() => document.querySelector('canvas').scrollIntoView({ block: 'center' }));
    const geo = await p.evaluate(() => { const v = window.__cpv, [I, , O, T] = v.ringR(), g = v.graph(); let bad = 0, n = 0;
      if (!v.field().on) document.getElementById('cpFieldBtn').click();
      const ids = [...g.skills.map(s => 's:' + s.id), ...g.concepts.map(c => 'c:' + c.id), ...g.topics.map(t => 't:' + t.id)];
      const zs = new Set(); for (const id of ids) { const q = v.field().pos(id); n++; const r = Math.hypot(q.x, q.y);
        if (r < I - 1e-6 || r > O + 1e-6 || Math.abs(q.z) > T + 1e-6) bad++; zs.add(Math.round(q.z)) }
      return { I, O, T, bad, n, depthLevels: zs.size } });
    ok(geo.I > 0.25 * geo.O && geo.T > 0, "levels are donuts with a hole and thickness: " + JSON.stringify(geo));
    ok(geo.bad === 0, "every node inside its donut (" + geo.n + " checked)");
    ok(geo.depthLevels > 20, "field axis 3 spreads nodes through the donut's thickness: " + geo.depthLevels + " distinct heights");
    // drag from a side view (donut seen nearly edge-on): the node must follow the pointer and stay where it is dropped
    for (const view of ['default', 'edge-on']) {
      await p.evaluate(v => { const c = window.__cpv; document.getElementById('cpResetBtn').click(); c.orient(v === 'edge-on' ? [0, 1, 0, 0.08, 0, -0.9968, -0.9968, 0, -0.08] : null || c.orient()) }, view);
      const id = await p.evaluate(() => { const g = window.__cpv.graph(), [I, , O] = window.__cpv.ringR();
        for (const s of g.skills) { const q = window.__cpv.field().pos('s:' + s.id), r = Math.hypot(q.x, q.y); if (r > I + 60 && r < O - 60 && Math.abs(q.z) < 10) return 's:' + s.id } });
      const a = await p.evaluate(id => window.__cpv.scr(id), id);
      const hit = await p.evaluate(([x, y, id]) => { const el = document.elementFromPoint(x, y); return el && el.tagName === 'CANVAS' }, [a.x, a.y, id]);
      await p.evaluate(id => { window.__cpv.select(id) }, id);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 12, a.y + 6, { steps: 4 }); await p.mouse.move(a.x + 24, a.y + 12, { steps: 4 }); await p.mouse.up();
      await p.waitForTimeout(150);
      const b2 = await p.evaluate(id => window.__cpv.scr(id), id);
      await p.evaluate(() => window.__cpv.rotate(0)); const b3 = await p.evaluate(id => window.__cpv.scr(id), id);
      ok(hit && Math.abs(b2.x - a.x - 24) < 3 && Math.abs(b2.y - a.y - 12) < 3, view + " view: dragged skill follows the pointer " + JSON.stringify({ a, b2 }));
      ok(Math.abs(b3.x - b2.x) < 0.5 && Math.abs(b3.y - b2.y) < 0.5, view + " view: dropped skill stays where it was placed");
    }
    await p.evaluate(() => { document.getElementById('cpResetBtn').click(); window.__cpv.fit && 0; if (window.__cpv.field().on) document.getElementById('cpFieldBtn').click() });
    await p.evaluate(() => document.getElementById('cpFitBtn').click());
  }

  // 1i. node size from density; each level framed on its own centroid and filling its donut
  {
    const r = await p.evaluate(() => { const v = window.__cpv, g = v.graph(), [I, , O] = v.ringR();
      if (!v.field().on) document.getElementById('cpFieldBtn').click();
      const c = v.cnt(), sk = v.nodeR('skill'), tp = v.nodeR('topic');
      let maxR = 0, sx = 0, sy = 0; for (const s of g.skills) { const q = v.field().pos('s:' + s.id); maxR = Math.max(maxR, Math.hypot(q.x, q.y)); sx += q.x; sy += q.y }
      const ang = Math.atan2(sy, sx), spread = Math.hypot(sx, sy) / g.skills.length;
      document.getElementById('cpFieldBtn').click(); return { c, sk, tp, maxR, O, I, spread } });
    ok(r.c.skill === 1998 && r.c.topic === 128, "visible counts per level: " + JSON.stringify(r.c));
    ok(r.sk < r.tp, "denser level draws smaller nodes: skill " + r.sk.toFixed(2) + " < topic " + r.tp.toFixed(2));
    ok(r.maxR > 0.95 * r.O, "skill level framed to reach its donut's outer rim: " + r.maxR.toFixed(1) + " of " + r.O.toFixed(1));
    ok(r.spread < 0.5 * r.I, "skill level centred on its own centroid (mean offset " + r.spread.toFixed(1) + ")");
  }

  // 1j. lens through agents and MCP servers + drift SCWs: app = live server, value for value
  {
    const mcp = async (name, args) => { const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } };
      const r = await fetch(API + "/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
      const t = await r.text(), j = JSON.parse(t.startsWith("{") ? t : t.split("\n").find(l => l.startsWith("data:")).slice(5)); return j.result.structuredContent };
    const TASK = "Work with a MCP architect to build a concept plane. then find a marketing exec to write the logic and domain expertise of our marketing bot.";
    const fx = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../server/test/lens.fixture.json'), 'utf8'));
    let same = 0, n = 0;
    for (const task of [TASK, ...fx.map(f => f.task)]) { n++;
      const sv = await mcp("route_task", { task, mode: "lens" });
      const ap = await p.evaluate(t => window.__cpv.lens(t), task);
      const pick = c => c.map(l => [l.level, l.candidates, l.task_in, l.task_out, l.selected.map(s => [s.id, s.weight, s.psi, s.drift.flat, s.drift.flat_rank, s.drift.lens_rank, s.drift.drift, s.drift.a_obs])]);
      if (JSON.stringify(pick(sv.lens)) === JSON.stringify(pick(ap.chain))) same++; else console.log("lens mismatch", task.slice(0, 40)) }
    ok(same === n, "app lens = server lens through agents and MCP servers, with drift, on " + n + " tasks");
    const r = await p.evaluate(t => { const $ = id => document.getElementById(id), v = window.__cpv;
      $('taskMode').value = 'lens'; $('taskIn').value = t; $('taskGo').click(); if (!v.field().on) $('cpFieldBtn').click();
      const D = v.drift(), txt = $('lensOut').textContent, btns = !!$('cpDriftBtn') && !!$('cpDriftExp');
      const moved = D.chain.slice(1).flatMap(l => l.nodes).filter(x => x.distance > 0.01).length;
      const consistent = D.chain.every(l => l.nodes.every(x => { const d = x.displacement, h = x.home, o = x.observed; return Math.abs(o[0] - h[0] - d[0]) < 1e-3 && Math.abs(o[1] - h[1] - d[1]) < 1e-3 && Math.abs(o[2] - h[2] - d[2]) < 1e-3 }));
      $('taskClr').click(); $('cpFieldBtn').click(); $('taskMode').value = 'flat';
      return { levels: D.chain.map(l => l.level), scw: D.scw, nodes: D.chain.map(l => l.nodes.length), moved, consistent, txt: /Agents \(λ/.test(txt) && /MCP servers \(λ/.test(txt) && /drift [+-]/.test(txt) && /% explained/.test(txt), btns } }, TASK);
    ok(r.scw === "SCW-path" && r.levels.join() === "topic,concept,skill,agent,mcp", "drift SCW around all five levels: " + JSON.stringify(r.nodes));
    ok(r.moved > 0 && r.consistent, "observed - home = displacement for every node; " + r.moved + " nodes moved by the observer");
    ok(r.txt && r.btns, "lens readout shows drift per node, explained task per level, drift arrows and export");
  }

  // 1k. drift in one shared 3D frame: depth spread through the thickness, depth can drift, displacement = drift only
  {
    const r = await p.evaluate(() => { const $ = id => document.getElementById(id), v = window.__cpv, g = v.graph(), T = v.ringR()[3];
      if (!v.field().on) $('cpFieldBtn').click();
      const zs = g.skills.map(s => v.field().pos('s:' + s.id).z), sat = zs.filter(z => Math.abs(z) > 0.89 * T).length / zs.length;
      const spread = Math.max(...zs) - Math.min(...zs);
      $('taskMode').value = 'lens'; $('taskIn').value = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard'; $('taskGo').click();
      const D = v.drift(), nodes = D.chain.slice(1).flatMap(l => l.nodes), zMoved = nodes.filter(n => Math.abs(n.displacement[2]) > 0.5).length;
      // shared frame: a node's observed place lies on the line from the observer through its home place (raw field), never off it
      const lead = D.chain[0].nodes[0].node, c0 = v.fieldRaw(lead);
      let maxOff = 0; for (const n of D.chain[1].nodes) { const f = v.fieldRaw(n.node), q = v.lensPos(n.node), d = f.map((x, i) => x - c0[i]), e = q.map((x, i) => i < 3 ? x - c0[i] : 0).slice(0, 3);
        const nd = Math.hypot(...d), ne = Math.hypot(...e); if (nd > 1e-9 && ne > 1e-9) maxOff = Math.max(maxOff, 1 - (d[0] * e[0] + d[1] * e[1] + d[2] * e[2]) / (nd * ne)) }
      $('taskClr').click(); $('taskMode').value = 'flat'; $('cpFieldBtn').click();
      return { sat, spread, T, zMoved, n: nodes.length, maxOff } });
    ok(r.sat < 0.05 && r.spread > 1.5 * r.T, "depth spread through the donut's thickness: " + (r.sat * 100).toFixed(1) + "% at the rim, spread " + r.spread.toFixed(1) + " of " + (2 * r.T));
    ok(r.zMoved > 0, "depth drifts too: " + r.zMoved + " of " + r.n + " chosen nodes moved in depth");
    ok(r.maxOff < 1e-6, "observed place lies on the observer's ray through the home place (shared frame)");
  }

  // 1l. color scale for observer value, with a legend; drift arrows colored by sign; saved with the state
  {
    const r = await p.evaluate(() => { const $ = id => document.getElementById(id), v = window.__cpv;
      if (!v.field().on) $('cpFieldBtn').click();
      $('taskMode').value = 'lens'; $('taskIn').value = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard'; $('taskGo').click();
      const st = v.getState().observer, btn = $('cpColorBtn'), on = btn && btn.getAttribute('aria-pressed') === 'true';
      const cv = document.querySelector('canvas'), c = cv.getContext('2d'), h = cv.height, px = c.getImageData(20 * devicePixelRatio, h - 60 * devicePixelRatio, 160 * devicePixelRatio, 4).data;
      let colors = new Set(); for (let i = 0; i < px.length; i += 4 * 8) colors.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2]);
      btn.click(); const off = btn.getAttribute('aria-pressed') === 'false' && v.getState().observer.colorObs === false; btn.click();
      $('taskClr').click(); $('taskMode').value = 'flat'; $('cpFieldBtn').click();
      return { on, off, saved: st.colorObs === true && st.drift === true, legendColors: colors.size } });
    ok(r.on && r.off && r.saved, "observer color toggle (aria-pressed) and saved in state");
    ok(r.legendColors > 10, "legend gradient drawn in the graph corner (" + r.legendColors + " distinct colors sampled)");
  }

  // 1m. 'constructor' (a word in the map and an Object.prototype key) never yields NaN in the app
  {
    const r = await p.evaluate(() => { const v = window.__cpv, L = v.lens('build a finite automaton constructor that accepts a test string'); const $ = id => document.getElementById(id);
      if (!v.field().on) $('cpFieldBtn').click(); $('taskMode').value = 'lens'; $('taskIn').value = 'Design a marketing email campaign'; $('taskGo').click();
      const bad = v.graph().skills.filter(s => { const q = v.lensPos('s:' + s.id); return q && !q.every(Number.isFinite) }).length;
      $('taskClr').click(); $('taskMode').value = 'flat'; $('cpFieldBtn').click();
      return { fin: L.chain.every(l => l.selected.every(x => Number.isFinite(x.psi))), n: L.chain.length, bad } });
    ok(r.fin && r.n >= 3 && r.bad === 0, "no NaN from prototype-named words: lens " + r.n + " levels, " + r.bad + " bad layout places");
  }

  // 1n. accessibility: keyboard access to nodes with a live region; text contrast (WCAG AA) on the page
  {
    await p.evaluate(() => { const v = window.__cpv; v.key('Escape') });
    await p.focus('#g'); await p.keyboard.press('ArrowRight');
    const k1 = await p.evaluate(() => ({ sel: window.__cpv.sel(), live: window.__cpv.live(), role: document.getElementById('g').getAttribute('role'), tab: document.getElementById('g').tabIndex }));
    await p.keyboard.press('ArrowRight'); const k2 = await p.evaluate(() => window.__cpv.sel());
    await p.keyboard.press('ArrowDown'); const k3 = await p.evaluate(() => ({ sel: window.__cpv.sel(), live: window.__cpv.live() }));
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); const k4 = await p.evaluate(() => ({ sel: window.__cpv.sel(), live: window.__cpv.live() }));
    await p.keyboard.press('ArrowUp'); const k5 = await p.evaluate(() => window.__cpv.sel());
    await p.keyboard.press('PageDown'); const k6 = await p.evaluate(() => window.__cpv.sel());
    await p.keyboard.press('Escape'); const k7 = await p.evaluate(() => ({ sel: window.__cpv.sel(), live: window.__cpv.live() }));
    ok(k1.role === 'application' && k1.tab === 0 && /^t:/.test(k1.sel) && /^Topic: .+, 1 of \d+\./.test(k1.live), "keyboard: focus the graph, Right selects the first topic and announces it: " + k1.live);
    ok(/^t:/.test(k2) && k2 !== k1.sel && /^c:/.test(k3.sel) && /^Concept: /.test(k3.live), "keyboard: Right moves along the level, Down moves to a concept");
    ok(/^a:/.test(k4.sel) && /^Agent: /.test(k4.live) && /^s:/.test(k5) && /^a:/.test(k6), "keyboard: Down twice reaches an agent, Up returns to a skill, Page Down changes level");
    ok(k7.sel === null && /cleared/.test(k7.live), "keyboard: Escape clears the selection");
    const cr = await p.evaluate(() => { const P = c => c.match(/[\d.]+/g).map(Number), lum = ([r, g, b]) => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4) }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) };
      const bg = el => { const cols = []; for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c.length === 4 && c[3] === 0) continue; cols.push(c); if (c.length === 3 || c[3] >= .99) break }
        let o = [7, 19, 33]; for (const c of cols.reverse()) { const a = c.length === 4 ? c[3] : 1; o = o.map((x, i) => x * (1 - a) + c[i] * a) } return o };
      const bad = []; let n = 0;
      for (const el of document.querySelectorAll('body *')) { if (![...el.childNodes].some(t => t.nodeType === 3 && t.textContent.trim())) continue; const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || (!el.offsetParent && cs.position !== 'fixed') || el.classList.contains('cpsr')) continue;
        let fg = P(cs.color), a = fg.length === 4 ? fg[3] : 1; for (let e = el; e; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity); const B = bg(el); fg = fg.slice(0, 3).map((x, i) => x * a + B[i] * (1 - a));
        const L1 = lum(fg), L2 = lum(B), r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05), size = parseFloat(cs.fontSize), need = (size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700)) ? 3 : 4.5; n++;
        if (r < need) bad.push((el.id || el.tagName) + ' ' + r.toFixed(2)) } return { n, bad } });
    ok(cr.n > 500 && cr.bad.length === 0, "text contrast meets WCAG AA on " + cr.n + " visible text elements" + (cr.bad.length ? ": " + cr.bad.slice(0, 5).join(", ") : ""));
  }

  // 1o. dense signal: the page asks the server; with no dense index (local server) the TF-IDF route stays and the readout says why;
  //     when the server answers with the dense signal, its route replaces the local one
  {
    const TASK = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard';
    await p.evaluate(t => { const $ = id => document.getElementById(id); $('taskMode').value = 'lens'; $('taskIn').value = t; $('taskGo').click() }, TASK);
    await p.waitForFunction(() => window.__cpv.signal() !== null, null, { timeout: 10000 });
    const r1 = await p.evaluate(() => ({ sig: document.getElementById('cpSignal').textContent, sk: window.__v3.taskSet().filter(x => x.startsWith('s:')).length }));
    ok(/^Signal: TF-IDF — no Workers AI/.test(r1.sig), "no dense on this server: TF-IDF route kept, readout says why: " + r1.sig);
    // a server that has the dense signal: answer with its lens route (here: the local route with the skill level's choice changed)
    await p.route(API + "/route", async route => { const args = JSON.parse(route.request().postData()); const resp = await route.fetch(); const sc = await resp.json(); const j = sc; sc.signal = { tfidf: 0.5, dense: 0.5, model: "@cf/baai/bge-m3", shortlist: 300 };
      if (args.mode === 'lens') { const L = sc.lens.find(l => l.level === 'skill'); L.selected = [{ ...L.selected[0], id: 'mk-audience-segmenter' }] }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }) });
    await p.evaluate(t => { const $ = id => document.getElementById(id); $('taskIn').value = t; $('taskGo').click() }, TASK);
    await p.waitForFunction(() => /bge-m3/.test(document.getElementById('cpSignal').textContent), null, { timeout: 10000 });
    const r2 = await p.evaluate(() => ({ sig: document.getElementById('cpSignal').textContent, lens: document.getElementById('lensOut').textContent, sel: window.__cpv.drift() && window.__cpv.drift().chain.find(l => l.level === 'skill').nodes.map(n => n.node) }));
    ok(/TF-IDF \+ bge-m3 \(β 0.5\)/.test(r2.sig) && JSON.stringify(r2.sel) === '["s:mk-audience-segmenter"]', "dense route from the server replaces the local route: " + JSON.stringify(r2));
    await p.unroute(API + "/route");
    await p.evaluate(() => { const $ = id => document.getElementById(id); $('cpDenseChk').click(); $('taskIn').value = 'price a call option'; $('taskGo').click() });
    const r3 = await p.evaluate(() => ({ sig: document.getElementById('cpSignal').textContent, saved: window.__cpv.getState().observer.dense }));
    await p.evaluate(() => { const $ = id => document.getElementById(id); $('cpDenseChk').click(); $('taskClr').click(); $('taskMode').value = 'flat' });
    ok(r3.sig === 'Signal: TF-IDF (dense off)' && r3.saved === false, "dense toggle off: TF-IDF only, saved in state");
  }

  // 1p. performance budget (11): page weight, time to a usable graph, frame time, routing time in the page.
  //     Limits are for this headless, software-rendered test browser; docs/PERFORMANCE.md has the budget and live numbers.
  {
    const html = require('fs').statSync(require('path').join(__dirname, 'maxey0-context-plane-graph.html')).size;
    const p2 = await ctx.newPage(); await p2.route(/^https?:/, r => r.request().url().startsWith(API + "/") ? r.continue() : r.abort());
    const t0 = Date.now(); await p2.goto(PAGE, { waitUntil: "commit" }); await p2.waitForFunction(() => window.__l5 && window.__l5.nodes() > 0, null, { timeout: 60000 }); const ready = Date.now() - t0;
    const m = await p2.evaluate(() => { const v = window.__cpv, med = f => { const t = []; for (let i = 0; i < 15; i++) { const a = performance.now(); f(); t.push(performance.now() - a) } t.sort((x, y) => x - y); return t[7] };
      const frame = med(() => v.rotate(0.01)); document.getElementById('cpFieldBtn').click(); const frameField = med(() => v.rotate(0.01));
      const T = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard'; v.lens(T);
      return { frame, frameField, lens: med(() => v.lens(T)), heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 } });
    await p2.close();
    console.log("# perf", JSON.stringify({ html_kb: Math.round(html / 1024), ready_ms: ready, frame_ms: +m.frame.toFixed(1), frame_field_ms: +m.frameField.toFixed(1), lens_ms: +m.lens.toFixed(1), heap_mb: Math.round(m.heap) }));
    ok(html < 300 * 1024, "budget: page under 300 KB (" + Math.round(html / 1024) + " KB)");
    ok(ready < 3000, "budget: graph usable within 3 s of navigation, local server (" + ready + " ms)");
    ok(m.frame < 40 && m.frameField < 40, "budget: median frame under 40 ms in the test browser (" + m.frame.toFixed(1) + " / " + m.frameField.toFixed(1) + " ms)");
    ok(m.lens < 40, "budget: lens route in the page under 40 ms (" + m.lens.toFixed(1) + " ms)");
    ok(!m.heap || m.heap < 150, "budget: JS heap under 150 MB (" + Math.round(m.heap) + " MB)");
  }

  // 1q. embedding values of a selected node: TF-IDF terms, bge-m3 vector (server), 3D field place, drawn 3D places,
  //     and with an observer: a, sqrt a, observed 3D place, displacement, lens values
  {
    const k = 's:mk-email-campaign-builder';
    // a server with the dense index: serve a 1024-value vector for this node
    const vals = Array.from({ length: 1024 }, (_, i) => +(Math.sin(i) / 22.6).toFixed(5));
    await p.route(API + "/embedding?*", r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: k, model: '@cf/baai/bge-m3', dims: 1024, centred: true, values: vals,
      nearest: { s: [['s:mk-audience-segmenter', 0.81], ['s:mk-email-performance-analyst', 0.77], ['s:dv-option-pricer', 0.12]], m: [['m:' + graph.mcp[0].id, 0.3], ['m:' + graph.mcp[1].id, 0.2], ['m:' + graph.mcp[2].id, 0.1]] } }) }));
    const a = await p.evaluate(k => { const v = window.__cpv; v.select(k); return document.getElementById('cpEmb').textContent }, k);
    await p.waitForFunction(() => /first 8/.test((document.getElementById('cpEmbDense') || {}).textContent || ''), null, { timeout: 5000 });
    const b2 = await p.evaluate(() => document.getElementById('cpEmb').textContent);
    await p.unroute(API + "/embedding?*");
    const T = 'Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard';
    const c = await p.evaluate(([k, T]) => { const $ = id => document.getElementById(id), v = window.__cpv; $('taskMode').value = 'lens'; $('taskIn').value = T; $('taskGo').click(); v.select(k);
      const t = $('cpEmb').textContent; $('taskClr').click(); $('taskMode').value = 'flat'; v.select(null); return t }, [k, T]);
    ok(/TF-IDF vector \(routing, exact\): \d+ non-zero of \d+ terms, length 1 · email \d\.\d{3}/.test(a), "TF-IDF terms and weights of the node: " + a.slice(a.indexOf('TF-IDF'), a.indexOf('TF-IDF') + 90));
    ok(/Field place, 3D \(shared field, SVD axes 1–3\): x -?\d\.\d{3}, y -?\d\.\d{3}, z -?\d\.\d{3}/.test(a) && /Seen from above \(no observer\): drawn on its skill donut at x -?\d+\.\d, y -?\d+\.\d, z -?\d+\.\d/.test(a), "3D field place and 3D drawn place (x, y, z)");
    ok(/1024 values, centred and length 1 · first 8: 0\.0000, 0\.0372/.test(b2) && /Nearest by bge-m3 cosine:Skills: Audience Segmenter 0\.81/.test(b2), "bge-m3 vector values and dense neighbours from the server");
    ok(/Seen from routed task \(lens\).*: a \d\.\d{3} .*√a \d\.\d{3} · field place x -?\d\.\d{3}, y -?\d\.\d{3}, z -?\d\.\d{3} · drawn at x/.test(c) && /Displacement \(observed − home\): x -?\d+\.\d, y -?\d+\.\d, z -?\d+\.\d/.test(c) && /In this lens route \(skill\): flat [\d.]+ \(seen from above, rank #\d+\) → ψ [\d.]+ \(through the lens, rank #1\)/.test(c), "observer view: a, √a, observed 3D place, displacement, lens values");
  }

  // 2. gates = the server's agent->MCP links, exactly
  const exp = {};
  for (const l of graph.agent_mcp) (exp[l.agent] = exp[l.agent] || new Set()).add(graph.mcp.find(m => m.id === l.mcp).name);
  let mism = 0;
  for (const a of graph.agents) {
    const got = new Set(await p.evaluate(k => window.__l5.top(k).map(x => x[0]), a.key)), e = exp[a.key] || new Set();
    if (got.size !== e.size || [...e].some(x => !got.has(x))) mism++;
  }
  ok(mism === 0, `gates differ from the server for ${mism} agents`);

  // 3. task routing in the page = the server's route_task
  let agree = 0;
  for (const t of TASKS) {
    await p.fill("#taskIn", t); await p.click("#taskGo"); await p.waitForTimeout(100);
    const pg = await p.evaluate(() => { const tk = window.__v6.task(); return tk && tk.matched ? tk.skills[0][0] : null });
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "route_task", arguments: { task: t, limit: 1 },
      _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } } };
    const res = await (await fetch(API + "/mcp", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "route_task" } })).json();
    const sp = res.result.structuredContent.paths[0];
    const same = (pg === null && !sp) || (sp && pg === sp.label);
    if (same) agree++; else console.log("  route differs:", t, "| page:", pg, "| server:", sp && sp.label);
  }
  ok(agree === TASKS.length, `page routing agrees with server on ${agree}/${TASKS.length}`);

  // 3b. a task highlights only its best route: one topic
  await p.fill("#taskIn", "quantum entanglement of two qubits"); await p.click("#taskGo"); await p.waitForTimeout(100);
  const hi = await p.evaluate(() => window.__v01.highlighted());
  const hiTopics = hi.filter(x => x.startsWith("t:")), hiSkills = hi.filter(x => x.startsWith("s:"));
  ok(hiTopics.length === 1 && hiTopics[0] === "t:quantum-physics" && hiSkills.length === 1, "highlight = best route only: " + hiTopics.join(","));
  const txt = await p.evaluate(() => document.getElementById("taskMsg").textContent);
  ok(/Best route: Quantum Physics/.test(txt) && /TF-IDF cosine/.test(txt) && !/vocabulary|Weak match|Engineering Physics/.test(txt), "result text: best route + method only");
  await p.screenshot({ path: path.join(require("os").tmpdir(), "maxey0-cpg-result.png") });

  // 3c. Hide keeps the highlight
  await p.click("#cpHide");
  const hid = await p.evaluate(() => ({ slim: document.getElementById("taskMsg").className === "slim", n: window.__v01.highlighted().length }));
  ok(hid.slim && hid.n === hi.length, "Hide shrinks the result to one line, highlight kept");
  await p.click("#cpShow");
  ok(await p.evaluate(() => !!document.getElementById("cpHide")), "Show brings the result back");

  // 4. state: save records the graph; an old (pre-live) state file is refused
  await p.click("#cs_app1 details.cpfold > summary");
  const bar = p.locator("#cs_app1 .statebar");
  await bar.locator('button[data-st="save"]').click(); await p.waitForTimeout(200);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("human0.v03.state.app1") || "null"));
  ok(saved && saved.graph === graph.snapshot_digest, "saved state records the graph digest");
  const old = path.join(require("os").tmpdir(), "old_state.json");
  fs.writeFileSync(old, JSON.stringify({ schema: "human0.app-state/1", app: "app1", version: "0.5", state: {} }));
  await bar.locator("input[type=file]").setInputFiles(old); await p.waitForTimeout(300);
  const msg = await p.evaluate(() => document.querySelector('[data-state-msg="app1"]').textContent);
  ok(/not loaded/.test(msg), "old state refused");

  // 5. readable paths: an isolated topic spreads its nodes on each level (no stacking)
  await p.evaluate(() => { document.getElementById("iso").click(); });
  const spread = await p.evaluate(() => {
    window.__cpv.select("t:quantum-physics");
    const fp = window.__cpv.fanPos(), ids = Object.keys(fp);
    const byLevel = {}; ids.forEach(id => { const k = window.__cpv.node(id).kind; (byLevel[k] = byLevel[k] || []).push(window.__cpv.screen(id)) });
    // spacing is measured on the level plane (world units), not on screen: a ring is foreshortened at its sides
    let minGap = 1e9; for (const k of ["concept", "skill"]) { const ps = ids.filter(id => window.__cpv.node(id).kind === k).map(id => fp[id]);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) minGap = Math.min(minGap, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)) }
    return { n: ids.length, levels: Object.keys(byLevel), minGap, skills: (byLevel.skill || []).length };
  });
  ok(spread.n > 10 && spread.skills > 5 && spread.minGap >= 30, "isolated path spreads on its level rings: " + JSON.stringify(spread));
  await p.screenshot({ path: path.join(require("os").tmpdir(), "maxey0-cpg-spread.png") });

  // 6. drag a node: it moves sideways in its own level (same plane), a click still selects
  await p.evaluate(() => document.getElementById("g").scrollIntoView({ block: "center" }));
  const target = await p.evaluate(() => { const id = Object.keys(window.__cpv.fanPos()).find(i => window.__cpv.node(i).kind === "skill"); return { id, ...window.__cpv.screen(id), z: window.__cpv.node(id).z } });
  await p.mouse.move(target.x, target.y); await p.mouse.down(); await p.mouse.move(target.x + 60, target.y + 5, { steps: 6 }); await p.mouse.up();
  const after = await p.evaluate(id => ({ ...window.__cpv.screen(id), z: window.__cpv.node(id).z, off: window.__cpv.off()[id] }), target.id);
  ok(Math.abs(after.x - target.x - 60) < 12 && after.z === target.z && after.off, "drag moves the node within its level: dx=" + Math.round(after.x - target.x));
  // the spread lives in the 3D world: rotating moves it on screen, its plane positions stay the same
  const rotChk = await p.evaluate(() => { const id = Object.keys(window.__cpv.fanPos()).find(i => window.__cpv.node(i).kind === "concept");
    const w0 = JSON.stringify(window.__cpv.fanPos()[id]), s0 = window.__cpv.screen(id); window.__cpv.rotate(0.6);
    const w1 = JSON.stringify(window.__cpv.fanPos()[id]), s1 = window.__cpv.screen(id); window.__cpv.rotate(-0.6);
    return { same: w0 === w1, moved: Math.hypot(s1.x - s0.x, s1.y - s0.y) } });
  ok(rotChk.same && rotChk.moved > 5, "spread path rotates with the 3D graph (world positions fixed, screen moved " + Math.round(rotChk.moved) + "px)");
  // the spread sits on each level's donut (same radius), and a dragged node never leaves its donut
  const ringChk = await p.evaluate(() => { const [I, R, O] = window.__cpv.ringR(), fp = window.__cpv.fanPos();
    const onRing = Object.values(fp).every(q => Math.abs(Math.hypot(q.x, q.y) - R) < 1e-6);
    const id = Object.keys(fp).find(i => window.__cpv.node(i).kind === "skill"); window.__cpv.move(id, 5000, 3000);
    const q = window.__cpv.pos(id), r = Math.hypot(q.x, q.y); return { onRing, r, I, O } });
  ok(ringChk.onRing && ringChk.r <= ringChk.O + 1e-6 && ringChk.r >= ringChk.I - 1e-6, "spread on the ring; a far drag is held inside the donut: " + JSON.stringify(ringChk));
  await p.click("#cpResetBtn");
  // all-axis rotation: orientation matrix, any angle, any direction
  const rotAll = await p.evaluate(async () => { const v = window.__cpv, M0 = v.orient(), d = (A, B) => Math.max(...A.map((x, i) => Math.abs(x - B[i])));
    v.tiltBy(2.0); const tilted = d(v.orient(), M0) > .5; v.tiltBy(2 * Math.PI - 2.0); const back = d(v.orient(), M0) < 1e-9;
    v.tiltBy(Math.PI); const flipped = v.orient(); const upside = flipped[4] * M0[4] < 0; v.tiltBy(Math.PI);
    v.track(0, 0, false); v.track(40, 0, true); const rolled = d(v.orient(), M0) > .1; v.track(-40, 0, true); const unrolled = d(v.orient(), M0) < 1e-9;
    const bad = v.orient([1, 2, 3]) === false && v.orient([NaN, 0, 0, 0, 1, 0, 0, 0, 1]) === false;
    v.spin720(300); await new Promise(r => setTimeout(r, 120)); const mid = d(v.orient(), M0) > 1e-3; await new Promise(r => setTimeout(r, 400));
    const after720 = d(v.orient(), M0);
    const det = M => M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*M[7]-M[4]*M[6]);
    return { tilted, back, upside, rolled, unrolled, bad, mid, after720, det: det(v.orient()) } });
  ok(rotAll.tilted && rotAll.back && rotAll.upside && rotAll.rolled && rotAll.unrolled && rotAll.bad && rotAll.mid && rotAll.after720 < 1e-9 && Math.abs(rotAll.det - 1) < 1e-9,
    "all-axis rotation: tilt past vertical and round, upside-down, roll, bad input refused, 720° tumble lands back: " + JSON.stringify(rotAll));
  // a mouse drag on empty canvas rotates (trackball) and a node drag lands under the cursor even upside-down
  await p.evaluate(() => document.getElementById("g").scrollIntoView({ block: "center" }));
  const box = await (await p.$("#g")).boundingBox();
  const orientBefore = await p.evaluate(() => window.__cpv.orient());
  await p.mouse.move(box.x + 12, box.y + 12); await p.mouse.down(); await p.mouse.move(box.x + 90, box.y + 50, { steps: 5 }); await p.mouse.up();
  const turned = await p.evaluate(M0 => Math.max(...window.__cpv.orient().map((x, i) => Math.abs(x - M0[i]))), orientBefore);
  ok(turned > .05, "mouse drag on empty space turns the graph (trackball): " + turned.toFixed(3));
  for (const flip of [0, Math.PI, 2.2]) {
    await p.evaluate(f => { window.__cpv.fit(); window.__cpv.tiltBy(f) }, flip);
    const t0 = await p.evaluate(() => { const id = Object.keys(window.__cpv.fanPos()).find(i => window.__cpv.node(i).kind === "skill"); return { id, ...window.__cpv.screen(id) } });
    await p.mouse.move(t0.x, t0.y); await p.mouse.down(); await p.mouse.move(t0.x + 25, t0.y + 10, { steps: 4 }); await p.mouse.up();
    const t1 = await p.evaluate(id => window.__cpv.screen(id), t0.id);
    ok(Math.hypot(t1.x - t0.x - 25, t1.y - t0.y - 10) < 3, `node drag follows the cursor at tilt ${flip.toFixed(2)}: off by ${Math.hypot(t1.x - t0.x - 25, t1.y - t0.y - 10).toFixed(2)}px`);
    await p.click("#cpResetBtn");
  }
  await p.evaluate(() => window.__cpv.fit());
  // Fit view: the whole stack (top and bottom donut) is inside the canvas
  const fitChk = await p.evaluate(() => { window.__cpv.fit(); const c = document.getElementById("g").getBoundingClientRect();
    const t = window.__cpv.screen(Object.keys(window.__cpv.fanPos()).find(i => window.__cpv.node(i).kind === "topic"));
    return { top: t.y - c.top, h: c.height } });
  ok(fitChk.top > 0 && fitChk.top < fitChk.h, "Fit view keeps the top level inside the frame: " + JSON.stringify(fitChk));
  // dragging a concept carries its whole downstream subtree, each node on its own level
  await p.click("#cpResetBtn");
  const sub = await p.evaluate(() => { const c = Object.keys(window.__cpv.fanPos()).find(i => window.__cpv.node(i).kind === "concept");
    const down = window.__cpv.down(c), z0 = down.map(i => window.__cpv.node(i).z); window.__cpv.move(c, 50, 0);
    const off = window.__cpv.off(), o = off[c];
    return { n: down.length, kinds: [...new Set(down.map(i => window.__cpv.node(i).kind))], allMoved: down.every(i => off[i] && Math.abs(off[i].x - o.x) < 1e-9 && Math.abs(off[i].y - o.y) < 1e-9),
      sameZ: down.every((i, k) => window.__cpv.node(i).z === z0[k]) } });
  ok(sub.n > 3 && sub.kinds.includes("skill") && sub.kinds.includes("agent") && sub.allMoved && sub.sameZ, "dragging a concept moves its skills, agents and servers with it on their own planes: " + JSON.stringify(sub));
  await p.click("#cpResetBtn");
  ok(await p.evaluate(() => Object.keys(window.__cpv.off()).length === 0), "Reset layout puts nodes back");
  await p.evaluate(() => { document.getElementById("iso").click(); window.__cpv.select(null); });

  // 7. generated topics: add three packs, remove the middle one, keep 1 + 3; details, new-only view, state
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "SCW1", "sources", "packs", "commodities.pack.json"), "utf8"));
  const mk = (n) => JSON.parse(JSON.stringify(base).replaceAll("cmd", "g" + n + "x").replaceAll('"commodities"', '"gen-topic-' + n + '"').replace('"Commodities"', '"Generated Topic ' + n + '"'));
  const before = await p.evaluate(() => window.__l5.nodes());
  for (const n of [1, 2, 3]) {
    await p.evaluate(() => { const d = document.getElementById("topicsBox"); if (d) d.open = true });
    await p.fill("#tpIn", JSON.stringify(mk(n))); await p.click("#tpAdd");
    const m = await p.evaluate(() => document.getElementById("tpMsg").textContent);
    ok(/^ADDED/.test(m), "generated topic " + n + " added: " + m.slice(0, 90));
  }
  await p.click("#tpRm_gen-topic-2".replace("#", "#")).catch(() => {});
  const keep = await p.evaluate(() => ({ packs: window.__cpv.packs(), t1: !!window.__cpv.node("t:gen-topic-1"), t2: !!window.__cpv.node("t:gen-topic-2"), t3: !!window.__cpv.node("t:gen-topic-3") }));
  ok(keep.t1 && !keep.t2 && keep.t3 && keep.packs.length === 2, "remove topic 2, keep 1 + 3: " + JSON.stringify(keep.packs));
  const det = await p.evaluate(() => { window.__cpv.select("t:gen-topic-1"); return document.getElementById("detail").textContent });
  ok(/Generated Topic 1/.test(det), "a generated topic shows in Details");
  await p.click("#cpNewBtn");
  const only = await p.evaluate(() => { const s = new Set(window.__cpv.newSet()); return { size: s.size, hasOld: s.has("t:quantum-physics"), has1: s.has("t:gen-topic-1"), has3: s.has("t:gen-topic-3"), st: window.__cpv.state() } });
  ok(only.st.onlyNew && only.has1 && only.has3 && !only.hasOld && only.size > 20, "New topics only shows the generated topics: " + only.size + " nodes");
  await p.click("#cpAllBtn");
  const st = await p.evaluate(() => { const g = window.__cpv.app(); return { packs: g.user_packs.map(x => x.id), view: !!g.view } });
  ok(st.packs.join() === "gen-topic-1,gen-topic-3" && st.view, "app state carries the kept topics and the view");
  // generation request + ask button; no-match task offers generation
  await p.fill("#taskIn", "hello there friend"); await p.click("#taskGo"); await p.waitForTimeout(100);
  const gen = await p.$("#cpGenFromTask");
  if (gen) { await gen.click(); await p.waitForTimeout(100) }
  const req = await p.evaluate(() => ({ req: (document.getElementById("tpReq") || {}).value || "", ask: !!document.getElementById("cpAsk") }));
  ok(gen && /hello there friend/.test(req.req) && /validate_topic_pack/.test(req.req) && req.ask, "no-match task -> generation request with Ask Claude");
  ok(errs.length === 0, "page errors: " + errs.join(" | "));
  await p.screenshot({ path: path.join(require("os").tmpdir(), "maxey0-cpg.png") });
  await b.close();
  console.log(`# pass ${pass}\n# fail ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("ERR", e.message); process.exit(1) });
