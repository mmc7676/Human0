# Test report

Built 2026-11-15T23:19:41.044Z · version 0.14.0

## test.js: 87 passed, 0 failed, 0 not run

```
PASS 25 tools listed: scw_get, scw_children, scw_search, scw_laws, scw_inheritance_rules, sim_state, sim_clock, run_evals, inject_interstellar_comet, events, validate_app_dropin, find_mining_targets, plan_mission, generate_universe, find_mining_targets_parallel, generate_exotic_universe, run_extraction_campaign, plan_trip, link_hidden_universe, remove_state, galaxy_field, galaxy_object, energy_ledger, scw_relations, open_space_at_scale
PASS graph resource has 152 SCWs
PASS Jupiter system SCW holds 4 moons + Juno
PASS Io inherits laws through 9 levels; Newtonian approximation valid
PASS SCW0 holds quantum laws only, no physical constants
PASS Horizon interior request is gated
PASS SCW6 Voyager 1 = 172.33 AU
PASS SCW6 in 1900: no spacecraft in space (16 listed as not launched yet)
PASS SCW6 on 1980-01-01: Voyager 1 is between Earth and its Jupiter flyby path, 7.36 AU from the Sun
PASS Invalid comet rejected: v_inf_kms must be between 0 and 200
PASS Comet injected, state version 2
PASS Milky Way SCW4 sees the new interstellar object
PASS Event log has the state change
PASS All evals pass from SCW0: 77/77
PASS The inline app embeds the exact physics core the server runs
PASS Space at Scale drops into SCW4 (Milky Way) with no flaws: ✓App declares units this SCW supports; ✓App gravitational parameter matches SCW1 constants; ✓App light-year conversion matches SCW1 constants; ✓App runs the same physics core as the harness; ✓All physics evals for SCW4 and the SCWs below it pass
PASS An app with a wrong G·M☉ is rejected
PASS Lithium search: top target Apophis, 21.39 million t of rock
PASS Iron-analog Psyche excluded as a lithium source
PASS Platinum search includes Psyche (iron analog, flagged unsourced)
PASS Unknown material rejected: No element recognized. Try lithium, nickel, cobalt, platinum, palladium, gold, iron or water.
PASS Apophis first window 2028-08-21, total 424M USD
PASS Ceres SCW carries measured density and sourced composition
PASS Chemistry law inherited from SCW1 down to Ceres
PASS Generated Parallel universe Ψ-2026: G × 0.9911, 8 planets, halo 2.68e+11 M☉
PASS Same seed is idempotent
PASS Invalid seed rejected
PASS SCW0 now holds two universes: SCW1, SCW1:psi-2026
PASS Parallel lithium search top target Ψ26-A8, 16.02 million t
PASS Exotic Ω-2026: threshold 5.97 M☉, 38 of 40 black holes float
PASS Exotic black-hole interior is gated too
PASS SCW0 holds three universes: SCW1, SCW1:psi-2026, SCW1:omega-2026
PASS Campaign: 1.839e+7 years, realized 0.303% of headline
PASS Invalid efficiency rejected
PASS Mars trip: first window 2026-12-04, 259 days, 6.32 km/s
PASS Europa resolves to the Jovian moon
PASS Non-trip request rejected with guidance
PASS open_space_at_scale declares its MCP App view
PASS App resource is self-contained HTML (2.36 MB, mcp-app profile)
PASS open_space_at_scale returns its text fallback
PASS All evals pass with all three universes: 96/96
PASS Milky Way children are typed: superposes 5, contains 5, passes-through 1, signals 1
PASS SCW4 laws: summed-field law and signal law present; central-mass (Kepler) law switched off
PASS Sgr A* node holds 44 S-stars (S2 pericenter 120 AU) and superposes
PASS Dark halo node: inferred not detected; over half the pull beyond 11.14 kpc
PASS Solar System boundary is its Jacobi radius in the galaxy field: 1.37 pc
PASS Field at the Sun: stellar disk leads, dark matter 41.4%, v_c 231.21 km/s, Jacobi radius 1.3696 pc
PASS Regimes: Sgr A* (black hole) to 0.003694 kpc; nuclear star cluster to 0.9547 kpc; stellar disk to 10.29 kpc; dark matter halo to 213 kpc
PASS At 20 kpc the dark halo leads with 66% of the pull
PASS At 1 pc the black hole leads
PASS Invalid radius rejected: r_kpc must be greater than 0 and at most 5000
PASS LMC: 306.6 km/s, bound only with dark matter
PASS LMC 500 Myr ago: 107.65 kpc from the center, epoch 499,997,974 BCE
PASS S2: period 16.0518 yr, implies 4309000 Msun
PASS SN 1054: exploded 5445 BCE, seen 1054 CE, shell now 7.4719 kly
PASS SN 1054 two thousand years ago: light on its way, not yet at the Sun
PASS Hulse-Taylor binary: merges in 300.7 Myr, decay -2.4021e-12
PASS Crab Pulsar: characteristic age 1257 yr
PASS Cygnus X-1: black hole, interior gated
PASS Unknown galaxy object rejected with guidance
PASS Out-of-range galaxy time rejected: t_myr must be within 14,000 Myr of today
PASS Ledger: GW150914 radiated 5.54e+47 J; Milky Way rest energy 1.8241e+59 J, binding -3.6161e+52 J
PASS SCW4 state: Sun at -8276.993 pc, 251.85 km/s
PASS GW231123: radiated 16 Msun c^2 (2.8593e+48 J), arrived 2023-11-23 13:54:30 UTC
PASS Vela Pulsar: measured motion 247.3 km/s, distance by independent
PASS Ledger includes the 391-event gravitational-wave catalog
PASS Galaxy evals: 29/29, structure 31/31
PASS The inline app embeds the exact galaxy core the server runs
PASS The inline app embeds the exact galaxy data the server serves
PASS The inline app loads no remote script
PASS galaxy.json was built with the same mass model and frame as the core
PASS Galaxy data counts: {"globular_clusters":161,"satellite_galaxies":50,"pulsars":3563,"black_holes":21,"supernovae":9,"s_stars":44,"gw_events":391,"sun":1,"total":4240}
PASS PROVENANCE.json: 44 artifacts match their recorded SHA-256 and byte length
PASS Comet Human0-1 removed
PASS Milky Way no longer sees the removed comet
PASS Parallel universe 2026 removed: SCW1:psi-2026 (34 SCWs)
PASS Clear all removed: SCW1:omega-2026 (41 SCWs)
PASS SCW0 holds only our universe again
PASS Removing a universe that was never generated is rejected
PASS Graph back to its base size: 152 SCWs (was 227)
PASS Simple hidden universe H matches 7 of 7 observations
PASS Mirror hidden universe H matches 0 of 7: 446 km/s; v(20 kpc)/v(Sun) = 0.70; 19 GeV/cm3
PASS Hidden universe state: light blocked, gravity only
PASS H relates to the harness by shares-gravity
PASS Mirror H removed
PASS Clear all removes the simple H too
PASS All evals still pass after clearing: 74/74
ALL PASSED
```

## test-http.js: 9 passed, 0 failed, 0 not run

```
PASS healthz: 152 SCWs, auth bearer
PASS Request without token rejected with 401
PASS Wrong token rejected with 401
PASS GET /mcp returns 405
PASS 25 tools over HTTP
PASS galaxy_field over HTTP: stellar disk leads at the Sun
PASS plan_trip over HTTP: Mars window 2026-12-04
PASS run_evals over HTTP: 74/74
PASS State persists across separate HTTP clients (universe Ψ-7 visible to a second client)
ALL PASSED
```

## Not covered by this script

- Browser interaction (run separately in headless Chrome; see INTEGRATION.md)
- Rendering inside a Claude conversation
- Docker image and Cloud Run deployment
