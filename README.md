<div align="center">

<img src="assets/human0-logo.png" width="104" alt="Human0">

# Human0

**Coming soon.**

</div>

## Apps

| App | |
|---|---|
| **[Maxey0 Context Plane](apps/maxey0-context-plane)** | A live map of where any task belongs and who should handle it: an MCP server for Claude and an interactive 3D graph. [Open the app](https://app.maxey0.com/app) · [Docs](https://app.maxey0.com/docs/) · [Research](https://app.maxey0.com/research/) |
| **[Space-at-Scale](plugins/space-at-scale)**<br><img src="plugins/space-at-scale/docs/images/milky-way-hero.jpg" width="260" alt="Space-at-Scale"> | A true-scale 3D simulation at three scales: the solar system in AU, the Local Bubble in light years and the Milky Way in thousands of light years, each running forward and backward in time to its physical limits. Runs inline in Claude (MCP App plus 25 tools) or as one offline HTML file (`plugins/space-at-scale/server/dist/space-at-scale.html`). |
| **[SCW Modeler](plugins/scw-modeler)** | Model any system as Structured Context Windows: `/scw-modeler text, …` returns the SCW tree, holdings, laws and typed relations; `/scw-modeler viz, …` opens it as an inline graph with the Context Plane route and data servers around it. |

## Skills

Each skill below is one folder in [`skills/`](skills), packaged for the Claude plugin directory in [`plugins/`](plugins) and as a zip in [`dist/`](dist). How the folders are organized: [STRUCTURE.md](STRUCTURE.md).

<!-- skills:start -->
| Skill | Name | Version | What it does | Packages |
|---|---|---|---|---|
| [`/coverage-testing-artifact-parity`](skills/coverage-testing-artifact-parity) | Coverage Testing Artifact Parity | 1.0.0 | Build requirement-to-artifact traceability, meaningful tests, provenance records, and exact byte-parity checks for generated artifacts. | [plugin](plugins/coverage-testing-artifact-parity) · [zip](dist/coverage-testing-artifact-parity.zip) |
| [`/data-ingestion-state-sync`](skills/data-ingestion-state-sync) | Data Ingestion State Sync | 1.0.0 | Implement reusable multi-source ingestion, normalization, deduplication, versioned state synchronization, and stale-derived-data invalidation. | [plugin](plugins/data-ingestion-state-sync) · [zip](dist/data-ingestion-state-sync.zip) |
| [`/definition-grounded-relation-inference`](skills/definition-grounded-relation-inference) | Definition Grounded Relation Inference | 1.0.0 | Infer reviewable candidate edges from verbs, adjectives, and adverbs to entity nodes using uploaded definitions and explicit lexical evidence. | [plugin](plugins/definition-grounded-relation-inference) · [zip](dist/definition-grounded-relation-inference.zip) |
| [`/effort-optimizer`](skills/effort-optimizer) | Effort Optimizer | 1.0.3 | Calibrates reasoning and execution effort to a task's actual stakes before acting on it — fast and low-verification for mechanical, reversible steps; slow and directly verified for anything touching auth, security, production, or a claim the user will act on without double-checking it. | [plugin](plugins/effort-optimizer) · [zip](dist/effort-optimizer.zip) |
| [`/evidence-based-relation-inference`](skills/evidence-based-relation-inference) | Evidence Based Relation Inference | 1.0.0 | Infer reviewable relationships between typed graph nodes from definitions, metadata, rules, compatible embeddings, or domain-specific evidence. | [plugin](plugins/evidence-based-relation-inference) · [zip](dist/evidence-based-relation-inference.zip) |
| [`/exam-prep`](skills/exam-prep) | Exam Prep | 1.0.0 | Build a verified Human0 Test Prep app and study-guide PDF for a certification exam from its official URL. | [plugin](plugins/exam-prep) · [zip](dist/exam-prep.zip) |
| [`/file-graph`](skills/file-graph) | File Graph | 1.0.0 | Find files the user uploaded to Claude by name or wildcard (maxey0.csv, maxey0*, *.tsx) and return a clickable graph of each file linked to the chat or project it was uploaded to. | [plugin](plugins/file-graph) · [zip](dist/file-graph.zip) |
| [`/find-concepts`](skills/find-concepts) | Find Concepts | 1.0.0 | Choose the optimal fixed set of 5-8 durable concepts for a topic, each with 2-4 skills' worth of scope, with coverage and traceability checks. | [plugin](plugins/find-concepts) · [zip](dist/find-concepts.zip) |
| [`/find-mcp`](skills/find-mcp) | Find MCP | 1.0.0 | Find and verify the right MCP servers for a skill, concept or topic from the live registry, with tools, uuids and human-approval flags; never invents servers. | [plugin](plugins/find-mcp) · [zip](dist/find-mcp.zip) |
| [`/find-skills`](skills/find-skills) | Find Skills | 1.0.0 | Design the optimal fixed slate of durable skills (or, with level=, of topics/concepts/agents/MCP servers) for an agent or domain, with per-level coverage, traceability and parity checks. | [plugin](plugins/find-skills) · [zip](dist/find-skills.zip) |
| [`/find-subagents`](skills/find-subagents) | Find Subagents | 1.0.0 | Determine the optimal fixed count and exact fixed set of durable subagent roles for a language model, AI assistant, or agent runtime. | [plugin](plugins/find-subagents) · [zip](dist/find-subagents.zip) |
| [`/full-example`](skills/full-example) | Full Example | 1.0.2 | Generates a complete, copy-paste worked example for any app, setup or build the user names — every field value, every step in order, what the user should see after each step, and any sample files. | [plugin](plugins/full-example) · [zip](dist/full-example.zip) |
| [`/interactive-graph-app-builder`](skills/interactive-graph-app-builder) | Interactive Graph App Builder | 1.0.0 | Build interactive graph dashboards whose node types, layers, ingestion controls, relations, and visual styles are configuration-driven. | [plugin](plugins/interactive-graph-app-builder) · [zip](dist/interactive-graph-app-builder.zip) |
| [`/lexicon-sync-embedding-refresh`](skills/lexicon-sync-embedding-refresh) | Lexicon Sync Embedding Refresh | 1.0.0 | Normalize staged lexical lists and refresh the embedding field for the complete current node set after every accepted change. | [plugin](plugins/lexicon-sync-embedding-refresh) · [zip](dist/lexicon-sync-embedding-refresh.zip) |
| [`/linktree-search`](skills/linktree-search) | LINKTREE Search | 1.0.3 | Build, maintain, or use the LINKTREE method for deterministic hierarchical URL crawling and indexing. | [plugin](plugins/linktree-search) · [zip](dist/linktree-search.zip) |
| [`/mahjong`](skills/mahjong) | Mahjong | 1.0.0 | Launch a single-player American Mah Jongg game (NMJL-style 2026 rules) inline in chat against three computer players who can also win, with Beginner/Intermediate/Advanced levels and a built-in coach. | [plugin](plugins/mahjong) · [zip](dist/mahjong.zip) |
| [`/modular-system-integrator`](skills/modular-system-integrator) | Modular System Integrator | 1.0.0 | Decompose and integrate arbitrary projects into reusable skills, domain objects, executable instructions, SCWs, and testable artifacts without coupling the workflow to one application domain. | [plugin](plugins/modular-system-integrator) · [zip](dist/modular-system-integrator.zip) |
| [`/semantic-graph-validation-and-parity`](skills/semantic-graph-validation-and-parity) | Semantic Graph Validation And Parity | 1.0.0 | Validate SWG behavior, provenance, and byte-identical source parity across Maxey0 artifacts and SCW records. | [plugin](plugins/semantic-graph-validation-and-parity) · [zip](dist/semantic-graph-validation-and-parity.zip) |
| [`/semantic-word-graph-builder`](skills/semantic-word-graph-builder) | Semantic Word Graph Builder | 1.0.0 | Build or revise the Maxey0 Semantic Word Graph as a staged, evidence-labelled, four-plane lexical graph. | [plugin](plugins/semantic-word-graph-builder) · [zip](dist/semantic-word-graph-builder.zip) |
| [`/starting-five`](skills/starting-five) | Starting Five | 1.0.0 | NBA Collect Starting 5 Contest: picks the max-expected Topps-rubric player at PG, SG, SF, PF and C for the current NBA slate, with live injuries, matchups, pace and blowout/back-to-back minutes. | [plugin](plugins/starting-five) · [zip](dist/starting-five.zip) |
| [`/supersystem-integrate`](skills/supersystem-integrate) | SuperSystem Integrate | 1.0.3 | Generative engineering skill for discovering the intent and feasibility of a new model, protocol, idea, or capability, integrating it modularly into an existing system, validating the result, and shipping the completed artifact. | [plugin](plugins/supersystem-integrate) · [zip](dist/supersystem-integrate.zip) |
| [`/topic-graph-generator`](skills/topic-graph-generator) | Topic Graph Generator | 1.0.0 | Generate a full-level Human0 topic pack (Topic → Concepts → Skills → Agents → MCP + lexicon) from a named topic/concept, building on existing topics, with real MCP servers verified this session. | [plugin](plugins/topic-graph-generator) · [zip](dist/topic-graph-generator.zip) |
| [`/typed-graph-modeler`](skills/typed-graph-modeler) | Typed Graph Modeler | 1.0.0 | Model arbitrary graphs with configurable node classes, layers, definitions, typed edges, and provenance. | [plugin](plugins/typed-graph-modeler) · [zip](dist/typed-graph-modeler.zip) |
| [`/winning-pattern`](skills/winning-pattern) | Winning Pattern | 1.0.0 | Perfect one user-acknowledged object (repo, file, app, skill, concept, SCW…) in its own sandboxed SCW: mine the user's context for every issue, win the easiest first, reuse each win as the harness for the next. | [plugin](plugins/winning-pattern) · [zip](dist/winning-pattern.zip) |
| [`/zero-to-one`](skills/zero-to-one) | Zero to One | 1.0.2 | Generates a complete, copy-paste worked example for any app, setup or build the user names — every field value, every step in order, what the user should see after each step, and any sample files. | [plugin](plugins/zero-to-one) · [zip](dist/zero-to-one.zip) |
<!-- skills:end -->

## Install the plugin in Claude

```
/plugin marketplace add mmc7676/Human0
/plugin install maxey0-context-plane-graph@human0
/plugin install space-at-scale@human0
/plugin install scw-modeler@human0
/plugin install zero-to-one@human0   # any skill in the table above, by name
```
