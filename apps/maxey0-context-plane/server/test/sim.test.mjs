// The server's tokenizer + vectoriser (src/sim.ts) must reproduce every vector the
// Python builder stored, or search would score differently from the build.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const g = JSON.parse(readFileSync(join(here, "..", "..", "SCW1", "scw1.graph.json"), "utf8"));
let sim;
before(async () => {
  const out = join(mkdtempSync(join(tmpdir(), "sim-")), "s.mjs");
  await build({ entryPoints: [join(here, "..", "src", "sim.ts")], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });
  sim = await import(pathToFileURL(out).href);
});
const eq = (a, b, id) => {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), id);
  for (const k of Object.keys(a)) assert.ok(Math.abs(a[k] - b[k]) <= 2e-6, `${id}:${k}`);
};
test("TS vectors == Python vectors for all concepts and skills", () => {
  const { idf, vectors } = g.similarity;
  for (const c of g.concepts) eq(sim.vec([c.label, c.desc, c.keywords.join(" ")].join(" "), idf), vectors["c:" + c.id], c.id);
  for (const s of g.skills) eq(sim.vec(s.label + " " + s.desc, idf), vectors["s:" + s.id], s.id);
});
test("vectors are unit length and cosine is symmetric", () => {
  for (const [id, v] of Object.entries(g.similarity.vectors)) {
    const n = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    if (Object.keys(v).length) assert.ok(Math.abs(n - 1) < 1e-4, id);
  }
  const v = g.similarity.vectors;
  assert.equal(sim.cos(v["c:cl-mechanics"], v["c:qm-foundations"]), sim.cos(v["c:qm-foundations"], v["c:cl-mechanics"]));
});
