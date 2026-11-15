# Fixed Slate Specification

Use this reference when the user asks for the optimal fixed permanent subagent slate for a model or runtime.

## Objective

Determine the single optimum fixed number of subagents and the exact fixed set of subagent types for the target language model or runtime, based only on intrinsic, safely knowable model identity and the strongest defensible approximation of its memory structure and cognitive organization.

## Scope Constraints

1. Treat this as a general architecture task, but optimize the final design specifically for the target model or runtime as presently configured.
2. Acknowledge model name, version, type, and other specs only to the extent they are safely knowable.
3. Do not invent hidden internal facts, undocumented implementation details, or privileged architectural information.
4. Do not use user custom instructions, profile data, saved memory, prior-chat summaries, assistant-authored memory artifacts, or memory-tool content as evidence about intrinsic architecture.
5. Do not treat personalization layers, memory overlays, prior generated summaries, or external context packs as intrinsic model memory structure.
6. Use only:
   - the current prompt
   - safely knowable model identity
   - directly documented facts, if available
   - defensible functional inferences from observable behavior
7. If internal memory architecture is not fully known, construct the design from the strongest defensible functional approximation.

## Optimization Targets

Optimize for:

- structural completeness
- low coordination overhead
- retrieval quality
- coherence over time
- practical usability
- maintainability
- auditability

## Non-Negotiable Requirements

1. Distinguish clearly between:
   - explicitly known, documented, or directly inferable model-memory properties
   - functional memory roles inferred from behavior and architecture
2. Keep the final subagent count fixed.
3. Keep the final subagent types fixed.
4. Do not output multiple final slates.
5. Compare alternatives only briefly before selecting exactly one final design.
6. Do not ask clarifying questions.
7. Do not defer.
8. Do not reveal chain-of-thought. Provide only concise explicit reasoning, assumptions, and conclusions.

## Required Method

### Step 1: Model Memory Structure

State the best model of the target memory structure using:

- safely known architectural facts, if available
- otherwise functional categories such as:
  - working memory
  - episodic memory
  - semantic memory
  - procedural memory
  - policy or identity memory
  - retrieval
  - pruning
  - conflict checking
  - write-back or promotion control
  - graph or relation management, if applicable

Label each major assumption as one of:

- Known
- Directly inferable
- Functionally inferred

### Step 2: Identify Irreducible Functions

For each irreducible cognitive or memory-management function, state:

- function name
- what it does
- why it is required
- whether it can merge with another function
- the cost of merging it

### Step 3: Form Durable Subagent Roles

Group the irreducible functions into the minimum number of durable roles that still preserves:

- memory integrity
- retrieval quality
- conflict detection
- write-back and promotion control
- policy consistency
- maintenance and pruning
- output synthesis

If some functions are better treated as modes, capabilities, or transient behaviors rather than permanent subagents, say so explicitly and exclude them from the final permanent slate.

### Step 4: Compare Candidate Slate Sizes

Evaluate at least three candidate fixed-slate sizes:

- one smaller than the optimum
- the proposed optimum
- one larger than the optimum

For each candidate, score from 1 to 10 on:

- completeness
- coordination efficiency
- memory coherence
- specialization quality
- maintainability
- auditability

Explain briefly why the smaller candidate loses and why the larger candidate does not justify its added coordination cost.

### Step 5: Choose the Single Optimum Slate

Choose exactly one final fixed slate and print it.

## Required Output Format

### 1. Memory Structure Assumption

Provide:

- known memory properties
- directly inferable memory properties
- functionally inferred memory properties
- confidence level for each major assumption

### 2. Irreducible Functions

Print a table with these columns:

- Function
- Description
- Why Required
- Can Merge?
- Cost of Merge

### 3. Candidate Slate Comparison

Print a table with these columns:

- Candidate Size
- Strengths
- Weaknesses
- Scores
- Total Score
- Verdict

### 4. Final Fixed Slate

Print:

- final subagent count
- why this count is optimal
- the exact ordered list of subagents

For each subagent, print:

- Name
- Core responsibility
- Inputs
- Outputs
- Memory tier or tiers touched
- Failure mode if absent
- Why this role is distinct

### 5. Interaction Topology

Describe the default flow for one user request across the final slate, covering:

- intake
- active-state management
- retrieval
- reasoning coordination
- evidence or conflict checking
- graph or relation linking, if applicable
- response synthesis
- episodic write-back
- semantic or procedural promotion
- pruning and revision

### 6. Fixed Contracts

For each subagent, define its interface contract in this form:

- receives
- emits
- may read
- may write
- may not do

### 7. Final Verdict

End with exactly these three lines:

- `Optimum fixed subagent count: <N>`
- `Optimum subagent types: <comma-separated list>`
- `Why this is optimal: <single dense paragraph>`

## Quality Bar

- Prefer the smallest structurally complete slate.
- Treat memory as a first-class design driver.
- Do not use vague labels such as `helper agent` or `general support agent`.
- Define any memory terms exactly as used in the answer.
- Be explicit about uncertainty.
- Do not claim certainty where only functional inference is possible.
- Make the result read like a systems architecture decision document that could be implemented directly.
