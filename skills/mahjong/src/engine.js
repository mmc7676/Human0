/* Human0 Mahjong engine — American (NMJL-style) rules.
   SCW0 = the game container. Sub-windows: SCW1 East (goes first), SCW2 South, SCW3 West, SCW4 North.
   Pure logic, no DOM. Runs in browsers (window.MJ) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MJ = factory();
})(this, function () {
  'use strict';
  const SUITS = ['B', 'C', 'D'];
  const SUIT_NAME = { B: 'Bam', C: 'Crak', D: 'Dot' };
  const DRAGON = { B: 'XG', C: 'XR', D: 'XW' }; // matching dragons: Bam-Green, Crak-Red, Dot-Soap
  const WINDS = ['E', 'S', 'W', 'N'];             // turn order (counterclockwise around the table)
  const WIND_NAME = { E: 'East', S: 'South', W: 'West', N: 'North' };
  const DIRS = { right: 1, across: 2, left: 3 };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  /* ---------- Tiles: the full 152-tile American set (matches the photographed set) ---------- */
  function makeSet() {
    const t = []; let id = 0;
    const add = (k, n) => { for (let i = 0; i < n; i++) t.push({ id: id++, k }); };
    for (const s of SUITS) for (let n = 1; n <= 9; n++) add(s + n, 4); // 108 suit tiles
    add('XG', 4); add('XR', 4); add('XW', 4);                          // 12 dragons
    for (const w of WINDS) add('W' + w, 4);                            // 16 winds
    add('F', 8);                                                       // 8 flowers/seasons
    add('J', 8);                                                       // 8 jokers
    return t;                                                          // 152
  }
  const ORDER = [];
  for (const s of SUITS) for (let n = 1; n <= 9; n++) ORDER.push(s + n);
  ORDER.push('XG', 'XR', 'XW', 'WE', 'WS', 'WW', 'WN', 'F', 'J');
  const ORDER_IX = Object.fromEntries(ORDER.map((k, i) => [k, i]));
  function sortTiles(ts) { return ts.sort((a, b) => ORDER_IX[a.k] - ORDER_IX[b.k] || a.id - b.id); }
  function tileName(k) {
    if (k === 'J') return 'Joker';
    if (k === 'F') return 'Flower';
    if (k[0] === 'X') return { XG: 'Green Dragon', XR: 'Red Dragon', XW: 'White Dragon (Soap)' }[k];
    if (k[0] === 'W') return WIND_NAME[k[1]] + ' Wind';
    return k[1] + ' ' + SUIT_NAME[k[0]];
  }

  /* ---------- Practice card ----------
     Original practice hands written for this game in the American style. They are NOT a copy of the
     copyrighted NMJL card. Groups: [token, count]. Tokens:
       '2a'  number 2 in suit-variable a (a,b,c are distinct suits)
       'ka','k1a' consecutive run: any start k, k+1 ...
       'Da'  dragon matching suit a (Bam=Green, Crak=Red, Dot=Soap)
       'Z'   White Dragon used as zero        'F' flower      'N','E','W','S' winds          */
  const HANDS = [
    { id: 'Y1', cat: 'Year', name: 'Year with soaps', groups: [['F', 2], ['2a', 3], ['Z', 3], ['2b', 3], ['6b', 3]], note: 'Any 2 suits', val: 25 },
    { id: 'Y2', cat: 'Year', name: 'Year kongs', groups: [['2a', 1], ['Z', 1], ['2a', 1], ['6a', 1], ['2b', 4], ['6c', 4], ['F', 2]], note: 'Any 3 suits', val: 30 },
    { id: 'Y3', cat: 'Year', name: 'Year with dragons', groups: [['F', 4], ['2a', 2], ['Z', 2], ['6a', 2], ['Da', 4]], note: 'Any 1 suit, matching dragon', val: 30 },
    { id: 'E1', cat: 'Evens', name: 'Even steps', groups: [['2a', 3], ['4a', 3], ['6b', 4], ['8b', 4]], note: 'Any 2 suits', val: 25 },
    { id: 'E2', cat: 'Evens', name: 'Evens with flowers', groups: [['F', 3], ['2a', 2], ['4a', 3], ['6a', 3], ['8a', 3]], note: 'Any 1 suit', val: 25 },
    { id: 'E3', cat: 'Evens', name: 'Even dragons', groups: [['4a', 4], ['Da', 3], ['6b', 4], ['Db', 3]], note: 'Any 2 suits, matching dragons', val: 25 },
    { id: 'L1', cat: 'Like Numbers', name: 'Three of a kind', groups: [['F', 3], ['ka', 4], ['kb', 4], ['kc', 3]], note: 'Any 3 suits, same number', val: 25 },
    { id: 'L2', cat: 'Like Numbers', name: 'Like numbers & dragons', groups: [['ka', 4], ['Da', 2], ['kb', 4], ['Db', 4]], note: 'Any 2 suits, same number', val: 30 },
    { id: 'R1', cat: 'Runs', name: 'Climbing run', groups: [['ka', 3], ['k1a', 3], ['k2a', 4], ['k3a', 4]], note: 'Any 1 suit, 4 consecutive numbers', val: 25 },
    { id: 'R2', cat: 'Runs', name: 'Split run', groups: [['ka', 2], ['k1a', 3], ['k2b', 4], ['k3b', 4], ['F', 1]], note: 'Any 2 suits, 4 consecutive numbers', val: 30 },
    { id: 'R3', cat: 'Runs', name: 'Rainbow run', groups: [['F', 2], ['ka', 3], ['k1b', 3], ['k2c', 3], ['k3a', 3]], note: 'Any 3 suits, 4 consecutive numbers', val: 25 },
    { id: 'R4', cat: 'Runs', name: 'Staircase', groups: [['ka', 1], ['k1a', 2], ['k2a', 3], ['k3a', 4], ['k4a', 4]], note: 'Any 1 suit, 5 consecutive numbers', val: 30 },
    { id: 'O1', cat: 'Odds', name: 'Odd pair-up', groups: [['1a', 3], ['3a', 3], ['5b', 4], ['7b', 4]], note: 'Any 2 suits', val: 25 },
    { id: 'O2', cat: 'Odds', name: 'High odds', groups: [['F', 2], ['5a', 3], ['7a', 3], ['9a', 3], ['Da', 3]], note: 'Any 1 suit, matching dragon', val: 25 },
    { id: 'O3', cat: 'Odds', name: 'Odd kong', groups: [['1a', 2], ['3a', 2], ['5a', 4], ['7b', 4], ['9b', 2]], note: 'Any 2 suits', val: 30 },
    { id: 'W1', cat: 'Winds & Dragons', name: 'Four winds', groups: [['N', 3], ['E', 4], ['W', 4], ['S', 3]], note: 'Winds only', val: 25 },
    { id: 'W2', cat: 'Winds & Dragons', name: 'North-South dragons', groups: [['F', 2], ['N', 3], ['S', 3], ['Da', 3], ['Db', 3]], note: 'Any 2 dragons', val: 25 },
    { id: 'W3', cat: 'Winds & Dragons', name: 'East-West kong', groups: [['E', 2], ['W', 2], ['ka', 4], ['Da', 3], ['Db', 3]], note: 'Any number, any 2 dragons', val: 30 },
    { id: 'T1', cat: '3-6-9', name: 'Triple threes', groups: [['3a', 3], ['6a', 4], ['9b', 4], ['3b', 3]], note: 'Any 2 suits', val: 25 },
    { id: 'T2', cat: '3-6-9', name: '3-6-9 kongs', groups: [['F', 2], ['3a', 4], ['6b', 4], ['9c', 4]], note: 'Any 3 suits', val: 25 },
    { id: 'S1', cat: 'Singles & Pairs', name: 'Windy pairs', groups: [['N', 2], ['E', 2], ['W', 2], ['S', 2], ['ka', 2], ['k1a', 2], ['k2a', 2]], note: 'Any 1 suit, 3 consecutive', val: 50, conc: true },
    { id: 'S2', cat: 'Singles & Pairs', name: 'Even pairs', groups: [['F', 2], ['2a', 2], ['4a', 2], ['6a', 2], ['8a', 2], ['2b', 2], ['4b', 2]], note: 'Any 2 suits', val: 50, conc: true },
    { id: 'S3', cat: 'Singles & Pairs', name: 'Six-pair run', groups: [['ka', 2], ['k1a', 2], ['k2a', 2], ['k3a', 2], ['k4a', 2], ['k5a', 2], ['Da', 2]], note: 'Any 1 suit, 6 consecutive, matching dragon', val: 50, conc: true }
  ];
  HANDS.forEach(h => { h.conc = !!h.conc; h.size = h.groups.reduce((a, g) => a + g[1], 0); });

  const PERMS = [['B', 'C', 'D'], ['B', 'D', 'C'], ['C', 'B', 'D'], ['C', 'D', 'B'], ['D', 'B', 'C'], ['D', 'C', 'B']];
  function resolve(t, map, k) {
    if (t === 'F') return 'F';
    if (t === 'Z') return 'XW';
    if (t.length === 1 && 'NESW'.includes(t)) return 'W' + t;
    let m = t.match(/^D([abc])$/); if (m) return DRAGON[map[m[1]]];
    m = t.match(/^(\d)([abc])$/); if (m) return map[m[2]] + m[1];
    m = t.match(/^k(\d?)([abc])$/);
    if (m) { const n = k + (+(m[1] || 0)); return n >= 1 && n <= 9 ? map[m[2]] + n : null; }
    throw new Error('bad token ' + t);
  }
  function buildConcretes() {
    const out = []; const seen = new Set();
    for (const h of HANDS) {
      const usesK = h.groups.some(g => g[0][0] === 'k');
      for (const p of PERMS) {
        const map = { a: p[0], b: p[1], c: p[2] };
        for (let k = usesK ? 1 : 0; k <= (usesK ? 9 : 0); k++) {
          const groups = []; let ok = true;
          for (const [tok, c] of h.groups) { const key = resolve(tok, map, k); if (!key) { ok = false; break; } groups.push({ key, c }); }
          if (!ok) continue;
          const sig = h.id + ':' + groups.map(g => g.key + 'x' + g.c).sort().join(',');
          if (seen.has(sig)) continue; seen.add(sig);
          out.push({ hand: h, groups, sig });
        }
      }
    }
    return out;
  }
  const CONCRETES = buildConcretes();

  /* Distance of a concealed hand (counts incl. jokers) + exposures from one concrete hand. */
  function evalConcrete(conc, counts, exposures) {
    const groups = conc.groups.map(g => ({ key: g.key, c: g.c }));
    if (exposures && exposures.length) {
      if (conc.hand.conc) return null;
      for (const e of exposures) {
        const i = groups.findIndex(g => g.key === e.key && g.c === e.size);
        if (i < 0) return null;
        groups.splice(i, 1);
      }
    }
    const avail = Object.assign({}, counts);
    let need = 0, jk = 0; const missing = [];
    groups.sort((a, b) => a.c - b.c); // singles/pairs take naturals first (jokers can't fill them)
    for (const g of groups) {
      const have = avail[g.key] || 0, use = Math.min(have, g.c);
      avail[g.key] = have - use;
      const m = g.c - use;
      if (m) { if (g.c >= 3) jk += m; else need += m; missing.push({ key: g.key, n: m, jokerOk: g.c >= 3 }); }
    }
    const J = avail.J || 0, ju = Math.min(J, jk);
    avail.J = J - ju;
    const left = [];
    for (const k in avail) for (let i = 0; i < avail[k]; i++) left.push(k);
    return { dist: need + jk - ju, missing, left, conc, rem: groups, jokersUsed: ju };
  }

  /* ---------- Game (SCW0) ---------- */
  class Game {
    constructor(o) {
      this.o = Object.assign({ seed: (Math.random() * 2 ** 31) | 0, level: 'beginner', userSeat: 0, dealer: 0, botsOnly: false }, o || {});
      this.r = rng(this.o.seed); this.level = this.o.level; this.dealer = this.o.dealer;
      this.players = [0, 1, 2, 3].map(i => ({ seat: i, hand: [], exp: [], isUser: !this.o.botsOnly && i === this.o.userSeat, target: null }));
      this.wall = shuffle(makeSet(), this.r);
      this.discards = []; this.result = null; this.lastDiscard = null; this.turnCount = 0; this.events = [];
      for (let j = 0; j < 4; j++) { const s = (this.dealer + j) % 4; this.players[s].hand = sortTiles(this.wall.splice(0, j === 0 ? 14 : 13)); }
      this.turn = this.dealer; this.phase = 'charleston';
    }
    windOf(s) { return WINDS[(s - this.dealer + 4) % 4]; }
    scwOf(s) { return 'SCW' + (1 + (s - this.dealer + 4) % 4); }
    ev(scw, text) { this.events.push({ n: this.events.length + 1, scw, text }); }
    counts(s) { const c = {}; for (const t of this.players[s].hand) c[t.k] = (c[t.k] || 0) + 1; return c; }
    total(s) { const p = this.players[s]; return p.hand.length + p.exp.reduce((a, e) => a + e.tiles.length, 0); }
    allTileCount() { return this.wall.length + this.discards.length + this.players.reduce((a, p, i) => a + this.total(i), 0); }

    options(s, extraKey, handId) {
      const p = this.players[s]; const c = this.counts(s);
      if (extraKey) c[extraKey] = (c[extraKey] || 0) + 1;
      const out = [];
      for (const cc of CONCRETES) {
        if (handId && cc.hand.id !== handId) continue;
        const e = evalConcrete(cc, c, p.exp); if (e) out.push(e);
      }
      out.sort((a, b) => a.dist - b.dist || b.conc.hand.val - a.conc.hand.val);
      return out;
    }
    bestPerHand(s) {
      const by = {};
      for (const e of this.options(s)) if (!by[e.conc.hand.id]) by[e.conc.hand.id] = e;
      return Object.values(by).sort((a, b) => a.dist - b.dist || b.conc.hand.val - a.conc.hand.val);
    }
    winningOption(s) {
      if (this.total(s) !== 14) return null;
      const o = this.options(s)[0]; return o && o.dist === 0 ? o : null;
    }
    isWin(s) { return !!this.winningOption(s); }

    /* ----- Charleston ----- */
    charlestonPass(dir, picks) {
      const off = DIRS[dir]; const moving = {};
      for (const s in picks) {
        const p = this.players[s];
        for (const id of picks[s]) {
          const t = p.hand.find(x => x.id === id);
          if (!t) throw new Error('tile not in hand');
          if (t.k === 'J') throw new Error('Jokers may not be passed');
        }
      }
      for (const s in picks) {
        const p = this.players[s];
        moving[s] = picks[s].map(id => p.hand.splice(p.hand.findIndex(x => x.id === id), 1)[0]);
      }
      for (const s in moving) {
        const to = (Number(s) + off) % 4;
        this.players[to].hand.push(...moving[s]); sortTiles(this.players[to].hand);
      }
      this.ev('SCW0', `Charleston: every player passed ${dir}.`);
    }
    pickTiles(s, n, opt) {
      opt = opt || {};
      const scores = this.tileScores(s, opt);
      return scores.filter(x => x.t.k !== 'J').sort((a, b) => b.sc - a.sc).slice(0, n).map(x => x.t.id);
    }
    botAgreeSecond(s) {
      const d = (this.options(s)[0] || { dist: 99 }).dist;
      if (this.level === 'beginner') return true;
      return this.level === 'intermediate' ? d > 4 : d > 3;
    }
    courtesyWant(s) {
      const d = (this.options(s)[0] || { dist: 99 }).dist;
      return Math.max(0, Math.min(3, d - 3));
    }

    /* ----- Discard choice (bots + coach) ----- */
    targetOptions(s, opt) {
      const p = this.players[s];
      let opts = this.options(s, null, opt.handId);
      if (!opts.length) opts = this.options(s);
      if (opt.style === 'beginner') {
        const keep = p.target && opts.find(e => e.conc.sig === p.target);
        if (keep && this.r() > 0.15) return [keep];
        const pick = opts[Math.floor(this.r() * Math.min(4, opts.length))];
        p.target = pick ? pick.conc.sig : null; return pick ? [pick] : [];
      }
      return opts.slice(0, opt.style === 'advanced' || opt.style === 'coach' ? 4 : 1);
    }
    exposedByOthers(s, k) { return this.players.some((p, i) => i !== s && p.exp.some(e => e.key === k)); }
    deadCount(k) { return this.discards.filter(d => d.t.k === k).length; }
    tileScores(s, opt) {
      const top = this.targetOptions(s, opt);
      const score = {};
      top.forEach((e, i) => { for (const k of e.left) score[k] = (score[k] || 0) + (top.length - i); });
      const defense = opt.style === 'advanced' || opt.style === 'coach';
      return this.players[s].hand.map(t => {
        let sc = (score[t.k] || 0) * 10;
        if (t.k === 'J') sc -= 5;
        if (defense) { sc += this.deadCount(t.k) * 2; if (this.exposedByOthers(s, t.k)) sc -= 15; }
        sc += (opt.style === 'coach' ? 0 : this.r() * 0.5);
        return { t, sc };
      });
    }
    chooseDiscard(s, opt) {
      const sc = this.tileScores(s, opt || { style: this.level });
      sc.sort((a, b) => b.sc - a.sc);
      return sc[0].t;
    }

    /* ----- Turn actions ----- */
    draw(s) {
      if (!this.wall.length) { this.endWall(); return null; }
      const t = this.wall.shift(); this.players[s].hand.push(t); sortTiles(this.players[s].hand);
      this.lastDraw = { t, by: s }; return t;
    }
    discard(s, id) {
      const p = this.players[s]; const i = p.hand.findIndex(x => x.id === id);
      if (i < 0) throw new Error('not in hand');
      if (this.total(s) !== 14) throw new Error('must hold 14 to discard');
      const t = p.hand.splice(i, 1)[0];
      this.discards.push({ t, by: s }); this.lastDiscard = { t, by: s }; this.turnCount++;
      this.ev(this.scwOf(s), `${WIND_NAME[this.windOf(s)]} discarded ${tileName(t.k)}.`);
      return t;
    }
    callOptions(s, key) {
      const none = { mahjong: null, expose: [] };
      if (!this.lastDiscard || this.lastDiscard.by === s || key === 'J' || this.result) return none;
      const res = { mahjong: null, expose: [] };
      if (this.total(s) + 1 === 14) {
        const o = this.options(s, key)[0];
        if (o && o.dist === 0) res.mahjong = o;
      }
      const c0 = this.counts(s); const nat = c0[key] || 0, J = c0.J || 0;
      const seen = new Set();
      for (const e of this.options(s, key)) {
        if (e.conc.hand.conc) continue;
        for (const g of e.rem) {
          if (g.key === key && g.c >= 3 && nat + J >= g.c - 1 && !seen.has(g.c)) {
            seen.add(g.c); res.expose.push({ size: g.c, opt: e });
          }
        }
      }
      res.expose.sort((a, b) => a.opt.dist - b.opt.dist);
      return res;
    }
    botWantsCall(s, key) {
      const co = this.callOptions(s, key);
      if (co.mahjong) return { kind: 'mahjong' };
      if (!co.expose.length) return null;
      const cur = (this.options(s)[0] || { dist: 99 }).dist, best = co.expose[0];
      if (this.level === 'beginner') return this.r() < 0.35 && best.opt.dist <= 5 && best.opt.dist < cur ? { kind: 'expose', size: best.size } : null;
      if (this.level === 'intermediate') return best.opt.dist < cur && best.opt.dist <= 6 ? { kind: 'expose', size: best.size } : null;
      return best.opt.dist < cur ? { kind: 'expose', size: best.size } : null;
    }
    /* Priority: Mah Jongg beats exposure; ties go to the player next in turn after the discarder. */
    resolveCalls(userDecision) {
      if (!this.lastDiscard) return null;
      const by = this.lastDiscard.by, key = this.lastDiscard.t.k;
      const wants = [];
      for (let d = 1; d <= 3; d++) {
        const s = (by + d) % 4; const p = this.players[s];
        const w = p.isUser ? userDecision : this.botWantsCall(s, key);
        if (w) wants.push(Object.assign({ seat: s }, w));
      }
      return wants.find(w => w.kind === 'mahjong') || wants.find(w => w.kind === 'expose') || null;
    }
    applyCall(s, kind, size) {
      const { t, by } = this.lastDiscard; const p = this.players[s];
      const di = this.discards.lastIndexOf(this.discards.find(d => d.t === t));
      this.discards.splice(di, 1); this.lastDiscard = null;
      if (kind === 'mahjong') {
        p.hand.push(t); sortTiles(p.hand);
        this.ev(this.scwOf(s), `${WIND_NAME[this.windOf(s)]} called ${tileName(t.k)} for Mah Jongg!`);
        return this.finish(s, { self: false, from: by });
      }
      const tiles = [t];
      for (const want of [t.k, 'J']) {
        while (tiles.length < size) {
          const i = p.hand.findIndex(x => x.k === want); if (i < 0) break;
          tiles.push(p.hand.splice(i, 1)[0]);
        }
      }
      if (tiles.length !== size) throw new Error('cannot complete exposure');
      p.exp.push({ key: t.k, size, tiles, from: by });
      this.turn = s;
      const nm = { 3: 'Pung', 4: 'Kong', 5: 'Quint', 6: 'Sextet' }[size];
      this.ev(this.scwOf(s), `${WIND_NAME[this.windOf(s)]} called ${tileName(t.k)} and exposed a ${nm}.`);
      return null;
    }
    jokerSwaps(s) {
      const out = []; const hand = this.players[s].hand;
      this.players.forEach((q, qi) => q.exp.forEach((e, ei) => {
        const ji = e.tiles.findIndex(x => x.k === 'J'); const h = hand.find(x => x.k === e.key);
        if (ji >= 0 && h) out.push({ owner: qi, ei, ji, handId: h.id, key: e.key });
      }));
      return out;
    }
    doSwap(s, sw) {
      const p = this.players[s]; const e = this.players[sw.owner].exp[sw.ei];
      const hi = p.hand.findIndex(x => x.id === sw.handId);
      const nat = p.hand.splice(hi, 1)[0]; const jk = e.tiles.splice(sw.ji, 1, nat)[0];
      p.hand.push(jk); sortTiles(p.hand);
      this.ev(this.scwOf(s), `${WIND_NAME[this.windOf(s)]} swapped a ${tileName(nat.k)} for a Joker.`);
    }
    botSwaps(s) {
      if (this.level === 'beginner') return 0;
      let n = 0, sw;
      while ((sw = this.jokerSwaps(s)[0])) {
        const before = (this.options(s)[0] || { dist: 99 }).dist;
        const snap = JSON.stringify([this.players[s].hand.map(x => x.id), this.players[sw.owner].exp[sw.ei].tiles.map(x => x.id)]);
        this.doSwap(s, sw); n++;
        const after = (this.options(s)[0] || { dist: 99 }).dist;
        if (after > before) { // undo a harmful swap
          const [h, e] = JSON.parse(snap); const all = [...this.players[s].hand, ...this.players[sw.owner].exp[sw.ei].tiles];
          const byId = Object.fromEntries(all.map(x => [x.id, x]));
          this.players[s].hand = sortTiles(h.map(i => byId[i])); this.players[sw.owner].exp[sw.ei].tiles = e.map(i => byId[i]);
          this.events.pop(); n--; break;
        }
        if (n > 4) break;
      }
      return n;
    }
    finish(s, how) {
      const o = this.winningOption(s);
      if (!o) throw new Error('not a winning hand');
      const p = this.players[s];
      const allTiles = [...p.hand, ...p.exp.flatMap(e => e.tiles)];
      const jokerless = !allTiles.some(t => t.k === 'J') && o.conc.hand.cat !== 'Singles & Pairs';
      const v = o.conc.hand.val * (jokerless ? 2 : 1);
      const pay = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) if (i !== s) { const amt = v * (how.self || i === how.from ? 2 : 1); pay[i] -= amt; pay[s] += amt; }
      this.result = { winner: s, opt: o, self: !!how.self, from: how.from, jokerless, pay };
      this.phase = 'over';
      this.ev(this.scwOf(s), `${WIND_NAME[this.windOf(s)]} declared Mah Jongg: ${o.conc.hand.name}.`);
      return this.result;
    }
    endWall() { this.result = { wall: true, pay: [0, 0, 0, 0] }; this.phase = 'over'; this.ev('SCW0', 'Wall game — the wall ran out, nobody wins.'); }

    /* Public SCW view: SCW0 holds shared state; each SCWn holds one player's private rack. */
    scwView(viewer) {
      const sub = [0, 1, 2, 3].map(i => (i - this.dealer + 4) % 4).map((_, j) => (this.dealer + j) % 4).map(s => {
        const p = this.players[s];
        return { scw: this.scwOf(s), wind: WIND_NAME[this.windOf(s)], seat: s, tiles: this.total(s),
          exposures: p.exp.map(e => ({ tile: tileName(e.key), size: e.size, jokers: e.tiles.filter(t => t.k === 'J').length })),
          rack: s === viewer || this.phase === 'over' ? p.hand.map(t => tileName(t.k)) : 'hidden (private to ' + this.scwOf(s) + ')' };
      });
      return { scw: 'SCW0', game: 'American Mah Jongg', phase: this.phase, level: this.level, wall: this.wall.length,
        turn: this.scwOf(this.turn), discards: this.discards.map(d => tileName(d.t.k)), children: sub };
    }
  }

  /* All-bot simulation used by tests. */
  function simulate(opts) {
    const g = new Game(Object.assign({ botsOnly: true }, opts));
    const ch = (dir) => { const pk = {}; for (let s = 0; s < 4; s++) pk[s] = g.pickTiles(s, 3, { style: g.level }); g.charlestonPass(dir, pk); };
    ['right', 'across', 'left'].forEach(ch);
    if ([0, 1, 2, 3].every(s => g.botAgreeSecond(s))) ['left', 'across', 'right'].forEach(ch);
    g.phase = 'play';
    let guard = 0;
    while (!g.result && guard++ < 1000) {
      const s = g.turn;
      if (g.total(s) === 13) { if (!g.draw(s)) break; if (g.isWin(s)) { g.finish(s, { self: true }); break; } }
      g.botSwaps(s);
      g.discard(s, g.chooseDiscard(s).id);
      const claim = g.resolveCalls(null);
      if (claim) { g.applyCall(claim.seat, claim.kind, claim.size); continue; }
      g.turn = (s + 1) % 4;
    }
    return g;
  }

  return { SUITS, SUIT_NAME, DRAGON, WINDS, WIND_NAME, DIRS, HANDS, CONCRETES, makeSet, tileName, sortTiles, evalConcrete, resolve, rng, Game, simulate };
});
