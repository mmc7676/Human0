```
SCW-Server       Space-at-Scale MCP Server                bounded object; hosts the multiverse
 ├─ governs ─────── SCW-Laws         Law registry                             (instructions, not mass)
 ├─ feeds ───────── SCW-Data         Catalog data                             (the energy)
 ├─ governs ─────── SCW-Evals        Evals and parity                         (the checker)
 ├─ contains ────── SCW-Interface    Tool and view surface                    (how agents and people enter)
 └─ contains ────── SCW-Multiverse   SCW0 multiverse harness                  (quantum laws only)
    ├─ contains ────── SCW-Universe     SCW1 our universe                        (constants live here)
    │  ├─ shares-gravity ─ SCW-Hidden       Hidden universe H                        (hypothesis)
    │  └─ contains ────── SCW-Laniakea     SCW2 Laniakea                            (reference node)
    │     └─ contains ────── SCW-LocalGroup   SCW3 Local Group                         (reference node)
    │        └─ contains ────── SCW-MW           SCW4 Milky Way                           (no central body)
    │           ├─ governs ─────── SCW-MWField      Dark matter field (instruction carrier)  (PROPOSED; massless, located at the galactic center)
    │           ├─ superposes ──── SCW-SgrA         Sagittarius A*                           (horizon)
    │           ├─ superposes ──── SCW-Halo         Dark matter halo (mass term)             (inferred)
    │           ├─ superposes ──── SCW-Baryons      Nucleus, bulge and disk                  (ordinary matter)
    │           ├─ contains ────── SCW-Populations  Galactic populations                     (bound members)
    │           ├─ passes-through ─ SCW-Spiral       Spiral pattern                           (density wave)
    │           ├─ signals ─────── SCW-Signals      Signals layer                            (light cones)
    │           └─ contains ────── SCW-Bubble       SCW5 Local Bubble                        (light years)
    │              └─ contains ────── SCW-Solar        SCW6 Solar System                        (AU)
    │                 ├─ contains ────── SCW-Bodies       SCW7 planet and body systems             (one SCW per planet, asteroid, KBO or comet)
    │                 │  └─ contains ────── SCW-Moons        SCW8 moons                               (bound inside each planet's Hill sphere)
    │                 ├─ contains ────── SCW-Missions     Human-made objects                       (routes)
    │                 └─ passes-through ─ SCW-Mining       Mining and extraction                    (process)
    └─ contains ────── SCW-Generated    Generated universes                      (what-ifs)
```

The server is the bounded object. Data feeds it the way energy fills a universe; the law registry and the field SCWs tell each region how to turn that data into structure. Everything marked PROPOSED is Human0's design for the next build: a massless instruction field located at each galaxy, with dark matter used as its carrier. The rest exists in v0.15.0.

### What each SCW holds

| SCW | Role | Holds | Its laws |
|---|---|---|---|
| Space-at-Scale MCP Server | the container every SCW runs inside; nothing in it can be told apart without the server | server.js (25 tools), universe.js (SCW graph), physics-core.js and galaxy-core.js (shared byte-for-byte with the app), stdio and HTTP transports, public mode | Public mode: return generated state, persist nothing; App and server load the same physics bytes |
| Law registry | governs: sets which laws apply in each SCW and whether each is inherited or locally checked | 20 laws: Q1-Q3 quantum, S0-S1 structural, P1-P5 physical, C1-C2 chemistry, E1-E4 and G1-G3 emergent; inherit or local rules | inherit laws pass down every parent chain; local laws are re-checked in each SCW |
| Catalog data | feeds: raw matter for every scale; built deterministically from published catalogs | galaxy.json (4,240 systems, 391 GW events), stars.json (3,665 stars), solar elements and routes in physics-core.js; build-galaxy.js | every value carries its source; inconsistent rows are dropped, not repaired |
| Evals and parity | governs: refuses any state that breaks a law or the byte parity between app and server | run_evals (77/77 in our universe, 96/96 with three), validate_app_dropin, release.js provenance check | no release unless every eval passes |
| Tool and view surface | contains: the 25 tools and the MCP App view; the only doors into the graph | open_space_at_scale (view); scw_get, scw_children, scw_search, scw_relations (graph); sim_state, sim_clock, events, remove_state (state) | tools read the graph; only state tools change it, and every change is removable |
| SCW0 multiverse harness | contains: holds universes; shares quantum laws, never physical constants | generate_universe, generate_exotic_universe, hidden universes | Q1-Q3 unitarity, superposition, uncertainty; physical constants (switched off) |
| SCW1 our universe | contains: the universe Space-at-Scale simulates | G, c, solar mass, chemistry; age 13.787 Gyr; Hubble tension recorded as unresolved | P1-P5 constants, conservation, GR, thermodynamics, light-speed signals; E1 Newtonian approximation where v/c is small |
| Hidden universe H | shares-gravity: dark matter as another universe's gravity; light does not cross | simple H (7/7 checks) and mirror H (0/7) | none of its own |
| Generated universes | contains: universes with other constants or chemistries | seeded universes and exotic universes; psi mining | horizon interiors gated here too |
| SCW2 Laniakea | contains: supercluster path from the universe to our galaxy | diameter 520 Mly, Great Attractor | none of its own |
| SCW3 Local Group | contains: galaxy group holding the Milky Way | M31 at 2.5 Mly, approaching at about 110 km/s | none of its own |
| SCW4 Milky Way | contains: the galaxy frame; orbits follow the summed field | galactocentric frame (kpc); gala MilkyWayPotential v1 + Sgr A* | G1 no central body; G2 bound children end at their Jacobi radius; G3 arms are patterns; E2 Kepler (switched off) |
| Dark matter field (instruction carrier) | governs: holds the local instructions for how gravity turns data into the Milky Way and Sgr A*, so an agent writing into SCW4 knows the data types, recursion limits and output contract | location: galactocentric origin; mass: none; instruction set for SCW4 and Sgr A*: data types, units, integrator and step limits, balance checks (energy, angular momentum, bound fraction) that stop a bang, pop or poof | carries no mass; acts only by setting laws; reject any write that unbalances energy or angular momentum beyond tolerance |
| Sagittarius A* | superposes: one field term; leads only within 3.69 pc | 4.297 million solar masses; 44 S-star orbits | Kepler inside 3.69 pc; Newton inside the horizon (switched off); interior gated |
| Dark matter halo (mass term) | superposes: NFW mass term; 41.4% of the pull at the Sun | NFW profile; over half the pull beyond 11.14 kpc | none of its own |
| Nucleus, bulge and disk | superposes: the baryonic field terms | nuclear star cluster, bulge, stellar disk (53% of the pull at the Sun) | none of its own |
| Galactic populations | contains: objects integrated in the summed field | 161 globular clusters, 50 satellite galaxies, 3,563 pulsars, 21 stellar black holes | none of its own |
| Spiral pattern | passes-through: arms with their own pattern speed; own no members | four-arm schematic pattern | none of its own |
| Signals layer | signals: supernova light and gravitational waves arriving at c | 9 supernova shells, 391 GW events, GW170817 front | none of its own |
| SCW5 Local Bubble | contains: the Sun's neighborhood | 3,665 naked-eye stars on measured velocities; Zucker et al. 2022 bubble model | E4 straight-line motion within 30 Myr |
| SCW6 Solar System | contains: bodies on orbital elements; formation dates | 132 bodies and spacecraft; rewind to 4.567 Gyr | E2 Kepler |
| SCW7 planet and body systems | contains: each body's own frame; planets hold their moons | planets (Pluto as dwarf planet), main-belt and near-Earth asteroids, trans-Neptunian objects, Halley's Comet; asteroid analog compositions for mining | E2 Kepler around the Sun (inherited) |
| SCW8 moons | contains: major moons on orbits around their planet | moons with period and semi-major axis; Io inherits its laws through nine levels | E2 Kepler around the parent planet |
| Human-made objects | contains: 72 objects on dated anchor routes; hidden before launch | escape, cruise, orbiter, Lagrange, rover and planned classes; plan_trip, plan_mission | none of its own |
| Mining and extraction | passes-through: finds targets and runs campaigns across the solar system | find_mining_targets (and parallel), run_extraction_campaign, inject_interstellar_comet; prices are model estimates | none of its own |

### How they interact

The model uses 7 relation types:

- **governs** (Space-at-Scale MCP Server to Law registry, Space-at-Scale MCP Server to Evals and parity, SCW4 Milky Way to Dark matter field (instruction carrier)): Sets or switches laws (rules, policy, configuration) for the parent without being contained by it.
- **feeds** (Space-at-Scale MCP Server to Catalog data): One-way flow of matter, energy, data or work from this SCW to the parent.
- **contains** (Space-at-Scale MCP Server to Tool and view surface, Space-at-Scale MCP Server to SCW0 multiverse harness, SCW0 multiverse harness to SCW1 our universe, SCW0 multiverse harness to Generated universes, SCW1 our universe to SCW2 Laniakea, SCW2 Laniakea to SCW3 Local Group, SCW3 Local Group to SCW4 Milky Way, SCW4 Milky Way to Galactic populations, SCW4 Milky Way to SCW5 Local Bubble, SCW5 Local Bubble to SCW6 Solar System, SCW6 Solar System to SCW7 planet and body systems, SCW7 planet and body systems to SCW8 moons, SCW6 Solar System to Human-made objects): Bound inside the parent; ends at a boundary computed from the parent (a tidal radius, a scope, a permission edge).
- **shares-gravity** (SCW1 our universe to Hidden universe H): Influence adds across the link but nothing observable crosses it (hidden or isolated sibling).
- **superposes** (SCW4 Milky Way to Sagittarius A*, SCW4 Milky Way to Dark matter halo (mass term), SCW4 Milky Way to Nucleus, bulge and disk): Shares the parent's space as one additive term; no single component is the center.
- **passes-through** (SCW4 Milky Way to Spiral pattern, SCW6 Solar System to Mining and extraction): A pattern or process with its own speed that members move through; it owns no members.
- **signals** (SCW4 Milky Way to Signals layer): An event that reaches other SCWs only when its signal arrives (light cone, message, notification).

### Tool map: which tools read or change each SCW

| SCW | Reads | Changes |
|---|---|---|
| SCW-Interface | open_space_at_scale | none |
| SCW-Laws | scw_laws, scw_inheritance_rules | none (laws are code) |
| SCW-Evals | run_evals, validate_app_dropin | none |
| SCW-Multiverse, SCW-Generated | scw_get, scw_children, scw_search | generate_universe, generate_exotic_universe, remove_state |
| SCW-Universe, SCW-Hidden | scw_relations, energy_ledger | link_hidden_universe, remove_state |
| SCW-MW and its field terms | galaxy_field, galaxy_object, energy_ledger, scw_relations | none (data rebuilt by build-galaxy.js) |
| SCW-Bubble | sim_state | none |
| SCW-Solar, SCW-Bodies, SCW-Moons | sim_state, sim_clock, events | inject_interstellar_comet, remove_state |
| SCW-Missions | plan_trip, plan_mission | none |
| SCW-Mining | find_mining_targets, find_mining_targets_parallel | run_extraction_campaign (returns results; public mode stores nothing) |

### Specialist loops by SCW (Context Plane, routed 2026-11-16)

| SCW | Best route (score) | Primary / checker agents | Fit |
|---|---|---|---|
| SCW-Interface, SCW-Evals | agentic-systems → pr-mcp → MCP Server Builder (0.44) | Maxey932 MCP Engineer / Maxey931 Conformance Tester | strong |
| SCW-Solar, SCW-Missions | classical-physics → cl-mechanics → Orbital Mechanics Calculator (0.34) | Maxey1485 Mechanics / Maxey1486 Conservation Law Checker | strong |
| SCW-Universe, SCW-Signals | classical-physics → astrophysics-cosmology → Cosmology Distance Calculator (0.33) | Maxey1479 Astronomer / Maxey1480 Theorist | usable |
| SCW-Data, SCW-Bubble | data-science → Classifier Builder (0.22) | Maxey1613 ML / Maxey1451 Statistician | weak: no astrometry skill |
| SCW-Mining | commodities → Metals Driver Explainer (0.18) | Maxey1691 Metals / Maxey1689 Commodities Checker | weak: no space-resources skill |
| SCW-MW, SCW-MWField, SCW-Halo, SCW-SgrA | routed to Hydrogen Atom Solver (0.17) | none suitable | gap: no galactic-dynamics skill |

### Data sources each SCW will need beyond the directory

| SCW | Source | Access |
|---|---|---|
| SCW-Bubble, SCW-Data | Gaia DR3 (ESA archive, TAP/ADQL) | public API, no MCP server found yet |
| SCW-Solar, SCW-Missions | NASA JPL Horizons and Small-Body Database | public API |
| SCW-Signals | GWOSC event catalogs | public API |
| SCW-MW, SCW-Halo, SCW-SgrA | gala / galpy potentials; GRAVITY Collaboration orbits | Python libraries and papers |
| SCW-Universe | Planck 2018 cosmological parameters | published tables |
| SCW-Populations | ATNF Pulsar Catalogue; Vasiliev and Baumgardt 2021 | public downloads |
| research, all SCWs | alphaXiv (Context Plane gate, registry) | MCP server |

### Data and sources

| SCW | Value | Source | Evidence |
|---|---|---|---|
| Space-at-Scale MCP Server | 25 tools; 87/87 stdio and 9/9 HTTP tests | server.js; TEST-REPORT.md v0.15.0 | EXEC |
| Law registry | scw_laws, scw_inheritance_rules | universe.js LAWS, PROPERTY_RULES | FACT |
| Catalog data | SHA-256 of every file | PROVENANCE.json | EXEC |
| Evals and parity | 77/77 and 96/96 | run_evals | EXEC |
| Hidden universe H | 7/7 and 0/7 | link_hidden_universe | EXEC |
| SCW4 Milky Way | 231.2 km/s at the Sun | galaxy_field | EXEC |
| Dark matter field (instruction carrier) | design choice, not physics | Human0, 2026-11-16 | HYPOTHESIS |
| Sagittarius A* | S2 period 16.07 yr | galaxy_object | EXEC |
| Dark matter halo (mass term) | 41.4% at the Sun | galaxy_field | EXEC |
| Galactic populations | 209 of 211 clusters and satellites bound | galaxy_field | EXEC |
| SCW6 Solar System | Voyager 1 at 172.33 AU | sim_state | EXEC |
| SCW7 planet and body systems | SCW7:<body> nodes | universe.js lines 87-88 | FACT |
| SCW8 moons | SCW8:<planet>/<moon> nodes | universe.js line 89 | FACT |

### Context Plane

Route: six routes on the Maxey0 Context Plane (see the specialist table); candidates, not authorizations
Data servers: space-at-scale, maxey0-context-plane, alphaXiv

### The one-line answer

The Space-at-Scale server is one bounded SCW: catalog data feeds it, the law registry and evals govern it, and SCW0 holds our universe down to the solar system. The proposed dark matter field is a massless SCW at the galactic center that governs how the Milky Way and Sgr A* are built from that data. Three of the six specialist areas have no good Context Plane skill yet, so a Space-at-Scale topic pack comes before the agent loops.