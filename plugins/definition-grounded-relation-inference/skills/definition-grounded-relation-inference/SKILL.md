---
name: definition-grounded-relation-inference
description: Infer reviewable candidate edges from verbs, adjectives, and adverbs to entity nodes using uploaded definitions and explicit lexical evidence.
---
# Definition-Grounded Relation Inference

## Inputs
Use the current entity terms and definitions, plus separate verb, adjective, and adverb lists. Never invent entity definitions or add unprovided lexicon items.

## Candidate edge procedure
1. Normalize and tokenize each non-noun term and each entity term+definition.
2. Compute explicit evidence: exact term occurrence in entity name/definition; shared definition tokens; and, if available, similarity from a single compatible embedding method/version.
3. Rank candidate entities for each non-noun term using the documented signals.
4. Emit bounded candidate edges with source node, target entity, word class, score/similarity when computed, and a human-readable evidence explanation.
5. Keep inferred candidates distinct from observed facts and user-provided definitions.
6. Avoid a link when no documented threshold/evidence condition is met; do not force every word to connect.

## Semantic caution
Lexical overlap or cosine similarity indicates candidate relatedness, not logical entailment, truth, or causation. Adverbs and adjectives can be ambiguous across context; mark results as candidates.

## Acceptance
Every edge connects a non-noun word to an entity, preserves the source word class, and carries inspectable evidence. No edge is silently treated as ground truth.
