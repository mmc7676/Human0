// Read-only query layer over the SCW1 graph (schema human0.scw1-graph/2).
// Spine (one parent each): Domain -> Topic -> Concept -> Skill
// Differentiation:        Skill -> Agents (role) -> MCP servers (derived links)

export interface Domain { id: string; label: string; desc: string }
export interface Topic { id: string; label: string; desc: string; domain: string; sources: string[]; priority: number }
export interface Concept { id: string; label: string; desc: string; keywords: string[]; topic: string; source: string }
export interface SkillAgent { key: string; role: string }
export interface Skill { id: string; concept: string; label: string; desc: string; type: string; agents: SkillAgent[]; source: string }
export interface Agent { key: string; name: string; legacy_key?: string }
export interface Mcp { id: string; uuid: string | null; name: string; desc: string; tools: string[]; state: string; source: string; origins: string[] }
export interface AgentMcp { agent: string; mcp: string; topic: string | null; score: number | null; basis: string; via?: { primary: string; skill: string } }
export interface Related { a: string; b: string; score: number; basis: string }
export interface Similarity { method: string; thresholds: { mcp_link: number; mcp_link_top_k: number; related: number; search_min: number };
  idf: Record<string, number>; vectors: Record<string, Vec> }
export interface GraphData {
  schema: string; scw: string; snapshot_digest: string;
  domains: Domain[]; topics: Topic[]; concepts: Concept[]; skills: Skill[]; agents: Agent[]; mcp: Mcp[];
  agent_mcp: AgentMcp[]; topic_mcp: Record<string, string[]>; related: Related[]; lexicon: Record<string, Record<string, string>>; similarity: Similarity;
  topic_priority: { source: string; use: string; default: number };
}

/** The graph restricted to one domain: topics, concepts and skills of that domain, the
 *  agents serving those skills, their MCP links, the MCP servers those topics list, and
 *  related links inside the domain. The similarity index (idf) stays global. */
export function scopeTo(g: GraphData, domain: string): GraphData {
  const topics = g.topics.filter((t) => t.domain === domain);
  const T = new Set(topics.map((t) => t.id));
  const concepts = g.concepts.filter((c) => T.has(c.topic));
  const C = new Set(concepts.map((c) => c.id));
  const skills = g.skills.filter((s) => C.has(s.concept));
  const A = new Set(skills.flatMap((s) => s.agents.map((a) => a.key)));
  const agent_mcp = g.agent_mcp.filter((l) => A.has(l.agent) && (l.topic === null || T.has(l.topic)));
  const topic_mcp = Object.fromEntries(Object.entries(g.topic_mcp).filter(([t]) => T.has(t)));
  const M = new Set([...agent_mcp.map((l) => l.mcp), ...Object.values(topic_mcp).flat()]);
  const keep = new Set([...[...C].map((c) => "c:" + c), ...skills.map((s) => "s:" + s.id)]);
  return { ...g, domains: g.domains.filter((d) => d.id === domain), topics, concepts, skills,
    agents: g.agents.filter((a) => A.has(a.key)), mcp: g.mcp.filter((m) => M.has(m.id)), agent_mcp, topic_mcp,
    related: g.related.filter((r) => C.has(r.a) && C.has(r.b)),
    lexicon: Object.fromEntries(Object.entries(g.lexicon).filter(([t]) => T.has(t))),
    similarity: { ...g.similarity, vectors: Object.fromEntries(Object.entries(g.similarity.vectors).filter(([k]) => keep.has(k))) } };
}

import { cos, vec, Vec } from "./sim";

export class ToolError extends Error {}
export const LEVELS = ["domain", "topic", "concept", "skill", "agent", "mcp"] as const;

const idx = <T, K extends keyof T>(xs: T[], k: K) => new Map(xs.map((x) => [x[k] as unknown as string, x]));
const group = <T>(xs: T[], f: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); }
  return m;
};

export class Graph {
  readonly domain: Map<string, Domain>; readonly topic: Map<string, Topic>; readonly concept: Map<string, Concept>;
  readonly skill: Map<string, Skill>; readonly agent: Map<string, Agent>; readonly mcp: Map<string, Mcp>;
  readonly topicsByDomain: Map<string, Topic[]>; readonly conceptsByTopic: Map<string, Concept[]>;
  readonly skillsByConcept: Map<string, Skill[]>; readonly linksByAgent: Map<string, AgentMcp[]>;
  readonly skillsByAgent = new Map<string, { skill: Skill; role: string }[]>();

  constructor(readonly g: GraphData) {
    this.domain = idx(g.domains, "id"); this.topic = idx(g.topics, "id"); this.concept = idx(g.concepts, "id");
    this.skill = idx(g.skills, "id"); this.agent = idx(g.agents, "key"); this.mcp = idx(g.mcp, "id");
    this.topicsByDomain = group(g.topics, (t) => t.domain);
    this.conceptsByTopic = group(g.concepts, (c) => c.topic);
    this.skillsByConcept = group(g.skills, (s) => s.concept);
    this.linksByAgent = group(g.agent_mcp, (l) => l.agent);
    for (const s of g.skills) for (const a of s.agents) {
      if (!this.skillsByAgent.has(a.key)) this.skillsByAgent.set(a.key, []);
      this.skillsByAgent.get(a.key)!.push({ skill: s, role: a.role });
    }
  }

  private need<T>(m: Map<string, T>, id: unknown, what: string, hint: string): T {
    const v = typeof id === "string" ? m.get(id) : undefined;
    if (!v) throw new ToolError(`unknown ${what} '${String(id)}'. ${hint}`);
    return v;
  }
  private topicOf(conceptId: string) { return this.topic.get(this.concept.get(conceptId)!.topic)!; }
  private relatedOf(cid: string) {
    return this.g.related.filter((r) => r.a === cid || r.b === cid).map((r) => (r.a === cid ? r.b : r.a)).sort();
  }
  private agentOut(key: string, role?: string) {
    const a = this.agent.get(key)!;
    return { key, name: a.name, ...(a.legacy_key ? { legacy_key: a.legacy_key } : {}), ...(role ? { role } : {}), mcp: (this.linksByAgent.get(key) ?? []).map((l) => ({ id: l.mcp, name: this.mcp.get(l.mcp)!.name, score: l.score, basis: l.basis, ...(l.via ? { via: l.via } : {}) })) };
  }
  private skillOut(s: Skill) {
    return { id: s.id, concept: s.concept, label: s.label, desc: s.desc, type: s.type, agents: s.agents.map((a) => this.agentOut(a.key, a.role)) };
  }
  private path(conceptId: string) {
    const t = this.topicOf(conceptId);
    return { domain: t.domain, topic: t.id, concept: conceptId };
  }

  list_domains() {
    return { domains: this.g.domains.map((d) => ({ ...d, topics: (this.topicsByDomain.get(d.id) ?? []).length })) };
  }

  list_topics(a: { query?: string; domain?: string }) {
    if (a.domain !== undefined) this.need(this.domain, a.domain, "domain", "Call list_domains.");
    const q = (a.query ?? "").toLowerCase();
    const rows = this.g.topics
      .filter((t) => (!a.domain || t.domain === a.domain) && (!q || t.id.includes(q) || t.label.toLowerCase().includes(q)))
      .map((t) => ({ id: t.id, label: t.label, domain: t.domain, priority: t.priority, concepts: (this.conceptsByTopic.get(t.id) ?? []).length }));
    return { count: rows.length, topics: rows };
  }

  get_topic(a: { topic_id: string }) {
    const t = this.need(this.topic, a.topic_id, "topic", "Call list_topics for valid ids.");
    const cs = this.conceptsByTopic.get(t.id) ?? [];
    return { topic: { id: t.id, label: t.label, desc: t.desc }, domain: t.domain, priority: t.priority,
      concepts: cs.map((c) => ({ id: c.id, label: c.label, skills: (this.skillsByConcept.get(c.id) ?? []).length, related: this.relatedOf(c.id) })),
      mcp_listed: (this.g.topic_mcp[t.id] ?? []).map((id) => ({ id, name: this.mcp.get(id)!.name })) };
  }

  /** Same document as SCW1/harnesses/<id>.harness.json (tested for equality). */
  get_harness(a: { topic_id: string }) {
    const t = this.need(this.topic, a.topic_id, "topic", "Call list_topics for valid ids.");
    const cs = this.conceptsByTopic.get(t.id) ?? [];
    const sk = cs.flatMap((c) => this.skillsByConcept.get(c.id) ?? []);
    const aks = [...new Set(sk.flatMap((s) => s.agents.map((x) => x.key)))].sort();
    const lk = this.g.agent_mcp.filter((l) => aks.includes(l.agent) && (l.topic === t.id || l.topic === null));
    const tm = this.g.topic_mcp[t.id] ?? [];
    const mids = [...new Set([...lk.map((l) => l.mcp), ...tm])].sort();
    return {
      schema: "maxey0.topic-harness/3", scw: this.g.scw, domain: t.domain,
      topic: { id: t.id, label: t.label, desc: t.desc },
      concepts: cs.map((c) => ({ ...c, related: this.relatedOf(c.id) })),
      skills: sk,
      agents: aks.map((k) => { const ag = this.agent.get(k)!;
        return { key: k, name: ag.name, ...(ag.legacy_key ? { legacy_key: ag.legacy_key } : {}), mcp: [...new Set(lk.filter((l) => l.agent === k).map((l) => l.mcp))].sort() }; }),
      mcp: mids.map((id) => this.mcp.get(id)!),
      topic_mcp: tm, agent_mcp: lk, lexicon: this.g.lexicon[t.id], sources: t.sources,
    };
  }

  get_concept(a: { concept_id: string }) {
    const c = this.need(this.concept, a.concept_id, "concept", "Call get_topic to list concept ids.");
    return { ...this.path(c.id), concept: { ...c, related: this.relatedOf(c.id) }, skills: (this.skillsByConcept.get(c.id) ?? []).map((s) => this.skillOut(s)) };
  }

  get_skill(a: { skill_id: string }) {
    const s = this.need(this.skill, a.skill_id, "skill", "Use search or get_concept to find skill ids.");
    return { ...this.path(s.concept), skill: this.skillOut(s) };
  }

  get_agent(a: { agent_key: string }) {
    this.need(this.agent, a.agent_key, "agent", "Agent keys appear on skills.");
    const uses = this.skillsByAgent.get(a.agent_key) ?? [];
    return { ...this.agentOut(a.agent_key),
      topics: [...new Set(uses.map((u) => this.topicOf(u.skill.concept).id))].sort(),
      skills: uses.map((u) => ({ skill: u.skill.id, label: u.skill.label, role: u.role, ...this.path(u.skill.concept) })),
      mcp_links: this.linksByAgent.get(a.agent_key) ?? [] };
  }

  get_mcp_server(a: { mcp_id: string }) {
    const m = this.need(this.mcp, a.mcp_id, "MCP server", "MCP ids appear on agents and topics.");
    return { mcp: m,
      agents: this.g.agent_mcp.filter((l) => l.mcp === m.id).map((l) => ({ key: l.agent, name: this.agent.get(l.agent)!.name, score: l.score, topic: l.topic })),
      listed_by_topics: Object.entries(this.g.topic_mcp).filter(([, v]) => v.includes(m.id)).map(([t]) => t).sort() };
  }

  /** Cosine between the query and every concept / skill vector (one method, see sim.ts). */
  search(a: { query: string; limit?: number; domain?: string; use_priority?: boolean }) {
    if (a.domain !== undefined) this.need(this.domain, a.domain, "domain", "Call list_domains.");
    const sim = this.g.similarity;
    const q = vec(String(a.query ?? ""), sim.idf, false);
    if (!Object.keys(q).length) throw new ToolError("query has no indexed words (all stop-words, too short, or unknown)");
    const min = sim.thresholds.search_min;
    const hits: [number, Record<string, unknown>][] = [];
    for (const c of this.g.concepts) {
      const p = this.path(c.id);
      if (a.domain && p.domain !== a.domain) continue;
      const sc = cos(q, sim.vectors["c:" + c.id]);
      if (sc >= min) hits.push([sc, { kind: "concept", id: c.id, label: c.label, ...p }]);
    }
    for (const sk of this.g.skills) {
      const p = this.path(sk.concept);
      if (a.domain && p.domain !== a.domain) continue;
      const sc = cos(q, sim.vectors["s:" + sk.id]);
      if (sc >= min) hits.push([sc, { kind: "skill", id: sk.id, label: sk.label, ...p }]);
    }
    // declared topic priority only breaks exact (4-decimal) score ties, and only when use_priority
    const usePrio = a.use_priority !== false;
    const r4 = (x: number) => Math.round(x * 1e4);
    const prio = (r: Record<string, unknown>) => (usePrio ? this.topic.get(r.topic as string)!.priority : 0);
    const ord = hits.map((h, i) => [h, i] as const)
      .sort((x, y) => r4(y[0][0]) - r4(x[0][0]) || prio(y[0][1]) - prio(x[0][1]) || x[1] - y[1]).map((x) => x[0]);
    const lim = Math.max(1, Math.min(Math.trunc(Number(a.limit ?? 10)) || 1, 50));
    return { query: a.query, method: sim.method, min_score: min, priority_tiebreak: usePrio, total: ord.length,
      results: ord.slice(0, lim).map(([sc, r]) => ({ ...r, score: Math.round(sc * 1e4) / 1e4 })) };
  }

  route_task(a: { task: string; limit?: number; domain?: string; use_priority?: boolean }) {
    const limit = Math.max(1, Math.min(Math.trunc(Number(a.limit ?? 5)) || 5, 20));
    const r = this.search({ query: a.task, limit: Math.min(limit * 3, 50), domain: a.domain, use_priority: a.use_priority });
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const h of r.results as unknown as { kind: string; id: string }[]) {
      const sk = h.kind === "concept" ? (this.skillsByConcept.get(h.id) ?? [])[0] : this.skill.get(h.id)!;
      if (!sk || seen.has(sk.id)) continue;
      seen.add(sk.id);
      out.push({ ...this.path(sk.concept), skill: sk.id, label: sk.label, agents: sk.agents.map((x) => this.agentOut(x.key, x.role)) });
      if (out.length >= limit) break;
    }
    return { task: a.task, note: "candidate paths ranked by TF-IDF cosine; not an authorization", matched: out.length > 0, paths: out };
  }

  children(a: { level: string; parent_id?: string }) {
    switch (a.level) {
      case "domain": return { level: "domain", children: this.g.domains };
      case "topic": { const d = this.need(this.domain, a.parent_id, "domain", "parent_id must be a domain id.");
        return { level: "topic", parent: d.id, children: (this.topicsByDomain.get(d.id) ?? []).map((t) => ({ id: t.id, label: t.label })) }; }
      case "concept": { const t = this.need(this.topic, a.parent_id, "topic", "parent_id must be a topic id.");
        return { level: "concept", parent: t.id, children: (this.conceptsByTopic.get(t.id) ?? []).map((c) => ({ id: c.id, label: c.label })) }; }
      case "skill": { const c = this.need(this.concept, a.parent_id, "concept", "parent_id must be a concept id.");
        return { level: "skill", parent: c.id, children: (this.skillsByConcept.get(c.id) ?? []).map((s) => ({ id: s.id, label: s.label })) }; }
      case "agent": { const s = this.need(this.skill, a.parent_id, "skill", "parent_id must be a skill id.");
        return { level: "agent", parent: s.id, children: s.agents.map((x) => this.agentOut(x.key, x.role)) }; }
      case "mcp": { this.need(this.agent, a.parent_id, "agent", "parent_id must be an agent key.");
        return { level: "mcp", parent: a.parent_id, children: this.agentOut(a.parent_id!).mcp }; }
    }
    throw new ToolError(`level must be one of ${LEVELS.join(", ")}`);
  }

  trace(a: { node_id: string }) {
    const id = a.node_id;
    if (this.domain.has(id)) return { kind: "domain", id, chain: [{ level: "domain", id }] };
    const t = this.topic.get(id);
    if (t) return { kind: "topic", id, chain: [{ level: "domain", id: t.domain }, { level: "topic", id }] };
    const c = this.concept.get(id);
    if (c) { const p = this.path(id); return { kind: "concept", id, related: this.relatedOf(id),
      chain: [{ level: "domain", id: p.domain }, { level: "topic", id: p.topic }, { level: "concept", id }] }; }
    const s = this.skill.get(id);
    if (s) { const p = this.path(s.concept); return { kind: "skill", id,
      chain: [{ level: "domain", id: p.domain }, { level: "topic", id: p.topic }, { level: "concept", id: p.concept }, { level: "skill", id }],
      agents: s.agents.map((x) => this.agentOut(x.key, x.role)) }; }
    if (this.agent.has(id)) { const g = this.get_agent({ agent_key: id }); return { kind: "agent", id, name: g.name, topics: g.topics, skills: g.skills, mcp: g.mcp }; }
    if (this.mcp.has(id)) return { kind: "mcp", ...this.get_mcp_server({ mcp_id: id }) };
    throw new ToolError(`unknown node '${id}' (not a domain, topic, concept, skill, agent or MCP id).`);
  }

  snapshot() {
    return { scw: this.g.scw, schema: this.g.schema, snapshot_digest: this.g.snapshot_digest,
      totals: { domains: this.g.domains.length, topics: this.g.topics.length, concepts: this.g.concepts.length, skills: this.g.skills.length,
        agents: this.g.agents.length, mcp_servers: this.g.mcp.length, agent_mcp_links: this.g.agent_mcp.length, related_links: this.g.related.length } };
  }

  level(lv: string) {
    switch (lv) {
      case "domain": return this.g.domains;
      case "topic": return this.g.topics.map((t) => ({ id: t.id, label: t.label, domain: t.domain }));
      case "concept": return this.g.concepts.map((c) => ({ id: c.id, label: c.label, topic: c.topic }));
      case "skill": return this.g.skills.map((s) => ({ id: s.id, label: s.label, concept: s.concept }));
      case "agent": return this.g.agents;
      case "mcp": return this.g.mcp.map((m) => ({ id: m.id, name: m.name }));
    }
    throw new ToolError(`unknown level '${lv}'`);
  }
}
