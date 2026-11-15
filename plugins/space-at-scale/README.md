# Space at Scale: a Human0 app

Space at Scale is one of the Human0 in-chat apps (github.com/mmc7676/Human0, at `apps/space-at-scale/`). It ships as a Claude plugin.

Inline MCP App. `open_space_at_scale` renders one self-contained 3D view (Three.js r128 bundled, no network requests) and 24 query tools run the same physics.

Three scales, each with forward and reverse time to its physical limits:

| Scale | Units | Systems | Earliest limit |
|---|---|---|---|
| Solar System (SCW6) | AU | 132 bodies and spacecraft | 4.567 Gyr ago (formation) |
| Local Bubble (SCW5) | light years | 3,665 stars | 30 Myr ago (straight-line motion ends) |
| Milky Way (SCW4) | thousand light years | 3,851: pulsars, globular clusters, satellite galaxies, S-stars, black holes, supernovae, gravitational-wave events | 13.787 Gyr ago (Big Bang) |

## Install
Accept the `.plugin` file in Claude, or `claude plugin install ./space-at-scale`. Requires Node 18+. The server ships as one bundled file (`server/server.bundle.js`), so nothing needs installing. Run `npm ci` in `server/` only for tests or `http.js`.

## Test
`cd server && npm ci && node test.js && node test-http.js`

## Rebuild
`node release.js` copies the app sources, rebuilds the inline app and the server bundle, writes `PROVENANCE.json`, runs the tests and packages the plugin. `server/tools/build-galaxy.js` rebuilds `galaxy.json` from the raw catalogs listed in its `provenance` block.

## Remote (optional)
`server/http.js` and `Dockerfile` serve Streamable HTTP with a bearer token; deploy to Cloud Run with `SCW_PUBLIC=1`.

## Documents
- `INTEGRATION.md`: architecture, data flow, requirement coverage matrix, limitations
- `PROVENANCE.json`: SHA-256 and byte length of every shipped file, and of the raw catalogs
- `TEST-REPORT.md`: output of the last test run
- `DATA-LICENSES.md`: licenses of the code and of each data set

## Directory submission (owner action)
Submit through Anthropic's plugin directory form with this package, the privacy note (no user data stored; public mode persists nothing), screenshots, and a decision on licensing (see `DATA-LICENSES.md`).
