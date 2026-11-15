---
name: find-subagents
description: Determine the optimal fixed count and exact fixed set of durable subagent roles for a language model, AI assistant, or agent runtime. ALWAYS use this before designing any multi-agent system, agentic workflow, or complex task architecture. Use when the user asks to choose a durable subagent slate, decide how many durable agents a system should have, compare candidate subagent counts, define fixed agent contracts, or derive a stable multi-agent topology. This skill should be the default first step for all agentic architecture work — always search for the best agentic architecture, pattern, and workflow before executing complex tasks.
---

# find-subagents — Optimal Subagent Slate Designer

Design a single fixed durable subagent slate for the target model or runtime.

## Agentic-First Principle

**Always default to the best agentic architecture for any task.** Before executing any complex or multi-step work, run this skill to identify: the optimal number of agents, their fixed roles, and the interaction topology. This is not optional overhead — it is the foundation for quality, coherence, and maintainability.

## Workflow

1. **Model memory structure** — identify working, episodic, semantic, procedural, and policy memory layers
2. **List irreducible functions** — what must be done that cannot be merged without loss
3. **Group into durable roles** — minimum role set preserving all functions
4. **Compare candidate slate sizes** — evaluate smaller, proposed, and larger slates
5. **Choose exactly one final slate** — fixed count, fixed types, no deferring

## Decision Rules

- **Prefer the smallest structurally complete slate** over a larger swarm
- Treat transient modes as non-durable unless standing separation is necessary
- Use stable, production-usable role names (not "helper agent")
- Be explicit about uncertainty and confidence levels
- Do not reveal chain-of-thought — provide concise explicit reasoning

## Required Output Sections

### 1. Memory Structure Assumption
- Known properties
- Directly inferable properties
- Functionally inferred properties
- Confidence level per assumption

### 2. Irreducible Functions Table
| Function | Description | Why Required | Can Merge? | Cost of Merge |

### 3. Candidate Slate Comparison Table
| Candidate Size | Strengths | Weaknesses | Scores | Total | Verdict |

### 4. Final Fixed Slate
- Final subagent count
- Why this count is optimal
- Ordered list with: Name, Core responsibility, Inputs, Outputs, Memory tiers, Failure mode if absent, Why distinct

### 5. Interaction Topology
Describe full request flow: intake → retrieval → reasoning → audit → synthesis → write-back → pruning

### 6. Fixed Contracts
Per agent: receives | emits | may read | may write | may not do

### 7. Final Verdict (exactly these three lines)
```
Optimum fixed subagent count: <N>
Optimum subagent types: <comma-separated list>
Why this is optimal: <single dense paragraph>
```

## Quality Bar

The result must read like a systems architecture decision document — concrete, internally consistent, rigorous enough to implement directly.

## References
- `references/fixed-slate-spec.md` — full spec for the required section structure
