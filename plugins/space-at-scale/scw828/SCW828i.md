# SCW828i: Gravitational-wave coverage

Parent: SCW828 · relation: contains · scope: one fix, independent of the others · nothing here alters the server, plugin or UI

**Issue.** Two events only; GW150914 not drawn.

**Data.** GWOSC publishes the full catalogs with distances, masses and sky maps.

**Fix, worked backwards from what the app needs.** Import the catalog; draw a wavefront only for events whose sky area is small enough to give a direction; list the rest in the ledger.

**Skill that owns it.** source-pinning · agents: Source Retriever (fetch), Kinematics and Model Builder (build), Independent Verifier (check), Release Auditor (parity)

**Check.** EXEC: event count equals the catalog count for the chosen release; radiated energies recomputed from masses.

**De-risk and cost.** Medium. Performance: a few more planes. UX: a list in the report.

**Status.** BLOCKED: GWOSC not reachable from here

**Update 2026-11-15: catalog received.** Human0 attached the Gravitational Wave Open Science Center event table (`events.csv`, 109,667 bytes, SHA-256 starts 1ddd28f263b1817d; same table as `download.txt`, SHA-256 starts 9bd88d7eff11d4d5). EXEC by script: 391 events, one row each, September 2015 to January 2025; GWTC-1 (1), GWTC-2.1 (54), GWTC-3 (35), GWTC-4.1 (140), GWTC-5.0 (161); 282 with both masses and distance; 279 with a final mass, so radiated energy can be computed; 109 without masses (57 in GWTC-5.0, 52 in GWTC-4.1); no sky position or sky-area column. NOT DONE: value-by-value comparison of the two files.

**Status now.** READY for the catalog and ledger part (2 events to 391; 279 energies). Still BLOCKED for wavefronts: directions need each event's sky-map file.
