---
name: modular-system-integrator
description: Decompose and integrate arbitrary projects into reusable skills, domain objects, executable instructions, SCWs, and testable artifacts without coupling the workflow to one application domain.
---
# Modular System Integrator

## Purpose
Convert a user goal into a modular, reusable implementation plan and deliverable set. Applies to semantic graphs, context graphs, knowledge systems, agent platforms, dashboards, document pipelines, and other software artifacts.

## Operating loop
1. Understand: preserve the user's exact goal, constraints, requested outputs, and success conditions.
2. Discover: inspect existing source artifacts, skills, schemas, integrations, and prior decisions before rebuilding.
3. Decompose: separate reusable skills (methods), domain objects (data/state), user-specific instructions (requirements), implementation code, and validation evidence.
4. Model: define ownership, interfaces, invariants, data flow, failure modes, and authority boundaries.
5. Compose: select existing skills first; create new skills only for reusable capabilities not already covered.
6. Implement: keep components replaceable, named, versioned, and independently testable.
7. Validate: map each requirement to an artifact, behavior, and test result.
8. Package: store each reusable skill as an independent SKILL.md with clear triggers, inputs, outputs, procedure, boundaries, and acceptance tests.
9. Verify: inspect actual artifacts and outputs; distinguish performed tests from intended tests.

## Modularity rules
- Generalize methods; do not bake a single domain's nouns, types, or UI into a reusable skill.
- Keep domain-specific examples as examples, not universal constraints.
- Prefer explicit interfaces and configurable schemas over hard-coded node classes.
- Keep user instructions and source truth separate from implementation code.
- Preserve backward compatibility unless a change is requested.
- Reuse established skills such as effort optimization, integration, research, and full-example delivery rather than copying their responsibilities.

## SCW mapping
When using SCWs, assign separate worlds for source/request; coverage orchestration; skill inventory; domain model; implementation requirements; and isolated child skill packages. IDs are references, not semantic substitutes for their contents.

## Deliverables
Provide a coverage matrix, architecture/data-flow description, artifact inventory, test report, and limitations. Save a final orchestration script that can be reused for future domains by supplying configuration and source artifacts.

## Acceptance
A reviewer can change the domain and configured node types without rewriting the general skills; every user requirement maps to code or an explicit limitation; no test is claimed without evidence.
