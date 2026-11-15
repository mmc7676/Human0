---
name: "exam-prep"
description: "Build a verified Human0 Test Prep app and study-guide PDF for a certification exam from its official URL. Use for /exam-prep URL plus exam name, or any request to make exam or certification prep."
---

# /exam-prep — Human0 Test Prep generator

`/exam-prep <certification URL> <Exam code/Exam name> [for <Name>] [lang=<language>]`

Example: `/exam-prep https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/ AZ-900/Azure Fundamentals`

You produce two deliverables from one verified content set:
1. **Human0 Test Prep app**, published as an Artifact. It has a control board, study guide, clickable visual maps, flashcards, practice bank, timed exam simulation, traps, missed-question review, study plan, official links, and click-to-translate on every sentence plus highlight-to-translate on any phrase.
2. **Human0 Test Prep PDF**, a printable study guide in the house research-paper format. It holds every outline section, the diagrams, a weighted mock exam with answer key, and a bilingual glossary.

Both carry the Human0 logo. Nothing in either deliverable mentions AI, models, agents or tools: content is the exam only.

**Defaults** (state them in one line, then run zero-shot; ask nothing unless the URL is unreachable):
- **Learner:** the user running the skill. Use the name they go by (from memory or profile). Override with `for <Name>`.
- **Translation language:** Simplified Chinese (`zh-CN`, label `中文`, toggle `全部中文`). Override with `lang=`.
- **Question volume:** ~215 original questions (about 50–55 per group), plus every official knowledge check, plus links to the vendor's practice assessment.
- **Simulation:** match the exam's minutes. Full mode is 50 questions or the vendor's stated count; sprint is 20 questions in 40% of the time.
- **Plan:** a 36-hour plan unless the user gives an exam date.

## 1. Effort calibration (effort-optimizer, applied per step)

| Step | What catches a wrong answer | Effort |
|---|---|---|
| Fetching, parsing, merging, building, counting | Script exit codes and asserts (`qcheck`, `bank.py`, `build_app.py`, `test_app.js PASS`) | FAST: one pass, no second opinion |
| Linktree resolution | Module list equals the catalog's paths; every outline bullet maps to fetched text | FAST, with a mechanical cross-check |
| Question keys, study notes, diagrams' facts | Nothing mechanical | SLOW: two independent verification rounds by agents that did not write the content, checked against the source text and official URLs; the orchestrator adjudicates conflicts by re-reading the source |
| Translations | `trcheck` negation and "only" scan, plus key-set equality | FAST, plus a manual fix of anything flagged |

Never weaken a check to pass. When sources conflict, quote both in the content and record them in `exam.json` `source_conflicts`. The course text beats a reviewer's memory, because the exam follows the course.

## 2. Fixed subagent slate (find-subagents result)

The memory layers are working (this run's files in `<RUN>`), semantic (official source packs plus the outline), procedural (the briefs below) and policy (the evidence rules above). Nine roles are irreducible; merging any two loses independence or parallelism:

| # | Role | Instances | Receives → Emits | May not |
|---|---|---|---|---|
| 1 | Orchestrator (you) | 1 | URL → exam.json, linktree, groups, adjudication, builds, delivery | delegate adjudication or delivery |
| 2 | Question Author | 1 per group (3–5) | src pack + outline → `q_<G>.json` | verify its own work |
| 3 | Study Guide Writer | 1 | all src packs + outline → `notes.json` | write questions |
| 4 | Round-1 Verifier | 1 per group | `q_<G>.json` → `v_<G>.json` | have written the questions it checks |
| 5 | Round-2 Cross Verifier | 2 (sets A/B) | fixed questions → `r2v_<SET>.json` | reuse a round-1 verifier |
| 6 | Notes Verifier | 2 (halves A/B) | notes → `nv_<SET>.json` | edit notes directly |
| 7 | Translator | ceil(sentences / 500) | `tr_in_<N>.json` → `tr_out_<N>.json` | change English |
| 8 | Diagram author | you (role 1) | notes → `diagrams.py` | invent facts not in notes |
| 9 | Integrator / tester | you (role 1) | all artifacts → app, PDF, test PASS | ship on a failing gate |

**Verdict:** 6 delegated agent types plus the orchestrator. A smaller slate merges authoring with verification and loses independent checking. A larger one adds roles with no new function.

Run every agent as `general-purpose` in the background. Give each the one-line prompt `Read <BRIEF> and follow it exactly. RUN=<run dir>. GROUP=<G> (or SET/N). COUNT=<n>.` plus any placeholders the brief names. Launch all agents of one role in a single message.

## 3. Linktree levels (linktree-search, depth found by probe)

Depth is the smallest level at which (a) every outline bullet maps to fetched official text and (b) the course's practice questions appear. For Microsoft Learn that depth is always **L3**:

| Level | Object | How it's resolved (deterministic) |
|---|---|---|
| L0 | Certification page (the input URL) | WebFetch: exam facts (minutes, pass score, languages, retake), practice-assessment link, sandbox link, study-guide link |
| L0′ | Study guide (`/credentials/certifications/resources/study-guides/<code>`) | WebFetch: verbatim skills outline, domain weights and date → `outline.md`, `exam.json` domains |
| L1 | Learning paths | WebFetch `https://learn.microsoft.com/api/catalog/?type=courses&uid=course.<code>t00` (lowercase code) → `study_guide` uids of type learningPath. If that course uid is empty, try the certification entry (`type=certifications`) or the path page's "other learning paths in the series" links |
| L2 | Modules | `python3 scripts/resolve_mslearn.py <RUN> <path uids...>` → `paths.json` |
| L3 | Units + knowledge checks (`*-knowledge-check`) | `python3 scripts/fetch_mslearn.py <RUN>` → `modules.json`, `kc.json`, `src_<G>.md` |

Exclude "apply skills / guided project" paths unless the outline tests them. For a non-Microsoft vendor, run `/linktree-search` on the URL with depth 1, then 2, then 3, until conditions (a) and (b) hold. Fetch pages with WebFetch, write unit text into `src_<G>.md` in the same `######## MODULE` / `==== UNIT` layout, and write any official practice questions to `kc.json` in the same schema. The vendor's interactive practice assessment usually renders client-side: link it, record it in `exam.json` `blocked`, and never claim it was ingested.

## 4. Pipeline

`RUN=~/examprep/runs/<code>`. First fetch and verify the kit (§7), which fills `~/examprep/scripts/`, `~/examprep/briefs/` and `~/examprep/reference/`.

1. **Intake (L0, L0′).** WebFetch the cert page and the study guide. Write `<RUN>/outline.md` with the verbatim skills measured.
2. **Linktree (L1–L3).** Use the catalog API to get path uids, then run `resolve_mslearn.py`. Map paths to outline domains, then form **groups** of 2–4 modules each (about 5–9k words per group). A big domain splits into two groups (D2A, D2B).
3. **Write `<RUN>/exam.json`**, copying the shape of `reference/exam.example.json`:
   - code, name, user, title (`<CODE> Prep for <User>`), subtitle
   - cert_url, outline_url, outline_date, pass, scale, minutes, format_note, score_note, sim
   - domains (id, name, part_title, weight, mid = weight midpoint as a fraction)
   - groups (domain, count, modules, sections: section ids `d<n>-<slug>`, one per outline sub-area in outline order)
   - module_sections: every module → its section
   - lang, plan_title, plan_note, plan (blocks with `go` panel ids: study, maps, cards, practice, exam, traps, review), links (practice assessment, sandbox, cert page, study guide, each path), facts (PDF table), figures: [], source_conflicts: [], blocked: []
4. **Fetch L3:** `python3 ~/examprep/scripts/fetch_mslearn.py $RUN`. It exits non-zero if any module is missing; fix the slug and rerun.
5. **Author in parallel.** In one message, launch the Question Authors (`briefs/author.md`, one per group, COUNT from exam.json) and the Study Guide Writer (`briefs/notes.md`, SECTION_IDS from exam.json).
6. **Mechanical gate:** `python3 ~/examprep/scripts/steps.py $RUN qcheck`. Send any failure back to its author.
7. **Round-1 verify.** Launch one `briefs/verifier.md` agent per group, in one message.
8. **Round-2 verify.** Run `steps.py $RUN r2split`. Then in one message launch two `briefs/round2.md` agents (SET A and B, SOURCES as printed) and two `briefs/notes_verify.md` agents (SET A and B).
9. **Adjudicate.** For each notes correction that contradicts an explicit course sentence, grep the source pack. Keep the course and reject the correction with `steps.py $RUN notesfix --reject <section:field>`. Otherwise run `steps.py $RUN notesfix`. Then run `python3 ~/examprep/scripts/bank.py $RUN`; it applies both rounds and asserts the invariants.
10. **Diagrams.** Write `<RUN>/diagrams.py` with 4–8 diagrams of the exam's most-confused structures (hierarchies, responsibility matrices, option ladders, tier ladders, connectivity, decision maps).
    - Start with `import sys, os; sys.path.insert(0, os.path.expanduser('~/examprep/scripts')); from diagram_lib import *; out = []`.
    - Build each card with `node(x, y, w, h, label, section_id, sub)`, `arrow`, `note`, and `out.append(svg(w, h, body, title))`. Finish with `write(out)`.
    - Every fact must appear in notes.json or the source pack; grep before drawing.
    - Run it, then `python3 ~/examprep/scripts/render_figs.py $RUN`. Read a contact sheet of `fig/*.png` once, and fix clipped text and labels that overlap arrows. Add the chosen figures to exam.json `figures` as {img, section, caption}.
11. **Translate.** Run `python3 ~/examprep/scripts/build_app.py $RUN segments`, then `steps.py $RUN trsplit`. In one message, launch one `briefs/translate.md` agent per batch. Then run `steps.py $RUN trmerge`. Re-run `segments`; if `todo` > 0, translate the leftovers yourself. Run `steps.py $RUN trcheck` and fix every flagged line.
12. **Build:** `python3 ~/examprep/scripts/build_app.py $RUN app`. For a CJK language, run `python3 ~/examprep/scripts/make_cjk_font.py $RUN`. Then `python3 ~/examprep/scripts/build_pdf.py $RUN`.
13. **Test the app:** `NODE_PATH=$(npm root -g) node ~/examprep/scripts/test_app.js $RUN/out/<CODE>_prep.html <scratchpad>` must print PASS. Read one desktop and one phone screenshot.
14. **Test the PDF:** render a contact sheet (`pdftoppm -r 45`) and page 1 plus a glossary page at 80 dpi, and look for tofu, overflow or clipping. Count pages and words with pypdf.
15. **Deliver.**
    - Publish the app with the Artifact tool: `file_path` is the built HTML, `icon` is `"book"`, `capabilities` is `{"sample": {}}`. It powers highlight-to-translate for phrases not in the glossary; the app falls back offline without it.
    - Send the PDF with SendUserFile.
    - Tell the user the artifact is private until they share it.

## 5. Gates (never ship past a failing one)

`fetch` exit 0 · `qcheck` OK · every question has a round-1 and a round-2 verdict · `bank.py` invariants pass · `segments` todo = 0 · `trcheck` reviewed · `build_app` asserts (sections, maps references) · `test_app` PASS · PDF visually clean.

## 6. Report (substantial work)

Use these headings: STATUS · FACTS (counts: paths, modules, units, knowledge checks, originals, sentences, pages, words) · CHANGES · TESTS (each gate and its result) · DEPLOYMENT (artifact private until shared) · BLOCKED/HUMAN ACTION (practice assessment not ingested; share link) · RISKS (source conflicts, anything unverifiable) · NEXT ACTION.

Keep VERIFIED and DERIVED claims separate. Never claim the vendor's practice assessment was included.

## 7. Kit — fetch once per session

The scripts, briefs and reference config live in the private Human0 Exam-Prep Kit artifact: https://claude.ai/artifact/1xzxidvNHnDuKShacjN914

1. Call the Artifact tool with `action: "read"`, that `url`, and `paths` set to the 19 file paths listed in the manifest below. It saves them under one scratchpad folder and reports that folder.
2. Copy that folder's `scripts/`, `briefs/` and `reference/` into `~/examprep/`. Then verify every hash; stop if it prints MISMATCH:

```bash
cd ~/examprep && python3 - <<'PYEOF'
import hashlib, json
M = {
 "scripts/fetch_mslearn.py": "aeff30c834fedf39d8e0bfad9c6cdf42b2141c0546a58b66eac187509b98dd8f",
 "scripts/resolve_mslearn.py": "f5c31c3eb024ee916dfee8f6eaa9b9a045c37f62c3287c44bfd480a120c03cbe",
 "scripts/steps.py": "b835d4c476f51a84da140267576f0b1d11a1cb26cb3baee6f097e81a284f8895",
 "scripts/bank.py": "c8980209d5c5c6dd6c7dc0a31c61aeed190f9ce39316f0f24a25a05143ee5e92",
 "scripts/build_app.py": "70609a74c0a6bfab2097ad32ac209c9d5fb857f4090182242c093b7324b7fa9c",
 "scripts/build_pdf.py": "1c660153a5fb8800b3d8a0cd44d9e461ba369bc1acc3b2f414d36b800b3faffb",
 "scripts/diagram_lib.py": "d7cfb2f0beb3ead0e3162424dc5fb3e455f515abd76ce2737d5489f47aa26e46",
 "scripts/render_figs.py": "aea92c06edcf29a2800d10c9277353d34896a3c261275bd30cf7d68ae6c7207f",
 "scripts/make_cjk_font.py": "446ed29c422c164ee6fd44a612d7300cdee0bd512c1c4a9ea092895f500a85ff",
 "scripts/test_app.js": "1ee6e3ab671fcaff8e1b23cd91e58ec022808b7f76aadac7097ca6331a36fa53",
 "scripts/app_template.html": "0b036e5e39272c1af24f60946557f933fccf2df607ab1d1bd74b4011cba58716",
 "scripts/human0_logo.svg": "81806ce916f1521d1033d2a406e64ea21992287d0958e8d172be3c8371e7ad07",
 "briefs/author.md": "cd182b17b32032c4676ece8f8e0434cd0f13aa093e2608ade91e7f383627e6ff",
 "briefs/verifier.md": "19686787eabe7e179f3cd2cef1210e4657a7940d137dd05dc50d376d13821346",
 "briefs/round2.md": "8adf8cd0002f0458463c32477ad23b5ba7969a88575903fcbba1fe5e1dd6134b",
 "briefs/notes.md": "9778a766f240a3839e2d61f345e73110ed30cc95824cc14fdfa283625f1f46e4",
 "briefs/notes_verify.md": "009ab6210eb7a158812fc10b9fde8ae78a9edbf10e722ead4a3a7ec093e66fdf",
 "briefs/translate.md": "9991ffa626dd081d21adf999dcac65b9110620f5bef3995969ec78fb9977cffd",
 "reference/exam.example.json": "fde5c25aa2baf9520612f2312d7e7feba3c5aea6df7e1a4c050805a5bce5f1e4"
}
bad = [f for f, h in M.items() if hashlib.sha256(open(f, "rb").read()).hexdigest() != h]
print(len(M), "kit files", "MISMATCH: " + str(bad) if bad else "verified")
PYEOF
```

Python needs `pyyaml reportlab pypdf fonttools playwright` (install any that are missing with `pip install --break-system-packages`); Node needs `playwright`. Both are usually present.

**Tuning the kit.** Edit a file, republish the kit artifact to the same URL with the changed file, then update that file's line in `M` above in this skill. The hash check catches any kit and skill drift.

To swap in the real Human0 logo, replace `scripts/human0_logo.svg` in the kit (and delete `scripts/logo.png` locally so it re-renders).