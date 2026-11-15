# SCW828h: Licensing

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** GPL and CC BY-SA data inside one package.

**Data.** ATNF psrcat is the upstream of the pulsar table; primary papers are the upstream of the supernova list.

**Fix, worked backwards from what the app needs.** Rebuild the pulsar table from ATNF directly and the supernova list from primary papers; then the GPL item drops out. CC BY-SA star data stays and needs attribution. The decision is the owner's.

**Skill that owns it.** release-audit · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: license table generated from the provenance block, not written by hand.

**De-risk and cost.** High for the GPL item. No runtime cost.

**Status.** HUMAN ACTION: license decision; ATNF not reachable from here
