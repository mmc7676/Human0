// Runs the built dist/worker.js in Node (same fetch handler Cloudflare calls) on both plans.
// CPU budget: on the free plan every tool must use under BUDGET_MS of CPU here, leaving room under Cloudflare's 10 ms.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const BUDGET_MS = 6;
const t0 = process.cpuUsage();
const W = (await import("../dist/worker.js")).default;
const startup = process.cpuUsage(t0), startupMs = (startup.user + startup.system) / 1000;
const TIERS = JSON.parse(readFileSync(new URL("../../../plugins/space-at-scale/server/tiers.json", import.meta.url)));
const PAID_ONLY = Object.keys(TIERS.tools);
const ARGS = { scw_get: { id: "SCW6" }, scw_children: { id: "SCW6" }, scw_search: { query: "jup" }, scw_laws: { id: "SCW7:jupiter" }, scw_inheritance_rules: {},
  sim_state: { id: "SCW6" }, sim_clock: {}, run_evals: { id: "SCW0" }, inject_interstellar_comet: { v_inf_kms: 26, q_au: 0.25 }, events: {},
  validate_app_dropin: { scw_id: "SCW6", name: "Space-at-Scale", units: "AU" }, find_mining_targets: { task: "$3,000,000 of platinum within 5 AU" },
  plan_mission: { target: "Psyche" }, generate_universe: { seed: 42 }, find_mining_targets_parallel: { seed: 42, task: "$1,000,000 of iron within 10 AU" },
  generate_exotic_universe: { seed: 7 }, run_extraction_campaign: {}, plan_trip: { request: "plan a trip to Mars" }, link_hidden_universe: { model: "mirror" },
  remove_state: { kind: "all" }, galaxy_field: { r_kpc: 8.277, mass_msun: 1e5 }, galaxy_object: { name: "Sgr A*", t_myr: -1 }, energy_ledger: {},
  scw_relations: {}, open_space_at_scale: { focus: "Mars" } };
let n = 0;
async function rpc(env, method, params, headers = {}) {
  const r = await W.fetch(new Request("https://x/mcp", { method: "POST", headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) }), env);
  return { status: r.status, body: r.status === 202 ? null : await r.json() };
}
const FREE = { SCW_TIER: "free" }, PAID = { SCW_TIER: "paid" };

test("startup", () => { console.log(`startup CPU ${startupMs.toFixed(0)} ms (module load, once per isolate)`); });

test("initialize and health", async () => {
  const r = await rpc(FREE, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(r.body.result.serverInfo.name, "space-at-scale");
  const h = await (await W.fetch(new Request("https://x/healthz"), FREE)).json();
  assert.equal(h.tier, "free"); assert.deepEqual(h.paid_only.sort(), [...PAID_ONLY].sort());
});

test("tools/list per plan", async () => {
  const f = (await rpc(FREE, "tools/list", {})).body.result.tools.map((t) => t.name);
  const p = (await rpc(PAID, "tools/list", {})).body.result.tools.map((t) => t.name);
  assert.equal(p.length, 25); assert.equal(f.length, 25 - PAID_ONLY.length);
  for (const k of PAID_ONLY) { assert.ok(p.includes(k)); assert.ok(!f.includes(k)); }
  const u = (await rpc(undefined, "tools/list", {})).body.result.tools.length;
  assert.equal(u, f.length, "no SCW_TIER means free");
});

test("paid-only tool on free plan is refused with a clear message", async () => {
  const r = await rpc(FREE, "tools/call", { name: "run_evals", arguments: {} });
  assert.match(r.body.error.message, /not offered on this server's current plan/);
});

test("every tool runs; free-plan tools stay under the CPU budget", async () => {
  const rows = [];
  for (const [name, args] of Object.entries(ARGS)) {
    const env = PAID_ONLY.includes(name) ? PAID : FREE;
    let best = 1e9, r;
    for (let i = 0; i < 5; i++) { const c = process.cpuUsage(); r = await rpc(env, "tools/call", { name, arguments: args }); const d = process.cpuUsage(c); best = Math.min(best, (d.user + d.system) / 1000); }
    assert.ok(r.body.result, name + ": " + JSON.stringify(r.body.error));
    assert.equal(r.body.result.isError, false, name + ": " + r.body.result.content?.[0]?.text);
    rows.push([best, name, env.SCW_TIER]);
  }
  rows.sort((a, b) => b[0] - a[0]).forEach(([ms, nm, t]) => console.log(`${ms.toFixed(2).padStart(7)} ms  ${t.padEnd(4)}  ${nm}`));
  const over = rows.filter(([ms, , t]) => t === "free" && ms >= BUDGET_MS);
  assert.deepEqual(over, [], "free-plan tools over budget; move them to paid in tiers.json");
});

test("bad arguments are a tool error, not a crash", async () => {
  const r = await rpc(FREE, "tools/call", { name: "galaxy_field", arguments: { r_kpc: "far" } });
  assert.equal(r.body.result.isError, true);
});

test("MCP App resource is served", async () => {
  const l = (await rpc(FREE, "resources/list", {})).body.result.resources.map((x) => x.uri);
  assert.ok(l.includes("ui://space-at-scale/app.html"));
  const r = (await rpc(FREE, "resources/read", { uri: "ui://space-at-scale/app.html" })).body.result.contents[0];
  assert.equal(r.mimeType, "text/html;profile=mcp-app"); assert.ok(r.text.length > 2e6);
  assert.ok(!r.text.includes("api.anthropic.com"), "plugin app has no Claude panel");
});

test("modern 2026-07-28 request with matching headers", async () => {
  const v = "2026-07-28";
  const r = await rpc(FREE, "tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": v } }, { "mcp-protocol-version": v, "mcp-method": "tools/list" });
  assert.equal(r.body.result.resultType, "complete");
});

test("origin guard", async () => {
  const r = await W.fetch(new Request("https://x/mcp", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" }), FREE);
  assert.equal(r.status, 403);
});

test("public mode: nothing is stored", async () => {
  const r = await rpc(FREE, "tools/call", { name: "inject_interstellar_comet", arguments: { name: "T1", v_inf_kms: 30, q_au: 1 } });
  assert.match(r.body.result.content[0].text, /"persisted": false/);
  const c = await rpc(FREE, "tools/call", { name: "sim_clock", arguments: { rate: 5 } });
  assert.equal(c.body.result.isError, true);
});
