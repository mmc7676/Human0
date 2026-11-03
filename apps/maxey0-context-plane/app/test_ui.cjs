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
  ok(r.nodes === graph.topics.length + graph.concepts.length + graph.skills.length + graph.agents.length + graph.mcp.length, "node count");
  ok(r.agents === graph.agents.length && r.servers === graph.mcp.length && r.gates === graph.agent_mcp.length, "agents/servers/gates");
  ok(r.topicOpts === graph.topics.length + 1 && r.conceptOpts === graph.concepts.length + 1, "topic and concept selectors");
  ok(r.logo && r.sliders, "Human0 logo shown, retired sliders hidden");
  ok(/Maxey0 Context Plane Graph/.test(r.title) && /MAXEY0 CONTEXT PLANE GRAPH/.test(r.header), "names");
  ok(r.digest === graph.snapshot_digest, "graph digest");

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
