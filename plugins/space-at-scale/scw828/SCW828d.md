# SCW828d: Distance uncertainty

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** Pulsar distances 20–40% and remnant distances 20–50% uncertain; SN 393 left out.

**Data.** FACT: 392 pulsars have parallaxes and 440 have independent distances on file. Error bars are not on file. SN 393 needs a primary paper.

**Fix, worked backwards from what the app needs.** Rank distance by method (parallax > association > dispersion measure), store the method per object, show it in the tooltip, draw a line-of-sight error bar for the selected object, and admit SN 393 only with a cited primary distance.

**Skill that owns it.** uncertainty-carrying · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: every object has a method tag; no tooltip shows a distance without one.

**De-risk and cost.** Medium: does not shrink errors, makes them visible. No performance cost.

**Status.** READY: mostly data on file
