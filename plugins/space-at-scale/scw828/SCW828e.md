# SCW828e: Model tracers and schematic arms

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** 6,000 disk dots are synthetic; the four-arm pattern is schematic.

**Data.** Needed: real arm tracers. Reid et al. 2019 maser parallaxes (about 200 sources) and Gaia open clusters. Not on GitHub as far as checked.

**Fix, worked backwards from what the app needs.** Add real tracers as a separate layer, fit nothing, keep the synthetic layer clearly named, and let the user switch the pattern off.

**Skill that owns it.** uncertainty-carrying · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: layer counts; the synthetic layer never appears in a count of real systems (already true).

**De-risk and cost.** Medium. Performance: +200 points. UX: one legend line.

**Status.** BLOCKED: source not reachable from here
