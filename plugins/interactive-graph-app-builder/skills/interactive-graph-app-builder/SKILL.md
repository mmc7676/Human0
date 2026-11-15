---
name: interactive-graph-app-builder
description: Build interactive graph dashboards whose node types, layers, ingestion controls, relations, and visual styles are configuration-driven.
---
# Interactive Graph App Builder

## Purpose
Build graph dashboards for arbitrary domains without hard-coding one graph's vocabulary into the visualization engine.

## Core architecture
Separate: (1) graph schema/configuration, (2) data adapters, (3) normalized state engine, (4) inference engine, (5) renderer, (6) node inspector, (7) validation/export, and (8) application shell/dashboard integration.

## Interaction requirements
- Support keyboard-accessible controls and clear empty/loading/error states.
- Make upload order and prerequisites explicit when order matters.
- Separate ingest/sync from explicit graph generation if the workflow requires a submit step.
- Include search, filters, node inspection, reset, and schema-preserving export where relevant.
- Display edge evidence and explain visual encodings.
- Avoid color as the sole carrier of type information.
- Avoid excessive node overlap; provide deterministic layout for repeatable tests.

## Configuration-first design
Node classes and layer names come from schema/configuration. A word graph may configure nouns, verbs, adjectives, and adverbs; a context graph may configure skills, topics, concepts, domain terms, and resources. These are examples, not fixed engine types.

## Runtime and claims
Use supported APIs and imports only. Distinguish a static mock, locally interactive prototype, and production-connected app. Do not claim persistence, external model use, or runtime tests unless verified.

## Acceptance
A new graph domain can be instantiated by supplying schema/configuration and data adapters, with minimal or no changes to the renderer/state engine.
