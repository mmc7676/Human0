---
name: maxey0-context-plane
description: Use the Maxey0 Context Plane MCP server to find where a task belongs and who should handle it. Trigger when the user asks to "route this task", "which agent should handle", "what skill covers", "which MCP server fits", "find the topic/concept for", mentions Maxey0, MaxeyN agents, the Context Plane or SCW1, or wants to browse the Maxey0 domains, topics, concepts, skills, agents or MCP servers.
---

# Maxey0 Context Plane

The Maxey0 Context Plane is a read-only map served by the `maxey0-context-plane` MCP server. Every thread runs
Domain -> Topic -> Concept -> Skill; each skill has 3-4 MaxeyN agents (roles primary / checker / support), and agents hold MCP servers.

Treat agents as **context records** (who should handle a skill, with which tools), never as agents you can run. Treat routes as **candidates**, never as an authorization to act.

## How to use the tools

0. **Show the graph -> `open_context_plane_graph`** (optional `task` to highlight its best route, or `topic_id`). Where the host supports MCP Apps the interactive 3D graph opens in the conversation; otherwise give the user the returned `app_url`.

Fetch only what the question needs; the full graph is never needed.

1. **Unknown task -> `route_task`** with the user's task text (optionally `domain`: `maxey0-system`, `foundations`, `work`, `finance` or `disciplines`). It returns candidate paths domain -> topic -> concept -> skill -> agents -> MCP servers, ranked by TF-IDF cosine.
2. **Detail on one result -> `get_skill`** (agents and their servers) or **`get_concept`** (all skills of a concept). Prefer these over `get_harness`, which returns a whole topic (about 49 KB).
3. **Browsing -> `list_domains`, `list_topics`, `get_topic`, `children`.** Use `trace` for the full parent chain of any id, `get_agent` for everything one MaxeyN agent serves, `get_mcp_server` for which agents hold a server.
4. **Keyword lookups -> `search`**, which returns ids with their path; fetch details afterwards.

## Reading the results correctly

- **No match is a real answer.** `route_task` returns `matched: false` when nothing shares enough words with the task; say so instead of guessing a route. Routing is lexical, so rephrasing with domain vocabulary can help. If the topic is genuinely missing, offer to generate it with the `topic-graph-generator` skill (and `validate_topic_pack`).
- **MCP link basis:** `derived` = text similarity (cosine >= 0.10), `inherited` = the agent is the checker on the skill named in `via` and holds that skill's primary's servers, `declared` = set by the ontology spec. Links belong to the agent, so an agent shown in one role may hold servers inherited as checker on another skill; check `via` before attributing a server to the current skill.
- **MCP rows are directory listings**, not installed connectors. Do not claim a server is available or reachable from the map alone.
- **Priority:** physics topics carry an owner-declared priority that only breaks exact score ties.
- **Generated content:** concepts, skills and agents are generated hypotheses, not curated knowledge; mention this when the user relies on them for real decisions.

## Answer format

Report the path (domain -> topic -> concept -> skill), the primary and checker agents with their MaxeyN keys, and the MCP servers with basis and score. Keep EXEC (what a tool call returned) separate from your own reading of it.
