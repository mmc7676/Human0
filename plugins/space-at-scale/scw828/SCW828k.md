# SCW828k: Interface issues

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** Reverse flips signed speeds; solar clock runs in other views; Jump to now changes solar speed; label crowding; signals not clickable; Go to date limited to 500 years.

**Data.** No data needed.

**Fix, worked backwards from what the app needs.** Six small changes, each with a browser test. Kept apart because every one alters behavior the owner has already seen.

**Skill that owns it.** release-audit · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: one browser assertion per change.

**De-risk and cost.** Medium. UX improves; no accuracy change.

**Status.** READY, waits for go
