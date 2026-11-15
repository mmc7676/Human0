![Human0](human0-logo.png)

# `file-graph`

By Human0. Find files the user uploaded to Claude by name or wildcard (maxey0.csv, maxey0*, *.tsx) and return a clickable graph of each file linked to the chat or project it was uploaded to. Use for /file-graph, "which chat did I upload X to", or browsing uploads beyond Settings > Privacy > Uploaded files.

## What it covers

- Input
- Procedure
- The page
- Boundaries
- Verify

The full instructions are in [`SKILL.md`](SKILL.md).

## Use it

In Claude or Claude Code, type `/file-graph` followed by your request, or describe the task in plain words and Claude loads the skill when it matches.

## Contents

- `LICENSE`
- `SKILL.md`
- `scripts/build_graph.py`
- `scripts/collect.js`
- `scripts/graph_template.html`
- `tests/test_build_graph.py`

## License

MIT, see [LICENSE](LICENSE).
