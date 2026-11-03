// Independent ontology checks on SCW1/scw1.graph.json. Written separately from the
// Python builder's own invariants, so the builder does not grade itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "SCW1");
const g = JSON.parse(readFileSync(join(root, "scw1.graph.json"), "utf8"));
const spec = JSON.parse(readFileSync(join(root, "ontology.spec.json"), "utf8"));
const by = (xs, k) => new Map(xs.map((x) => [x[k], x]));
const D = by(g.domains, "id"), T = by(g.topics, "id"), C = by(g.concepts, "id"), S = by(g.skills, "id"), A = by(g.agents, "key"), M = by(g.mcp, "id");

test("spine: every node has exactly one existing parent one level up", () => {
  for (const t of g.topics) assert.ok(D.has(t.domain), t.id);
  for (const c of g.concepts) assert.ok(T.has(c.topic), c.id);
  for (const s of g.skills) assert.ok(C.has(s.concept), s.id);
  for (const [, m] of [["t", T], ["c", C], ["s", S]]) assert.equal(m.size, [...m.keys()].length);
});

test("no empty branches: domain>=1 topic, topic>=3 concepts, concept>=1 skill, skill has a primary agent", () => {
  for (const d of g.domains) assert.ok(g.topics.some((t) => t.domain === d.id), d.id);
  for (const t of g.topics) assert.ok(g.concepts.filter((c) => c.topic === t.id).length >= 3, t.id);
  for (const c of g.concepts) assert.ok(g.skills.some((s) => s.concept === c.id), c.id);
  for (const s of g.skills) {
    assert.ok(s.agents.some((a) => a.role === "primary"), s.id);
    assert.equal(new Set(s.agents.map((a) => a.key)).size, s.agents.length, `duplicate agent on ${s.id}`);
    for (const a of s.agents) assert.ok(A.has(a.key), `${s.id} -> ${a.key}`);
  }
});

test("no level clashes or duplicates", () => {
  const tl = new Set(g.topics.map((t) => t.label.toLowerCase()));
  assert.equal(tl.size, g.topics.length, "topic labels unique");
  const cl = g.concepts.map((c) => c.label.toLowerCase());
  assert.equal(new Set(cl).size, cl.length, "concept labels unique");
  for (const c of g.concepts) assert.ok(!tl.has(c.label.toLowerCase()), `concept named like a topic: ${c.label}`);
  const ids = [...D.keys(), ...T.keys(), ...C.keys(), ...S.keys(), ...A.keys()];
  assert.equal(new Set(ids).size, ids.length, "ids unique across levels");
  // same name is one agent only within a topic: same-name agents never share a topic
  const topicsOf = new Map();
  for (const sk of g.skills) for (const a of sk.agents) {
    if (!topicsOf.has(a.key)) topicsOf.set(a.key, new Set());
    topicsOf.get(a.key).add(C.get(sk.concept).topic);
  }
  const byName = new Map();
  for (const a of g.agents) { const n = a.name.toLowerCase(); if (!byName.has(n)) byName.set(n, []); byName.get(n).push(a.key); }
  for (const [n, ks] of byName) for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++)
    for (const t of topicsOf.get(ks[i])) assert.ok(!topicsOf.get(ks[j]).has(t), `two '${n}' agents in topic ${t}`);
});

test("agents and MCP: no orphans, links evidence-backed, no invented links", () => {
  const used = new Set(g.skills.flatMap((s) => s.agents.map((a) => a.key)));
  for (const a of g.agents) assert.ok(used.has(a.key), `unused agent ${a.key}`);
  const declared = new Set((spec.declared_mcp_links ?? []).map((d) => d.agent + "|" + d.mcp));
  for (const l of g.agent_mcp) {
    assert.ok(A.has(l.agent) && M.has(l.mcp));
    if (l.basis === "declared:spec") { assert.ok(declared.has(l.agent + "|" + l.mcp), "undeclared declared-link"); continue; }
    if (l.basis === "inherited:checker-of-primary") {
      const sk = S.get(l.via.skill);
      assert.ok(sk.agents.some((a) => a.key === l.agent && a.role === "checker"), "inherited by a non-checker");
      assert.ok(sk.agents.some((a) => a.key === l.via.primary && a.role === "primary"), "via is not the primary");
      assert.ok(g.agent_mcp.some((x) => x.agent === l.via.primary && x.mcp === l.mcp && !x.basis.startsWith("inherited")), "primary does not hold it");
      continue;
    }
    assert.ok(l.score >= spec.similarity.thresholds.mcp_link, `weak link ${l.agent}->${l.mcp}`);
    assert.equal(l.basis, "derived:tfidf-cosine");
  }
  for (const d of declared) assert.ok(g.agent_mcp.some((l) => l.agent + "|" + l.mcp === d && l.basis === "declared:spec"), d);
  const listed = new Set(Object.values(g.topic_mcp).flat());
  const linked = new Set(g.agent_mcp.map((l) => l.mcp));
  for (const m of g.mcp) assert.ok(listed.has(m.id) || linked.has(m.id), `orphan mcp ${m.name}`);
  const uu = g.mcp.filter((m) => m.uuid).map((m) => m.uuid);
  assert.equal(new Set(uu).size, uu.length, "one registry row per uuid");
  for (const [t, v] of Object.entries(g.topic_mcp)) { assert.ok(T.has(t)); for (const u of v) assert.ok(M.has(u)); }
});

test("spec decisions are reflected", () => {
  for (const t of Object.keys(spec.removed_topics)) assert.ok(!T.has(t), t);
  for (const [src, dst] of Object.entries(spec.concept_merges)) { assert.ok(!C.has(src), src); assert.ok(C.has(dst), dst); }
  for (const s of Object.keys(spec.dropped_skills)) assert.ok(!S.has(s), s);
  for (const t of spec.work_topics) assert.equal(T.get(t).domain, "work", t);
  for (const t of Object.keys(spec.maxey0_topics)) assert.equal(T.get(t).domain, "maxey0-system", t);
  assert.equal(g.topics.filter((t) => t.domain === "maxey0-system").length, 1);
  // Maxey0 is one topic with 8 concepts; every former Maxey0 skill survives the concept merges
  assert.equal(g.concepts.filter((c) => c.topic === "maxey0").length, 8);
  assert.equal(g.skills.filter((s) => s.concept.startsWith("mx-")).length, 81);   // 26 + 30 + 25 before the merge
  for (const r of g.related) {
    assert.ok(C.has(r.a) && C.has(r.b)); assert.notEqual(C.get(r.a).topic, C.get(r.b).topic);
    assert.ok(r.score >= spec.similarity.thresholds.related); assert.equal(r.basis, "derived:tfidf-cosine");
  }
});

test("every agent is a MaxeyN agent; Maxey0 orchestrates; source keys kept", () => {
  const re = new RegExp("^" + spec.id_rules.maxey_agent_key.pattern + "$");
  for (const a of g.agents) assert.match(a.key, re, a.key);
  assert.equal(A.get("Maxey0").name, "SuperAgent Orchestrator");
  assert.equal(A.get("Maxey00").name, "Superposition Agent");
  const renamed = g.agents.filter((a) => a.legacy_key);
  assert.ok(renamed.length > 700);
  assert.equal(new Set(renamed.map((a) => a.legacy_key)).size, renamed.length);
  for (const a of renamed) assert.ok(Number(a.key.slice(5)) > 801, a.key);
});

test("MaxeyN keys are stable: every registry entry is honoured", () => {
  const reg = JSON.parse(readFileSync(join(root, "maxey_registry.json"), "utf8"));
  assert.equal(new Set(Object.values(reg)).size, Object.keys(reg).length, "registry values unique");
  for (const a of g.agents) if (a.legacy_key) assert.equal(reg[a.legacy_key], a.key, a.legacy_key);
});

test("test-chat findings stay fixed", () => {
  // 1. physics' Data Analyst Agent is its own agent, without the data topic's warehouse servers
  const sk = g.skills.find((s) => s.label === "Entanglement Entropy Analyzer");
  assert.equal(sk.agents.find((a) => a.role === "checker").key, "Maxey1500", "override: Quantum Consistency Checker");
  const checker = "Maxey1617";
  for (const sk2 of g.skills) if (sk2.agents.some((a) => a.key === checker)) assert.ok(["classical-physics", "quantum-physics", "physics-foundations"].includes(C.get(sk2.concept).topic));
  const names = g.agent_mcp.filter((l) => l.agent === checker).map((l) => M.get(l.mcp).name);
  assert.ok(!names.includes("Snowflake"), names.join(","));
  // 1b. servers listed by a pack follow its concepts into the topics they merged into
  const qs = [...M.values()].find((m) => m.name === "quantum-simulator-mcp").id;
  assert.ok(g.agent_mcp.some((l) => l.agent === "Maxey1498" && l.mcp === qs), "primary quantum agent holds quantum-simulator-mcp");
  assert.ok(g.topic_mcp["quantum-physics"].includes(qs));
  // 2. the orchestrator holds its own store
  assert.ok(g.agent_mcp.some((l) => l.agent === "Maxey0" && l.mcp === "session:Maxey0"));
  // 3. the Maxey0 System domain describes Maxey0, not Human0
  assert.match(D.get("maxey0-system").desc, /^How Maxey0 itself runs/);
});

test("checker rule: every checker holds its primary's servers for that skill's topic", () => {
  let checked = 0;
  for (const sk of g.skills) {
    const t = C.get(sk.concept).topic;
    const prim = sk.agents.filter((a) => a.role === "primary").map((a) => a.key);
    const chk = sk.agents.filter((a) => a.role === "checker").map((a) => a.key);
    for (const l of g.agent_mcp) {
      if (!prim.includes(l.agent) || l.basis.startsWith("inherited") || !(l.topic === t || l.topic === null)) continue;
      for (const c of chk) { assert.ok(g.agent_mcp.some((x) => x.agent === c && x.mcp === l.mcp), `${sk.id}: ${c} lacks ${l.mcp}`); checked++; }
    }
  }
  assert.ok(checked > 200, String(checked));
  const q = g.agent_mcp.filter((l) => l.agent === "Maxey1500").map((l) => M.get(l.mcp).name);
  assert.ok(q.includes("quantum-simulator-mcp"), q.join(","));
});
