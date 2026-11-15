# Output format

The reply is the deliverable. Write it in this order.

## 1. One opening line

State what the example does and which defaults you chose, in one or two
sentences. Name the version or commit if there is one. If the example needs
files, say to save them first.

## 2. Numbered steps

Number the steps, because their order matters. Each step has:

- **A bold heading** naming the action and the control or section, using the app's own label: **Agents → Add**, **Run ↗**.
- **Values** in fenced code blocks, one block per value, so each copies with one long-press. Short values that need no copying, such as a role chosen from a menu, can sit inline in backticks.
- **A "You should see:" line** with what appears when the step worked: a message, a count, a label, a status code. Quote message text exactly.
- **A warning**, only when the step resets or erases something, or when a control shows misleading state. Say what is lost and what survives.

A good step:

````
**2. Paste the workflow, then tap Visualize**
```
<the full text to paste>
```
You should see: "Drew 4 worlds and 5 steps." under the button.

Do this before every other step. Tapping Visualize again later erases world
names, files, agent placements and loops; added agents are kept.
````

Never use "Check:" or checkbox wording. The user reads it as a box to tick.

## 3. What the result should be

The checkable outcome: the expected counts, response or final state, and how
to tell success from failure.

## 4. Issues found

Problems in the target that turned up while building the example, one line
each, phrased as things to fix. Leave this section out if there are none.

## 5. Status

One line each, labelled:

- **VERIFIED** — run, or read in the source this session. Say which.
- **DERIVED** — reasoned from something verified, not tested directly. Say from what.
- **BLOCKED** — could not be done, why, and the exact action that unblocks it.
- **HUMAN ACTION** — steps that only the user can do: sign-in, payment, keys, consent.

## Length

As long as the steps require and no longer. Don't explain controls the step
already names. Don't recap at the end.
