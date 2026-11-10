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

test("tools/list: 15 read-only tools, deterministic order, cacheable", async () => {
  const a = (await modern("tools/list")).body.result, b = (await modern("tools/list")).body.result;
  assert.equal(a.tools.length, 15);
  assert.deepEqual(a.tools.map((t) => t.name), b.tools.map((t) => t.name));
  assert.ok(a.tools.every((t) => t.annotations.readOnlyHint === true && t.inputSchema.type === "object"));
  assert.equal(a.resultType, "complete"); assert.ok(a.ttlMs > 0);
});

test("domains and every topic served with manifest counts; removed/merged topics absent", async () => {
  const d = (await call("list_domains", {})).structuredContent.domains;
  assert.deepEqual(d.map((x) => x.id), ["agentic-systems", "data-science", "math-physical-sciences", "engineering", "life-health-mind", "earth-environment-place", "business-finance", "society-governance", "languages-communication", "area-identity-studies", "humanities-arts"]);
  const r = (await call("list_topics", {})).structuredContent;
  assert.equal(r.count, manifest.entries.length);
  const byId = Object.fromEntries(r.topics.map((t) => [t.id, t]));
  for (const e of manifest.entries) { assert.equal(byId[e.id].domain, e.domain); assert.equal(byId[e.id].concepts, e.counts.concepts, e.id); }
  for (const gone of ["digestion", "nutrition", "medical-conditions", "physics", "maxey0", "location", "infrastructure"]) assert.ok(!byId[gone], gone);
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
  const t = (await call("children", { level: "topic", parent_id: "agentic-systems" })).structuredContent.children;
  assert.ok(t.some((x) => x.id === "maxey0-context-architecture"));
  const c = (await call("children", { level: "concept", parent_id: "maxey0-context-architecture" })).structuredContent.children;
  assert.equal(c.length, 6); assert.ok(c.some((x) => x.id === "mx-memory"));
  const s = (await call("children", { level: "skill", parent_id: "mx-memory" })).structuredContent.children;
  const sk = (await call("get_skill", { skill_id: s[0].id })).structuredContent;
  assert.deepEqual([sk.domain, sk.topic, sk.concept], ["agentic-systems", "maxey0-context-architecture", "mx-memory"]);
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

test("physics: normal-size topics carry the declared priority of the topics they came from; overview concepts merged away", async () => {
  const want = { "classical-physics": "Newtonian Mechanics", "quantum-physics": "Quantum Foundations", "thermodynamics-and-transport-phenomena": "Transport Phenomena", "optics-photonics-and-plasma": "Optics and Photonics" };
  for (const [id, label] of Object.entries(want)) {
    const t = (await call("get_topic", { topic_id: id })).structuredContent;
    assert.equal(t.domain, id.startsWith("thermo") ? "engineering" : "math-physical-sciences"); assert.equal(t.priority, 1);
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
  for (const d of ["agentic-systems", "data-science", "math-physical-sciences", "engineering", "life-health-mind", "earth-environment-place", "business-finance", "society-governance", "languages-communication", "area-identity-studies", "humanities-arts"]) {
    const r = (await at("/mcp/" + d, "tools/call", { name: "list_topics", arguments: {} })).body.result.structuredContent;
    assert.ok(r.count > 0 && r.topics.every((t) => t.domain === d), d); sum += r.count;
    const dom = (await at("/mcp/" + d, "tools/call", { name: "list_domains", arguments: {} })).body.result.structuredContent.domains;
    assert.deepEqual(dom.map((x) => x.id), [d]);
    const disc = (await at("/mcp/" + d, "server/discover")).body.result;
    assert.match(disc.instructions, new RegExp("only the '" + d + "' domain"));
  }
  assert.equal(sum, all.count);
  const cross = (await at("/mcp/business-finance", "tools/call", { name: "get_topic", arguments: { topic_id: "classical-physics" } })).body.result;
  assert.equal(cross.isError, true);
  const route = (await at("/mcp/agentic-systems", "tools/call", { name: "route_task", arguments: { task: "quantum entanglement of two qubits" } })).body.result.structuredContent;
  assert.ok(route.paths.every((p) => p.domain === "agentic-systems"));
  const h = (await at("/mcp/math-physical-sciences", "tools/call", { name: "get_harness", arguments: { topic_id: "quantum-physics" } })).body.result.structuredContent;
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
  const nNodes = gi.domains.length + gi.topics.length + gi.concepts.length + gi.skills.length + gi.agents.length + gi.mcp.length;
  assert.ok(gi.similarity.idf && Object.keys(gi.similarity.vectors).length === nNodes, "every node of all six levels has a vector");
  assert.equal(Object.keys(g.field.xy).length, nNodes, "every node has a field location (graph.json, no index needed)");
  assert.ok(Object.values(g.field.xy).every(([x, y]) => Math.hypot(x, y) <= 1.0001));
  assert.equal((await worker.fetch(new Request("https://x/graph.json", { method: "OPTIONS" }), env)).status, 204);
  assert.equal((await worker.fetch(new Request("https://x/graph.json", { method: "POST", body: "{}" }), env)).status, 405);
});

test("route_task returns full vertical paths; domain filter works", async () => {
  const r = (await call("route_task", { task: "orbital mechanics trajectory", limit: 2 })).structuredContent;
  assert.ok(r.paths.length > 0);
  for (const p of r.paths) assert.ok(p.domain && p.topic && p.concept && p.skill && p.agents.length);
  const w = (await call("route_task", { task: "tiered memory promotion", domain: "agentic-systems" })).structuredContent;
  assert.ok(w.paths.length && w.paths.every((p) => p.domain === "agentic-systems"));
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
  const t = JSON.parse((await modern("resources/read", { uri: "ctxplane://topic/linear-algebra-and-geometry" })).body.result.contents[0].text);
  assert.equal(t.topic.id, "linear-algebra-and-geometry");
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
  assert.equal(l.body.result.tools.length, 15); assert.equal(l.body.result.resultType, undefined);
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


test("Human0's test tasks route to the topics that now hold their concepts", async () => {
  const d = (await call("list_domains", {})).structuredContent.domains;
  const n = Object.fromEntries(d.map((x) => [x.id, x.topics ?? x.topic_count ?? x.count]));
  console.log("domains", JSON.stringify(n));
  const want = {
    "get geographic coordinates": "places-routing-and-travel", "hike in California": "places-routing-and-travel", "build a website": "front-end-and-ui-engineering",
    "search local real estate": "real-estate", "drone simulator": "simulation-and-digital-twins", "use claude to do my taxes": "taxes-and-personal-finance",
    "read a 10-K filing": "equities", "take a company public with an IPO": "securities-offerings", "offshore hedge fund master feeder structure": "hedge-funds-and-private-funds",
    "AML red flags in wire transfers": "financial-regulation-and-aml", "bitcoin wallet custody": "crypto-and-digital-assets", "price a call option": "derivatives",
    "convert time zones for a meeting": "time-and-scheduling", "kubernetes cluster deployment": "cloud-infrastructure-and-devops",
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

test("shared embedding field: nearest across levels, by node or text; linked nodes sit closer than random", async () => {
  const q = (await call("nearest", { text: "price an option with black scholes", level: "skill", limit: 3 })).structuredContent;
  assert.equal(q.results[0].id, "dv-option-pricer");
  const t = (await call("nearest", { node_id: "quantum-physics", level: "agent", limit: 5 })).structuredContent;
  assert.equal(t.from.level, "topic"); assert.equal(t.results.length, 5); assert.ok(t.results.every((r) => r.level === "agent" && r.xy.length === 2));
  const m = (await call("nearest", { node_id: "Maxey0", level: "mcp", limit: 3 })).structuredContent;
  assert.ok(m.results.every((r) => r.level === "mcp"));
  const bad = await call("nearest", { node_id: "x", text: "y" }); assert.equal(bad.isError, true);
  const g = await (await worker.fetch(new Request("https://x/graph.json"), env)).json(), xy = g.field.xy, d = (a, b) => Math.hypot(xy[a][0] - xy[b][0], xy[a][1] - xy[b][1]);
  const mean = (ps) => ps.reduce((s, [a, b]) => s + d(a, b), 0) / ps.length;
  const keys = Object.keys(xy); let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const random = Array.from({ length: 4000 }, () => [keys[Math.floor(rnd() * keys.length)], keys[Math.floor(rnd() * keys.length)]]);
  const tc = g.concepts.map((c) => ["t:" + c.topic, "c:" + c.id]), gate = g.agent_mcp.map((l) => ["a:" + l.agent, "m:" + l.mcp]);
  assert.ok(mean(tc) < 0.5 * mean(random), "topic-concept closer than random");
  assert.ok(mean(gate) < mean(random), "agent-server gates closer than random");
});

const f0 = (fx) => fx[3].task;
test("observer-lens routing: same chain as the reference implementation; superposed branches, signed contributions", async () => {
  const fx = JSON.parse(readFileSync(join(here, "lens.fixture.json"), "utf8"));
  for (const f of fx) {
    const r = (await call("route_task", { task: f.task, mode: "lens" })).structuredContent;
    assert.equal(r.mode, "lens");
    assert.deepEqual(r.lens.slice(0, 3).map((l) => l.selected.map((s) => s.id)), f.levels, f.task);
    assert.deepEqual(r.paths.map((p) => p.skill), f.skills, f.task);
    for (const l of r.lens) { assert.ok(Math.abs(l.selected.reduce((s, x) => s + x.weight * x.weight, 0) - 1) < 2e-3, "weights " + JSON.stringify(l.selected)); assert.ok(l.selected.every((x) => x.psi > 0), "psi"); }
  }
  const sup = (await call("route_task", { task: f0(fx), mode: "lens" })).structuredContent.lens;
  for (const l of sup.slice(1)) { assert.ok(Array.isArray(l.suppressed)); for (const s of l.selected) assert.ok(Object.keys(s.contributions).length >= 1); }
  const d = (await call("route_task", { task: "price a call option", mode: "lens", domains: ["business-finance"] })).structuredContent;
  const topicsOf = Object.fromEntries((await call("list_topics", {})).structuredContent.topics.map((t) => [t.id, t.domain]));
  assert.ok(d.lens[0].selected.every((s) => topicsOf[s.id] === "business-finance"), "observer starts in the chosen domain");
  assert.equal((await call("route_task", { task: "x y", mode: "nope" })).isError, true);
});

test("lens continues through agents and MCP servers; drift is recorded per node, per level and around the path", async () => {
  const r = (await call("route_task", { task: "Work with a MCP architect to build a concept plane. then find a marketing exec to write the logic and domain expertise of our marketing bot.", mode: "lens" })).structuredContent;
  assert.deepEqual(r.lens.map((l) => l.level), ["topic", "concept", "skill", "agent", "mcp"]);
  const skillsSel = r.lens[2].selected.map((s) => s.id), agentSel = r.lens[3].selected.map((s) => s.id);
  const kids = new Set(); for (const sid of skillsSel) for (const a of (await call("get_skill", { skill_id: sid })).structuredContent.skill.agents) kids.add(a.key);
  assert.ok(agentSel.every((a) => kids.has(a)), "agents are children of the chosen skills");
  assert.equal(r.lens[3].candidates, kids.size, "agent candidates = the chosen skills' agents");
  const gates = new Set(); for (const a of agentSel) for (const m of (await call("get_agent", { agent_key: a })).structuredContent.mcp_links) gates.add(m.mcp);
  assert.ok(r.lens[4].selected.every((m) => gates.has(m.id)), "MCP servers are gated to the chosen agents");
  assert.deepEqual(r.agents, agentSel); assert.deepEqual(r.mcp_servers, r.lens[4].selected.map((s) => s.id));
  for (const l of r.lens) {
    assert.ok(l.task_out <= l.task_in + 1e-4 && l.explained >= 0 && l.explained <= 1, "task norms " + l.level);
    for (const s of l.selected) { const d = s.drift; assert.ok(Math.abs(d.drift - (s.psi - d.flat)) < 2e-4 && d.lens_rank >= 1 && d.flat_rank >= 1, "drift " + JSON.stringify(d)); }
  }
  const D = r.drift; assert.equal(D.scw, "SCW-path"); assert.equal(D.levels, 5); assert.equal(D.chain[3].scw, "SCW-level:agent");
  assert.ok(D.chain.every((l) => l.nodes.every((n) => n.scw.startsWith("SCW-drift:") && Array.isArray(n.field) && n.field.length === 3)), "every node has a drift SCW and a 3D field place");
  assert.ok(Math.abs(D.total_drift - D.chain.reduce((t, l) => t + l.nodes.reduce((u, n) => u + Math.abs(n.drift), 0), 0)) < 1e-3);
});

test("open_context_plane_graph passes domain, mode and field to the app; rejects unknown values", async () => {
  const r = (await call("open_context_plane_graph", { task: "price a call option", domain: "business-finance", mode: "lens", field: true })).structuredContent;
  assert.equal(r.domain, "business-finance"); assert.equal(r.mode, "lens"); assert.ok(r.best_route && r.best_route.domain === "business-finance");
  assert.equal((await call("open_context_plane_graph", { domain: "nope" })).isError, true);
  assert.equal((await call("open_context_plane_graph", { mode: "x" })).isError, true);
});

test("a word that is also an Object.prototype key ('constructor') never turns scores into NaN", async () => {
  const f = (await call("route_task", { task: "build a finite automaton constructor that accepts a test string" })).structuredContent;
  assert.ok(f.matched && f.paths.length > 0, "flat route matches");
  const l = (await call("route_task", { task: "build a finite automaton constructor that accepts a test string", mode: "lens" })).structuredContent;
  for (const lv of l.lens) for (const x of lv.selected) assert.ok(Number.isFinite(x.psi) && Number.isFinite(x.drift.drift), JSON.stringify(x));
  assert.ok(Number.isFinite(l.remaining_task));
});

test("dense signal end to end through the Worker: /dense warms in steps, then route_task and /route use TF-IDF + bge-m3", async () => {
  const fake = (t) => { const v = new Array(1024).fill(0); for (const w of t.toLowerCase().match(/[a-z]{3,}/g) || []) { let h = 2166136261; for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619); v[(h >>> 0) % 1024] += 1 } v[1] += 2; return v };
  const kv = new Map(); let calls = 0; const waits = [];
  const denv = { ...env, AI: { run: async (m, { text }) => { calls++; return { data: text.map(fake) } } },
    DENSE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v) }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) } };
  const ctx = { waitUntil: (p) => waits.push(p) };
  const get = async (path, init) => { const r = await worker.fetch(new Request("https://x" + path, init), denv, ctx); return { status: r.status, body: await r.json() } };
  assert.equal((await get("/dense")).body.ready, false);
  // before the index exists: TF-IDF only, the reason is stated, and one warm step is started in the background
  const before = await get("/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "price a call option" }) });
  assert.equal(before.status, 200); assert.equal(before.body.signal.tfidf, 1); assert.match(before.body.dense_status.reason, /being built/);
  await Promise.all(waits);
  let st; do { st = (await get("/dense", { method: "POST" })).body } while (!st.ready);
  assert.ok(st.total > 0 && (await get("/dense")).body.ready);
  const r = await get("/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "Design a marketing email campaign, segment the customer list and measure attribution", mode: "lens" }) });
  assert.equal(r.body.signal.dense, 0.7); assert.equal(r.body.signal.model, "@cf/baai/bge-m3"); assert.equal(r.body.lens.length, 5);
  const viaMcp = await (async () => { const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "route_task", arguments: { task: "price a call option", dense_weight: 0.3 } } };
    const res = await worker.fetch(new Request("https://x/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2025-11-25" }, body: JSON.stringify(body) }), denv, ctx); return (await res.json()).result.structuredContent })();
  assert.equal(viaMcp.signal.dense, 0.3); assert.ok(viaMcp.matched && typeof viaMcp.paths[0].score === "number");
  const off = await get("/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "price a call option", dense: false }) });
  assert.equal(off.body.signal.tfidf, 1);
  const bad = await get("/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "x", dense_weight: 2 }) });
  assert.equal(bad.status, 400);
});

test("performance budget (server CPU per route, in-process): flat under 15 ms, lens under 60 ms (median of 5)", async () => {
  const med = async (args) => { const t = []; for (let i = 0; i < 6; i++) { const a = performance.now(); await call("route_task", args); t.push(performance.now() - a) } t.shift(); t.sort((x, y) => x - y); return t[2] };
  const T = "Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard";
  const flat = await med({ task: T }), lens = await med({ task: T, mode: "lens" });
  console.log("# perf server", JSON.stringify({ flat_ms: +flat.toFixed(1), lens_ms: +lens.toFixed(1) }));
  assert.ok(flat < 15, "flat " + flat.toFixed(1) + " ms"); assert.ok(lens < 60, "lens " + lens.toFixed(1) + " ms");
});
