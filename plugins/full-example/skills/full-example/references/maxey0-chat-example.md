# Worked example: /full-example Maxey0-Chat App

This is the answer that was sent for `/full-example Maxey0-Chat App`, after one
round of the user's corrections, followed by how it was built. Use it to
calibrate the level of detail: every label in it was read from the dashboard
source, and every expected message came from running the dashboard's own
parser.

## How it was built

| Stage | What was done | Result |
|---|---|---|
| Pin | Dashboard script pinned in the Maxey0 skill: `mmc7676/maxey0-chat` at commit `4551647`, used on mobile | Exact target |
| Inspect | Fetching from the CDN was blocked, so the public repo was cloned at that commit. Read `src/dashboard.src.html` (every control and handler), `src/parser.js`, `skills/maxey0/syntax.md` and `state.example.json` | Full control list, plus gotchas: Visualize wipes worlds and steps but keeps agents; a name saves on blur; files are read only if text and ≤40 KB; the "starts" menu misreports multi-waits; loops are fixed at 3 rounds |
| Past chats | Searched for multi-SCW and loop workflows. Found the user's real Maker/Checker/Judge/LBJ skills-inventory cleanup across SCW0–SCW4 | Scenario rebuilt on synthetic data |
| Scenario | 16-row synthetic inventory, six cleanup rules, web provenance research in its own world, an answer key held only by the Judge's world, and an LBJ cross-world check | Uses every dashboard feature; the right answer is known (9 removed, 7 kept); safe to record publicly |
| Files | `skills_inventory.csv`, `cleanup_rules.txt`, `answer_key.txt`. The `.txt` extension was chosen because the dashboard's MIME check rejects `.md` on many Android phones | — |
| Verify | Ran `parser.js` on the workflow text in Node, which gave 4 worlds, 5 steps, the intended dependencies and stages. Computed the answer key with a script applying the rules. Cloned `anthropics/skills` to confirm `skill-creator`, `pdf` and `docx` are published there | One fix: `/effort-optimizer` was reaching only one step, so it was moved inline on each step and re-run |
| Blocked | `/file-graph` collection needed a signed-in browser and none was reachable | Reported as BLOCKED, and synthetic files were used instead |
| Correction | The user asked what "Check:" meant. It was leftover tutorial wording | Replaced with "You should see:" and merged into one current version |

## Sample files

### skills_inventory.csv
```csv
name,author,version,path,description
maxey0-orchestrator,Human0,3.1.0,skills/maxey0/SKILL.md,Opens the Maxey0 dashboard and runs SCW workflows.
scw-evaluator,Human0,1.2.0,skills/scw-evaluator/SKILL.md,Checks a run against the five SCW invariants.
scw-evaluator,Human0,1.0.0,skills/scw-evaluator-old/SKILL.md,Checks a run against SCW invariants (old).
effort-optimizer,Human0,2.0.0,skills/effort-optimizer/SKILL.md,Calibrates effort to what can check the answer.
lbj-observer,Human0,1.1.0,skills/lbj/SKILL.md,Maxey00 superposition observer that compares worlds.
okf-bundle-builder,Human0,0.1.0,skills/okf/SKILL.md,
skill-creator,,1.0.0,skills/skill-creator/SKILL.md,Guide for creating effective skills.
pdf,,1.0.0,skills/pdf/SKILL.md,"Create, merge and fill PDF files."
docx,Anthropic,1.0.0,skills/docx/SKILL.md,Create and edit Word documents.
Skills2upload.zip,Human0,,uploads/Skills2upload.zip,
notes-2026-09.txt,Human0,,notes/notes-2026-09.txt,Scratch notes.
loopy,Human0,0.3.0,experimental/loopy/SKILL.md,Experimental loop library.
loop-library,Human0,0.3.0,experimental/loop-library/SKILL.md,Compatibility alias for loopy.
tokenless-compiler,Human0,0.9.0,skills/tokenless/SKILL.md,Compiles Tokenless symbols to prompts.
tokenless,Human0,0.9.0,skills/tokenless-alias/SKILL.md,Compatibility alias for tokenless-compiler.
kml-mapper,Human0,1.0.0,skills/kml-mapper/SKILL.md,Exports KML layers for Maxey0-GIS.
```

### cleanup_rules.txt
```
# Skills inventory cleanup rules

Apply these to `skills_inventory.csv`. Every removal must cite one rule and the
evidence visible in that row (name, author, path or description). No evidence in
the row, no removal.

- **R1 Not a skill.** Remove the row if its `path` does not end in `SKILL.md`.
- **R2 Anthropic-published.** Remove the row if `author` is `Anthropic`, or if
  `author` is empty and the `name` appears in the SCW3 provenance list.
- **R3 Experimental.** Remove the row if its `path` starts with `experimental/`
  or its description says "Experimental".
- **R4 Duplicates.** If the description says "Compatibility alias for X" and X is
  another remaining row, remove the alias. If two remaining rows share a `name`,
  keep only the highest `version`.
- **R5 Missing description.** Keep the row, set the description to
  `MISSING - needs author`.
- **R6 Stale terminology.** Replace `Maxey00` with `LBJ` in descriptions.

Output: the cleaned CSV with the same five columns, then a change log with one
line per removed or edited row: `name | rule | evidence`.
```

### answer_key.txt
````
# Answer key: skills inventory cleanup

Only the Judge's world (SCW2 Review) holds this file. The maker never sees it.

Expected: 16 input rows, 9 removed, 7 kept.

## Expected cleaned CSV

```csv
name,author,version,path,description
maxey0-orchestrator,Human0,3.1.0,skills/maxey0/SKILL.md,Opens the Maxey0 dashboard and runs SCW workflows.
scw-evaluator,Human0,1.2.0,skills/scw-evaluator/SKILL.md,Checks a run against the five SCW invariants.
effort-optimizer,Human0,2.0.0,skills/effort-optimizer/SKILL.md,Calibrates effort to what can check the answer.
lbj-observer,Human0,1.1.0,skills/lbj/SKILL.md,LBJ superposition observer that compares worlds.
okf-bundle-builder,Human0,0.1.0,skills/okf/SKILL.md,MISSING - needs author
tokenless-compiler,Human0,0.9.0,skills/tokenless/SKILL.md,Compiles Tokenless symbols to prompts.
kml-mapper,Human0,1.0.0,skills/kml-mapper/SKILL.md,Exports KML layers for Maxey0-GIS.
```

## Expected change log

- skill-creator | R2 | author '', in provenance list: True
- pdf | R2 | author '', in provenance list: True
- docx | R2 | author 'Anthropic', in provenance list: True
- Skills2upload.zip | R1 | path uploads/Skills2upload.zip
- notes-2026-09.txt | R1 | path notes/notes-2026-09.txt
- loopy | R3 | path experimental/loopy/SKILL.md
- loop-library | R3 | path experimental/loop-library/SKILL.md
- tokenless | R4 | alias for tokenless-compiler
- scw-evaluator | R4 | older version 1.0.0 at skills/scw-evaluator-old/SKILL.md
- lbj-observer | R6 | Maxey00 -> LBJ
- okf-bundle-builder | R5 | empty description

R2 provenance basis: github.com/anthropics/skills lists skill-creator, pdf and docx under skills/.
````

## The answer as sent

Save skills_inventory.csv, cleanup_rules.txt and answer_key.txt to your phone first.

**1. Open the dashboard** (in a new chat)
```
/maxey0
```

**2. Paste the workflow, then tap Visualize**
```
Process in parallel ($pp)
Launch SCW 1 in scw0
Launch SCW 3 in scw0
In scw3:
/effort-optimizer /deep-research List the skill names Anthropic publishes in github.com/anthropics/skills and as claude.ai built-in skills. Return a plain list with one source link per name. Save to SCW3.
In scw1:
1) /effort-optimizer Apply rules R1 to R3 from cleanup_rules.txt to skills_inventory.csv when scw3 is complete. Use the SCW3 list for rows with no author. List every removed row with its rule. Save to SCW1.
2) /effort-optimizer Apply rules R4 to R6 to the result of step 1. Output the cleaned CSV and the change log. Save to SCW1.
---
Process in parallel ($pp)
Launch SCW 2 in scw0
In scw2:
/effort-optimizer Compare the cleaned CSV with answer_key.txt row by row when scw1 is complete. Report PASS or FAIL per row and an overall score. Save to SCW2.
In scw0:
/effort-optimizer Compare what SCW1 removed with the SCW3 list and flag any contradiction between worlds when scw1 is complete.
Also confirm every SCW3 name has a source link when scw3 is complete. Save to SCW0.
```
You should see this message under the button: "Drew 4 worlds and 5 steps."

Do this step before every other step. Tapping Visualize again later erases world names, files, agent placements and loops; only the agents you add are kept.

**3. Add two agents** (type the name and role, then tap Add)
- Name `Maxey4`, role `researcher`
- Name `LBJ`, role `observer`

**4. Name and describe the worlds** (top to bottom)
A world name saves only when you tap outside the field. A description saves as you type.
- SCW0: keep the name. Description: `Root: Maxey0 orchestrates, LBJ observes across worlds`
- SCW1 → `Intake`. Description: `Raw inventory and cleanup rules. The maker works here.`
- SCW3 → `Provenance`. Description: `Web research on who published each skill.`
- SCW2 → `Review`. Description: `Answer key. Only the judge works here.`

**5. Attach files** (tap + file)
- In Intake: skills_inventory.csv and cleanup_rules.txt
- In Review: answer_key.txt

You should see each file as a chip with its name. "(attach in chat)" may flash for a second while a file loads. If it stays, the phone reported the file as non-text and the dashboard didn't read it.

**6. Place agents** (tap the agent, then tap "Drop an agent" on the step)
- Provenance step → Maxey4
- Intake step 1 → Maxey1
- Intake step 2 → Maxey1
- Review step → Maxey3
- SCW0 step → LBJ

**7. Turn on loops**
On both Intake steps, tick "Loop until a checker passes it" and leave the checker on `checked by Maxey2`. Each loop is fixed at 3 rounds.

**8. Add a nested world and a manual step**
1. On Review, tap **+ world inside**. SCW4 appears.
2. Rename it `Report` and tap outside the field. Description: `Public run summary`
3. In Report, tap **+ step**, then place Maxey3 on the new step.
4. Paste this as the step's task:
```
/effort-optimizer Write a one-page public run report: what each world produced, the judge's score, and what failed and why.
```
5. Set "When this step starts" to **After Review · Maxey3: Compare the cleaned CSV…**

**9. Remove a world**
On Provenance, tap **+ world inside**, then tap × on the new SCW5.

**10. Confirm the run order, then tap Run ↗**
You should see five rows in Run order:
1. first: Provenance
2. then: Intake (Apply rules R1 to…)
3. then: Intake (Apply rules R4 to…)
4. then, at once: Review and SCW0
5. then: Report

Leave the "When this step starts" menus on the Review and SCW0 steps alone. They show "Starts at once", but each step really waits on several steps, as the "Waits for…" line under it shows. Changing the menu cuts those waits down to one.

**What the run should produce**
The run is R-1. The correct cleanup result is 16 rows in, 9 removed and 7 kept. The Judge scores Intake's output against answer_key.txt, which only the Review world holds.

**Issues found**
- The "When this step starts" menu shows "Starts at once" for steps with several waits, and changing it collapses them to one.
- Skill chips only come from Visualize; in a manual step, a `/skill` stays inside the task text.
- Loop rounds are fixed at 3.
- Files are read only if text-typed and 40 KB or smaller.
- A world's name saves on blur, but its description saves as you type.

**Status**
- VERIFIED: labels, messages and ordering (source at `4551647`, plus a parser run); the answer key (computed by code).
- DERIVED: `.txt` files load reliably on the user's phone (from the MIME check; not device-tested).
- BLOCKED: `/file-graph` (no reachable browser).
