# Space at Scale v0.10.0: integration record

Evidence labels: FACT (read from a source this session), EXEC (actually run), DERIVED (computed from FACT/EXEC), HYPOTHESIS, NOT RUN.

## 1. Modules and ownership

| Module | File | Owns | Used by |
|---|---|---|---|
| Solar and bubble physics | `server/physics-core.js` | orbits, chemistry, trips, generated universes | app, server |
| Galaxy core | `server/galaxy-core.js` | constants, frame, mass model, field shares, orbit integrator, S-star orbits, gravitational-wave formulas, calendar, galaxy evals, energy and matter ledger | app, server, data builder |
| Galaxy data | `server/galaxy.json` | 3,851 systems plus a provenance block | app, server |
| Star data | `server/stars.json` | 3,665 stars | app, server |
| Solar and bubble view | `server/app/app.js`, `index.html` | rendering, controls, tooltips | app |
| Galaxy view | `server/app/galaxy-view.js` | third scale: rendering, time, limits, signals, report | app |
| SCW graph and tools | `server/universe.js`, `server.js`, `http.js` | SCW nodes, laws, typed relations, 23 tools | Claude |
| Data builder | `server/tools/build-galaxy.js` | raw catalogs to `galaxy.json`, deterministic | release |
| Inline app builder | `server/build-app.js` | one self-contained HTML file | release |
| Release orchestration | `release.js` | sync, build, bundle, provenance, test, package, verify | release |

Rules kept: the two cores are plain data and functions with no UI; the views never contain physics constants; the app and the server load the same core bytes; user instructions live in the skill file, not in code.

## 2. Data flow

```
raw catalogs (galpy, Stellarium, gala, Wikipedia tables)
   -> tools/build-galaxy.js (uses galaxy-core.js for every coordinate transform)
   -> galaxy.json (positions, velocities, provenance, counts)
        -> app: galaxy-view.js integrates orbits with galaxy-core.js, draws signals
        -> server: universe.js builds SCW4 nodes and answers galaxy tools
galaxy-core.js --same bytes--> inline app HTML and server bundle
```

Authority boundaries: data never changes the model; the model never edits data; tools are read-only at galaxy scale; horizon interiors stay gated.

## 3. How the Milky Way is represented (the answer to "what holds it together")

The solar system fits a containment tree because one body dominates each level. The galaxy does not: Sgr A* is 0.0004% of the mass and leads the pull only inside 3.66 pc. Four typed relations replace the single "orbits its parent" edge:

| Relation | Meaning | Computed boundary | In the graph |
|---|---|---|---|
| contains | bound inside a tidal (Jacobi) radius in the parent field | r_J = (G m / (Omega^2 - d2Phi/dR2))^(1/3) | Solar System (1.37 pc), clusters, satellites, pulsars, black holes, S-stars around Sgr A* |
| superposes | components share space; fields add | hand-off radii where the leading share changes | black hole, nuclear cluster, bulge, disk, dark halo |
| passes-through | a pattern with its own speed; no members | pattern phase at time t | spiral pattern |
| signals | events arrive on light cones at c | shell radius c (t - t_event) | supernova light, gravitational waves |

Computed regimes (DERIVED from the published mass model): black hole to 3.69 pc; nuclear cluster to 0.95 kpc; disk to 10.29 kpc; dark halo beyond. At the Sun the disk supplies 53% of the pull and dark matter 41%. Dark matter supplies over half only beyond 11.14 kpc.

Status of the idea: the physics is textbook galactic dynamics (enclosed-mass orbits, tidal radii, density waves, light cones). What is new here is the encoding: one graph where each relation is typed and its boundary is computed. Whether that encoding yields new science is a HYPOTHESIS; nothing in this build tests it.

## 4. Requirement coverage

| # | Requirement (source statement) | Component | Test and evidence | Status |
|---|---|---|---|---|
| 1 | "Remove the zip code add fields/buttons" | `index.html`, `app.js` | EXEC Chrome: no ZIP input, button or label; `test.js`: inline app loads no remote script | PASS |
| 2 | "-002491 can just be 2491 BCE ... keep the same 12 month 365 day year ... start with December 31" | `galaxy-core.js` calendar, `app.js` date readout | EXEC eval "Calendar: BCE dates keep the 12-month year"; Chrome readouts `2491 BCE 07-22 21:22 UTC` and `1 BCE 12-31 18:00 UTC` | PASS |
| 3 | "add Reverse time speeds 1,000,000 yr/s and 10,000,000 y/s ... both solar system and Bubble" | `index.html` speed lists | EXEC Chrome: solar list ends 1,000 yr/s, 1 Myr/s, 10 Myr/s, 100 Myr/s; Bubble list has 10 Myr/s and -10 Myr/s. Full solar rewind = 4,567 Myr / 10 = 457 s is DERIVED; frame-rate on a GPU NOT RUN | PASS, timing derived |
| 4a | "Add a 3rd scale larger than the Bubble" | `galaxy-view.js`, SCW4 | EXEC Chrome: Galaxy button and zoom-out hand-off at 15,000 ly; units `thousand light years (kly)` | PASS |
| 4b | signals of black holes | 44 S-star orbits, Sgr A*, 20 stellar black holes | EXEC evals: S2 period 16.07 vs 16.05 yr; pericenter 7,754 vs 7,650 km/s; all 44 orbits give one mass within 15% | PASS |
| 4c | signals of dark matter | rotation curve, Dark matter on/off, bound checks | EXEC evals: 209 of 211 clusters and satellites bound with the halo, 124 without; Chrome: after 1 Gyr without dark matter 12 of 211 are beyond 1,000 kly (3 with), outer disk radius x8.4, inner x1.17 | PASS |
| 4d | signals of supernovae | 9 light shells, 2,716 pulsar birth times | EXEC Chrome: SN 1054 shell is 6.5 kly at 1054 CE (its distance); 2,783 pulsars present 2.5 Myr ago vs 3,563 today | PASS |
| 4e | signals of gravitational waves | GW170817 wavefront, two merging pulsar binaries, GW150914 in the ledger | EXEC evals: orbital decay within 0.5% of published GR values; Chrome: wavefront 9.2 ly past the Sun today, Double Pulsar merges at +86.01 Myr | PASS |
| 4f | "Reverse Time and Forward time" with limits | galaxy time, floor and cap | EXEC Chrome: stops at 13.787 Gyr ago and at 5 Gyr ahead with a note; eval "Reverse time retraces forward time" | PASS |
| 4g | "as many scw systems as the Local Bubble Cloud and solar system" | `galaxy.json` counts | EXEC structural eval: 3,851 galaxy systems vs 3,665 + 111 in the graph (132 in the app) | PASS |
| 5 | "How would we represent the Milky Way as a system" | typed relations, field components, `galaxy_field`, `scw_relations` | EXEC `test.js` galaxy block (23 checks) | PASS as built; novelty is a HYPOTHESIS |
| 6 | integrate every full example into one system | one app, one server, one plugin | EXEC `release.js` steps 1 to 7 | PASS |
| 7 | modular integration | section 1, `release.js` | EXEC byte-identical mirrors, independent module tests | PASS |
| 8 | coverage, testing, parity "down to the byte" | `PROVENANCE.json`, embed checks, package verify | EXEC SHA-256 and byte length for every shipped file; cores and data found byte-for-byte inside the inline app | PASS |
| 9 | "translate everything to energy + matter" | `ledger()` in `galaxy-core.js`, report panel, `energy_ledger` tool | EXEC `test.js`: GW150914 5.54e47 J, Milky Way rest energy 1.82e59 J | PASS; estimates flagged in each row |
| 10 | full example of the latest version | chat reply | steps taken from the Chrome run above | delivered in chat |

## 5. Test layers (what ran, where)

- Static: syntax check of each script; `claude plugin validate`; zip path characters. EXEC.
- Unit and physics: 26 galaxy evals, 12 structural, 30 solar, bubble, chemistry and campaign evals (68 of 68). EXEC in Node and in the app.
- Integration: `test.js` over stdio (68 checks), `test-http.js` over HTTP (9 checks). EXEC.
- Interaction: headless Chrome with software rendering on the app sources and on the built single-file app; no console errors. EXEC, run outside `release.js`.
- Regression: solar tooltip, trip planner, Bubble limits, mobile docking. EXEC in the same Chrome run.
- Provenance and parity: `PROVENANCE.json`, verified again from the unzipped package. EXEC.

NOT RUN: rendering inside a Claude conversation for this version; a physical phone; frame rate on a GPU; Docker image; Cloud Run.

## 6. Limitations

- The mass model is today's Milky Way at every epoch. Orbits earlier than a few billion years ago are illustrative.
- Pulsar and black-hole velocities are not on file. They start on circular orbits; real pulsars carry large birth kicks.
- Pulsar distances (20 to 40%) and supernova-remnant distances (20 to 50%) are uncertain. SN 393 is left out because its listed distance conflicts with published values. S4713 is left out because its row fails Kepler's third law.
- Disk dots are 6,000 model tracers. The four-arm pattern is schematic; the Milky Way's arm count and pattern speed are debated.
- Only two gravitational-wave events are included; GW150914 has no usable sky position.
- BCE years follow the requested scale with a year 0 (0 CE). Historians' BCE dates are one larger (their 1 BCE is this 0 CE).
- Values recalled from the cited papers and not re-fetched this session: GWTC-1 event values, binary pulsar masses, solar motion, pattern speed and pitch, and the measured ranges used as eval bands. The binary pulsar masses are cross-checked by the decay eval.
- Licenses are mixed (see `DATA-LICENSES.md`).

## v0.11.0 additions (SCW828 fixes that needed no new data)

| Fix | Change | Evidence |
|---|---|---|
| SCW828a | 426 pulsars use their measured proper motion; the unmeasurable line-of-sight part follows local rotation | EXEC: `test.js` count check; Chrome: Vela tooltip shows measured motion |
| SCW828d (part) | each pulsar records and shows its distance method | EXEC: `galaxy_object` Vela returns `distance_method` |
| SCW828i | 391 gravitational-wave events from the supplied GWOSC catalog; 276 radiated energies in the ledger | EXEC: 2 new galaxy evals, `galaxy_object` GW231123, ledger check |
| SCW828k | negative Bubble and Galaxy speeds always run backward; solar clock pauses in the Bubble and Galaxy views; Jump to now keeps the speed; fewer labels at the Disk zoom; Go to date accepts any date with a note | EXEC: headless Chrome assertions |
| SCW828l | Year count menu: Year 0 scale (default) or Historians (no year 0) | EXEC: calendar eval; Chrome readout 2492 BCE |

Not done: clickable gravitational-wave sheet and halo rings; per-object distance error bars; everything that needs new data (SCW828b, c, e, f, g, h, wavefronts in i).

## v0.12.0: routes for every human-made object

Decomposition (72 objects): 5 escape craft (flyby waypoints, then their state vector outward), 11 heliocentric cruise craft (launch, flybys, modeled orbit, future flybys and arrival), 35 orbiters (Earth orbiters from launch; Moon, Mars, Jupiter and Mercury orbiters cruise from Earth to an arrival date), 9 Lagrange-point craft, 3 surface rovers (launch to landing), 9 planned missions (hidden until the planned launch, then a Hohmann-length cruise to the destination).

Rules enforced (EXEC: `routeEvals` in the shared physics core, run by the app and the server): hidden before launch; at Earth on the launch date; at each flyby body on its date; escape craft move outward forward and inward in reverse. Between dated waypoints the path is an interpolated arc, not an integrated trajectory. Dates are recalled from mission records, not fetched this session.

Local Bubble: the five escape craft appear at Bubble scale on their outbound paths (EXEC: about 37 to 56 ly after 1 million years; hidden before launch). Galaxy scale: not yet.

## v0.13.0: full screen and removable state

Full screen: the Full screen button (or Exit full screen / Esc) fills the screen with the view. Uses the browser Fullscreen API when allowed, otherwise a fixed full-window layout. A floating, collapsible panel controls the active scale (solar system, Local Bubble, Galaxy, generated universes): Play/Pause, Forward/Reverse, Speed (that scale's own menu), Reset, and the current date or epoch. EXEC: headless Chrome.

Add/remove audit (every addable state has a removal):
| Added | Removed by |
|---|---|
| Simulated comets | Clear comets (app); remove_state comet / all (server) |
| Generated parallel and exotic universes | Universe menu back to ours, Reset everything (app); remove_state universe / exotic_universe / all (server) |
| Task results, extraction campaign | Clear task, Close |
| Eval panel | Run physics evals toggles to Hide physics evals |
| Bubble time and view | Reset bubble |
| Galaxy time, dark matter off, markers off | Reset galaxy, the two toggles |
| Go to date, Reverse, speed | Clear, Jump to now |
| Labels, spacecraft, paths, belt, sizes, year count | their toggles |
| Full screen | Exit full screen, Esc |
| Everything at once | Reset everything (app); remove_state all (server) |
EXEC: 8 new server checks (remove comet, universe, all; graph back to 152 SCWs; evals still pass) and headless Chrome checks of each app control.

## v0.14.0: dark matter as a hidden universe (hypothesis test)

Hypothesis (Human0): our universe is encoded on a horizon (holographic picture); other universes overlap on it, sharing gravity but not light; dark matter is the pull of their matter. Added as a fifth relation type, `shares-gravity`, between whole universes, and tested two ways against the same bands the standard halo passes:

| Version | What H's matter is | Result (EXEC) |
|---|---|---|
| Simple H | collisionless, settles into a halo | 7 of 7 checks pass; its pull is identical to the standard halo, so it tests the label, not new physics |
| Mirror H | its own light and chemistry, so it cools into a disk (5.36 times our ordinary mass, Planck 2018 ratio) | 0 of 7: 446 km/s at the Sun, 19 GeV/cm3 local density, disk axis ratio 0.09, LMC unbound, self-interaction 5e7 cm2/g against the Bullet Cluster limit 1.25 |

App: Dark matter source menu (halo, simple H, mirror H); tooltips, markers, report and evals follow it. Server: `link_hidden_universe`, removable with `remove_state`. Recalled, not fetched: the Planck densities, the Bullet Cluster limit, the measured bands.

## v0.15.0: control board

- Removed the Year count selector. The app always uses the year-0 scale (0 CE is year zero); the historians' count stays in `galaxy-core.js` and its eval.
- Control board: nebula banner background; **Collapse controls** keeps the title row plus the first three rows; a drag handle under the board resizes it like a split screen (also arrow keys, and double-click to toggle). The 3D view grows by the height the board gives up.
- **Info on/off** hides the explanatory text (star and galaxy counts, the how-to footer and the data credits). The setting and the board height persist per viewer where browser storage is available.
- **Reset everything** also restores the full board and turns Info back on.

## v0.15.1: hosting fixes and naming

- `Dockerfile` now copies `galaxy-core.js`, `galaxy.json` and `dist/`. Without them a hosted server could not start (the galaxy core and the app view are required at load). Verified by running `http.js` from exactly the files the image copies, with production dependencies only: 74/74 evals pass and the app resource loads.
- Name styled as "Space-at-Scale" in the display name, README, skill and app title. The plugin id stays `space-at-scale`.
- `docs/scw-model/` holds the SCW model of this server and the build plan.

## v0.15.2: one toggle convention

Every toggle reads "Name: State", where State is what is happening now (Time: Running, Direction: Forward, Galaxy view: Off), and is lit when the feature is on. One-time actions (Jump to now, Go to date, Fit view, Reset everything) stay as verbs. Labels are derived from the live state variables every frame, so no code path can leave a label out of step. Verified in headless Chrome on the built app: all 14 toggles plus the 3 floating full-screen controls flip label and lit state consistently; Reset everything restores the defaults; no console errors.
