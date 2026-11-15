# SCW828g: Recalled values

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** GW event figures, pulsar masses, solar motion, pattern values and eval bands came from memory.

**Data.** Each has a citable paper. alphaXiv (registry, verified this session) gives full text of arXiv papers.

**Fix, worked backwards from what the app needs.** For every constant: fetch the paper, store value, uncertainty, citation and the sentence it came from; fail the build if a constant has no pin. The decay eval (0.05% agreement) stays as an independent cross-check.

**Skill that owns it.** source-pinning · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: pin file covers 100% of constants; evals read bands from the pin file.

**De-risk and cost.** High. No runtime cost.

**Status.** READY once alphaXiv is connected (human action) or papers are attached
