// The dense second signal (src/dense.ts + the hybrid space in src/lens.ts), tested without Cloudflare: a deterministic
// stand-in embedder (hashed bag of words, 1024 dims) and an in-memory KV. What is checked is the plumbing and the maths:
// warming in steps, the stored index, the hybrid score, and that the lens stays well-formed with a dense signal.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const g = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "scw1.graph.json"), "utf8"));
let D, G, L;
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "dense-"));
  for (const [f, k] of [["dense.ts", "d"], ["graph.ts", "g"], ["lens.ts", "l"]])
    await build({ entryPoints: [join(here, "..", "src", f)], bundle: true, format: "esm", platform: "neutral", outfile: join(dir, k + ".mjs"), logLevel: "error" });
  D = await import(pathToFileURL(join(dir, "d.mjs")).href); G = await import(pathToFileURL(join(dir, "g.mjs")).href); L = await import(pathToFileURL(join(dir, "l.mjs")).href);
});
const fakeEmbed = (t) => { const v = new Array(1024).fill(0); for (const w of t.toLowerCase().match(/[a-z]{3,}/g) || []) { let h = 2166136261; for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  v[(h >>> 0) % 1024] += 1; v[((h >>> 10) >>> 0) % 1024] += 0.5 } v[0] += 3; return v };   // v[0]: a shared offset, removed by centring
const env = () => { const kv = new Map(); let calls = 0;
  return { calls: () => calls, kv, AI: { run: async (m, { text }) => { calls++; assert.equal(m, "@cf/baai/bge-m3"); return { shape: [text.length, 1024], data: text.map(fakeEmbed) } } },
    DENSE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v) }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) } } };

test("warming builds the index in steps and stores it per graph digest", async () => {
  const E = env(), { keys } = D.nodeTexts(g);
  assert.equal(keys.length, Object.keys(g.field.xy).length, "one text per node of all six levels");
  let st, steps = 0; do { st = await D.warmStep(E, g); steps++ } while (!st.ready && steps < 50);
  assert.ok(st.ready && st.total === Math.ceil(keys.length / 50), JSON.stringify(st));
  assert.equal(E.calls(), st.total, "one embedding call per chunk, no repeats");
  assert.ok(E.kv.has("bge-m3:" + g.snapshot_digest + ":full"));
  const again = await D.warmStep(E, g); assert.ok(again.ready && again.embedded_now === 0, "warming is idempotent");
  const idx = await D.loadIndex(E, g);
  for (const k of [keys[0], "s:dv-option-pricer", "m:" + g.mcp[0].id]) { const r = D.rowOf(idx, k); assert.ok(Math.abs(D.ddot(r, r) - 1) < 1e-4, k) }
  let mean0 = 0; for (const k of keys.slice(0, 200)) mean0 += D.rowOf(idx, k)[0]; assert.ok(Math.abs(mean0 / 200) < 0.2, "centred: the shared offset is removed");
});

test("hybrid score = (1 - beta) TF-IDF + beta dense; dense alone can match a task with no map words", async () => {
  const E = env(); while (!(await D.warmStep(E, g)).ready);
  const idx = await D.loadIndex(E, g), gr = new G.Graph(g);
  const task = "price a European call option with Black-Scholes";
  const q = await D.embedTask(E, idx, task), sig = { beta: 0.5, q, get: (k) => D.rowOf(idx, k), model: D.DENSE_MODEL };
  const r = gr.search({ query: task, limit: 5, _dense: sig }), top = r.results[0];
  const plain = gr.search({ query: task, limit: 50 }).results.find((x) => x.id === top.id && x.kind === top.kind);
  const t = plain ? plain.score : 0, d = D.ddot(D.rowOf(idx, (top.kind === "skill" ? "s:" : "c:") + top.id), q);
  assert.ok(Math.abs(top.score - (0.5 * t + 0.5 * d)) < 2e-4, JSON.stringify({ top, t, d }));
  assert.match(r.method, /dense @cf\/baai\/bge-m3 \(beta 0.5\)/);
  const none = "zxqv wuffle"; assert.throws(() => gr.search({ query: none }), /no indexed words/);
  const qn = await D.embedTask(E, idx, "option pricing derivatives"); assert.ok(qn.length === 1024);
});

test("lens with the dense signal: five levels, unit weights, drift = psi - flat, shortlist bounds the work", async () => {
  const E = env(); while (!(await D.warmStep(E, g)).ready);
  const idx = await D.loadIndex(E, g), gr = new G.Graph(g);
  const task = "Design a marketing email campaign, segment the customer list, A/B test subject lines, and measure attribution in a dashboard";
  const sig = { beta: 0.5, q: await D.embedTask(E, idx, task), get: (k) => D.rowOf(idx, k), model: D.DENSE_MODEL };
  const r = gr.route_task({ task, mode: "lens", _dense: sig });
  assert.deepEqual(r.lens.map((l) => l.level), ["topic", "concept", "skill", "agent", "mcp"]);
  assert.equal(r.signal.dense, 0.5); assert.equal(r.signal.shortlist, L.SHORTLIST);
  for (const l of r.lens) { assert.ok(Math.abs(l.selected.reduce((s, x) => s + x.weight * x.weight, 0) - 1) < 2e-3);
    for (const x of l.selected) assert.ok(Math.abs(x.drift.drift - (x.psi - x.drift.flat)) < 2e-4 && Number.isFinite(x.psi)) }
  assert.equal(r.lens[2].candidates, g.skills.length, "ranks seen from above still cover every skill");
  const flat = gr.route_task({ task }); const flatD = gr.route_task({ task, _dense: sig });
  assert.ok(flat.matched && flatD.matched && flatD.signal.model === D.DENSE_MODEL);
});

test("without a dense signal the lens is exactly the TF-IDF lens", () => {
  const gr = new G.Graph(g), fx = JSON.parse(readFileSync(join(here, "lens.fixture.json"), "utf8"));
  for (const f of fx) assert.deepEqual(gr.route_task({ task: f.task, mode: "lens" }).lens.slice(0, 3).map((l) => l.selected.map((s) => s.id)), f.levels, f.task);
});
