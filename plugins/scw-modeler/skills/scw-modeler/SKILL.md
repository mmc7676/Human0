---
name: scw-modeler
description: Models any system the user names (physical, software, organizational, biological) in Structured Context Window (SCW) architecture and returns it as text or as an inline graph. Use for /scw-modeler, "model X as SCWs", or "show X in SCW architecture".
---

# /scw-modeler

Input: `/scw-modeler <text|viz>, <system or list of parts>`. Example: `/scw-modeler text, Sag A, The Milky way, the sun, and dark matter`. If the mode is missing, use `text`.

## 1. Model only what was named

Build exactly the parts the user listed, no more. If a part the user did not name would normally carry something (for example the stars and gas of a galaxy), the nearest named SCW owns it. Say so in `structural_note`: that is the structural difference from a fuller model.

## 2. Build the SCW model

Call `scw_relations` first. Every SCW has:

- an `id` of the form `SCW-<Name>`, a `name`, and a short `tag` (shown in the tree);
- a `role` and what it `holds`;
- `laws`, each `on`, `off` or `inherit`. Switch a law off where it stops being valid (Kepler is off in a galaxy with no dominant mass; Newton is off inside a horizon).

Every non-root SCW names its `parent` and one `relation`:

| Relation | Use when |
|---|---|
| contains | bound inside the parent; its boundary is computed from the parent |
| superposes | one additive term sharing the parent's space; no component is the center |
| passes-through | a pattern or process that members move through and that owns no members |
| signals | known to others only when its signal arrives |
| shares-gravity | influence adds across the link but nothing observable crosses it |
| feeds | one-way flow into the parent |
| governs | sets or switches the parent's laws without being contained by it |

There is exactly one root. Prefer the relation that the physics or mechanics justifies over "contains" by habit. Add `tables` for shares, regimes or comparisons, and add a `one_line` answer.

## 3. Get the data (find-mcp first)

1. **Route on the Context Plane.** Call `route_task` on `maxey0-context-plane` with short keyword phrasing and a `domain` (long sentences often return no match). Record the top path as `context.path`, its agents as `context.agents`, and its gated MCP servers as `context.mcp`. A route is a candidate, not an authorization; say so.
2. **Run /find-mcp.** If the find-mcp skill is installed, run it for the system. Otherwise call SearchMcpRegistry with 2 to 4 keyword sets. Add each server you would use to `context.mcp` with a `why`. Never invent a server, uuid or tool name.
3. **Pull numbers from a tool where one exists.** For galaxies, stars, the solar system or dark matter, use the Space at Scale tools when they are connected (`galaxy_field`, `galaxy_object`, `sim_state`). Every number goes in a `data` row with its `source` and an evidence label: EXEC (a tool computed it this session), FACT (read from a source), DERIVED (your arithmetic, with the formula), or HYPOTHESIS. Do not state a number that has no source.

## 4. Validate, then return

1. Call `validate_scw_model` and fix every error it reports.
2. **text:** call `scw_model_text` and return its output as your answer, unchanged, followed by at most two sentences of your own.
3. **viz:** call `render_scw_model`. The graph opens inline, with each SCW drawn inside its SCW boundary, superposed terms overlapping in one field, contained children nested, and the Context Plane route and data servers as the outer ring. If the inline view is not available, call `scw_model_html` and publish or send the file.

## Boundaries

- Model what the user named. Extra SCWs go in a suggestion, not in the model.
- Keep the user's names and spelling for parts; fix only obvious typos.
- Label every claim's evidence. A Context Plane route or a registry hit shows that a candidate exists, not that it works.
