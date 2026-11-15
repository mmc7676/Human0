# SCW828a: Pulsar velocities

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** 3,563 pulsars start on circular orbits; real pulsars carry birth kicks.

**Data.** FACT: the Stellarium/ATNF file already holds proper motions for 642 pulsars and parallaxes for 392. EXEC count: of the 3,563 plotted, 617 have both proper-motion components and 360 of those a parallax. They were not used. Radial velocity is not measurable for pulsars.

**Fix, worked backwards from what the app needs.** Work backwards from the orbit: need (x,v). Use proper motion x distance for the two transverse components. For the unmeasured line-of-sight part, set the peculiar radial velocity to 0 by default and expose a labelled "kick sample" option drawn from a published kick distribution. Pulsars without proper motion stay circular and say so.

**Skill that owns it.** kinematics-reconstruction · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: transverse speed distribution median falls in the published range; energy conserved; tooltip states which components are measured.

**De-risk and cost.** High for 642 objects; none for 2,921 (no data exists). Performance: none (same integrator). UX: one extra tooltip row.

**Status.** READY: data on file
