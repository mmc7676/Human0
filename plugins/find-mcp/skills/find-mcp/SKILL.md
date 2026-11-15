---
name: "find-mcp"
description: "Find and verify the right MCP servers for a skill, concept or topic from the live registry, with tools, uuids and human-approval flags; never invents servers."
---

# find-mcp — MCP-level slate (L5)

Part of the /find-<LEVEL> family (`find-skills` is the umbrella).

## Input
`/find-mcp <skill | concept | topic> [need=<capability>]`

## Workflow
1. **Inspect** which agents/skills need external capability; list the needed verbs (search, read, write, run).
2. **Search** the registry (SearchMcpRegistry with 2-4 keyword sets) and, only if empty, web-listed sources. Record the search date.
3. **Verify** each candidate: exact name, uuid (registry rows only), the tool names actually exposed, read vs write.
4. **Classify**: `registry` (uuid verified this session) or `web-listed` (name + source URL, uuid null, tools unknown). Never fabricate a uuid, URL or tool name; an unverified item is BLOCKED/unverified, not guessed.
5. **Bound** each server: observe / decide / modify / invoke. Servers that read personal records (health, finance, email) are human-approved and consented only; write tools need explicit authorization. A decision engine is not an authorization engine.
6. **Map** each server to the agents allowed to call it (the agent->MCP gates).

## Output
- Table: server | uuid | class | tools | read/write | gated agents | sensitivity | source + date
- Gaps: needs with no verified server (say so; do not pad)
- Per-level checks: coverage (each needing agent has a gate or a stated gap), traceability (gate -> agent -> skill -> concept -> topic), parity (pack MCP rows equal the app's embedded rows)
- Verdict lines:
```
Optimum MCP server count: <N>
Optimum servers: <list>
Why this is optimal: <one paragraph>
```

Secrets, API keys and OAuth are the human's: give the exact action and stop; never ask for a raw secret.