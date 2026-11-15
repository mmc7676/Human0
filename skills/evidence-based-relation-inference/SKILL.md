---
name: evidence-based-relation-inference
description: Infer reviewable relationships between typed graph nodes from definitions, metadata, rules, compatible embeddings, or domain-specific evidence.
---
# Evidence-Based Relation Inference

## Purpose
Generate candidate graph relations without confusing similarity with proof. Applies to term-definition graphs, context/skill/topic graphs, document graphs, knowledge graphs, and other typed networks.

## Inputs
Require normalized nodes, definitions/attributes, configured node and edge types, evidence sources, inference rules, thresholds, and provenance policy. Never invent source records or definitions.

## Procedure
1. Generate candidates only for edge types allowed by the configured schema.
2. Gather inspectable evidence: exact references, definition overlap, typed rules, source links, graph paths, or compatible embedding similarity.
3. Score and rank candidates using documented weights. Keep raw evidence separate from aggregate score.
4. Apply minimum evidence/threshold rules; do not force every node to connect.
5. Record source node, target node, edge type, evidence explanation, score components, inference version, and status.
6. Distinguish user-authored, source-observed, rule-derived, and model-inferred edges.
7. Keep conflicting evidence and uncertainty visible.
8. Support human review, acceptance/rejection, and provenance-preserving edits.
9. Re-run affected inference when source nodes, definitions, rules, or embedding versions change.

## Semantic and logical boundaries
- Lexical overlap and embedding similarity are relatedness signals, not entailment.
- A graph path does not prove transitive truth unless edge types explicitly support that inference.
- Semantic relevance is not access authorization or permission to execute.
- For context/agent graphs, keep descriptive relations separate from enforceable gates and scopes.

## Acceptance
Every inferred edge is schema-valid, evidence-labelled, versioned, inspectable, and distinguishable from ground truth. No unsupported relationship is presented as fact.
