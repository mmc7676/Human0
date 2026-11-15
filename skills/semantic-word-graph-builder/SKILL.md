---
name: semantic-word-graph-builder
description: Build or revise the Maxey0 Semantic Word Graph as a staged, evidence-labelled, four-plane lexical graph.
---
# Semantic Word Graph Builder

## Mission
Implement the requested semantic word graph by preserving the current SWG app's behavior and extending it only where explicitly required.

## Required planes
- Entity/noun plane: terms and user-provided definitions; ingest this first.
- Verb plane.
- Adjective plane.
- Adverb plane.

## Required workflow
1. Inspect the existing SWG artifact and canonical SCW1 source.
2. Load entities with definitions and validate non-empty terms.
3. Add each non-noun word class separately.
4. After every accepted addition, re-sync embedding fields for the full node set, not only new rows.
5. Require explicit Submit/Generate Graph before displaying inferred links.
6. Display candidate edges with evidence, searchable nodes, filters, rotation/zoom, details, and JSON export.
7. Preserve source provenance and report exactly what is heuristic, simulated, or externally computed.

## Authority and claims
Do not describe a lexical hash vector as a pretrained embedding. Do not present heuristic links as verified facts. Do not silently upload the user's lexicon to a server.

## Acceptance
The four planes exist, staged ingest works, entity definitions are retained, full-set embedding sync increments a version, graph generation is explicit, and each edge can be inspected.
