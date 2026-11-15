---
name: "winning-pattern"
description: "Perfect one user-acknowledged object (repo, file, app, skill, concept, SCW…) in its own sandboxed SCW: mine the user's context for every issue, win the easiest first, reuse each win as the harness for the next."
---

# winning-pattern

`/full-example` creates the universe. `/winning-pattern` perfects it, using the user's context as the whole universe.

A **win** is a task step completed zero-shot, correct, complete, and verified. The user's acceptance is the gate, and the gate is in their head. The only way to cheat is to cheat yourself: claim a win you have not verified, or skip an issue the user raised. Making the result good enough that the user accepts it is not cheating; it is winning.

## Runs in its own SCW (sandboxed by default)

Every run happens in a fresh, isolated workspace: a new SCW for this object only.

- **Isolate the context.** Where the host can, run the work in a separate subagent or forked context that receives only the object, the user's context about it, and this skill. Otherwise, open a dedicated scratch workspace and keep everything for this run inside it.
- **Isolate the changes.** Work on a copy or a new branch of the object. Nothing touches the user's original until the ledger is complete and the user accepts the result.
- **Free inside the box.** Inside the SCW, act without waiting for permission on anything reversible and contained: read, build, test, rewrite, try again. Ask nothing you can check.
- **The box has walls.** Sandboxing frees the work from the user's live files, not from rules: safety guidelines, the user's stated boundaries, and anything owned by the user (credentials, legal choices, money, publishing, irreversible steps) stay outside the box and come back as BLOCKED rows.
- **Leave only the result.** When the run ends, hand back the perfected object (or its change set) and the ledger; discard the scratch work.

## Inputs (all three required)

| | Input | Rule |
|---|---|---|
| `$` | **The object**: a repo, file, app, skill, concept, agent, topic, SCW, or anything else | The user must have acknowledged it, and you must have access to it. If either is missing, stop and say which. |
| `$$` | **The user's acknowledgments**: every issue, constraint, preference, decision, correction and gate the user has stated about the object, in this request and earlier in the conversation or memory | The user carries the context. Never ask for something already given. |
| `$$$` | **The pattern to win**: zero-shot, verified-correct, complete task completion | Applies to every step, not only the last |

## How it differs from neighbouring skills

- **supersystem-integrate** synthesises many data sources into an application. **winning-pattern** works on one acknowledged object, and its only source of requirements is the user's context.
- **full-example** builds the full world (an SCW, an app, a repo). **winning-pattern** takes that world to the state the user will accept; for an SCW, it authors the final constitution, as of the moment the user asks for it.
- Like both, it recurses and **infers before it generates**.

## Procedure

### 1. Confirm the object

Name the object and how you can reach it. Open it and look; never work from memory of it. If you cannot reach it, stop: that is the one question worth asking.

### 2. Build the win ledger

Read all of the user's context about the object (this message, the conversation, memory, files they pointed to) and write one ledger row per item:

| # | Acknowledgment (in the user's words) | Kind | Check that proves it won | Ease | State |
|---|---|---|---|---|---|

- **Kind**: issue, constraint, preference, decision, correction, or gate.
- **Include implicit items.** A correction the user applied directly in their context can be inferred as a constraint and harnessed now. A decision the user has described does not need to be re-verified, and can be harnessed across other decision sets. A preference they stated once applies everywhere.
- **Check**: name the evidence before solving. Mechanical (a test, count, diff, file listing, exit code) when possible; otherwise the specific line of user context the result must satisfy.
- **Ease** = how cheaply the check can pass: mechanical and local first, judgment last.
- **State**: OPEN, WON, or BLOCKED (owned by the user: credentials, legal choices, money, publishing, irreversible steps).

### 3. Infer the gate

Before generating anything, write one line per open row: *what would make the user accept this?* Derive it only from their context: what they praised, what they rejected, what they corrected, the words they use for things. Generate against that inference, not against a generic standard.

### 4. Win the easiest row

Solve the easiest open row completely. Run its check. Only a passed check books the win:

```
[WON] #3  Root README explains how Maxey0 relates to Human0
      check: section present; every claim traces to the user's stated ontology (Human0 = app/architecture, SCW0 = top-level environment, Maxey0 = orchestrator)
```

If the check fails, fix and re-run. Never book a partial win.

### 5. Turn the win into a harness

State the win as a reusable pattern: *input → method → check*. Apply that harness to the next-easiest row that has the same shape. Example: the harness that fixed one stale definition (find the user's current statement → replace → grep every file for the old wording) also clears every other place the old wording appears. A decision the user described works the same way: once applied in one place, apply it to every decision set it governs.

### 6. Recurse until you can't lose

Repeat 4–5, easiest first, re-ranking after each win: a win often makes harder rows easy. Stop when every row is WON or BLOCKED. Then sweep once more for issues the user's context implies but never named; add them as rows and win them too.

### 7. Deliver

1. The perfected object (or the exact change set, if the user must apply it).
2. The ledger: each row with its state and the evidence for each WON.
3. BLOCKED rows as precise actions for the user: what, where, and the expected result.

Keep the report about the object, not the process. One line per win.

## Iteration

The user saving the skill or accepting the result is the win. If the user replies `/winning-pattern`, they want a better version from their context: open a fresh SCW, re-read everything they have said since the last pass, add new rows, and run again from step 2 without asking them to repeat themselves.

## Rules

- **The user's context is the universe.** No requirement from outside it, unless it is a fact you verified about the object itself.
- **Address everything the user raised.** An issue mentioned in passing is still a row.
- **Verify before WON.** An unchecked claim is OPEN, never WON. A decision the user described is context, not a claim: harness it, don't re-verify it.
- **Never re-ask** for context the user already gave, and never ask about something you can check.
- **Current over obsolete.** When the user's statements about the object differ across time, the latest wins; replace older wording everywhere it appears.
- **Confidence comes from the ledger,** not from tone: report exactly what was won and how.

## Example

Object: `Human0/README.md`, which you drafted. The user says: *"I like it, but it's weak on how Maxey0 relates to Human0, and I think your SCW data came from an obsolete version."*

| # | Acknowledgment | Check | Ease |
|---|---|---|---|
| 1 | SCW data may be obsolete | every SCW statement matches the user's latest definition; grep shows no older wording anywhere | mechanical |
| 2 | Weak on Maxey0 ↔ Human0 | a section stating the user's own ontology, with no claim outside it | judgment, sourced |
| 3 | "I like it" | everything else unchanged (diff limited to rows 1–2) | mechanical |

In a fresh SCW on a copy of the README: win row 3's harness first (diff discipline), then row 1 (find the latest definition → replace → grep all files), then reuse row 1's harness for row 2 (find the latest ontology statement → write the section → trace every claim). Deliver the README, the three WON rows with their evidence, and nothing else.