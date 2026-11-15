---
name: "find-concepts"
description: "Choose the optimal fixed set of 5-8 durable concepts for a topic, each with 2-4 skills' worth of scope, with coverage and traceability checks."
---

# find-concepts — Concept-level slate (L2)

Part of the /find-<LEVEL> family (`find-skills` is the umbrella; `find-subagents` covers agents).

## Input
`/find-concepts <topic> [existing topic id to extend]`

## Workflow
1. **Inspect** the topic: existing concepts in the target graph (extend, never duplicate), authoritative curricula/taxonomies, and what a user would ask.
2. **Enumerate** candidate concepts; define each in one sentence plus 3-6 keywords that are specific to it (not generic words such as plan, update, design).
3. **Test separability**: two concepts that would share most keywords or most skills merge; a concept needing more than 4 skills splits.
4. **Fix the slate**: 5-8 concepts, ordered from foundations to applications, plus a safety/limits concept when the topic carries risk (health, legal, finance).
5. **Check** with the level rules and report.

## Output
- Candidate comparison (5 / 6 / 7 / 8) with trade-offs
- Final table: concept id (topic-prefix), label, description, keywords, intended 2-4 skills
- Keyword-collision report against existing concepts in the graph
- Coverage (every concept has 2-4 skills planned), traceability (concept -> topic), parity (any second copy of the list is identical)
- Verdict lines:
```
Optimum fixed concept count: <N>
Optimum concept ids: <list>
Why this is optimal: <one paragraph>
```

Rules: smallest complete set; no placeholders; label FACT / EXEC / DERIVED / HYPOTHESIS / BLOCKED; health/legal/finance topics are educational only.