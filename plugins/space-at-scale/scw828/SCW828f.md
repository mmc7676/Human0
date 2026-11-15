# SCW828f: Secondary sources

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** S-star orbits and black holes were transcribed from Wikipedia tables.

**Data.** Primary sources: Gillessen et al. 2017 Table 3 and GRAVITY Collaboration papers for S-stars; BlackCAT and discovery papers for black holes.

**Fix, worked backwards from what the app needs.** Fetch each primary table, diff it row by row against the shipped rows, replace on mismatch, and record the table id and hash. The Kepler check already caught one bad row (S4713); keep it as a gate.

**Skill that owns it.** source-pinning · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: row-level diff report; zero unexplained differences.

**De-risk and cost.** High. No runtime cost.

**Status.** BLOCKED: needs the paper tables (attach or reachable source)
