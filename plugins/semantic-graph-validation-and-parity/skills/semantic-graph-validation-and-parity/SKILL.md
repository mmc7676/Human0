---
name: semantic-graph-validation-and-parity
description: Validate SWG behavior, provenance, and byte-identical source parity across Maxey0 artifacts and SCW records.
---
# Semantic Graph Validation and Parity

## Functional validation
- Entities with definitions load before other lists.
- CSV/TSV/TXT/JSON parsing handles valid input and reports malformed input.
- Empty entities block graph generation.
- Adding each non-noun class refreshes embeddings for all current nodes.
- Graph edges remain cleared until Submit.
- Generated edges only connect non-noun nodes to entity nodes and include evidence.
- Search/filter, rotation/zoom, node detail, JSON export, and reset remain functional.
- No remote upload or model call is claimed unless implemented.

## Provenance
Keep canonical HTML source, original request, artifact ID/version, SHA-256, and test status in SCW1/SCW2/SCW001. Distinguish mechanical checks from browser interaction tests.

## Byte parity
Compare exact bytes, not semantic equivalence: define canonical source; retrieve candidate; compare lengths and SHA-256; inspect byte diff if mismatched; repeat until exact match. Never report parity as executed if only metadata was inspected.

## Acceptance
Report source and candidate hashes, byte lengths, actual test steps, passed/failed/not-run states, and remaining limitations.
