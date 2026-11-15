---
name: "find-skills"
description: "Design the optimal fixed slate of durable skills (or, with level=, of topics/concepts/agents/MCP servers) for an agent or domain, with per-level coverage, traceability and parity checks."
---

# find-skills — Optimal Skill Slate Designer (all 5 levels)

Skill-level sibling of `find-subagents`. Chooses ONE fixed, durable slate; no deferring.

## Input
`/find-skills <target agent | domain | topic> [level=topic|concept|skill|agent|mcp|all]`
Default `level=skill`. `level=all` walks the five levels top-down (Topic -> Concept -> Skill -> Agent -> MCP). `level=agent` delegates to `find-subagents`; `level=concept` and `level=mcp` may delegate to `find-concepts` / `find-mcp` when installed.

## Level model (Human0 / Context Plane Control Graph)
| Level | Unit | Parent | Pack rule |
|---|---|---|---|
| L1 Topic | topic | - | one per pack |
| L2 Concept | concept | topic | 5-8 per topic |
| L3 Skill | skill | concept | 2-4 per concept; type semantic or procedural |
| L4 Agent | agent | skill | each skill: exactly 1 primary + 1 checker + 1-2 support; every agent used |
| L5 MCP | server | agent | registry rows need a verified uuid; unverified = web-listed, tools may be empty |

## Workflow
1. **Inspect** the target: existing skills, tools, connectors, router/trigger behaviour. Read the real files; never assume.
2. **Model capability** - list the procedures the target must perform repeatedly (irreducible procedures), separating semantic (knowledge/judgement) from procedural (ordered steps) skills.
3. **Group** into durable skills: one trigger, one output contract, one owner. Merge anything two skills would both fire on; split anything whose output has two different checkers.
4. **Compare candidate slate sizes** (smaller / proposed / larger) on: coverage of procedures, trigger collision, maintenance cost, checkability.
5. **Choose exactly one** final slate.
6. **Run the level checks** below and report them.

## Decision rules
- Smallest structurally complete slate wins. Transient modes are not skills.
- A skill description states WHEN to use it (trigger) in under 200 characters, and is distinct from every sibling (no shared first-clause).
- Every skill names its checker role; a skill whose answer nothing mechanical can verify needs an independent checker agent.
- Never invent MCP servers, uuids, or tool names: look them up (SearchMcpRegistry) or mark web-listed/unverified.
- Sensitive domains (health, legal, finance): educational scaffolding only; personal-record connectors are human-approved.

## Required output
1. Capability model (known / inferred / confidence)
2. Irreducible procedures table: procedure | why required | can merge? | cost of merge
3. Candidate slate comparison: size | strengths | weaknesses | score | verdict
4. Final fixed slate: skill id | concept parent | type | trigger description | inputs | outputs | primary / checker / support agents | MCP
5. Routing topology: intake -> match (threshold) -> run -> check -> write-back
6. Contracts per skill: receives | emits | may read | may write | may not do
7. **Per-level coverage / traceability / parity table** (see below)
8. Final verdict, exactly:
```
Optimum fixed skill count: <N>
Optimum skill ids: <comma-separated>
Why this is optimal: <one dense paragraph>
```

## Per-level checks (coverage-testing-artifact-parity, applied to LEVELS not artifacts)
For each level L1..L5 report pass/fail counts for:
- **Coverage**: every parent has children within the pack rule (topic has concepts, concept has skills, skill has agents, agent is used by a skill, MCP row has a source).
- **Traceability**: every child resolves to its parent (skill -> concept -> topic; agent -> skill; MCP -> agent gate); ids globally unique; no orphans.
- **Parity**: the same slate expressed in two places is byte-equal (pack file vs. embedded copy; docs vs. data).
Ship a runnable script when a pack exists (e.g. `levels_parity.py <html> <packs_dir>`); state what was executed vs derived. Label claims FACT / EXEC / DERIVED / HYPOTHESIS / BLOCKED.