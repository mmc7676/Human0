// Protocol + data tests for the Worker. Bundles src/index.ts with esbuild, then
// calls the Worker's fetch handler directly with standard Request objects.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "scw1.manifest.json"), "utf8"));
let worker;
const env = { ALLOWED_ORIGINS: "https://claude.ai,https://claude.com" };
const V = "2026-07-28";

before(async () => {
  const out = join(mkdtempSync(join(tmpdir(), "cpmcp-")), "w.mjs");
  await build({ entryPoints: [join(here, "..", "src", "index.ts")], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error", loader: { ".html": "text" } });
  worker = (await import(pathToFileURL(out).href)).default;
});

const meta = { "io.modelcontextprotocol/protocolVersion": V, "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} };
let n = 0;
async function modern(method, params = {}, hdr = {}) {
  const body = { jsonrpc: "2.0", id: ++n, method, params: { ...params, _meta: meta } };
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": V, "mcp-method": method };
  if (method === "tools/call" || method === "prompts/get") h["mcp-name"] = params.name;
  if (method === "resources/read") h["mcp-name"] = params.uri;
  const res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { ...h, ...hdr }, body: JSON.stringify(body) }), env);
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
}
async function legacy(method, params = {}, version = "2025-11-25", extra = {}) {
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream", ...extra };
  if (method !== "initialize" && version) h["mcp-protocol-version"] = version;
  const res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: h, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) }), env);
  return { status: res.status, headers: res.headers, body: await res.json() };
}
const byIdPre = (r, id) => r.structuredContent.topics.some((t) => t.id === id);
const call = async (name, args) => (await modern("tools/call", { name, arguments: args })).body.result;

test("server/discover advertises versions, capabilities, serverInfo, cache fields", async () => {
  const { status, body } = await modern("server/discover");
  assert.equal(status, 200);
  const r = body.result;
  assert.deepEqual(r.supportedVersions, ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"]);
  assert.equal(r.resultType, "complete");
  assert.ok(r.capabilities.tools && r.capabilities.resources);
  assert.equal(r._meta["io.modelcontextprotocol/serverInfo"].name, "maxey0-context-plane");
  assert.equal(typeof r.ttlMs, "number"); assert.equal(r.cacheScope, "public");
});

test("tools/list: 14 read-only tools, deterministic order, cacheable", async () => {
  const a = (await modern("tools/list")).body.result, b = (await modern("tools/list")).body.result;
  assert.equal(a.tools.length, 14);
  assert.deepEqual(a.tools.map((t) => t.name), b.tools.map((t) => t.name));
  assert.ok(a.tools.every((t) => t.annotations.readOnlyHint === true && t.inputSchema.type === "object"));
  assert.equal(a.resultType, "complete"); assert.ok(a.ttlMs > 0);
});

test("domains and every topic served with manifest counts; removed/merged topics absent", async () => {
  const d = (await call("list_domains", {})).structuredContent.domains;
  assert.deepEqual(d.map((x) => x.id), ["maxey0-system", "foundations", "work", "finance", "disciplines"]);
  const r = (await call("list_topics", {})).structuredContent;
  assert.equal(r.count, manifest.entries.length);
  const byId = Object.fromEntries(r.topics.map((t) => [t.id, t]));
  for (const e of manifest.entries) { assert.equal(byId[e.id].domain, e.domain); assert.equal(byId[e.id].concepts, e.counts.concepts, e.id); }
  for (const gone of ["digestion", "nutrition", "medical-conditions", "physics"]) assert.ok(!byId[gone], gone);
  assert.equal(d.reduce((n, x) => n + x.topics, 0), r.count);
});

test("get_harness equals SCW1/harnesses/<id>.harness.json for every topic", async () => {
  const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
  for (const e of manifest.entries) {
    const h = (await call("get_harness", { topic_id: e.id })).structuredContent;
    const f = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "harnesses", `${e.id}.harness.json`), "utf8"));
    assert.equal(canon(h), canon(f), e.id);
  }
});

test("walk domain -> topic -> concept -> skill -> agent -> mcp with children and trace", async () => {
  const t = (await call("children", { level: "topic", parent_id: "maxey0-system" })).structuredContent.children;
  assert.deepEqual(t.map((x) => x.id), ["maxey0"]);
  const c = (await call("children", { level: "concept", parent_id: "maxey0" })).structuredContent.children;
  assert.equal(c.length, 8); assert.ok(c.some((x) => x.id === "mx-memory"));
  const s = (await call("children", { level: "skill", parent_id: "mx-memory" })).structuredContent.children;
  const sk = (await call("get_skill", { skill_id: s[0].id })).structuredContent;
  assert.deepEqual([sk.domain, sk.topic, sk.concept], ["maxey0-system", "maxey0", "mx-memory"]);
  const tr = (await call("trace", { node_id: s[0].id })).structuredContent;
  assert.deepEqual(tr.chain.map((x) => x.level), ["domain", "topic", "concept", "skill"]);
  const g = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "scw1.graph.json"), "utf8"));
  const counts = {}; for (const l of g.agent_mcp) counts[l.agent] = (counts[l.agent] ?? 0) + 1;
  const multi = Object.keys(counts).find((k) => counts[k] > 1);
  const ag = (await call("get_agent", { agent_key: multi })).structuredContent;
  assert.match(ag.key, /^Maxey\d+$/);
  assert.ok(ag.mcp.length >= 2, "multi-MCP agent");
  const m = (await call("get_mcp_server", { mcp_id: ag.mcp[0].id })).structuredContent;
  assert.ok(m.agents.some((x) => x.key === multi));
});

test("physics: three normal-size topics with declared priority; overview concepts merged away", async () => {
  const want = { "classical-physics": "Newtonian Mechanics", "quantum-physics": "Quantum Foundations", "physics-foundations": "Astrophysics and Cosmology" };
  for (const [id, label] of Object.entries(want)) {
    const t = (await call("get_topic", { topic_id: id })).structuredContent;
    assert.equal(t.domain, "disciplines"); assert.equal(t.priority, 1);
    assert.ok(t.concepts.length >= 3 && t.concepts.length <= 8, id);
    assert.ok(t.concepts.some((c) => c.label === label), label);
    for (const l of ["Quantum Physics", "Classical Physics", "Relativity"]) assert.ok(!t.concepts.some((c) => c.label === l), l);
  }
  const others = (await call("list_topics", {})).structuredContent.topics.filter((t) => !(t.id in want));
  assert.ok(others.every((t) => t.priority === 0));
});

test("priority only breaks exact ties: scores are identical with and without it", async () => {
  const a = (await call("search", { query: "relativity spacetime gravity", limit: 20 })).structuredContent;
  const b = (await call("search", { query: "relativity spacetime gravity", limit: 20, use_priority: false })).structuredContent;
  assert.equal(a.priority_tiebreak, true); assert.equal(b.priority_tiebreak, false);
  assert.deepEqual(a.results.map((r) => r.score), b.results.map((r) => r.score));
  assert.equal((await call("search", { query: "x y", use_priority: "yes" })).isError, true);
});

async function at(path, method, params = {}) {
  const body = { jsonrpc: "2.0", id: ++n, method, params: { ...params, _meta: meta } };
  const h = { "content-type": "application/json", "mcp-protocol-version": V, "mcp-method": method };
  if (method === "tools/call") h["mcp-name"] = params.name;
  const res = await worker.fetch(new Request("https://x" + path, { method: "POST", headers: h, body: JSON.stringify(body) }), env);
  return { status: res.status, body: res.status === 404 && !res.headers.get("content-type")?.includes("json") ? null : await res.json() };
}
test("one endpoint per domain plus /mcp: /mcp serves all; /mcp/<domain> serves only that domain", async () => {
  const all = (await at("/mcp", "tools/call", { name: "list_topics", arguments: {} })).body.result.structuredContent;
  let sum = 0;
  for (const d of ["maxey0-system", "foundations", "work", "finance", "disciplines"]) {
    const r = (await at("/mcp/" + d, "tools/call", { name: "list_topics", arguments: {} })).body.result.structuredContent;
    assert.ok(r.count > 0 && r.topics.every((t) => t.domain === d), d); sum += r.count;
    const dom = (await at("/mcp/" + d, "tools/call", { name: "list_domains", arguments: {} })).body.result.structuredContent.domains;
    assert.deepEqual(dom.map((x) => x.id), [d]);
    const disc = (await at("/mcp/" + d, "server/discover")).body.result;
    assert.match(disc.instructions, new RegExp("only the '" + d + "' domain"));
  }
  assert.equal(sum, all.count);
  const cross = (await at("/mcp/work", "tools/call", { name: "get_topic", arguments: { topic_id: "classical-physics" } })).body.result;
  assert.equal(cross.isError, true);
  const route = (await at("/mcp/maxey0-system", "tools/call", { name: "route_task", arguments: { task: "quantum entanglement of two qubits" } })).body.result.structuredContent;
  assert.ok(route.paths.every((p) => p.domain === "maxey0-system"));
  const h = (await at("/mcp/disciplines", "tools/call", { name: "get_harness", arguments: { topic_id: "quantum-physics" } })).body.result.structuredContent;
  const f = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "harnesses", "quantum-physics.harness.json"), "utf8"));
  assert.equal(JSON.stringify(h.skills), JSON.stringify(f.skills));
  assert.equal((await at("/mcp/nope", "tools/list")).status, 404);
  assert.equal((await at("/mcp/all", "tools/list")).status, 404);
});

test("inherited links say which skill and primary they come from", async () => {
  const sk = (await call("get_skill", { skill_id: "entanglement-entropy-analyzer" })).structuredContent.skill;
  for (const a of sk.agents) for (const m of a.mcp) {
    if (m.basis !== "inherited:checker-of-primary") continue;
    assert.ok(m.via && m.via.skill && m.via.primary, a.key);
    const src = (await call("get_skill", { skill_id: m.via.skill })).structuredContent.skill;
    assert.ok(src.agents.some((x) => x.key === a.key && x.role === "checker"), `${a.key} is checker on ${m.via.skill}`);
    assert.ok(src.agents.some((x) => x.key === m.via.primary && x.role === "primary"));
  }
});

test("GET /graph.json: whole graph for browser UIs, CORS open, no search index", async () => {
  const res = await worker.fetch(new Request("https://x/graph.json", { headers: { origin: "null" } }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const g = await res.json();
  assert.equal(g.snapshot_digest, manifest.snapshot_digest);
  assert.equal(g.topics.length, manifest.entries.length);
  assert.equal(g.similarity.vectors, undefined); assert.equal(g.similarity.idf, undefined);
  const gi = await (await worker.fetch(new Request("https://x/graph.json?index=1"), env)).json();
  assert.ok(gi.similarity.idf && Object.keys(gi.similarity.vectors).length === gi.concepts.length + gi.skills.length);
  assert.equal((await worker.fetch(new Request("https://x/graph.json", { method: "OPTIONS" }), env)).status, 204);
  assert.equal((await worker.fetch(new Request("https://x/graph.json", { method: "POST", body: "{}" }), env)).status, 405);
});

test("route_task returns full vertical paths; domain filter works", async () => {
  const r = (await call("route_task", { task: "orbital mechanics trajectory", limit: 2 })).structuredContent;
  assert.ok(r.paths.length > 0);
  for (const p of r.paths) assert.ok(p.domain && p.topic && p.concept && p.skill && p.agents.length);
  const w = (await call("route_task", { task: "tiered memory promotion", domain: "maxey0-system" })).structuredContent;
  assert.ok(w.paths.length && w.paths.every((p) => p.domain === "maxey0-system"));
});

test("tool errors are isError results, not protocol errors", async () => {
  const r = await call("get_topic", { topic_id: "nope" });
  assert.equal(r.isError, true); assert.match(r.content[0].text, /unknown topic/);
  assert.equal((await call("get_topic", {})).isError, true);
  assert.equal((await call("search", { query: "x", limit: "5" })).isError, true);
  assert.equal((await call("list_topics", { domain: "nope" })).isError, true);
  assert.equal((await modern("tools/call", { name: "no_such_tool", arguments: {} })).body.error.code, -32602);
});

test("resources: list, ontology, snapshot, topic template, not-found = -32602", async () => {
  const l = (await modern("resources/list")).body.result;
  assert.equal(l.resources.length, 9);   // 8 data resources + the MCP App page
  const o = JSON.parse((await modern("resources/read", { uri: "ctxplane://ontology" })).body.result.contents[0].text);
  assert.equal(o.spec, "maxey0.scw1-ontology/3");
  const s = JSON.parse((await modern("resources/read", { uri: "ctxplane://snapshot" })).body.result.contents[0].text);
  assert.equal(s.snapshot_digest, manifest.snapshot_digest);
  const t = JSON.parse((await modern("resources/read", { uri: "ctxplane://topic/math" })).body.result.contents[0].text);
  assert.equal(t.topic.id, "math");
  assert.equal((await modern("resources/read", { uri: "ctxplane://topic/zzz" })).body.error.code, -32602);
});

test("header validation: missing / mismatched headers -> 400 HeaderMismatch -32020", async () => {
  let r = await modern("tools/list", {}, { "mcp-method": "tools/call" });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, -32020);
  r = await modern("tools/call", { name: "list_topics", arguments: {} }, { "mcp-name": "get_topic" });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, -32020);
  r = await modern("tools/list", {}, { "mcp-protocol-version": "2025-11-25" });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, -32020);
  // base64 sentinel Mcp-Name is decoded before comparison
  r = await modern("tools/call", { name: "list_topics", arguments: {} }, { "mcp-name": "=?base64?" + btoa("list_topics") + "?=" });
  assert.equal(r.status, 200);
});

test("unsupported version -> 400 -32022 with supported list", async () => {
  const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "1900-01-01" } } };
  const res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "1900-01-01", "mcp-method": "tools/list" }, body: JSON.stringify(body) }), env);
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.equal(j.error.code, -32022); assert.equal(j.error.data.requested, "1900-01-01"); assert.ok(j.error.data.supported.includes(V));
});

test("modern: unknown method -> 404 -32601; removed ping/initialize rejected", async () => {
  let r = await modern("completion/unknown");
  assert.equal(r.status, 404); assert.equal(r.body.error.code, -32601);
  r = await modern("ping"); assert.equal(r.body.error.code, -32601);
  r = await modern("initialize"); assert.equal(r.body.error.code, -32601);
});

test("legacy: initialize negotiates, no session id minted, tools work", async () => {
  const i = await legacy("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old", version: "1" } }, null);
  assert.equal(i.status, 200); assert.equal(i.body.result.protocolVersion, "2025-06-18");
  assert.equal(i.body.result.serverInfo.name, "maxey0-context-plane");
  assert.equal(i.headers.get("mcp-session-id"), null);
  const u = await legacy("initialize", { protocolVersion: "2099-01-01" }, null);
  assert.equal(u.body.result.protocolVersion, "2025-11-25");
  const l = await legacy("tools/list");
  assert.equal(l.body.result.tools.length, 14); assert.equal(l.body.result.resultType, undefined);
  const c = await legacy("tools/call", { name: "route_task", arguments: { task: "dna transcription" } });
  assert.ok(c.body.result.structuredContent.paths.length > 0);
  assert.equal((await legacy("ping")).body.result && true, true);
  assert.equal((await legacy("resources/read", { uri: "ctxplane://nope" })).body.error.code, -32002);
});

test("transport: notification 202, GET/DELETE 405, bad Origin 403, bad JSON 400", async () => {
  let res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }), env);
  assert.equal(res.status, 202);
  assert.equal((await worker.fetch(new Request("https://x/mcp"), env)).status, 405);
  assert.equal((await worker.fetch(new Request("https://x/mcp", { method: "DELETE" }), env)).status, 405);
  res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" }), env);
  assert.equal(res.status, 403);
  res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { origin: "https://claude.ai", "content-type": "application/json" }, body: "{not json" }), env);
  assert.equal(res.status, 400);
});


test("v4: Foundations and Finance domains; Human0's test tasks route to the new topics", async () => {
  const d = (await call("list_domains", {})).structuredContent.domains;
  const n = Object.fromEntries(d.map((x) => [x.id, x.topics ?? x.topic_count ?? x.count]));
  console.log("domains", JSON.stringify(n));
  const want = {
    "get geographic coordinates": "location", "hike in California": "travel-outdoors", "build a website": "ui-frontend",
    "search local real estate": "real-estate", "drone simulator": "simulation", "use claude to do my taxes": "taxes",
    "read a 10-K filing": "equities", "take a company public with an IPO": "offerings", "offshore hedge fund master feeder structure": "hedge-funds",
    "AML red flags in wire transfers": "financial-regulation", "bitcoin wallet custody": "crypto", "price a call option": "derivatives",
    "convert time zones for a meeting": "time", "kubernetes cluster deployment": "infrastructure",
  };
  const got = {};
  for (const [task, topic] of Object.entries(want)) {
    const r = (await call("route_task", { task, limit: 1 })).structuredContent;
    got[task] = r.paths[0]?.topic ?? null;
  }
  console.log("routes", JSON.stringify(got));
  const ok = Object.entries(want).filter(([t, tp]) => got[t] === tp).length;
  assert.ok(ok >= Object.keys(want).length - 2, `only ${ok}/${Object.keys(want).length} routed to the expected topic`);
});

test("v4: location-resolution placeholder is recorded, not a rule", async () => {
  const s = (await call("get_skill", { skill_id: "env-location-resolution-placeholder" })).structuredContent;
  assert.match(JSON.stringify(s), /open question/i);
});

test("v4: topic-graph-generator prompt lists existing topics and the rules", async () => {
  const l = (await modern("prompts/list")).body.result;
  assert.deepEqual(l.prompts.map((p) => p.name), ["topic-graph-generator"]);
  const g = (await modern("prompts/get", { name: "topic-graph-generator", arguments: { topic: "Insurance Law", task: "explain subrogation" } })).body.result;
  const text = g.messages[0].content.text;
  assert.match(text, /human0\.topic-pack\/1/); assert.match(text, /REAL ONLY/); assert.match(text, /explain subrogation/); assert.match(text, /quantum-physics/);
});

test("v4: validate_topic_pack accepts a build pack and rejects broken ones", async () => {
  const fs = await import("node:fs");
  const good = JSON.parse(fs.readFileSync(new URL("../../SCW1/sources/packs/commodities.pack.json", import.meta.url)));
  const fresh = JSON.parse(JSON.stringify(good).replaceAll("cmd-", "cmx-").replaceAll('"commodities"', '"raw-materials"').replace('"Commodities"', '"Raw Materials"'));
  const ok = (await call("validate_topic_pack", { pack: fresh })).structuredContent;
  assert.equal(ok.ok, true, JSON.stringify(ok.problems)); assert.ok(ok.nearest_existing.length);
  const dup = (await call("validate_topic_pack", { pack: good })).structuredContent;   // ids already in the graph
  assert.equal(dup.ok, false); assert.ok(dup.problems.some((p) => /already exists/.test(p)));
  const bad = JSON.parse(JSON.stringify(fresh)); bad.skills[0][5] = [["cmx-energy", "support"]]; bad.concepts = bad.concepts.slice(0, 2); bad.topic.desc = "<script>";
  const b = (await call("validate_topic_pack", { pack: bad })).structuredContent;
  assert.equal(b.ok, false);
  for (const re of [/exactly one primary/, /3-8 concepts/, /control characters/]) assert.ok(b.problems.some((p) => re.test(p)), String(re));
});

test("MCP App: tool carries ui.resourceUri; ui:// resource is the app HTML with CSP; /app serves the page", async () => {
  const tools = (await modern("tools/list")).body.result.tools;
  const t = tools.find((x) => x.name === "open_context_plane_graph");
  assert.equal(t._meta.ui.resourceUri, "ui://maxey0-context-plane/graph.html");
  const res = (await modern("resources/list")).body.result.resources;
  assert.ok(res.some((r) => r.uri === "ui://maxey0-context-plane/graph.html" && r.mimeType === "text/html;profile=mcp-app"));
  const rd = (await modern("resources/read", { uri: "ui://maxey0-context-plane/graph.html" })).body.result.contents[0];
  assert.equal(rd.mimeType, "text/html;profile=mcp-app");
  assert.match(rd.text, /Maxey0 Context Plane Graph/); assert.match(rd.text, /ui\/initialize/);
  assert.deepEqual(rd._meta.ui.csp.connectDomains, ["https://x"]);   // the Worker that served it
  assert.ok(rd.text.includes("https://x") && !rd.text.includes("maxey0.workers.dev"), "page reads the graph from the serving Worker");
  const call1 = (await call("open_context_plane_graph", { task: "quantum entanglement of two qubits" })).structuredContent;
  assert.equal(call1.app_url, "https://x/app"); assert.equal(call1.best_route.topic, "quantum-physics");
  const bad = await call("open_context_plane_graph", { topic_id: "no-such-topic" });
  assert.equal(bad.isError, true);
  const page = await worker.fetch(new Request("https://cp.example/app"), env);
  assert.equal(page.status, 200); assert.match(page.headers.get("content-type"), /text\/html/);
  const html = await page.text(); assert.ok(html.includes("https://cp.example") && /Maxey0 Context Plane Graph/.test(html));
  assert.match(page.headers.get("content-security-policy"), /connect-src 'self'/);
});

test("every tool carries annotations.title for the directory listing", async () => {
  const tools = (await modern("tools/list")).body.result.tools;
  for (const t of tools) { assert.equal(t.annotations.title, t.title, t.name); assert.equal(t.annotations.readOnlyHint, true, t.name) }
});
