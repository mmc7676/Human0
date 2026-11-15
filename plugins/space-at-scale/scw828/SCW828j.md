# SCW828j: Unverified runtime

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** Not run: inside Claude, a phone, a GPU frame rate, Docker, Cloud Run.

**Data.** No data needed; needs the real surfaces.

**Fix, worked backwards from what the app needs.** A fixed check script: open, read six named strings, run evals, report frame rate from the app itself (add a hidden fps readout).

**Skill that owns it.** release-audit · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC by the owner on each surface; results pasted back.

**De-risk and cost.** High. No cost.

**Status.** HUMAN ACTION
