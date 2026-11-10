# Maxey0 Context Plane — OWL 2 + SHACL (build 6.3.0)

The same plane as `SCW1/scw1.graph.json`, in standard knowledge-graph form.

| File | What it is |
|---|---|
| `maxey0-context-plane.owl.ttl` | OWL 2 ontology + every node, link and 3D field place (Turtle) |
| `maxey0-context-plane.shapes.ttl` | SHACL shapes: one parent per node, one primary and one checker per skill, gate basis, related ≥ 0.40, a 3D field place on every node, and the drift record rules (drift = ψ − flat, task_out ≤ task_in, the node must exist) |
| `build_log.json` | the checks of the last build |
| `examples/run-1-drift-scw.json` → `examples/drift-run-1.ttl` | one lens route's drift record (app export) and its RDF form |

Rebuild (needs `pip install rdflib pyshacl owlrl`):

```
python tools/owl/build_owl.py SCW1/scw1.graph.json SCW1/scw1.graph.json ontology ontology/examples/run-1-drift-scw.json
```

The second argument can be the live `https://maxey0-context-plane-mcp.maxey0.workers.dev/graph.json` (saved to a file) to check live/local parity. The RDF/XML form and the OWL 2 RL closure (`*.owl`, `*.inferred.ttl`) are written too but not committed (regenerable, 4.7 MB and 7.7 MB).

Checks at build 6.3.0 (digest `sha256:e195205d…`): counts 9 of 9 equal; 6,314 of 6,314 role edges round-trip; 3,986 of 3,986 field places round-trip; 0 checker-inheritance violations; SHACL conforms; a skill with two primaries is rejected; OWL 2 RL closure 119,115 triples with no inconsistency; all 1,998 skills inferred partOf their domain; the run-1 drift record conforms and a tampered drift value is rejected.
