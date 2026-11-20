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
    { id: 'catalog-fill', event: 'star.select', label: 'Fill region', action: { kind: 'tool', tool: 'stream_catalog_region', args: (c) => ({ center: c.name, radius_ly: 20 }) } },
    { id: 'census-estimate', event: 'star.select', label: 'Census estimate', action: { kind: 'tool', tool: 'densify_region', args: (c) => ({ center: c.name, radius_ly: 20 }) } },
    // Zoom hook: when the camera comes within 40 ly of the star the view is centered on, stream that region once.
    { id: 'catalog-on-zoom', event: 'zoom.region', auto: true, action: { kind: 'tool', tool: 'stream_catalog_region', args: (c) => ({ center: c.name, radius_ly: 20 }) } },
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
      if (t.auto) { const key = t.id + ':' + JSON.stringify(ctx.name || ''); if (!agentState.seen.has(key)) { agentState.seen.add(key); run(t, ctx); } }
      else manual.push(t);
    }
    return manual;
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
    const O = lbOrigin(); bubbleRoot.position.set(-O[0], -O[2], O[1]);
    if (lb.on && lb.data && lb.view.startsWith('star:') && lbCam.position.length() < 40) {
      const i = +lb.view.slice(5), s = lb.data.stars[i];
      if (s) fire('zoom.region', { name: s[0] });
    }
    if (gx.on) { const G = gxOrigin(); galaxyRoot.position.set(-G[0] * KLY_PER_KPC, -G[2] * KLY_PER_KPC, G[1] * KLY_PER_KPC); }
    requestAnimationFrame(follow);
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
    menuBtns.forEach(([t, b]) => { const show = agentState.on && (t.event === 'galaxy.menu' ? gx.on : true); b.style.display = show ? '' : 'none'; });
    requestAnimationFrame(sync);
  })();

  window.SAS_AGENT = { TRIGGERS, fire, run, callTool, askAgent, drawLayer, onResult, focusStar, findStarIndex, layers, state: agentState };
})();
