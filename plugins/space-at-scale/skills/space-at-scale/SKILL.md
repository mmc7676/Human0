---
name: space-at-scale
description: Opens and drives Space-at-Scale, an inline 3D simulation at three scales (solar system in AU, Local Bubble in light years, Milky Way in thousands of light years) with forward and reverse time. Use when the user says /space-at-scale, asks to see or play with the solar system, orbits, a comet, spacecraft, nearby stars, the galaxy, black holes, dark matter, supernovae, gravitational waves, asteroid mining, or a space trip plan.
---

# Space-at-Scale

1. Call `open_space_at_scale` first (set `focus` to the body the user named, if any). It renders the app inline; never rebuild it by hand.
2. Answer questions from the server's tools, not memory:
   - solar system positions and time: `sim_state`, `sim_clock`
   - hierarchy and laws: `scw_get`, `scw_children`, `scw_search`, `scw_laws`, `scw_relations`
   - galaxy: `galaxy_field` (who governs the pull at a distance, with and without dark matter), `galaxy_object` (any cluster, satellite, pulsar, black hole, supernova, S-star by name, optionally at another time)
   - energy and matter in SI units across all scales: `energy_ledger`
   - mining and trips: `find_mining_targets`, `plan_trip`, `plan_mission`, `run_extraction_campaign`
   - what-ifs: `inject_interstellar_comet`, `generate_universe`, `generate_exotic_universe`; undo any of them with `remove_state` (one comet, one universe, or `all`)
   - dark matter hypothesis: `link_hidden_universe` (simple or mirror) tests "dark matter is a hidden universe sharing our gravity"; report both results and that the simple version is identical in pull to the standard halo
   - correctness: `run_evals`
3. The Milky Way has no central body. Say so when asked what holds it together: the pull at any point is the sum of five overlapping sources (black hole, nuclear cluster, bulge, disk, dark halo). Quote `galaxy_field` for the shares; dark matter supplies under half of the pull at the Sun in this model.
4. Public mode (`SCW_PUBLIC=1`) is on: generated universes and comets are returned, not persisted, and clock-rate changes are refused. Say so if a user expects persistence.
5. Label numbers as computed by the simulation. The galaxy mass model is a published fit (gala MilkyWayPotential v1), not a measurement; pulsar and supernova-remnant distances carry 20 to 50% uncertainty; prices in mining results are model estimates.
6. Reverse time is shown in years BCE on the usual 12-month calendar with 0 CE as year zero (historians call that year 1 BCE). Mention the one-year offset if a user compares with a history book.
7. Agents build the simulation out on demand. Builders: `exoplanet_system` (a star's confirmed planets), `densify_region` (generated stars at the real local density), `build_galaxy` (Andromeda, Triangulum), `sky_check` (historical visibility of a comet or asteroid on a date). Each result opens the app with the new layer drawn.
8. A message that starts with `[Space-at-Scale trigger] event=<event> agent=<agent>` comes from a button in the app. Hand it to that plugin agent (`space-architect`, `sky-historian` or `scw-checker`) with the Task tool when agents are available; otherwise follow the agent's procedure yourself with the same tools.
