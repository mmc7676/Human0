---
name: typed-graph-modeler
description: Model arbitrary graphs with configurable node classes, layers, definitions, typed edges, and provenance.
---
# Typed Graph Modeler

## Purpose
Design graph models for word graphs, context graphs, dependency graphs, research graphs, organizations, and agent capabilities without hard-coding one domain.

## Configurable schema
- NodeType: id, label, description, required/optional fields, validation rules, visual style, and allowed edge roles.
- Node: stable id, type id, canonical label, definition, attributes, provenance, version, and optional vector/coordinates.
- EdgeType: id, label, direction, allowed source/target types, validation, and interpretation.
- Edge: id, source, target, edge type, evidence, score if computed, provenance, status (observed, user-authored, inferred, reviewed), and rule/model version.
- Layer: presentation group or context scope; visual position is not semantic containment.
- GraphMetadata: schema version, source manifest, sync version, generation time, method, and limitations.

## Procedure
1. Gather domain vocabulary and definitions from the user or authoritative sources.
2. Configure required and optional node/edge types before import.
3. Validate IDs, references, required definitions, edge endpoints, and provenance.
4. Preserve source definitions separately from inferred annotations.
5. Preserve unknown fields when safe; never silently discard data.
6. Export schema and graph data together for portability.

## Example
A context graph can configure Skill, Topic, Concept, DomainTerm, Resource, and Agent nodes with contains, defines, requires, routes_to, uses, and constrains relations. These are examples, not fixed types.

## Boundary and acceptance
Edges do not automatically prove truth, causation, authorization, or execution permission. The same engine must support materially different domains by changing configuration rather than rewriting core logic.
