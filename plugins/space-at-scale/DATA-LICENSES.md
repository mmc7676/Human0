# Licenses

This is a factual list, not legal advice. Confirm it before publishing.

| Part | License | Notes |
|---|---|---|
| Plugin code (app, server, cores, tools) | MIT | written for Human0 |
| three.js r128, OrbitControls | MIT | bundled unmodified |
| `stars.json` | CC BY-SA 4.0 | HYG Database v4.1 (astronexus); planets from the Open Exoplanet Catalogue (MIT) |
| `galaxy.json`: globular clusters, satellite galaxies | BSD-3-Clause | galpy `named_objects.json`; underlying papers cited in the file |
| `galaxy.json`: pulsars, historical supernovae | GPL-2.0-or-later | Stellarium data files; pulsars derive from the ATNF Pulsar Catalogue v2.9.0 (Manchester et al. 2005), which asks for acknowledgement |
| `galaxy.json`: S-star orbits, nearest black holes | CC BY-SA 4.0 | transcribed from Wikipedia tables; underlying papers cited in the file |
| Mass model parameters | MIT | gala `MilkyWayPotential` v1 (Price-Whelan 2017; Bovy 2015) |

Two of these are share-alike or copyleft (CC BY-SA 4.0, GPL-2.0-or-later). Shipping the data under an MIT-only label would misstate it. Options: keep the combined license expression in `plugin.json`; or regenerate the pulsar table straight from ATNF psrcat and the supernova list from primary papers, then drop the GPL item.
