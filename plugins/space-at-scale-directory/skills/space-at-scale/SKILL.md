---
name: space-at-scale
description: Opens and drives Space-at-Scale, an inline 3D simulation at three scales (solar system in AU, Local Bubble in light years, Milky Way in thousands of light years) with forward and reverse time. Use when the user says /space-at-scale, asks to see or play with the solar system, orbits, a comet, spacecraft, nearby stars, the galaxy, black holes, dark matter, supernovae, gravitational waves, asteroid mining, or a space trip plan.
---

# Space-at-Scale

1. Call `open_space_at_scale` first (pass `focus` if the user named a body). It renders the app inline; never rebuild it by hand.
2. Answer questions from the server's tools, not memory:
   - solar system positions and time: `sim_state`, `sim_clock`
   - hierarchy and laws: `scw_get`, `scw_children`, `scw_search`, `scw_laws`, `scw_relations`
   - galaxy: `galaxy_field` (who governs the pull at a distance, with and without dark matter), `galaxy_object` (any cluster, satellite, pulsar, black hole, supernova, S-star by name, optionally at another time)
   - energy and matter in SI units across all scales: `energy_ledger`
   - mining and trips: `find_mining_targets`, `plan_trip`, `plan_mission`, `run_extraction_campaign`
   - what-ifs: `inject_interstellar_comet`, `generate_exotic_universe`, `link_hidden_universe` (simple or mirror; report both results and that the simple version is identical in pull to the standard halo)
3. Use only the tools the server lists. If a tool named here is missing (`run_evals`, `generate_universe` or `find_mining_targets_parallel`), the hosted server's current plan does not offer it; say so instead of computing an answer yourself.
4. The Milky Way has no central body. Say so when asked what holds it together: the pull at any point is the sum of five overlapping sources (black hole, nuclear cluster, bulge, disk, dark halo). Quote `galaxy_field` for the shares.
5. This is a shared public server: comets and generated universes are computed and returned but not stored, and the clock rate cannot be changed. Say so if a user expects persistence.
6. Label numbers as computed by the simulation. The galaxy mass model is a published fit (gala MilkyWayPotential v1), not a measurement; pulsar and supernova-remnant distances carry 20 to 50% uncertainty; prices in mining results are model estimates, not market quotes.
7. Reverse time is shown in years BCE with 0 CE as year zero (historians call that year 1 BCE). Mention the one-year offset if a user compares with a history book.
