# SCW828b: Black-hole velocities

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** 20 stellar black holes start on circular orbits.

**Data.** Needed: proper motion, parallax and systemic radial velocity of each companion star. Sources: Gaia DR3 (via VizieR/ESA archive) and the Atri et al. 2019 kick study. Neither is on GitHub; the sandbox cannot reach them.

**Fix, worked backwards from what the app needs.** Build a 6D row per system where a companion exists (Gaia BH1/2/3, Cygnus X-1, V404 Cyg, A0620-00, GRO J1655-40 and others); microlensing candidates have lens proper motion only and stay partial.

**Skill that owns it.** kinematics-reconstruction · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: each row passes units and frame checks; Cygnus X-1 space velocity compared with its published value.

**De-risk and cost.** High for about 10 systems, partial for 6 candidates. No performance or UX cost.

**Status.** BLOCKED: needs a catalog file attached or a reachable source
