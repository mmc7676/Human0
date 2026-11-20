// Space-at-Scale agent bridge: host connection, trigger table ("hooks") and agent overlay layers.
//
// 1. Host connection (MCP Apps): ui/initialize, tools/call through the host, ui/message into the chat,
//    and ui/notifications/tool-result from tools Claude runs. Outside Claude (the web build) it stays idle.
// 2. Triggers: a data table maps app events to actions. kind 'tool' calls a server tool directly (no model, instant);
//    kind 'agent' sends a structured trigger message so Claude hands the job to a Space-at-Scale agent.
// 3. Overlays: any tool result with a `render` payload is drawn as a layer in the Local Bubble or Milky Way scale.
(function () {
  'use strict';
  const inHost = window.parent !== window;

  // ---------- 1. host connection ----------
  let nextId = 1, ready = false;
  const pending = new Map(), queue = [];
  const send = (m) => window.parent.postMessage(m, '*');
  function request(method, params) {
    if (!inHost) return Promise.reject(new Error('Not running inside Claude'));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const msg = { jsonrpc: '2.0', id, method, params };
      if (ready || method === 'ui/initialize') send(msg); else queue.push(msg);
    });
  }
  const size = () => inHost && send({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { height: Math.ceil(document.documentElement.scrollHeight) } });
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && pending.has(m.id) && (m.result !== undefined || m.error)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message || 'host error')) : p.resolve(m.result);
      return;
    }
    if (m.method === 'ui/notifications/tool-result' && m.params) onResult(m.params, 'claude');
  });
  if (inHost) {
    request('ui/initialize', { appInfo: { name: 'space-at-scale', version: '0.17.0' },
      appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] }, protocolVersion: '2026-01-26' })
      .then(() => { ready = true; send({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }); queue.splice(0).forEach(send); size(); })
      .catch(() => {});
    new ResizeObserver(size).observe(document.body);
  }
  const callTool = (name, args) => request('tools/call', { name, arguments: args || {} });
  const askAgent = (text) => request('ui/message', { role: 'user', content: [{ type: 'text', text }] });

  // ---------- 2. trigger table (the app's hooks) ----------
  // event: what happened in the app. when: extra condition. action.kind: 'tool' (direct) or 'agent' (message to Claude).
  const TRIGGERS = [
    { id: 'exoplanets-on-select', event: 'star.select', when: (c) => c.planets > 0, auto: true,
      action: { kind: 'tool', tool: 'exoplanet_system', args: (c) => ({ star: c.name }) } },
    // Selecting a star is a magnification target: the button adds the real Gaia stars around it at the current magnification.
    { id: 'catalog-fill', event: 'star.select', label: 'Show nearby stars', action: { kind: 'tool', tool: 'stream_catalog_region', args: (c) => ({ center: c.name, radius_ly: 15, mag_limit: magLevel() }) } },
    // Zoom hook: when the camera comes within 40 ly of the star the view is centered on, its neighborhood streams in once per magnification level.
    { id: 'catalog-on-zoom', event: 'zoom.region', auto: true, action: { kind: 'tool', tool: 'stream_catalog_region', args: (c) => ({ center: c.name, radius_ly: 15, mag_limit: magLevel() }) } },
    { id: 'agent-star', event: 'star.select', label: 'Ask agent', action: { kind: 'agent', agent: 'space-architect',
      text: (c) => 'Investigate the star ' + c.name + ' (' + c.distance + ' ly). Add what the catalogs and models support: its planets, the crowded region around it, and anything notable about it.' } },
    { id: 'build-andromeda', event: 'galaxy.menu', label: 'Build Andromeda', action: { kind: 'tool', tool: 'build_galaxy', args: () => ({ name: 'Andromeda' }) } },
    { id: 'build-triangulum', event: 'galaxy.menu', label: 'Build Triangulum', action: { kind: 'tool', tool: 'build_galaxy', args: () => ({ name: 'Triangulum' }) } },
    { id: 'agent-sky', event: 'date.menu', label: 'Sky experiment', action: { kind: 'agent', agent: 'sky-historian',
      text: (c) => 'Run a historical sky experiment for ' + c.date + ': which simulated comets and asteroids were close to Earth then, and were any visible to the naked eye?' } },
  ];
  const agentState = { on: true, seen: new Set() };

  async function run(trigger, ctx) {
    const a = trigger.action;
    if (!inHost) return; // outside Claude there is no server or chat to reach
    try {
      if (a.kind === 'tool') {
        note('Agent: ' + (trigger.label || trigger.id) + '…');
        const r = await callTool(a.tool, a.args(ctx));
        if (r && r.isError) note('Agent: ' + ((r.content && r.content[0] && r.content[0].text) || 'tool error'));
        else onResult(r, 'app');
      } else {
        await askAgent('[Space-at-Scale trigger] event=' + trigger.event + ' agent=' + a.agent + '\n' + a.text(ctx));
        note('Sent to Claude: the ' + a.agent + ' agent will answer in the conversation.');
      }
    } catch (e) { note('Agent: ' + e.message); }
  }
  function fire(event, ctx) {
    if (!agentState.on) return [];
    const manual = [];
    for (const t of TRIGGERS) {
      if (t.event !== event || (t.when && !t.when(ctx))) continue;
      if (t.auto) { const key = t.id + ':' + JSON.stringify(ctx.name || '') + ':' + magLevel(); if (!agentState.seen.has(key)) { agentState.seen.add(key); run(t, ctx); } }
      else manual.push(t);
    }
    return manual;
  }


  // ---------- real catalog stars added to the Local Bubble ----------
  // Streamed Gaia stars become rows of lb.data.stars: the existing picker selects them, Center works, they move with
  // the Bubble clock, and the star count line counts them. Nothing is generated.
  const MAG_LEVELS = [['Naked eye', 6], ['Binoculars', 9.5], ['Small telescope', 13], ['Large telescope', 16], ['Gaia limit', 19]];
  let magIdx = 1; const magLevel = () => MAG_LEVELS[magIdx][1];
  const added = { start: -1, names: new Set(), pts: null, baseText: null };
  function appendStars(rows) {
    if (!lb.data) return 0;
    const S = lb.data.stars; if (added.start < 0) { added.start = S.length; S.forEach((s) => added.names.add(s[0])); }
    let n = 0; for (const r of rows) if (!added.names.has(r[0])) { added.names.add(r[0]); S.push(r); n++; }
    const cnt = S.length - added.start, pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), c = new THREE.Color();
    for (let k = 0; k < cnt; k++) { const s = S[added.start + k]; c.set(typeof bvColor === 'function' && s[9] !== '' ? bvColor(parseFloat(s[9])) : 0xffffff); col.set([c.r, c.g, c.b], 3 * k); }
    if (added.pts) { lbScene.remove(added.pts); added.pts.geometry.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    added.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })); added.pts.frustumCulled = false; lbScene.add(added.pts);
    const lc = document.getElementById('lbcount');
    if (lc) { if (added.baseText === null) added.baseText = lc.textContent; lc.textContent = added.baseText + ' · +' + cnt.toLocaleString() + ' Gaia DR3 stars added'; }
    return n;
  }
  function updateAdded() {
    if (!added.pts || !lb.data) return;
    const S = lb.data.stars, a = added.pts.geometry.attributes.position, O = lbOrigin();
    for (let k = 0; k < a.count; k++) { const p = starPos(S[added.start + k]); a.setXYZ(k, p[0] - O[0], p[2] - O[2], -(p[1] - O[1])); }
    a.needsUpdate = true;
  }

  // ---------- 3. overlays ----------
  const layers = new Map();
  const bubbleRoot = new THREE.Group(), galaxyRoot = new THREE.Group();
  lbScene.add(bubbleRoot); gxScene.add(galaxyRoot);
  // Scene axes: (x, z, -y) of the catalog frame; light years in the Local Bubble, thousands of light years in the galaxy.
  const KLY_PER_KPC = GXC.C.kpc_kly;
  function textSprite(text, color) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '24px sans-serif';
    c.width = Math.ceil(g.measureText(text).width) + 8; c.height = 32; g.font = '24px sans-serif'; g.fillStyle = color || '#cfe3ff'; g.fillText(text, 4, 24);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, sizeAttenuation: false }));
    s.scale.set(c.width / 900, c.height / 900, 1); return s;
  }
  function drawLayer(render) {
    const root = render.scale === 'galaxy' ? galaxyRoot : bubbleRoot, k = render.frame === 'galcen_kpc' ? KLY_PER_KPC : 1;
    const map = (p) => [p[0] * k, p[2] * k, -p[1] * k];
    if (layers.has(render.layer)) { root.remove(layers.get(render.layer)); }
    const grp = new THREE.Group();
    if (render.points && render.points.length) {
      const pos = new Float32Array(render.points.length * 3), col = new Float32Array(render.points.length * 3), c = new THREE.Color();
      render.points.forEach((p, i) => { const q = map(p); pos.set(q, 3 * i); c.set(p[3] || '#ffffff'); col.set([c.r, c.g, c.b], 3 * i); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: render.points[0][4] || 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
      pts.frustumCulled = false; grp.add(pts);
    }
    (render.rings || []).forEach((r) => {
      const ctr = map(r.center), pts = [];
      for (let i = 0; i <= 96; i++) { const a = i / 96 * 2 * Math.PI; pts.push(new THREE.Vector3(ctr[0] + r.r * k * Math.cos(a), ctr[1], ctr[2] + r.r * k * Math.sin(a))); }
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: r.color || '#5DCAA5', transparent: true, opacity: 0.8 })));
    });
    (render.labels || []).forEach(([t, x, y, z]) => { const s = textSprite(t); s.position.set(...map([x, y, z])); grp.add(s); });
    grp.userData = render; root.add(grp); layers.set(render.layer, grp);
  }
  function onResult(result, source) {
    const sc = result && result.structuredContent, render = sc && sc.render;
    if (sc && sc.catalog) {
      if (!lb.on) enterLB(false);
      const go = () => { const n = appendStars(sc.catalog.stars); if (Number.isInteger(sc.catalog.focus)) focusStar(sc.catalog.focus); note(sc.catalog.note + (n < sc.catalog.stars.length ? ' (' + (sc.catalog.stars.length - n) + ' were already shown)' : '')); };
      lb.data ? go() : setTimeout(go, 1500); return;
    }
    if (sc && sc.eyepiece) { showEyepiece(sc.eyepiece, (sc.resolved_as ? sc.resolved_as.trim() + ' · ' : '') + sc.instrument); return; }
    if (!render) return;
    if (render.scale === 'galaxy') { if (!gx.on) enterGX(false); } else if (!lb.on) enterLB(false);
    drawLayer(render);
    if (render.scale !== 'galaxy' && Number.isInteger(render.focus) && lb.data && lb.data.stars[render.focus]) focusStar(render.focus);
    note((source === 'claude' ? 'Agent result: ' : '') + (render.note || render.label));
  }
  // Center the Local Bubble view on a catalog star and open its panel.
  function focusStar(i) {
    lb.view = 'star:' + i; lbCtl.target.set(0, 0, 0); lb.sel = { i }; lb.starIdx = i;
    const sel = document.getElementById('lbv'); if (sel && [...sel.options].some((o) => o.value === lb.view)) sel.value = lb.view;
    try { lbTip(); } catch (e) {}
  }
  function findStarIndex(q) {
    if (!lb.data) return -1;
    const n = String(q).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (!n) return -1;
    const S = lb.data.stars, norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    let i = S.findIndex((s) => norm(s[0]) === n);
    if (i < 0) i = S.findIndex((s) => (' ' + norm(s[1]) + ' ').includes(' ' + n + ' '));
    if (i < 0) i = S.findIndex((s) => norm(s[0]).includes(n));
    return i;
  }
  // Keep overlay roots aligned with whatever the view is centered on.
  (function follow() {
    const O = lbOrigin(); bubbleRoot.position.set(-O[0], -O[2], O[1]); if (lb.on) updateAdded();
    if (lb.on && lb.data && lb.view.startsWith('star:') && lbCam.position.length() < 40) {
      const i = +lb.view.slice(5), s = lb.data.stars[i];
      if (s) fire('zoom.region', { name: s[0] });
    }
    if (gx.on) { const G = gxOrigin(); galaxyRoot.position.set(-G[0] * KLY_PER_KPC, -G[2] * KLY_PER_KPC, G[1] * KLY_PER_KPC); }
    requestAnimationFrame(follow);
  })();


  // ---------- magnification (eyepiece) ----------
  // Drag a box on any view while Magnify is on: the box center becomes a sky direction (RA/Dec), its height the field
  // of view; the eyepiece shows real Gaia stars to the chosen limiting magnitude over a survey image of that field.
  const EPS = 23.43928 * Math.PI / 180;
  let EQ_FROM_GAL = null;
  function galToEq(g) {
    if (!EQ_FROM_GAL) EQ_FROM_GAL = [GXC.galHelio(0, 0, 1), GXC.galHelio(90, 0, 1), GXC.galHelio(0, 90, 1)];
    return EQ_FROM_GAL.map((b) => b[0] * g[0] + b[1] * g[1] + b[2] * g[2]);
  }
  function sceneDirToRaDec(d, frame) {
    let e;
    if (frame === 'ecliptic') { const x = d.x, y = -d.z, z = d.y; e = [x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS)]; }
    else e = galToEq([d.x, -d.z, d.y]);
    const n = Math.hypot(e[0], e[1], e[2]);
    return { ra: ((Math.atan2(e[1], e[0]) * 180 / Math.PI) + 360) % 360, dec: Math.asin(e[2] / n) * 180 / Math.PI };
  }
  const activeView = () => (gx.on ? { cam: gxCam, frame: 'galactic', ctl: gxCtl } : lb.on ? { cam: lbCam, frame: 'galactic', ctl: lbCtl } : { cam, frame: 'ecliptic', ctl });
  const mag = { on: false, box: null, start: null, ep: null, req: 0 };
  const boxDiv = document.createElement('div');
  boxDiv.style.cssText = 'position:absolute;border:1px solid #7fd3ff;background:rgba(127,211,255,0.08);pointer-events:none;display:none;z-index:6';
  (document.getElementById('wrap') || document.body).appendChild(boxDiv);
  const cv = ren.domElement;
  function setMagnify(on) {
    mag.on = on; [ctl, lbCtl, gxCtl].forEach((c) => { if (c) c.enabled = !on; });
    cv.style.cursor = on ? 'crosshair' : '';
  }
  cv.addEventListener('pointerdown', (e) => { if (!mag.on) return; const r = cv.getBoundingClientRect(); mag.start = [e.clientX - r.left, e.clientY - r.top]; boxDiv.style.display = 'block'; e.stopPropagation(); }, true);
  cv.addEventListener('pointermove', (e) => {
    if (!mag.on || !mag.start) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, s = mag.start;
    Object.assign(boxDiv.style, { left: (cv.offsetLeft + Math.min(s[0], x)) + 'px', top: (cv.offsetTop + Math.min(s[1], y)) + 'px', width: Math.abs(x - s[0]) + 'px', height: Math.abs(y - s[1]) + 'px' });
  }, true);
  cv.addEventListener('pointerup', (e) => {
    if (!mag.on || !mag.start) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, s = mag.start; mag.start = null; boxDiv.style.display = 'none';
    const cx = (s[0] + x) / 2, cy = (s[1] + y) / 2, h = Math.max(Math.abs(y - s[1]), Math.abs(x - s[0]));
    const v = activeView(), rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(cx / r.width * 2 - 1, -(cy / r.height) * 2 + 1), v.cam);
    const sky = sceneDirToRaDec(rc.ray.direction, v.frame);
    const fov = Math.min(10, Math.max(0.05, h < 8 ? 1 : h / r.height * v.cam.fov));
    setMagnify(false);
    const box = [Math.min(s[0], x), Math.min(s[1], y), Math.max(s[0], x), Math.max(s[1], y)];
    if (lb.on && !gx.on) { // Local Bubble: add the real stars along that line of sight
      run({ id: 'magnify-cone', label: 'Magnify', action: { kind: 'tool', tool: 'stream_catalog_region', args: () => ({ ra: +sky.ra.toFixed(4), dec: +sky.dec.toFixed(4), radius_deg: +Math.min(10, Math.max(0.1, fov / 2)).toFixed(3), max_distance_ly: 1000, mag_limit: magLevel() }) } }, {});
    } else if (!lb.on && !gx.on) { // Solar system: a planet inside the box opens its system; otherwise look at the sky there
      const planet = planetInBox(box, r);
      if (planet) openPlanetFrame(planet); else openEyepiece({ ra: sky.ra, dec: sky.dec, fov_deg: +fov.toFixed(3), mag_limit: magLevel() });
    } else openEyepiece({ ra: sky.ra, dec: sky.dec, fov_deg: +fov.toFixed(3), mag_limit: magLevel() });
    e.stopPropagation();
  }, true);

  const ep = document.createElement('div');
  ep.style.cssText = 'position:absolute;top:44px;right:8px;width:500px;max-width:92%;background:rgba(5,8,16,0.96);border:1px solid #2a3b55;border-radius:8px;padding:8px;z-index:7;display:none;color:#cfe3ff;font:12px system-ui,sans-serif';
  ep.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b id="ep-title">Eyepiece</b><button id="ep-x" title="Close">×</button></div>' +
    '<div id="ep-steps" style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0"></div><canvas id="ep-cv" width="480" height="480" style="width:100%;background:#000;border-radius:4px"></canvas>' +
    '<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><button id="ep-stars">Stars: On</button><button id="ep-img">Image: On</button><span id="ep-info"></span></div><div id="ep-credit" style="opacity:.7;margin-top:4px"></div>';
  (document.getElementById('wrap') || document.body).appendChild(ep);
  const $e = (id) => ep.querySelector('#' + id), IMG_ALPHA = [0, 0.35, 0.6, 0.85, 1];
  const epState = { data: null, bitmap: null, showStars: true, showImg: true };
  $e('ep-x').onclick = () => { ep.style.display = 'none'; };
  $e('ep-stars').onclick = () => { epState.showStars = !epState.showStars; $e('ep-stars').textContent = 'Stars: ' + (epState.showStars ? 'On' : 'Off'); drawEyepiece(); };
  $e('ep-img').onclick = () => { epState.showImg = !epState.showImg; $e('ep-img').textContent = 'Image: ' + (epState.showImg ? 'On' : 'Off'); drawEyepiece(); };
  const COLORS = [[-0.3, '#9bb2ff'], [0.3, '#cad7ff'], [0.8, '#fff4ea'], [1.2, '#ffd2a1'], [2.0, '#ffb56b'], [9, '#ff8a4a']];
  const colorOf = (c) => (c === null || c === undefined ? '#ffffff' : COLORS.find(([v]) => c <= v)[1]);
  function drawEyepiece() {
    const d = epState.data; if (!d) return;
    const g = $e('ep-cv').getContext('2d'), W = 480, half = Math.tan(d.fov_deg / 2 * Math.PI / 180), D = Math.PI / 180;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
    const stepIdx = d.steps.findIndex((s) => s[1] === d.mag_limit);
    if (epState.showImg && epState.bitmap) { g.globalAlpha = IMG_ALPHA[stepIdx < 0 ? 2 : stepIdx]; g.drawImage(epState.bitmap, 0, 0, W, W); g.globalAlpha = 1; }
    const a0 = d.ra * D, d0 = d.dec * D, sd0 = Math.sin(d0), cd0 = Math.cos(d0);
    const proj = (ra, dec) => { const a = ra * D - a0, dd = dec * D, c = sd0 * Math.sin(dd) + cd0 * Math.cos(dd) * Math.cos(a); if (c <= 0) return null;
      const X = Math.cos(dd) * Math.sin(a) / c, Y = (cd0 * Math.sin(dd) - sd0 * Math.cos(dd) * Math.cos(a)) / c; return [W / 2 - X / half * W / 2, W / 2 - Y / half * W / 2]; };
    if (epState.showStars) {
      const all = d.stars.concat(d.bright);
      for (const s of all) { const p = proj(s[0], s[1]); if (!p || p[0] < -4 || p[0] > W + 4 || p[1] < -4 || p[1] > W + 4) continue;
        const r = Math.max(0.7, (d.mag_limit - s[2]) * 0.55 + 0.7); g.fillStyle = colorOf(s[3]); g.beginPath(); g.arc(p[0], p[1], r, 0, 2 * Math.PI); g.fill();
        if (s[4]) { g.fillStyle = '#cfe3ff'; g.fillText(s[4], p[0] + r + 3, p[1] + 3); } }
    }
    $e('ep-info').textContent = (d.stars.length + d.bright.length).toLocaleString() + ' stars to mag ' + d.mag_limit + ' · field ' + d.fov_deg + '°';
  }
  function renderSteps(d) {
    const box = $e('ep-steps'); box.innerHTML = '';
    d.steps.forEach(([label, m]) => { const b = document.createElement('button'); b.textContent = label + ' (' + m + ')';
      b.setAttribute('aria-pressed', String(m === d.mag_limit)); if (m === d.mag_limit) b.style.outline = '1px solid #7fd3ff';
      b.onclick = () => openEyepiece({ ra: d.ra, dec: d.dec, fov_deg: d.fov_deg, mag_limit: m, image: !epState.bitmap }); box.appendChild(b); });
  }
  async function showEyepiece(d, title) {
    epState.data = d; ep.style.display = 'block';
    $e('ep-title').textContent = title || ('RA ' + d.ra.toFixed(3) + '°, Dec ' + d.dec.toFixed(3) + '°');
    $e('ep-credit').textContent = d.credit + (d.image ? ' · Image shown dimmer at lower magnification.' : '');
    if (d.image && d.image.base64) {
      try { const bin = atob(d.image.base64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        epState.bitmap = await createImageBitmap(new Blob([u], { type: d.image.mime })); } catch (e) { epState.bitmap = null; }
    }
    renderSteps(d); drawEyepiece();
  }
  async function openEyepiece(args) {
    if (!inHost) return;
    const my = ++mag.req; ep.style.display = 'block'; $e('ep-info').textContent = 'Looking…';
    if (args.image !== false) epState.bitmap = null;
    try {
      const r = await callTool('sky_region', args);
      if (my !== mag.req) return;
      const sc = r && r.structuredContent;
      if (!sc || r.isError) { $e('ep-info').textContent = (r && r.content && r.content[0] && r.content[0].text) || 'No result'; return; }
      showEyepiece(sc.eyepiece, (sc.resolved_as ? sc.resolved_as.trim() + ' · ' : '') + sc.instrument);
      if (sc.notes && sc.notes.length) note(sc.notes.join(' '));
    } catch (e) { $e('ep-info').textContent = e.message; }
  }


  // ---------- planet system frame (solar system magnification) ----------
  // A closeable frame with its own renderer: the planet, its rings and its moons at true relative scale, in the same
  // simulation time as the main view (moon phases use the same circular-orbit model as the solar system scale).
  const RINGS = { Saturn: [[1.24, 2.27, 0xcbb98f, 0.75]], Jupiter: [[1.72, 1.81, 0x8a7a6a, 0.25]], Uranus: [[1.64, 2.0, 0x8fa7b3, 0.35]], Neptune: [[1.69, 2.54, 0x8f9fc0, 0.25]] };
  function planetInBox(box, r) {
    const v = new THREE.Vector3(); let best = null, bd = 1e9;
    Object.keys(MO).forEach((name) => { const b = byName[name]; if (!b || !b.mesh || b.gone) return; v.copy(b.w).project(cam); if (v.z > 1) return;
      const px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height; if (px < box[0] - 6 || px > box[2] + 6 || py < box[1] - 6 || py > box[3] + 6) return;
      const d = Math.hypot(px - (box[0] + box[2]) / 2, py - (box[1] + box[3]) / 2); if (d < bd) { bd = d; best = name; } });
    return best;
  }
  const pf = { name: null, ren: null, scene: null, cam: null, ctl: null, moons: [], div: null };
  function openPlanetFrame(name) {
    if (!pf.div) {
      pf.div = document.createElement('div');
      pf.div.style.cssText = 'position:absolute;top:44px;right:8px;width:520px;max-width:92%;background:rgba(5,8,16,0.97);border:1px solid #2a3b55;border-radius:8px;padding:8px;z-index:8;color:#cfe3ff;font:12px system-ui,sans-serif';
      pf.div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b id="pf-title"></b><button id="pf-x" title="Close">×</button></div><div id="pf-host" style="height:380px;margin-top:6px;overflow:hidden;border-radius:4px"></div><div id="pf-info" style="opacity:.8;margin-top:4px"></div>';
      (document.getElementById('wrap') || document.body).appendChild(pf.div);
      pf.div.querySelector('#pf-x').onclick = () => { pf.div.style.display = 'none'; pf.name = null; };
      pf.ren = new THREE.WebGLRenderer({ antialias: true }); pf.ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      pf.ren.domElement.style.display = 'block'; pf.div.querySelector('#pf-host').appendChild(pf.ren.domElement);
      pf.cam = new THREE.PerspectiveCamera(45, 1, 1e-3, 1e6); pf.ctl = new THREE.OrbitControls(pf.cam, pf.ren.domElement);
    }
    pf.div.style.display = 'block'; pf.name = name;
    const b = byName[name], R = b.rkm / 1000, tl = (TILT[name] || 0) * D; // scene unit: 1,000 km
    pf.scene = new THREE.Scene(); pf.scene.add(new THREE.AmbientLight(0xffffff, 0.35)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); pf.scene.add(sun); pf.sun = sun;
    const col = b.mesh && b.mesh.material && b.mesh.material.color ? b.mesh.material.color.getHex() : 0xbbbbbb;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshStandardMaterial({ color: col, roughness: 1 })); pf.scene.add(planet);
    (RINGS[name] || []).forEach(([a, c, color, op]) => { const ring = new THREE.Mesh(new THREE.RingGeometry(a * R, c * R, 128), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: op, roughness: 1 }));
      ring.rotation.x = -Math.PI / 2 + tl; pf.scene.add(ring); });
    pf.moons = MO[name].map((m, k) => {
      const a = m[2] / 1000, orbit = [];
      for (let i = 0; i <= 128; i++) { const th = i / 128 * 2 * Math.PI; orbit.push(new THREE.Vector3(a * Math.cos(th), a * Math.sin(th) * Math.sin(tl), -a * Math.sin(th) * Math.cos(tl))); }
      pf.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbit), new THREE.LineBasicMaterial({ color: 0x3d5a80 })));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(m[3] / 1000, R * 0.01), 24, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 })); pf.scene.add(mesh);
      const lab = textSprite(m[0]); pf.scene.add(lab);
      return { m, k, a, mesh, lab };
    });
    const far = Math.max(...pf.moons.map((x) => x.a), 3 * R);
    pf.cam.position.set(0, far * 0.9, far * 1.6); pf.ctl.target.set(0, 0, 0); pf.ctl.update();
    pf.div.querySelector('#pf-title').textContent = name + ' system · true scale';
    pf.div.querySelector('#pf-info').textContent = MO[name].length + ' moons shown (' + MO[name].map((m) => m[0]).join(', ') + ') · same simulation time as the solar system · drag to orbit, scroll to zoom';
  }
  (function pfLoop() {
    if (pf.name && pf.div && pf.div.style.display !== 'none') {
      const host = pf.div.querySelector('#pf-host'), w = host.clientWidth || 500, h = host.clientHeight || 380;
      if (pf.ren.domElement.width !== Math.floor(w * pf.ren.getPixelRatio())) { pf.ren.setSize(w, h); pf.cam.aspect = w / h; pf.cam.updateProjectionMatrix(); }
      const tl = (TILT[pf.name] || 0) * D;
      pf.moons.forEach(({ m, k, a, mesh, lab }) => {
        let u;
        if (m[0] === 'Moon' && typeof moonGeo === 'function') { const g = moonGeo(jd), r = Math.hypot(...g); u = g.map((c) => c / r); }
        else { const th = 2 * Math.PI * ((jd - 2451545) / m[1] % 1) + k * 1.3; u = [Math.cos(th), Math.sin(th) * Math.cos(tl), Math.sin(th) * Math.sin(tl)]; }
        mesh.position.set(u[0] * a, u[2] * a, -u[1] * a); lab.position.copy(mesh.position);
      });
      const p = byName[pf.name].w; if (p) pf.sun.position.set(-p.x, -p.y, -p.z).normalize();
      pf.ctl.update(); pf.ren.render(pf.scene, pf.cam);
    }
    requestAnimationFrame(pfLoop);
  })();

  // ---------- hooks into the existing views ----------
  // Local Bubble: a star selection fires 'star.select'; manual triggers become buttons in the star's panel.
  const baseTip = window.lbTip;
  window.lbTip = lbTip = function () {
    baseTip.apply(this, arguments);
    const sel = lb.sel; if (!sel || sel.i === undefined || !lb.data) return;
    const s = lb.data.stars[sel.i], ctx = { name: s[0], planets: (s[17] || []).length, distance: Math.hypot(s[3], s[4], s[5]).toFixed(1) };
    const manual = fire('star.select', ctx);
    if (!manual.length) return;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';
    manual.forEach((t) => { const b = document.createElement('button'); b.textContent = t.label; b.style.cssText = 'font-size:12px;padding:2px 8px'; b.onpointerdown = (e) => { e.stopPropagation(); run(t, ctx); }; row.appendChild(b); });
    tip.appendChild(row);
  };
  // Agent menu: one toggle plus the menu triggers of the current scale.
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;top:8px;left:8px;display:flex;gap:6px;z-index:5;flex-wrap:wrap;max-width:55%';
  const toggle = document.createElement('button'); toggle.id = 'agentb';
  toggle.onclick = () => { agentState.on = !agentState.on; };
  bar.appendChild(toggle);
  const magBtn = document.createElement('button'); magBtn.id = 'magb';
  magBtn.onclick = () => setMagnify(!mag.on);
  bar.appendChild(magBtn);
  const magSel = document.createElement('select'); magSel.title = 'Magnification: how faint a star you can see';
  MAG_LEVELS.forEach(([l, m], i) => { const o = document.createElement('option'); o.value = i; o.textContent = l + ' (mag ' + m + ')'; magSel.appendChild(o); });
  magSel.value = String(magIdx); magSel.onchange = () => { magIdx = +magSel.value; }; bar.appendChild(magSel);
  const search = document.createElement('input');
  search.placeholder = 'Find star…'; search.style.cssText = 'font-size:12px;width:110px;padding:2px 6px';
  search.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    if (!lb.on) enterLB(false);
    const go = () => { const i = findStarIndex(search.value); if (i < 0) note('No naked-eye star named "' + search.value + '".'); else focusStar(i); };
    lb.data ? go() : setTimeout(go, 1500);
  };
  bar.appendChild(search);
  const menuBtns = [];
  TRIGGERS.filter((t) => t.event.endsWith('.menu')).forEach((t) => {
    const b = document.createElement('button'); b.textContent = t.label; b.style.fontSize = '12px';
    b.onclick = () => run(t, { date: $('gdate') && $('gdate').value ? $('gdate').value : 'the current simulation date' });
    menuBtns.push([t, b]); bar.appendChild(b);
  });
  if (!inHost) bar.style.display = 'none'; // the web build has its own Claude panel
  (document.getElementById('wrap') || document.body).appendChild(bar);
  (function sync() {
    const t = 'Agent: ' + (agentState.on ? 'On' : 'Off');
    if (toggle.textContent !== t) toggle.textContent = t;
    toggle.setAttribute('aria-pressed', String(agentState.on));
    const mt = 'Magnify: ' + (mag.on ? 'On' : 'Off'); if (magBtn.textContent !== mt) magBtn.textContent = mt; magBtn.setAttribute('aria-pressed', String(mag.on));
    menuBtns.forEach(([t, b]) => { const show = agentState.on && (t.event === 'galaxy.menu' ? gx.on : true); b.style.display = show ? '' : 'none'; });
    requestAnimationFrame(sync);
  })();

  window.SAS_AGENT = { appendStars, openPlanetFrame, planetInBox, magLevel, openEyepiece, showEyepiece, sceneDirToRaDec, setMagnify, TRIGGERS, fire, run, callTool, askAgent, drawLayer, onResult, focusStar, findStarIndex, layers, state: agentState };
})();
