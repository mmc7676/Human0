---
name: lexicon-sync-embedding-refresh
description: Normalize staged lexical lists and refresh the embedding field for the complete current node set after every accepted change.
---
# Lexicon Sync and Embedding Refresh

## Input contract
Accept CSV, TSV, TXT, or JSON. Entity records use term plus definition; non-noun lists use one term per row or supported term/word fields. Preserve multiword terms and original definitions.

## Normalization
Normalize Unicode to NFC, trim and collapse whitespace, and deduplicate by case-insensitive normalized key. Keep a canonical display term and count merged source rows. Do not merge different entity terms merely because their definitions overlap.

## Sync invariant
After entities load and after every verb/adjective/adverb addition: recompute the embedding field for every current node; assign one shared embedding version and timestamp; invalidate generated graph edges; require graph generation again after an update.

## Embedding honesty
If using deterministic lexical feature hashing, label it as a local lexical vector, not a pretrained semantic embedding. Record method/version in exports. If a provider-backed model is later integrated, store provider/model/version and normalize all terms in the same shared space.

## Acceptance
No stale embedding version remains after an accepted addition; every node has the same current version; generated links are cleared until the user submits again.
