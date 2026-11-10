---
name: topic-graph-generator
description: Generate a human0.topic-pack/1 (Topic -> Concepts -> Skills -> MaxeyN agents -> real MCP servers) for a topic the Maxey0 Context Plane does not cover, validate it with validate_topic_pack, and return the JSON for the Maxey0 Context Plane Graph app. Use when route_task finds no match, or when asked to add or generate a topic.
---

# topic-graph-generator

Produce ONE JSON object, schema `human0.topic-pack/1`, that the Maxey0 Context Plane Graph app adds to its graph (Topics panel -> paste -> Add to graph) and the next SCW1 build can ingest unchanged.

## Steps
1. Get the request. If the Maxey0 Context Plane connector is available, get its `topic-graph-generator` prompt with the topic (and the task that had no route); it lists the existing topics. The app's "Build generation request" / "Generate a topic for this task" gives the same request.
2. Check overlap first: call `route_task` and `list_topics` with the topic's words. Extend an existing topic instead of creating a near-duplicate.
3. Generate: 3-8 concepts; 1-4 skills per concept; each skill has exactly one primary agent, one checker and 0-2 support agents. New agent keys are prefixed with the pack id (the build assigns permanent MaxeyN keys). Ids are lowercase slugs that do not reuse an existing topic, concept or skill id; a concept label never equals a topic label.
4. MCP servers: real only. Verify each server exists (connector directory or its repository page) and record where you checked: `[name, uuid|null, description, [tools], "registry"|"web-listed", source]`. Never invent a server, uuid, URL or tool name; return `"mcp": []` if none can be verified.
5. Domain: choose one of the 11 domain ids `list_domains` returns for the new topic (the app suggests the domain of the nearest existing topic). Report it beside the JSON: to enter the plane, the topic must be listed in the spec's `regroup.pack_domains` as `topic_id -> domain_id`, or the build fails for an unplaced topic.
6. Provenance: `levels` (topic "user", the rest "generated", mcp "real" or "none"), `mcp_checked_at`, `mcp_notes`, `limitations`.
7. Validate: call `validate_topic_pack` with the JSON and fix every problem it reports. Then return the JSON object only.

Agents in the pack are context records (who should handle a skill, with which tools), not executable agents.
