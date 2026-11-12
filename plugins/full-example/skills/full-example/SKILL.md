---
name: full-example
description: Generates a complete, copy-paste worked example for any app, setup or build the user names — every field value, every step in order, what the user should see after each step, and any sample files. Use for /full-example, "full example of X", or a request to show every field and step needed to use, set up or build something.
---

# /full-example

The user names an application, an account setup, or a build. You return one
worked example they can follow start to finish by copying values, without
having to decide anything themselves.

Examples:

- `/full-example Build a FastAPI todo API with tests` gives every file in full, the install and run commands, and the exact responses you should get back.
- `/full-example LinkedIn profile set-up` gives every sign-up and profile field, with an example value for each and the order to fill them in.
- `/full-example Build a Cloudflare MCP server and wrap it as a connector in Claude` gives complete code files, terminal commands, config, deploy, and the connector setup in Claude.

The more the user specifies (versions, platform, device, their own data), the
more precise the example. When they specify little, pick defaults, state them
in one line at the top, and continue. Ask only when guessing either way would
waste the work, such as a paid plan versus a free plan that changes every
step.

## What the user gets

Values and steps, in chat. Do not build a tutorial page, an interactive
walkthrough or a checklist widget unless the user asks for one. They will copy
from your reply, often on a phone, often while recording the screen. The
format is fixed in `references/output-format.md`. Read it before writing the
answer.

Sample files, if the example needs any, go out as files with SendUserFile,
named exactly as the steps refer to them.

## Process

Each stage has a check. Spend effort where nothing mechanical can catch a
mistake, and skip effort where something already can.

### 1. Pin the target

Name the exact thing, version and surface: "FastAPI 0.115.6 on Python 3.13,
run locally", not "a Python API". If the user gave no version, use the current
one and say which.

### 2. Inspect the real thing

Every label, field name, button, command and message in the answer must come
from a source you actually read in this session:

- **The app's source code**, when it's open source or the user's own repo. This beats docs. Read the UI markup and handlers, and list every control, its label, what it does, and what it resets.
- **Official documentation**, fetched now, for third-party products such as LinkedIn, Cloudflare and Claude connectors. Field names and menu paths change, and memory is not a source.
- **The user's past chats**, searched for how they actually use the thing, so the example reflects their real workflows and not a generic demo.

If you can't inspect something, say so in the status section and label every
claim that depends on it DERIVED. Never present a remembered menu path as
verified.

While inspecting, collect two lists:

- **Gotchas**: actions that erase earlier work, fields that save only on blur, limits on file size or type, controls that display misleading state. These decide the step order and the warnings.
- **Issues**: things in the app that look like bugs. You report them; you don't fix them.

### 3. Design the scenario

Pick one scenario that:

1. **Uses every section and feature** the user would want to see, each at least once. Map features to steps before writing anything, and drop nothing silently. If a feature can't be shown, say which and why.
2. **Has a checkable outcome.** Prefer a task with a known right answer, such as a fixed dataset and the correct result, a deploy that returns a known response, or a profile that passes the platform's completeness meter. That lets the user, and the app's own checker if it has one, tell success from failure.
3. **Is safe to share publicly.** Use synthetic data and fictional people and companies, with no real emails, keys, account numbers or private history. The user may record and post it.
4. **Reuses the user's real patterns** found in step 2, rebuilt on synthetic data.

### 4. Build the sample files

Keep them small and in formats the target accepts on the user's device. Check
the app's actual file handling: on Android, `.md` often arrives as binary, so
`.txt` is safer when an app tests the file's MIME type. Where the scenario has a
right answer, write the answer key by running code that applies the rules, not
by hand.

### 5. Verify mechanically

Run everything that can be run:

- The app's own parser or validator on any text the user will paste, with the output compared to the intended structure.
- Every expected message, label and ordering, derived from the source code or captured from a real run.
- Code in build examples, installed and run locally: tests, a type-check, a local dev server, one request against it.
- External facts the scenario depends on, such as a list of published names, confirmed at the source.

Fix what fails and run it again. Never weaken an expected result to make it
match.

### 6. Order the steps

- **Destructive and reset actions come first.** If an action wipes earlier work, it is step 1 or 2, with the warning attached.
- **Prerequisites before dependents.** Create a thing before referencing it, name a thing before a label shows its name, and download files before the step that attaches them.
- **One action per step.** Each step gets the values it needs and a "You should see:" line describing what appears when it worked.

### 7. Respect the human boundary

Stop at the exact action for anything the user owns: account creation,
passwords, payment, API keys and tokens, OAuth consent, DNS, legal acceptance,
production deploys. Write "Paste your Cloudflare API token into the
`Authorization` field" as an instruction. Never write a fake token as a value
or ask the user to paste a secret into chat. Example personal data, such as
names and headlines, is fine as long as it is labeled as an example to
replace.

### 8. Audit before sending

Reread the answer as the user will see it, and check:

- Every label matches the source exactly, including case and the trailing "↗" or "…".
- No leftover scaffolding: no "Check:", no "tick this", and no references to a tutorial, page or widget that doesn't exist.
- Values are complete. No "TODO", no "...", and no "YOUR_VALUE" where a real example value belongs. Secrets are the only placeholders, and they appear as instructions, not values.
- The status section keeps VERIFIED, DERIVED and BLOCKED separate. Compiling is not passing, passing is not deployed, and deployed is not verified live.

If the user later corrects the example, merge every correction into one
complete, current version. Never send a diff they have to apply in their head.

## Modes

The process is the same in every mode. What changes is what "inspect" and
"verify" mean.

| Request | Inspect | Values are | Verify by |
|---|---|---|---|
| Use an app ("a project dashboard") | Source code, UI markup, handlers | Text to paste, names, files, settings | Running the app's parser or logic; source-derived labels |
| Account or profile setup ("LinkedIn profile set-up") | Current official help pages for each form | Field-by-field example values with limits | Character limits and required fields from docs; human boundary at sign-up and verification |
| Build and deploy ("Cloudflare MCP server + Claude connector") | Current docs for each tool and the API | Complete files, commands, config, connector fields | Local install, tests and a dev-server request; deploy and live checks reported only if actually done |

`references/fastapi-todo-example.md` is a complete worked answer for the
build mode, with the record of how it was built and verified. Read it the first time you
use this skill, to calibrate the level of detail.
