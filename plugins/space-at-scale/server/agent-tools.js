'use strict';
// Space-at-Scale agent tools: on-demand builders an agent (or an in-app trigger) calls to add objects to a scale.
// Nothing here is stored. Every result carries a `render` payload the inline app draws as an overlay layer, and
// a `provenance` block that says which parts are catalog data and which are generated.
//
// render = { layer, scale: 'bubble'|'galaxy', frame: 'helio_ly'|'galcen_kpc', label, note,
//            points: [[x,y,z,'#rrggbb',sizePx]], labels: [[text,x,y,z]], rings: [{center:[x,y,z], r, color}] }
const core = require('./physics-core.js');
const GXC = require('./galaxy-core.js');
const STARS = require('./stars.json');

const D = Math.PI / 180, LY_PER_PC = 3.26156, AU_PER_LY = 63241.077;
const COL = Object.fromEntries(STARS.cols.map((c, i) => [c, i]));
const MAX_POINTS = 3000;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function findStar(q) {
  const n = norm(q);
  if (!n) throw new Error('Name a star, e.g. "Vega" or "HD 6805".');
  if (n === 'sun' || n === 'sol') return { index: -1, s: null, name: 'Sun', pos: [0, 0, 0] };
  let best = -1;
  STARS.stars.forEach((s, i) => {
    if (best >= 0) return;
    if (norm(s[COL.name]) === n || norm(s[COL.ids]).split(' ').join(' ').includes(n) && n.length > 3) best = i;
  });
  if (best < 0) STARS.stars.forEach((s, i) => { if (best < 0 && norm(s[COL.name]).includes(n)) best = i; });
  if (best < 0) throw new Error('No naked-eye star (V <= 5.8, within 1,000 ly) matches "' + q + '".');
  const s = STARS.stars[best];
  return { index: best, s, name: s[COL.name], pos: [s[COL.x_ly], s[COL.y_ly], s[COL.z_ly]] };
}

// ---- 1. exoplanet_system: the star's confirmed planets from the NASA Exoplanet Archive extract in stars.json ----
function exoplanetSystem({ star }) {
  const st = findStar(star);
  if (!st.s) throw new Error('Use the solar system scale for the Sun\'s planets.');
  const raw = st.s[COL.planets] || [];
  const mStar = +st.s[COL.mass_est] || 1;
  const planets = raw.map(([name, mass_mj, radius_rj, period_d, a_au, ecc, year, method, status]) => {
    const P = +period_d, aGiven = +a_au;
    const a = aGiven > 0 ? aGiven : P > 0 ? Math.cbrt(mStar * Math.pow(P / 365.25, 2)) : null;
    return { name, mass_mjup: mass_mj === '' ? null : +mass_mj, radius_rjup: radius_rj === '' ? null : +radius_rj,
      period_days: P || null, a_au: a === null ? null : +a.toFixed(4), a_source: aGiven > 0 ? 'archive' : a === null ? 'unknown' : 'Kepler third law from period and estimated stellar mass',
      eccentricity: ecc === '' ? null : +ecc, discovered: year ? +year : null, method, status };
  });
  const amax = Math.max(...planets.map((p) => p.a_au || 0), 1e-3);
  // Draw orbits enlarged so they are visible at light-year scale: the widest orbit is drawn with a 0.6 ly radius.
  const scale = 0.6 / amax;
  const rings = planets.filter((p) => p.a_au).map((p) => ({ center: st.pos, r: p.a_au * scale, color: '#5DCAA5', label: p.name }));
  return {
    star: st.name, ids: st.s[COL.ids], distance_ly: +Math.hypot(...st.pos).toFixed(1), spectral_type: st.s[COL.spect], planets,
    count: planets.length,
    note: planets.length ? undefined : 'No confirmed planets in the archive extract for this star.',
    render: { layer: 'exo:' + st.name, scale: 'bubble', frame: 'helio_ly', label: st.name + ' planets', focus: st.index,
      note: 'Orbits enlarged ' + Math.round(scale * AU_PER_LY).toLocaleString() + ' times so they show at light-year scale.',
      points: [], labels: planets.filter((p) => p.a_au).map((p) => [p.name, st.pos[0] + p.a_au * scale, st.pos[1], st.pos[2]]), rings },
    provenance: { planets: 'catalog (NASA Exoplanet Archive extract shipped in stars.json)', orbit_drawing: 'enlarged for visibility' },
  };
}

// ---- 2. densify_region: statistically drawn fainter stars around a point (not catalog stars) ----
// Local stellar number density ~0.1 stars per cubic parsec (all types); spectral mix from the solar neighborhood census.
const MIX = [['M', 0.765, [8.5, 16], '#ffb56b'], ['K', 0.121, [5.9, 8.5], '#ffd2a1'], ['G', 0.076, [4.4, 5.9], '#fff4ea'], ['F', 0.03, [2.5, 4.4], '#f8f7ff'], ['A', 0.006, [0.6, 2.5], '#cad7ff'], ['B', 0.0013, [-4, 0.6], '#aabfff']];
function densifyRegion({ center = 'Sun', radius_ly = 20, max_stars = 1500, seed = 1 }) {
  if (!(radius_ly > 0 && radius_ly <= 200)) throw new Error('radius_ly must be greater than 0 and at most 200.');
  const st = findStar(center), rnd = mulberry32(seed >>> 0 || 1);
  const perLy3 = 0.1 / Math.pow(LY_PER_PC, 3), expected = perLy3 * 4 / 3 * Math.PI * Math.pow(radius_ly, 3);
  const n = Math.min(Math.round(expected), Math.min(max_stars, MAX_POINTS));
  const pts = [], counts = {};
  for (let k = 0; k < n; k++) {
    const u = rnd(), r = radius_ly * Math.cbrt(rnd()), th = Math.acos(2 * rnd() - 1), ph = 2 * Math.PI * rnd();
    let acc = 0, t = MIX[0]; for (const m of MIX) { acc += m[1]; if (u <= acc) { t = m; break; } }
    counts[t[0]] = (counts[t[0]] || 0) + 1;
    pts.push([+(st.pos[0] + r * Math.sin(th) * Math.cos(ph)).toFixed(3), +(st.pos[1] + r * Math.sin(th) * Math.sin(ph)).toFixed(3), +(st.pos[2] + r * Math.cos(th)).toFixed(3), t[3], 1.5]);
  }
  return {
    center: st.name, radius_ly, expected_stars: Math.round(expected), drawn: n, capped: n < Math.round(expected), by_type: counts,
    render: { layer: 'dense:' + st.name + ':' + radius_ly, scale: 'bubble', frame: 'helio_ly', label: 'Census estimate around ' + st.name, focus: st.index >= 0 ? st.index : null,
      note: 'Statistical fill: ' + n + ' stars drawn at the local density (0.1 per cubic parsec). They are not catalog stars.', points: pts, labels: [], rings: [] },
    provenance: { stars: 'generated (seeded, deterministic per seed)', density: 'local stellar density ~0.1 pc^-3', mix: 'solar-neighborhood spectral census (approximate)' },
  };
}

// ---- 3. build_galaxy: a particle model of a named galaxy at its measured sky position and distance ----
const GALAXIES = {
  andromeda: { name: 'Andromeda (M31)', ra: 10.6847, dec: 41.2690, d_kpc: 765, rd_kpc: 5.3, rmax_kpc: 30, bulge_kpc: 1.0, inc: 77, pa: 38, arms: 2, src: 'distance McConnachie 2005/2012; disk scale length Courteau+ 2011; inclination and PA from de Vaucouleurs 1958' },
  triangulum: { name: 'Triangulum (M33)', ra: 23.4621, dec: 30.6599, d_kpc: 840, rd_kpc: 1.4, rmax_kpc: 9, bulge_kpc: 0.2, inc: 55, pa: 23, arms: 2, src: 'distance Gieren+ 2013; disk Regan & Vogel 1994; orientation Corbelli & Schneider 1997' },
};
const ALIAS = { m31: 'andromeda', 'andromeda galaxy': 'andromeda', 'ngc 224': 'andromeda', m33: 'triangulum', 'ngc 598': 'triangulum', 'triangulum galaxy': 'triangulum' };
function buildGalaxy({ name, particles = 2500, seed = 31 }) {
  const key = ALIAS[norm(name)] || norm(name).split(' ')[0];
  const G = GALAXIES[key];
  if (!G) throw new Error('Galaxy models available: ' + Object.values(GALAXIES).map((g) => g.name).join(', ') + '.');
  const n = Math.min(Math.max(200, particles | 0), MAX_POINTS), rnd = mulberry32(seed >>> 0 || 1);
  const c = GXC.toGalcen(G.ra, G.dec, G.d_kpc);
  // Sky basis at the galaxy: line of sight, east, north (Galactic-frame vectors via the same rotation the catalog uses).
  const los = GXC.galHelio(G.ra, G.dec, 1), east = sub(GXC.galHelio(G.ra + 0.01, G.dec, 1), los), north = sub(GXC.galHelio(G.ra, G.dec + 0.01, 1), los);
  const L = unit(los), N0 = unit(north), E = unit(cross(N0, L));
  const pa = G.pa * D, inc = G.inc * D;
  const major = add(scale(N0, Math.cos(pa)), scale(E, Math.sin(pa)));          // major axis on the sky
  const minorSky = unit(cross(L, major));                                      // perpendicular on the sky
  const minor = add(scale(minorSky, Math.cos(inc)), scale(L, Math.sin(inc)));   // tilted out of the sky plane
  const pts = [];
  for (let k = 0; k < n; k++) {
    let x, y, z, col, size;
    if (rnd() < 0.18) { // bulge: Plummer-like sphere
      const r = G.bulge_kpc / Math.sqrt(Math.pow(rnd() + 1e-9, -2 / 3) - 1 + 1e-9), th = Math.acos(2 * rnd() - 1), ph = 2 * Math.PI * rnd();
      const rr = Math.min(r, G.bulge_kpc * 4); x = rr * Math.sin(th) * Math.cos(ph); y = rr * Math.sin(th) * Math.sin(ph); z = rr * Math.cos(th) * 0.7; col = '#ffd9a0'; size = 1.6;
    } else { // exponential disk with a two-arm logarithmic spiral perturbation
      let R = -G.rd_kpc * Math.log(1 - rnd() * (1 - Math.exp(-G.rmax_kpc / G.rd_kpc)));
      const arm = Math.floor(rnd() * G.arms), phi0 = arm * 2 * Math.PI / G.arms + Math.log(R / G.rd_kpc + 0.2) / Math.tan(14 * D);
      const phi = rnd() < 0.6 ? phi0 + (rnd() - 0.5) * 0.5 : 2 * Math.PI * rnd();
      x = R * Math.cos(phi); y = R * Math.sin(phi); z = (rnd() - 0.5) * 0.3; col = R < 2 * G.rd_kpc ? '#f4ead8' : '#aec8ff'; size = 1.3;
    }
    const p = add(c, add(add(scale(major, x), scale(minor, y)), scale(L, 0)));
    const q = add(p, scale(unit(cross(major, minor)), z));
    pts.push([+q[0].toFixed(3), +q[1].toFixed(3), +q[2].toFixed(3), col, size]);
  }
  return {
    galaxy: G.name, distance_kpc: G.d_kpc, distance_mly: +(G.d_kpc * LY_PER_PC / 1000).toFixed(2), center_galcen_kpc: c.map((v) => +v.toFixed(2)),
    inclination_deg: G.inc, position_angle_deg: G.pa, particles: n,
    render: { layer: 'galaxy:' + key, scale: 'galaxy', frame: 'galcen_kpc', label: G.name,
      note: G.name + ' at ' + (G.d_kpc * LY_PER_PC / 1000).toFixed(2) + ' million ly: a ' + n + '-particle model, not individual stars. Zoom out past ~2,500 kly to see it.',
      points: pts, labels: [[G.name, c[0], c[1], c[2]]], rings: [] },
    provenance: { position_and_distance: 'catalog (' + G.src + ')', particles: 'generated model (exponential disk, bulge, two-arm spiral), seeded' },
  };
}
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), scale = (a, s) => a.map((v) => v * s);
const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---- 4. sky_check: was a small body visible from Earth on a date (historical experiments) ----
// Dates: year is the historians' year by default (5 BCE = -5 as input 'BCE' text, or pass astronomical_year).
function julianCalendarJD(y, m, d) { const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3; return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083 - 0.5; }
function parseDate(date) {
  const s = String(date).trim();
  let m = /^(\w+)\s+(\d{1,2}),?\s+(\d+)\s*(BCE|BC|CE|AD)?$/i.exec(s);
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let y, mo, d, era;
  if (m) { mo = MON.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; d = +m[2]; y = +m[3]; era = (m[4] || 'CE').toUpperCase(); }
  else if ((m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; era = 'ASTRO'; }
  else throw new Error('Date format: "October 5, 5 BCE", "March 1, 2026" or astronomical "-0004-10-05".');
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) throw new Error('Unrecognized month or day in "' + s + '".');
  const astro = era === 'ASTRO' ? y : era === 'BCE' || era === 'BC' ? 1 - y : y;
  const julian = astro < 1582;
  const jd = julian ? julianCalendarJD(astro, mo, d) : GXC.jdOf(astro, mo, d);
  return { jd, astronomical_year: astro, calendar: julian ? 'Julian' : 'Gregorian', historians_label: astro <= 0 ? (1 - astro) + ' BCE' : astro + ' CE' };
}
const ALBEDO = { Phaethon: 0.12 };
function skyCheck({ body, date, albedo }) {
  const k = core.KB.find((b) => norm(b[0]) === norm(body));
  if (!k) throw new Error('sky_check covers the small bodies in the simulation (asteroids, comets, KBOs), e.g. Phaethon, Ceres, Halley.');
  const t = parseDate(date);
  const earth = core.plPos(core.PL.find((p) => p[0] === 'Earth'), t.jd), b = core.kbPos(k, t.jd);
  const r = Math.hypot(...b), g = [b[0] - earth[0], b[1] - earth[1], b[2] - earth[2]], delta = Math.hypot(...g), R = Math.hypot(...earth);
  const cosPhase = (r * r + delta * delta - R * R) / (2 * r * delta), phase = Math.acos(Math.max(-1, Math.min(1, cosPhase)));
  const elong = Math.acos(Math.max(-1, Math.min(1, (R * R + delta * delta - r * r) / (2 * R * delta)))) / D;
  const radius_km = +k[9], p = albedo || ALBEDO[k[0]] || 0.12;
  const H = radius_km > 0 ? 5 * Math.log10(1329 / (2 * radius_km * Math.sqrt(p))) : null;
  // H-G magnitude system with G = 0.15
  const G = 0.15, phi1 = Math.exp(-3.33 * Math.pow(Math.tan(phase / 2), 0.63)), phi2 = Math.exp(-1.87 * Math.pow(Math.tan(phase / 2), 1.22));
  const V = H === null ? null : H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * phi1 + G * phi2);
  return {
    body: k[0], date_input: String(date), ...t, heliocentric_distance_au: +r.toFixed(4), geocentric_distance_au: +delta.toFixed(4),
    solar_elongation_deg: +elong.toFixed(1), phase_angle_deg: +(phase / D).toFixed(1), absolute_magnitude_H: H === null ? null : +H.toFixed(2),
    apparent_magnitude_V: V === null ? null : +V.toFixed(1), naked_eye: V !== null && V <= 6 && elong > 20,
    verdict: V === null ? 'No size on record, so brightness cannot be estimated.' : V <= 6 && elong > 20 ? 'Bright enough for the naked eye under dark skies.' : 'Not visible to the naked eye (limit about V 6' + (elong <= 20 ? '; also too close to the Sun' : '') + ').',
    assumptions: ['Present-day orbit propagated two-body; planetary perturbations over centuries are ignored, so positions far from today are indicative.', 'Albedo ' + p + ' and H-G slope 0.15; cometary activity (outbursts, dust) is not modeled.', 'Dates before 1582 use the Julian calendar; BCE years are historians\' years (1 BCE = astronomical year 0).'],
  };
}

// ---- 5. stream_catalog_region: real Gaia DR3 stars around a star, streamed from a public TAP service ----
// Gaia data: ESA/Gaia/DPAC, CC BY-SA 3.0 IGO. Primary service: ESA Gaia archive; fallback: CDS VizieR (same Gaia DR3 table).
const LY_PER_MAS = 3261.56; // distance in ly = 3261.56 / parallax(mas)
const TAP = [
  { name: 'ESA Gaia Archive', url: 'https://gea.esac.esa.int/tap-server/tap/sync', table: 'gaiadr3.gaia_source', id: 'source_id', ra: 'ra', dec: 'dec', plx: 'parallax', plxe: 'parallax_over_error', g: 'phot_g_mean_mag', bprp: 'bp_rp', pmra: 'pmra', pmdec: 'pmdec', rv: 'radial_velocity' },
  { name: 'CDS VizieR', url: 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', table: '"I/355/gaiadr3"', id: 'Source', ra: 'RA_ICRS', dec: 'DE_ICRS', plx: 'Plx', plxe: 'RPlx', g: 'Gmag', bprp: '"BP-RP"', pmra: 'pmRA', pmdec: 'pmDE', rv: 'RV' },
];
function regionQuery(t, ra, dec, radDeg, plxMin, plxMax, gMax, top) {
  return 'SELECT TOP ' + top + ' ' + [t.id, t.ra, t.dec, t.plx, t.g, t.bprp, t.pmra, t.pmdec, t.rv].join(', ') + ' FROM ' + t.table +
    ' WHERE ' + t.plx + ' BETWEEN ' + plxMin.toFixed(4) + ' AND ' + plxMax.toFixed(4) + ' AND ' + t.plxe + ' > 10 AND ' + t.g + ' < ' + gMax +
    (radDeg < 180 ? ' AND 1 = CONTAINS(POINT(\'ICRS\', ' + t.ra + ', ' + t.dec + '), CIRCLE(\'ICRS\', ' + ra.toFixed(5) + ', ' + dec.toFixed(5) + ', ' + radDeg.toFixed(4) + '))' : '') +
    ' ORDER BY ' + t.g + ' ASC';
}
function parseCsv(text) {
  const rows = [], lines = text.trim().split(/\r?\n/);
  const head = lines.shift().split(',').map((h) => h.replace(/"/g, '').trim());
  for (const l of lines) { const c = l.split(','); if (c.length >= head.length) rows.push(c.map((v) => v.replace(/"/g, '').trim())); }
  return { head, rows };
}
function bprpColor(bprp) {
  if (!(bprp > -1)) return '#ffffff';
  const stops = [[-0.3, '#9bb2ff'], [0.3, '#cad7ff'], [0.8, '#fff4ea'], [1.2, '#ffd2a1'], [2.0, '#ffb56b'], [3.5, '#ff8a4a']];
  for (const [v, c] of stops) if (bprp <= v) return c;
  return '#ff8a4a';
}
// Pure conversion step, exported for tests: CSV text from either service -> stars in the catalog frame.
// Pure conversion step, exported for tests: CSV text from either service -> stars in the catalog frame,
// with space velocity from proper motion (+ radial velocity when Gaia has it) so they move with the Bubble clock.
const KMS_TO_LYYR = 1 / 299792.458; // 1 km/s in light years per year
function gaiaRowsToStars(csvText, inside) {
  const { head, rows } = parseCsv(csvText), ix = (re) => head.findIndex((h) => re.test(h));
  const iId = ix(/^(source_id|Source)$/i), iRa = ix(/^(ra|RA_ICRS)$/i), iDe = ix(/^(dec|DE_ICRS)$/i), iP = ix(/^(parallax|Plx)$/i), iG = ix(/^(phot_g_mean_mag|Gmag)$/i), iC = ix(/^(bp_rp|BP-RP)$/i);
  const iPa = ix(/^(pmra|pmRA)$/i), iPd = ix(/^(pmdec|pmDE)$/i), iRv = ix(/^(radial_velocity|RV)$/i);
  if ([iId, iRa, iDe, iP, iG].some((i) => i < 0)) throw new Error('Unexpected columns from the catalog service: ' + head.join(', '));
  const out = [];
  for (const r of rows) {
    const plx = +r[iP]; if (!(plx > 0)) continue;
    const ra = +r[iRa], dec = +r[iDe], d = LY_PER_MAS / plx, p = GXC.galHelio(ra, dec, d);
    if (inside && !inside(p)) continue;
    // velocity: tangential from proper motion, radial from RV (0 when missing), rotated with the same equatorial->galactic map
    const dpc = 1000 / plx, pa = iPa >= 0 ? +r[iPa] || 0 : 0, pd = iPd >= 0 ? +r[iPd] || 0 : 0, rv = iRv >= 0 && r[iRv] !== '' ? +r[iRv] : 0;
    const va = 4.74047 * pa / 1000 * dpc, vd = 4.74047 * pd / 1000 * dpc, a = ra * Math.PI / 180, de = dec * Math.PI / 180;
    const eq = [-Math.sin(a) * va - Math.sin(de) * Math.cos(a) * vd + Math.cos(de) * Math.cos(a) * rv,
      Math.cos(a) * va - Math.sin(de) * Math.sin(a) * vd + Math.cos(de) * Math.sin(a) * rv, Math.cos(de) * vd + Math.sin(de) * rv];
    const ux = GXC.galHelio(0, 0, 1), uy = GXC.galHelio(90, 0, 1), uz = GXC.galHelio(0, 90, 1);
    const vg = [0, 1, 2].map((k) => (ux[k] * eq[0] + uy[k] * eq[1] + uz[k] * eq[2]) * KMS_TO_LYYR);
    const G = +r[iG], bprp = iC >= 0 && r[iC] !== '' ? +r[iC] : null;
    out.push({ id: 'Gaia DR3 ' + r[iId], ra, dec, pos: p, G, bprp, d_ly: d, v: vg, rv: iRv >= 0 && r[iRv] !== '' ? rv : null });
  }
  return out;
}
// A streamed star as a row in the base catalog's column order, so the app can add it to the Local Bubble
// (selectable, centerable, moving with the Bubble clock). V and B-V are approximated from Gaia G and BP-RP.
function starRow(g) {
  const absV = g.G + 5 - 5 * Math.log10(g.d_ly / 3.26156), bv = g.bprp === null ? '' : (0.85 * g.bprp - 0.05).toFixed(2);
  return [g.id, g.id + ' · G ' + g.G.toFixed(2) + (g.bprp === null ? '' : ' · BP-RP ' + g.bprp.toFixed(2)) + ' · ' + (g.rv === null ? 'no RV' : 'RV ' + g.rv.toFixed(1) + ' km/s'), '',
    +g.pos[0].toFixed(3), +g.pos[1].toFixed(3), +g.pos[2].toFixed(3), +g.G.toFixed(2), +absV.toFixed(2), 'Gaia', bv,
    +(g.ra / 15).toFixed(6), +g.dec.toFixed(5), g.rv === null ? '' : g.rv.toFixed(1), +Math.pow(10, (4.83 - absV) / 2.5).toPrecision(4),
    g.v.map((x) => +x.toPrecision(6)), 0, '', []];
}
// Two shapes: a sphere around a star (center + radius_ly), or a cone along a sky direction (ra, dec, radius_deg,
// out to max_distance_ly) — the cone is what a Magnify box selects. Stars come back as base-catalog rows.
async function streamCatalogRegion({ center, radius_ly = 20, ra, dec, radius_deg, max_distance_ly = 1000, mag_limit = 13, max_stars = 800 }, fetchImpl) {
  const f = fetchImpl || fetch, cone = ra !== undefined && dec !== undefined;
  let q0, inside, label, focus = null;
  const top = Math.min(Math.max(50, max_stars | 0), 2000) * 2;
  if (cone) {
    if (!(radius_deg > 0 && radius_deg <= 10)) throw new Error('radius_deg must be greater than 0 and at most 10.');
    if (!(max_distance_ly > 0 && max_distance_ly <= 5000)) throw new Error('max_distance_ly must be greater than 0 and at most 5,000.');
    q0 = { ra, dec, radDeg: radius_deg, plxMin: LY_PER_MAS / max_distance_ly, plxMax: 1e6 };
    inside = null; label = 'RA ' + ra.toFixed(2) + '°, Dec ' + dec.toFixed(2) + '° (' + radius_deg + '° cone to ' + max_distance_ly + ' ly)';
  } else {
    if (!(radius_ly > 0 && radius_ly <= 100)) throw new Error('radius_ly must be greater than 0 and at most 100.');
    const st = findStar(center || 'Sun'), D = Math.hypot(...st.pos), R = radius_ly;
    q0 = { ra: st.s ? st.s[COL.ra_h] * 15 : 0, dec: st.s ? st.s[COL.dec_deg] : 0, radDeg: D > R ? Math.asin(R / D) * 180 / Math.PI : 180,
      plxMin: LY_PER_MAS / (D + R), plxMax: D > R ? LY_PER_MAS / (D - R) : 1e6 };
    inside = (p) => Math.hypot(p[0] - st.pos[0], p[1] - st.pos[1], p[2] - st.pos[2]) <= R;
    label = R + ' ly around ' + st.name; focus = st.index >= 0 ? st.index : null;
  }
  const errors = [];
  for (const t of TAP) {
    const q = regionQuery(t, q0.ra, q0.dec, q0.radDeg, q0.plxMin, q0.plxMax, mag_limit, top);
    const url = t.url + '?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=' + encodeURIComponent(q);
    try {
      const res = await f(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'text/csv' } });
      if (!res.ok) { errors.push(t.name + ': HTTP ' + res.status); continue; }
      let stars = gaiaRowsToStars(await res.text(), inside);
      const returned = stars.length;
      // Skip stars the base naked-eye catalog already has (within 1 ly).
      stars = stars.filter((g) => !STARS.stars.some((s) => Math.abs(s[COL.x_ly] - g.pos[0]) < 1 && Math.hypot(s[COL.x_ly] - g.pos[0], s[COL.y_ly] - g.pos[1], s[COL.z_ly] - g.pos[2]) < 1)).slice(0, max_stars);
      return {
        region: label, mag_limit_G: mag_limit, service: t.name, returned, already_in_base_catalog: returned - stars.length, added: stars.length,
        brightest: stars.slice(0, 5).map((g) => ({ id: g.id, G: g.G, distance_ly: +g.d_ly.toFixed(1) })),
        catalog: { kind: 'gaia-dr3', focus, stars: stars.map(starRow), note: stars.length + ' real Gaia DR3 stars (G < ' + mag_limit + ') added: ' + label + '. Data: ESA/Gaia/DPAC, CC BY-SA 3.0 IGO.' },
        provenance: { stars: 'catalog (Gaia DR3 via ' + t.name + '); V and B-V approximated from G and BP-RP; motion from Gaia proper motion and radial velocity (0 when Gaia has none)', license: 'ESA/Gaia/DPAC, CC BY-SA 3.0 IGO', query: q },
      };
    } catch (e) { errors.push(t.name + ': ' + (e.name === 'TimeoutError' ? 'timed out' : e.message)); }
  }
  throw new Error('No catalog service answered (' + errors.join('; ') + ').');
}

// ---- 6. route_trigger: used by the plugin's mcp_tool hook (UserPromptSubmit) to route in-app trigger messages ----
const AGENTS = ['space-architect', 'sky-historian', 'scw-checker'];
function routeTrigger({ prompt = '' }) {
  const m = /^\[Space-at-Scale trigger\]\s+event=(\S+)\s+agent=(\S+)/.exec(String(prompt));
  if (!m || !AGENTS.includes(m[2])) return '';
  return 'This message was sent by a button in the Space-at-Scale app (event ' + m[1] + '). It is a task for the space-at-scale:' + m[2] +
    ' agent, which uses only Space-at-Scale tools for numbers and reports which results are catalog data and which are generated.';
}

// ---- 7. sky_region: the magnification view ("eyepiece") for a patch of sky ----
// Stars: Gaia DR3 to a chosen limiting magnitude (plus base-catalog bright stars Gaia saturates on).
// Image: a DSS2 color survey cutout of the same field from the CDS hips2fits service.
// Names: CDS Sesame resolves "M42", "Orion Nebula", "Andromeda Galaxy" to coordinates.
const STEPS = [['Naked eye', 6], ['Binoculars', 9.5], ['Small telescope', 13], ['Large telescope', 16], ['Gaia limit', 19]];
const D2R = Math.PI / 180;
async function resolveName(name, f) {
  const url = 'https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?' + encodeURIComponent(name);
  const res = await f(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Name service (CDS Sesame) returned HTTP ' + res.status);
  const x = await res.text(), ra = /<jradeg>([-\d.]+)<\/jradeg>/.exec(x), de = /<jdedeg>([-\d.]+)<\/jdedeg>/.exec(x);
  if (!ra || !de) throw new Error('CDS Sesame could not resolve "' + name + '".');
  const oname = /<oname>([^<]+)<\/oname>/.exec(x);
  return { ra: +ra[1], dec: +de[1], resolved_as: oname ? oname[1].trim() : name };
}
function angSep(ra1, de1, ra2, de2) {
  const a = Math.sin((de2 - de1) * D2R / 2) ** 2 + Math.cos(de1 * D2R) * Math.cos(de2 * D2R) * Math.sin((ra2 - ra1) * D2R / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) / D2R;
}
function toBase64(buf) {
  if (typeof Buffer !== 'undefined') return Buffer.from(buf).toString('base64');
  let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s);
}
async function skyRegion({ target, ra, dec, fov_deg = 1, mag_limit = 9.5, max_stars = 1500, image = true }, fetchImpl) {
  const f = fetchImpl || fetch, notes = [];
  if (!(fov_deg >= 0.05 && fov_deg <= 10)) throw new Error('fov_deg must be between 0.05 and 10 degrees.');
  let where = { ra, dec, resolved_as: null };
  if (target) where = await resolveName(target, f);
  if (!(where.ra >= 0 && where.ra < 360 && where.dec >= -90 && where.dec <= 90)) throw new Error('Give a target name, or ra (0-360) and dec (-90 to 90) in degrees.');
  const rad = fov_deg / Math.SQRT2;
  const starsJob = (async () => {
    const errs = [];
    for (const t of TAP) {
      const q = 'SELECT TOP ' + Math.min(Math.max(50, max_stars | 0), 3000) + ' ' + [t.id, t.ra, t.dec, t.g, t.bprp].join(', ') + ' FROM ' + t.table + ' WHERE ' + t.g + ' < ' + mag_limit +
        ' AND 1 = CONTAINS(POINT(\'ICRS\', ' + t.ra + ', ' + t.dec + '), CIRCLE(\'ICRS\', ' + where.ra.toFixed(5) + ', ' + where.dec.toFixed(5) + ', ' + rad.toFixed(4) + ')) ORDER BY ' + t.g + ' ASC';
      try {
        const res = await f(t.url + '?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=' + encodeURIComponent(q), { signal: AbortSignal.timeout(12000) });
        if (!res.ok) { errs.push(t.name + ': HTTP ' + res.status); continue; }
        const { head, rows } = parseCsv(await res.text()), ix = (re) => head.findIndex((h) => re.test(h));
        const iRa = ix(/^(ra|RA_ICRS)$/i), iDe = ix(/^(dec|DE_ICRS)$/i), iG = ix(/^(phot_g_mean_mag|Gmag)$/i), iC = ix(/^(bp_rp|BP-RP)$/i);
        return { service: t.name, stars: rows.map((r) => [+(+r[iRa]).toFixed(5), +(+r[iDe]).toFixed(5), +(+r[iG]).toFixed(2), iC >= 0 && r[iC] !== '' ? +(+r[iC]).toFixed(2) : null]) };
      } catch (e) { errs.push(t.name + ': ' + (e.name === 'TimeoutError' ? 'timed out' : e.message)); }
    }
    notes.push('Gaia stars unavailable (' + errs.join('; ') + ').'); return { service: null, stars: [] };
  })();
  const imageJob = image ? (async () => {
    const url = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=' + encodeURIComponent('CDS/P/DSS2/color') + '&width=512&height=512&fov=' + fov_deg +
      '&projection=TAN&coordsys=icrs&ra=' + where.ra.toFixed(5) + '&dec=' + where.dec.toFixed(5) + '&format=jpg';
    try {
      const res = await f(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { notes.push('Survey image unavailable (CDS hips2fits HTTP ' + res.status + ').'); return null; }
      return { mime: 'image/jpeg', base64: toBase64(await res.arrayBuffer()), survey: 'DSS2 color (CDS/P/DSS2/color)', width: 512, height: 512 };
    } catch (e) { notes.push('Survey image unavailable (' + e.message + ').'); return null; }
  })() : Promise.resolve(null);
  const [st, img] = await Promise.all([starsJob, imageJob]);
  // Bright stars Gaia saturates on: add base-catalog stars in the field (V as an approximation of G).
  const bright = STARS.stars.filter((s) => s[COL.V] < mag_limit && angSep(where.ra, where.dec, s[COL.ra_h] * 15, s[COL.dec_deg]) < rad)
    .filter((s) => !st.stars.some((g) => angSep(g[0], g[1], s[COL.ra_h] * 15, s[COL.dec_deg]) < 0.002))
    .map((s) => [+(s[COL.ra_h] * 15).toFixed(5), +s[COL.dec_deg].toFixed(5), +s[COL.V], s[COL.BV] === '' ? null : +s[COL.BV], s[COL.name]]);
  const step = STEPS.reduce((a, b) => (Math.abs(b[1] - mag_limit) < Math.abs(a[1] - mag_limit) ? b : a));
  return {
    target: target || null, resolved_as: where.resolved_as, ra_deg: +where.ra.toFixed(5), dec_deg: +where.dec.toFixed(5), fov_deg, mag_limit, instrument: step[0],
    stars_found: st.stars.length + bright.length, gaia_service: st.service, capped: st.stars.length >= Math.min(Math.max(50, max_stars | 0), 3000),
    brightest: [...bright, ...st.stars].sort((a, b) => a[2] - b[2]).slice(0, 5).map((s) => ({ name: s[4] || null, mag: s[2], ra: s[0], dec: s[1] })),
    image: img ? { survey: img.survey } : null, notes,
    eyepiece: { ra: where.ra, dec: where.dec, fov_deg, mag_limit, steps: STEPS, stars: st.stars, bright, image: img,
      credit: 'Stars: ESA/Gaia/DPAC (CC BY-SA 3.0 IGO) via ' + (st.service || '-') + '. Image: DSS2 via CDS hips2fits (Digitized Sky Survey, STScI/NASA).' },
    provenance: { stars: 'catalog (Gaia DR3; bright stars from the base catalog)', image: 'survey photograph (DSS2), shown dimmer at lower magnification to suggest what each instrument reveals; it is not an instrument simulation' },
  };
}

module.exports = { starRow, skyRegion, resolveName, STEPS, streamCatalogRegion, gaiaRowsToStars, regionQuery, routeTrigger, exoplanetSystem, densifyRegion, buildGalaxy, skyCheck, parseDate, findStar, GALAXIES };
