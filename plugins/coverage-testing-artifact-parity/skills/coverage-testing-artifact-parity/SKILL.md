---
name: coverage-testing-artifact-parity
description: Build requirement-to-artifact traceability, meaningful tests, provenance records, and exact byte-parity checks for generated artifacts.
---
# Coverage, Testing, and Artifact Parity

## Purpose
Validate multi-artifact builds honestly, from requirements to source code, app tile, reusable skills, and release package.

## Traceability
For every requirement record: source statement, target artifact/component, expected behavior, test method, actual result, evidence, and status. Mark unsupported requirements as explicit gaps.

## Test layers
- Static/mechanical: non-empty files, size, syntax/markup, dependency and host checks.
- Schema/unit: parsers, validation, normalization, state invariants, relation rules.
- Integration: import, sync, inference, rendering, export.
- Interaction: upload, submit, search/filter, select, inspect, reset, errors.
- Regression: prior behavior remains intact.
- Provenance/parity: source, version, artifact IDs, hashes, lengths, test timestamps.
Do not substitute one layer for another.

## Byte identity
1. Read exact canonical source bytes.
2. Copy bytes without decoding/re-encoding when exact parity is required.
3. Compute byte length and SHA-256 for source and candidate.
4. If they differ, perform a byte-level diff, fix the divergence, and repeat.
5. A matching hash establishes practical byte identity for compared payloads; it does not prove independent regeneration or semantic correctness.

## Coverage workflow
- Inventory skills, domain objects, user-specific instructions, code artifacts, and tests separately.
- Check every requirement against actual source.
- If code changes, update all mirrors and recompute digests.
- Preserve known limitations and mark unrun tests NOT RUN.
- Never claim a runtime test, browser interaction, or independent rebuild without actual execution evidence.

## Acceptance
The final report includes a requirement matrix, exact source/artifact hashes where available, test evidence, untested cases, and a release inventory.
