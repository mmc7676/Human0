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
    render: { layer: 'exo:' + st.name, scale: 'bubble', frame: 'helio_ly', label: st.name + ' planets',
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
    render: { layer: 'dense:' + st.name + ':' + radius_ly, scale: 'bubble', frame: 'helio_ly', label: 'Synthetic stars around ' + st.name,
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

module.exports = { exoplanetSystem, densifyRegion, buildGalaxy, skyCheck, parseDate, findStar, GALAXIES };
