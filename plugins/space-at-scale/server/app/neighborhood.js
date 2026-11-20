// Space-at-Scale solar neighborhood: the real sky and the nearest real stars inside the solar system scale,
// plus a frame that runs any known star system (binaries and planets) in the same simulation time.
//
// Data: neighborhood.json (built by server/tools/build-neighborhood.py from HYG v4.1 and the Open Exoplanet Catalogue):
//   nearby: the 250 nearest stars at true heliocentric ecliptic positions in AU, with space velocity in AU/yr
//   sky:    every other star to magnitude 7 as a direction on the sky (replaces the decorative random starfield)
// Systems: the star_system tool on the server (Open Exoplanet Catalogue, 4,081 systems).
(function () {
  'use strict';
  const NB = { data: null, pts: null, labels: [], sel: -1, frame: null };
  const J2000 = 2451545, SKY_R = 9e5;
  const inHost = window.parent !== window;
  const yearsFromJ2000 = () => Math.max(-1e6, Math.min(1e6, (jd - J2000) / 365.25)); // straight-line motion is valid for about a million years
  const posOf = (s, t) => [s.pos[0] + s.vel[0] * t, s.pos[1] + s.vel[1] * t, s.pos[2] + s.vel[2] * t];

  function label(text, color) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '22px sans-serif';
    c.width = Math.ceil(g.measureText(text).width) + 8; c.height = 28; g.font = '22px sans-serif'; g.fillStyle = color || '#9fc6ff'; g.fillText(text, 4, 21);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, depthTest: false, sizeAttenuation: false, transparent: true }));
    s.scale.set(c.width / 1100, c.height / 1100, 1); s.center.set(-0.05, 0.5); return s;
  }

  function init(d) {
    NB.data = d;
    // 1. real sky: replace the random starfield with every star to magnitude 7 at its true direction
    if (typeof starLayers !== 'undefined') starLayers.forEach((p) => { p.visible = false; });
    const buckets = [[-2, 2.5, 3.2], [2.5, 4.5, 2.1], [4.5, 7.1, 1.15]];
    buckets.forEach(([lo, hi, size]) => {
      const sel = d.sky.filter((s) => s[2] >= lo && s[2] < hi), pos = new Float32Array(sel.length * 3), col = new Float32Array(sel.length * 3);
      sel.forEach((s, i) => {
        const v = eq2ecl(s[0], s[1]); pos.set([v[0] * SKY_R, v[2] * SKY_R, -v[1] * SKY_R], 3 * i);
        const c = bvColor(s[3]), k = Math.max(0.25, Math.min(1, Math.pow(10, -0.4 * (s[2] - lo)) * 1.15)); col.set([c.r * k, c.g * k, c.b * k], 3 * i);
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false })); p.frustumCulled = false; scene.add(p);
    });
    // 2. nearest stars at their true positions in AU, moving with the solar-system clock
    const n = d.nearby.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    d.nearby.forEach((s, i) => { const c = bvColor(s.ci === null ? 0.65 : s.ci); col.set([c.r, c.g, c.b], 3 * i); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    NB.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, depthWrite: false })); NB.pts.frustumCulled = false; scene.add(NB.pts);
    d.nearby.forEach((s, i) => { if (s.system || i < 40) { const l = label(s.name, s.system ? '#5DCAA5' : '#9fc6ff'); l.userData.i = i; scene.add(l); NB.labels.push(l); } });
    window.SAS_NEAR = { data: d, find, select, openSystem };
  }

  // keep the nearby stars where the solar system view is centered (the Sun is not always the origin)
  (function loop() {
    if (NB.pts) {
      const t = yearsFromJ2000(), sun = byName.Sun.w, a = NB.pts.geometry.attributes.position, show = !lb.on && !gx.on;
      NB.pts.visible = show;
      NB.data.nearby.forEach((s, i) => { const p = posOf(s, t); a.setXYZ(i, sun.x + p[0], sun.y + p[2], sun.z - p[1]); });
      a.needsUpdate = true;
      NB.labels.forEach((l) => { l.visible = show && labelsOn(); const i = l.userData.i; l.position.set(a.getX(i), a.getY(i), a.getZ(i)); });
    }
    requestAnimationFrame(loop);
  })();
  const labelsOn = () => { const b = document.getElementById('lab'); return !b || b.getAttribute('aria-pressed') !== 'false'; };

  // ---------- selection in the solar system view ----------
  let down = null;
  ren.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  ren.domElement.addEventListener('pointerup', (e) => {
    if (!NB.pts || lb.on || gx.on || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    if (typeof sel !== 'undefined' && sel) return; // a solar-system body was picked first
    if (window.SAS_AGENT && window.SAS_AGENT.magnifyOn && window.SAS_AGENT.magnifyOn()) return;
    const r = ren.domElement.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, a = NB.pts.geometry.attributes.position, v = new THREE.Vector3();
    let best = -1, bd = 12;
    for (let i = 0; i < a.count; i++) { v.set(a.getX(i), a.getY(i), a.getZ(i)).project(cam); if (v.z > 1) continue;
      const dd = Math.hypot((v.x + 1) / 2 * r.width - mx, (1 - v.y) / 2 * r.height - my); if (dd < bd) { bd = dd; best = i; } }
    if (best >= 0) select(best);
  });

  function select(i) {
    const s = NB.data.nearby[i]; NB.sel = i;
    const rows = [['Designations', [s.name].concat(s.aliases).slice(0, 6).join(' · ')], ['Distance', s.dist_ly.toFixed(2) + ' ly (' + Math.round(s.dist_ly * 63241.077).toLocaleString() + ' AU)'],
      ['Spectral type', s.spect || '—'], ['Apparent / absolute mag', (s.mag === null ? '—' : s.mag.toFixed(2)) + ' / ' + (s.absmag === null ? '—' : s.absmag.toFixed(2))],
      ['Known system', s.system ? s.system + ' (Open Exoplanet Catalogue)' : 'No planets or orbits on record']];
    tip.innerHTML = tipHTML(s.name, 'Nearby star', rows, 'Center'); tip.style.display = 'block';
    document.getElementById('tipc').onpointerdown = () => centerOn(i);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-top:8px';
    const b = document.createElement('button'); b.textContent = s.system ? 'Open system' : 'Open star'; b.style.cssText = 'font-size:12px;padding:2px 8px';
    b.onpointerdown = (ev) => { ev.stopPropagation(); openSystem(s.system || s.name); }; row.appendChild(b); tip.appendChild(row);
  }
  function centerOn(i) {
    const a = NB.pts.geometry.attributes.position, p = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i));
    const dir = cam.position.clone().sub(ctl.target).normalize(); ctl.target.copy(p); cam.position.copy(p.clone().add(dir.multiplyScalar(2e4)));
  }
  function find(q) {
    if (!NB.data) return -1;
    const k = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, ''), n = k(q); if (!n) return -1;
    const L = NB.data.nearby;
    let i = L.findIndex((s) => k(s.name) === n); if (i < 0) i = L.findIndex((s) => s.aliases.some((a) => k(a) === n));
    if (i < 0 && n.length >= 4) i = L.findIndex((s) => k(s.name).startsWith(n) || s.aliases.some((a) => k(a).startsWith(n)));
    return i;
  }

  // ---------- star system frame ----------
  // Every node is a binary, star or planet with OEC elements (a AU, e, P days, w and Om deg, i deg, tp or tt JD).
  const D2R = Math.PI / 180;
  const massOf = (n) => (n.type === 'star' ? n.mass || 1 : n.type === 'binary' ? (n.kids || []).filter((k) => k.type !== 'planet').reduce((s, k) => s + massOf(k), 0) || 1 : 0);
  function kepler(M, e) { let E = M; for (let k = 0; k < 12; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function orbitPos(el, jdNow, M) {
    const a = el.a, e = Math.min(el.e || 0, 0.95), w = (el.w || 0) * D2R, Om = (el.Om || 0) * D2R, inc = (el.i !== undefined ? el.i : 0) * D2R;
    let Mean;
    if (el.tp && el.P) Mean = 2 * Math.PI * ((jdNow - el.tp) / el.P);
    else if (el.tt && el.P) { const f0 = Math.PI / 2 - w, E0 = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(f0 / 2)); Mean = E0 - e * Math.sin(E0) + 2 * Math.PI * ((jdNow - el.tt) / el.P); }
    else Mean = 2 * Math.PI * ((jdNow - J2000) / (el.P || 365.25 * Math.sqrt(Math.pow(a, 3) / (M || 1)))) + (el.L || 0) * D2R;
    const E = kepler(((Mean % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e), xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
    return [(cO * cw - sO * sw * ci) * xo + (-cO * sw - sO * cw * ci) * yo, (sO * cw + cO * sw * ci) * xo + (-sO * sw + cO * cw * ci) * yo, (sw * si) * xo + (cw * si) * yo];
  }
  function fillA(n, hostMass) { if (!n.a && n.P && n.type === 'planet') n.a = Math.cbrt(hostMass * Math.pow(n.P / 365.25, 2)); return n.a; }

  function buildFrame() {
    const f = document.createElement('div');
    f.style.cssText = 'position:absolute;top:44px;right:8px;width:560px;max-width:94%;background:rgba(5,8,16,0.97);border:1px solid #2a3b55;border-radius:8px;padding:8px;z-index:9;color:#cfe3ff;font:12px system-ui,sans-serif;display:none';
    f.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b id="sf-title"></b><button id="sf-x" title="Close">×</button></div>' +
      '<div id="sf-focus" style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0"></div><div id="sf-host" style="height:400px;overflow:hidden;border-radius:4px"></div>' +
      '<div id="sf-info" style="opacity:.85;margin-top:6px;max-height:120px;overflow:auto"></div>';
    (document.getElementById('wrap') || document.body).appendChild(f);
    const ren2 = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); ren2.setPixelRatio(Math.min(2, devicePixelRatio || 1)); ren2.domElement.style.display = 'block';
    f.querySelector('#sf-host').appendChild(ren2.domElement);
    const cam2 = new THREE.PerspectiveCamera(45, 1, 1e-6, 1e8), ctl2 = new THREE.OrbitControls(cam2, ren2.domElement);
    f.querySelector('#sf-x').onclick = () => { f.style.display = 'none'; NB.frame.sys = null; };
    return { div: f, ren: ren2, cam: cam2, ctl: ctl2, sys: null, bodies: [], scene: null, follow: null };
  }
  async function openSystem(name) {
    if (!inHost) { note('Star systems open inside Claude.'); return; }
    try {
      const r = await window.SAS_AGENT.callTool('star_system', { name });
      if (!r || r.isError) { note((r && r.content && r.content[0] && r.content[0].text) || 'No system found.'); return; }
      showSystem(r.structuredContent);
    } catch (e) { note('System: ' + e.message); }
  }
  function showSystem(sc) {
    if (!NB.frame) NB.frame = buildFrame();
    const F = NB.frame, sys = sc.starsystem; F.sys = sys; F.div.style.display = 'block';
    F.scene = new THREE.Scene(); F.scene.add(new THREE.AmbientLight(0xffffff, 1)); F.bodies = [];
    const SPT = { O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff', G: '#fff4ea', K: '#ffd2a1', M: '#ffb56b' };
    const mk = (color, size) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, depthWrite: false })); p.frustumCulled = false; F.scene.add(p); return p; };
    // walk the tree: each node gets a parent, an orbit (relative to its parent's barycenter) and a mass share for binaries
    (function walk(n, parent, hostMass) {
      for (const k of n.kids || []) {
        const b = { node: k, parent, pts: null, orbit: null, frac: 0, name: (k.names && k.names[0]) || 'binary' };
        if (k.type === 'planet') { fillA(k, hostMass); b.pts = mk(k.status === 'confirmed' ? '#5DCAA5' : '#8a8f99', 4); }
        else if (k.type === 'star') b.pts = mk(SPT[(k.spect || 'G')[0]] || '#ffffff', 9);
        if (b.pts) { const l = label(b.name + (k.type === 'planet' && k.status !== 'confirmed' ? ' (' + k.status + ')' : ''), k.type === 'star' ? '#ffe9c4' : '#9fd8c6'); F.scene.add(l); b.lab = l; }
        F.bodies.push(b);
        walk(k, b, k.type === 'star' ? k.mass || 1 : massOf(k));
      }
    })(sys, null, 1);
    // binary members split the relative orbit by mass: the two non-planet children of a binary share its orbit
    F.bodies.forEach((b) => {
      const par = b.parent && b.parent.node;
      if (par && par.type === 'binary' && b.node.type !== 'planet') {
        const sib = (par.kids || []).filter((k) => k.type !== 'planet'), m = sib.map(massOf), tot = m[0] + (m[1] || 0) || 1, idx = sib.indexOf(b.node);
        b.frac = idx === 0 ? -(m[1] || 0) / tot : m[0] / tot; b.binary = par;
      }
      if (b.node.type === 'planet' && b.node.a) { // orbit line around the host
        const pts = []; for (let k = 0; k <= 180; k++) { const t = J2000 + (b.node.P || 365.25) * k / 180; pts.push(new THREE.Vector3(...xyz(orbitPos(b.node, t, hostMassOf(b))))); }
        b.orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: b.node.status === 'confirmed' ? 0x2f7a66 : 0x4a4f58 })); F.scene.add(b.orbit);
      }
    });
    // focus buttons: one per star, plus the whole system
    const fb = F.div.querySelector('#sf-focus'); fb.innerHTML = '';
    const addBtn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; fb.appendChild(b); };
    addBtn('Whole system', () => focus(null));
    F.bodies.filter((b) => b.node.type === 'star').forEach((b) => addBtn(b.name, () => focus(b)));
    const stars = F.bodies.filter((b) => b.node.type === 'star').map((b) => b.name), planets = F.bodies.filter((b) => b.node.type === 'planet');
    F.div.querySelector('#sf-title').textContent = sys.name + (sys.dist_pc ? ' · ' + (sys.dist_pc * 3.26156).toFixed(2) + ' ly' : '');
    F.div.querySelector('#sf-info').innerHTML = stars.length + ' star' + (stars.length === 1 ? '' : 's') + ' (' + stars.join(', ') + ') · ' + planets.length + ' planet' + (planets.length === 1 ? '' : 's') + ': ' +
      planets.map((p) => p.name + ' (' + p.node.status + (p.node.a ? ', ' + (+p.node.a.toPrecision(3)) + ' AU' : '') + (p.node.P ? ', ' + (+p.node.P.toPrecision(4)) + ' d' : '') + ')').join('; ') +
      '. <br>Same simulation time as the main view. Orbit orientation and phase come from the catalog where known; otherwise orbits are drawn face-on from J2000. Data: Open Exoplanet Catalogue (MIT).';
    focus(F.bodies.find((b) => b.node.type === 'star' && F.bodies.some((p) => p.node.type === 'planet' && p.parent === b)) || null);
  }
  const xyz = (p) => [p[0], p[2], -p[1]];
  function hostMassOf(b) { let p = b.parent; while (p && p.node.type !== 'star') p = p.parent; return p ? p.node.mass || 1 : 1; }
  function worldPos(b, t, memo) {
    if (memo.has(b)) return memo.get(b);
    let base = b.parent ? worldPos(b.parent, t, memo) : [0, 0, 0], off = [0, 0, 0];
    if (b.node.type === 'planet' && b.node.a) off = orbitPos(b.node, t, hostMassOf(b));
    else if (b.binary && b.binary.a) { const r = orbitPos(b.binary, t, massOf(b.binary)); off = r.map((v) => v * b.frac); }
    const p = [base[0] + off[0], base[1] + off[1], base[2] + off[2]]; memo.set(b, p); return p;
  }
  function focus(b) {
    const F = NB.frame; F.follow = b;
    let ext;
    if (!b) ext = Math.max(1, ...F.bodies.map((x) => (x.node.a || 0) * (x.node.type === 'planet' ? 1 : 1.2)));
    else { const ps = F.bodies.filter((p) => p.node.type === 'planet' && p.parent === b && p.node.a); ext = ps.length ? Math.max(...ps.map((p) => p.node.a)) * 1.6 : 0.05; }
    F.cam.position.set(0, ext * 1.2, ext * 2.2); F.ctl.target.set(0, 0, 0); F.ext = ext;
  }
  (function frameLoop() {
    const F = NB.frame;
    if (F && F.sys && F.div.style.display !== 'none') {
      const host = F.div.querySelector('#sf-host'), w = host.clientWidth || 540, h = host.clientHeight || 400;
      if (F.ren.domElement.width !== Math.floor(w * F.ren.getPixelRatio())) { F.ren.setSize(w, h); F.cam.aspect = w / h; F.cam.updateProjectionMatrix(); }
      const memo = new Map(), center = F.follow ? worldPos(F.follow, jd, memo) : [0, 0, 0];
      F.bodies.forEach((b) => {
        const p = worldPos(b, jd, memo), q = xyz([p[0] - center[0], p[1] - center[1], p[2] - center[2]]);
        if (b.pts) { b.pts.position.set(...q); if (b.lab) b.lab.position.set(...q); }
        if (b.orbit) { const hp = worldPos(b.parent, jd, memo); b.orbit.position.set(...xyz([hp[0] - center[0], hp[1] - center[1], hp[2] - center[2]])); }
      });
      F.ctl.update(); F.ren.render(F.scene, F.cam);
    }
    requestAnimationFrame(frameLoop);
  })();

  // Results from Claude (star_system run in the chat) open the frame too.
  window.SAS_SYSTEM = { showSystem, openSystem };
  const load = window.__NEIGHBORHOOD ? Promise.resolve(window.__NEIGHBORHOOD) : fetch('neighborhood.json').then((r) => r.json());
  load.then(init).catch((e) => console.warn('neighborhood data failed to load', e));
})();
