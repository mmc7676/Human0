# Space-at-Scale build plan

The SCW model of this server is in `model.json` (validated with SCW Modeler), `scw-model.md` (text) and `graph.html` (graph). Each SCW is a part of the MCP server that a specialist agent loop can own. Status as of November 16, 2026.

## Phase 0: fixes (done in v0.15.1)

| Item | Status |
|---|---|
| Dockerfile copies `galaxy-core.js`, `galaxy.json` and `dist/` | Done. Ran `http.js` from exactly the image's files: 74/74 evals, app resource loads |
| Model includes SCW7 (planet and body systems) and SCW8 (moons), plus a tool map | Done. 25 SCWs; validates |
| Name styled "Space-at-Scale" (plugin id unchanged) | Done |
| SCW Modeler 0.1.1: Levels control and double-click zoom; headless render test | Done. 27/27 unit and 4/4 render checks |

## Phase 1: hosted connector

Host: Cloudflare Workers, the platform the Maxey0 Context Plane already runs on. No Google Cloud account is assumed.

1. Human0 confirms the Workers plan. Free allows 10 ms of CPU per request; `run_evals` measured 70 ms cold and 17 ms warm, so heavy tools need Workers Paid (5 min per request, $5/month minimum).
2. Claude adds a Workers entry point (web-standard MCP transport from SDK 1.32.2) and `wrangler.jsonc`, and tests it locally against the evals.
3. Human0 deploys with Wrangler (Cloudflare sign-in is the owner's), then adds the connector in claude.ai: Customize > Connectors > + Add > Add custom connector; Authentication "No sign in".
4. Claude verifies the live URL: 25 tools listed; `run_evals` all passing.

The `Dockerfile` remains valid for any container host.

## Phase 2: SCW-MWField (dark matter field as instruction carrier)

Human0 approves the contract; Claude then adds `SCW4:field` (massless, `governs` SCW4, located at the galactocentric origin) and eval G4 with a negative test.

| Contract item | Proposal |
|---|---|
| Energy drift per integrator step | at most 1e-6 relative |
| Angular-momentum drift per step | at most 1e-6 relative |
| Bound fraction | at least 209 of 211 clusters and satellites |
| Allowed data in SCW4 | positions (kpc), velocities (km/s), masses (solar masses), each with a source and evidence label |
| Output contract | research records only; no narrative |

## Phase 3: Context Plane topic pack

Generate "Space-at-Scale astrophysics" with `/topic-graph-generator`: galactic dynamics, black holes, astrometry and stellar kinematics, gravitational waves, small bodies and space resources, cosmological parameters. Acceptance: routing "galaxy dynamics dark matter halo" scores above 0.35 on a galactic-dynamics skill (0.17 on a hydrogen-atom solver on November 16, 2026).

## Phase 4: data sources

A connector-registry search on November 16, 2026 found no astronomy data servers. All candidate sources are public and need no keys:

| SCW | Source |
|---|---|
| SCW-Bubble, SCW-Data | Gaia DR3 (ESA archive, TAP/ADQL) |
| SCW-Solar, SCW-Bodies, SCW-Missions | NASA JPL Horizons, JPL Small-Body Database |
| SCW-Signals | GWOSC event catalogs |
| SCW-Populations | ATNF Pulsar Catalogue; Vasiliev and Baumgardt 2021 |
| SCW-Universe | Planck 2018 parameters |

Each adapter records source, fetch date and content hash, and never overwrites a value without provenance. Note: the hosted server needs outbound internet for live fetches; the plugin's local server can fetch from the user's machine.

## Phase 5: specialist loops

Pilot on SCW-Missions with JPL Horizons: primary Maxey1485 Mechanics, checker Maxey1486 Conservation Law Checker. Loop: pull, update routes, `run_evals`, provenance check, pull request. Nothing merges unless evals and provenance pass.
