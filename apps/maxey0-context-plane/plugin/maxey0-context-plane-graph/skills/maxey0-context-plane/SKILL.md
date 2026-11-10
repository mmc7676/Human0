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

1. **Unknown task -> `route_task`** with the user's task text (optionally `domain`, one of the ids `list_domains` returns). It returns candidate paths domain -> topic -> concept -> skill -> agents -> MCP servers, ranked by a hybrid score: (1 − β)·TF-IDF cosine + β·bge-m3 cosine, β = 0.7 by default (`signal` in the result says which signals were used; `dense: false` or `dense_weight` changes it). For a task with several parts, add `mode: "lens"`: topics are chosen first and each lower level — concepts, skills, then the chosen skills' agents and the servers those agents hold — is read from the chosen nodes; the result carries the observer chain (selected nodes, weights, each branch's signed contribution, suppressed candidates) and a `drift` record: per chosen node its score seen from above (`flat`), its lens score ψ, `drift = ψ − flat` and its rank in both, per level the task received, passed on and explained, shaped as SCW-drift / SCW-level / SCW-path.
2. **Detail on one result -> `get_skill`** (agents and their servers) or **`get_concept`** (all skills of a concept). Prefer these over `get_harness`, which returns a whole topic (about 49 KB).
3. **Browsing -> `list_domains`, `list_topics`, `get_topic`, `children`.** Use `trace` for the full parent chain of any id, `get_agent` for everything one MaxeyN agent serves, `get_mcp_server` for which agents hold a server.
4. **Keyword lookups -> `search`**, which returns ids with their path; fetch details afterwards.

## Reading the results correctly

- **No match is a real answer.** Flat `route_task` returns `matched: false` when no candidate reaches the match threshold (0.25 with the dense signal); say so instead of guessing a route. The lens has no threshold and always returns its best path, so check `remaining_task` and the scores before relying on it. Rephrasing with domain vocabulary can help. If the topic is genuinely missing, offer to generate it with the `topic-graph-generator` skill (and `validate_topic_pack`).
- **MCP link basis:** `derived` = text similarity (cosine >= 0.10), `inherited` = the agent is the checker on the skill named in `via` and holds that skill's primary's servers, `declared` = set by the ontology spec. Links belong to the agent, so an agent shown in one role may hold servers inherited as checker on another skill; check `via` before attributing a server to the current skill.
- **MCP rows are directory listings**, not installed connectors. Do not claim a server is available or reachable from the map alone.
- **Priority:** physics topics carry an owner-declared priority that only breaks exact score ties.
- **Generated content:** concepts, skills and agents are generated hypotheses, not curated knowledge; mention this when the user relies on them for real decisions.

- **Drift:** a large positive drift means the path above carried the node; a negative drift means it was chosen despite its context. Report drift as what the lens did, not as a quality score.
- **Dense signal availability:** `dense_status` says when the dense signal was not used (index building, no binding) — the route is then TF-IDF only.

## Answer format

Report the path (domain -> topic -> concept -> skill), the primary and checker agents with their MaxeyN keys, and the MCP servers with basis and score. Keep EXEC (what a tool call returned) separate from your own reading of it.
