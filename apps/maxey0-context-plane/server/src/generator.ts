// Topic generation support (read-only). The server never writes to the graph: generation happens in the
// client model (Claude) using the topic-graph-generator prompt; the result is checked by validate_topic_pack
// and added in the Human0 app (or proposed for the next SCW1 build). Same pack schema as the build sources.
import type { Graph } from "./graph";

type Json = Record<string, unknown>;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BAD = /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const ROLES = new Set(["primary", "checker", "support"]);
const STATUS = new Set(["registry", "web-listed"]);

export const GENERATOR_PROMPT = {
  name: "topic-graph-generator",
  title: "Generate a topic pack",
  description: "Build the request to generate one human0.topic-pack/1 (Topic -> Concepts -> Skills -> MaxeyN agents -> real MCP servers) for a topic missing from the Maxey0 Context Plane, then check it with validate_topic_pack.",
  arguments: [
    { name: "topic", description: "The new topic, e.g. 'Commodities' (or an existing topic to extend)", required: true },
    { name: "concept", description: "Optional concept to focus on, e.g. 'Crude Oil'", required: false },
    { name: "task", description: "Optional: the task that found no route, so the pack covers its words", required: false },
  ],
};

export function generatorText(g: Graph, a: { topic?: string; concept?: string; task?: string }): string {
  const topics = g.g.topics.map((t) => `${t.id} (${t.label}, ${t.domain})`).join("; ");
  return [
    `Generate ONE JSON object, schema human0.topic-pack/1, for the topic "${a.topic ?? ""}"` + (a.concept ? ` focused on the concept "${a.concept}"` : "") + ".",
    a.task ? `It must cover this task, which currently has no route: "${a.task}". Use the task's own words in skill descriptions.` : "",
    "Shape: {\"schema\":\"human0.topic-pack/1\",\"id\",\"topic\":{\"id\",\"label\",\"desc\"},\"concepts\":[[id,label,topicId,desc,[keywords]]],\"skills\":[[id,conceptId,label,desc,\"semantic|procedural\",[[agentKey,\"primary|checker|support\"]]]],\"agents\":{\"key\":\"Name\"},\"mcp\":[[name,uuid|null,desc,[tools],\"registry|web-listed\",source]],\"lexicon\":{domain:\"terms\"},\"provenance\":{levels,mcp_checked_at,mcp_notes,limitations}}.",
    "Rules: 3-8 concepts; 1-4 skills per concept; every skill has one primary, one checker and 0-2 support agents; agent keys are new and prefixed with the pack id (the Context Plane assigns permanent MaxeyN keys at build).",
    "Ids are lowercase slugs, unique, and must not reuse an existing topic, concept or skill id. A concept label must not equal a topic label.",
    "MCP servers: REAL ONLY. Verify each one exists (directory listing or repository) and record where you checked; never invent a server, uuid, URL or tool name; use \"mcp\": [] if none can be verified.",
    "Agents are context records (who should handle a skill, with which tools), not executable agents.",
    `Existing topics (${g.g.topics.length}): ${topics}.`,
    "Then call validate_topic_pack with the JSON and fix every problem it reports before returning the pack.",
  ].filter(Boolean).join("\n");
}

export function validatePack(g: Graph, p: unknown): Json {
  const problems: string[] = [], warnings: string[] = [];
  const P = (p ?? {}) as Json;
  if (typeof P !== "object" || Array.isArray(P)) return { ok: false, problems: ["pack must be a JSON object"] };
  if (P.schema !== "human0.topic-pack/1") problems.push("schema must be human0.topic-pack/1");
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") { if (BAD.test(v)) problems.push(`${path}: contains < > or control characters`); if (v.length > 2000) problems.push(`${path}: longer than 2000`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(P, "pack");
  const T = (P.topic ?? {}) as Json, tid = String(T.id ?? "");
  if (!SLUG.test(tid)) problems.push("topic.id must be a lowercase slug");
  if (!T.label || !T.desc) problems.push("topic needs label and desc");
  const existingTopic = g.g.topics.find((t) => t.id === tid);
  const topicLabels = new Set(g.g.topics.filter((t) => t.id !== tid).map((t) => t.label.toLowerCase()));
  if (!existingTopic && topicLabels.has(String(T.label ?? "").toLowerCase())) problems.push(`topic label '${T.label}' is already used by another topic`);
  const cIds = new Set(g.g.concepts.map((c) => c.id)), sIds = new Set(g.g.skills.map((s) => s.id));
  const allTopicLabels = new Set(g.g.topics.map((t) => t.label.toLowerCase()).concat(String(T.label ?? "").toLowerCase()));
  const concepts = Array.isArray(P.concepts) ? (P.concepts as unknown[][]) : [];
  if (concepts.length < 3 || concepts.length > 8) problems.push(`a topic needs 3-8 concepts (has ${concepts.length})`);
  const pc = new Set<string>();
  for (const c of concepts) {
    const [id, label, t] = c as string[];
    if (!SLUG.test(String(id))) problems.push(`concept id '${id}' is not a slug`);
    if (cIds.has(id)) problems.push(`concept id '${id}' already exists in the graph`);
    if (pc.has(id)) problems.push(`concept id '${id}' repeated`);
    if (t !== tid) problems.push(`concept '${id}' topic must be '${tid}'`);
    if (allTopicLabels.has(String(label).toLowerCase())) problems.push(`concept label '${label}' equals a topic label`);
    pc.add(id);
  }
  const agents = (P.agents && typeof P.agents === "object" ? P.agents : {}) as Record<string, string>;
  const skills = Array.isArray(P.skills) ? (P.skills as unknown[][]) : [];
  const ps = new Set<string>(), perConcept: Record<string, number> = {}, used = new Set<string>();
  for (const s of skills) {
    const [id, cid, label, desc, kind, roles] = s as [string, string, string, string, string, [string, string][]];
    if (!SLUG.test(String(id))) problems.push(`skill id '${id}' is not a slug`);
    if (sIds.has(id) || ps.has(id)) problems.push(`skill id '${id}' is not unique`);
    ps.add(id);
    if (!pc.has(cid)) problems.push(`skill '${id}' points to unknown concept '${cid}'`);
    perConcept[cid] = (perConcept[cid] ?? 0) + 1;
    if (!label || !desc) problems.push(`skill '${id}' needs label and desc`);
    if (kind !== "semantic" && kind !== "procedural") problems.push(`skill '${id}' type must be semantic or procedural`);
    const rs = Array.isArray(roles) ? roles : [];
    if (rs.filter((r) => r[1] === "primary").length !== 1) problems.push(`skill '${id}' needs exactly one primary agent`);
    if (rs.filter((r) => r[1] === "checker").length !== 1) problems.push(`skill '${id}' needs exactly one checker agent`);
    for (const [k, role] of rs) {
      if (!ROLES.has(role)) problems.push(`skill '${id}': role '${role}'`);
      if (!(k in agents)) problems.push(`skill '${id}': agent '${k}' is not in pack.agents`);
      used.add(k);
    }
  }
  for (const c of pc) if (!perConcept[c]) problems.push(`concept '${c}' has no skills`);
  for (const k of Object.keys(agents)) if (!used.has(k)) warnings.push(`agent '${k}' serves no skill`);
  const mcp = Array.isArray(P.mcp) ? (P.mcp as unknown[][]) : [];
  for (const m of mcp) {
    const [name, , desc, tools, status, source] = m as [string, unknown, string, unknown, string, string];
    if (!name || !desc) problems.push("an MCP row needs name and description");
    if (!Array.isArray(tools)) problems.push(`MCP '${name}': tools must be a list`);
    if (!STATUS.has(status)) problems.push(`MCP '${name}': status must be registry or web-listed`);
    if (!source) problems.push(`MCP '${name}': record where it was verified (source)`);
  }
  if (!mcp.length) warnings.push("no MCP servers: allowed when none could be verified");
  // overlap with the existing graph: route the topic description
  const overlap = g.route_task({ task: `${T.label ?? ""} ${T.desc ?? ""}`, limit: 3 }) as Json;
  return {
    ok: problems.length === 0, problems, warnings,
    extends_existing_topic: !!existingTopic,
    counts: { concepts: concepts.length, skills: skills.length, agents: Object.keys(agents).length, mcp: mcp.length },
    nearest_existing: ((overlap.paths ?? []) as Json[]).map((x) => ({ topic: x.topic, concept: x.concept, skill: x.label })),
    note: "Validation only; nothing is written. Add the pack in the Maxey0 Context Plane Graph app, or propose it for the next SCW1 build.",
  };
}
