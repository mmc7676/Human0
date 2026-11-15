# SCW828c: Static mass model

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** Today's mass is used at every epoch; the LMC and Andromeda are ignored.

**Data.** Needed: a published mass-growth history and an LMC mass. gala v2 potential and an LMC Hernquist model are on GitHub (reachable).

**Fix, worked backwards from what the app needs.** Scale component masses with a published accretion history M(t)/M(0); add the LMC as a moving mass on its own orbit; keep v1 as the default and offer "evolving model" as a labelled option; tighten the "illustrative" boundary to a computed epoch instead of a phrase.

**Skill that owns it.** model-validity-bounding · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: reduces to v1 at t=0 (byte-equal outputs); energy drift reported instead of asserted; Sagittarius dwarf pericenter times compared with published values.

**De-risk and cost.** Medium: removes the largest physical error but adds model choices. Performance: one extra body. UX: one toggle.

**Status.** READY to design; values need fetching
