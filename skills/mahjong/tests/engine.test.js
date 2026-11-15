/* Run: node tests/engine.test.js  — requirement IDs map to COVERAGE.md */
const MJ = require('../src/engine.js');
let pass = 0, fail = 0;
const t = (id, name, fn) => { try { fn(); pass++; console.log('PASS', id, name); } catch (e) { fail++; console.log('FAIL', id, name, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${b} got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assert'); };

t('R1', 'full 152-tile set with 8 flowers and 8 jokers', () => {
  const s = MJ.makeSet(); eq(s.length, 152);
  const c = {}; s.forEach(x => c[x.k] = (c[x.k] || 0) + 1);
  eq(c.F, 8); eq(c.J, 8); eq(c.XW, 4); eq(c.WN, 4); eq(c.B1, 4); eq(c.D9, 4);
});
t('R2', 'every practice hand has exactly 14 tiles', () => MJ.HANDS.forEach(h => eq(h.size, 14, h.id)));
t('R3', 'every hand resolves to at least one concrete hand', () => MJ.HANDS.forEach(h => ok(MJ.CONCRETES.some(c => c.hand === h), h.id)));
t('R4', 'deal: East 14, others 13, wall 99', () => {
  const g = new MJ.Game({ seed: 1, dealer: 2 });
  eq(g.total(2), 14); eq(g.total(3), 13); eq(g.total(0), 13); eq(g.wall.length, 99); eq(g.scwOf(2), 'SCW1'); eq(g.scwOf(3), 'SCW2');
});
const conc = (id) => MJ.CONCRETES.find(c => c.hand.id === id);
const counts = (keys) => { const c = {}; keys.forEach(k => c[k] = (c[k] || 0) + 1); return c; };
t('R5', 'matcher: exact natural hand has distance 0', () => {
  const c = MJ.CONCRETES.find(x => x.hand.id === 'W1');
  eq(MJ.evalConcrete(c, counts(['WN','WN','WN','WE','WE','WE','WE','WW','WW','WW','WW','WS','WS','WS']), []).dist, 0);
});
t('R6', 'jokers fill pungs/kongs but never singles or pairs', () => {
  const c = conc('W1');
  eq(MJ.evalConcrete(c, counts(['WN','WN','J','WE','WE','WE','J','WW','WW','WW','WW','WS','WS','WS']), []).dist, 0);
  const s = MJ.CONCRETES.find(x => x.hand.id === 'S1');
  const base = ['WN','WN','WE','WE','WW','WW','WS','WS'];
  const run = s.groups.filter(g => g.key[0] !== 'W').map(g => g.key);
  eq(MJ.evalConcrete(s, counts([...base, run[0], run[0], run[1], run[1], run[2], 'J']), []).dist, 1, 'joker in pair');
});
t('R7', 'exposures must match a group; concealed hands reject exposures', () => {
  const c = conc('W1'); const e = [{ key: 'WN', size: 3, tiles: [] }];
  eq(MJ.evalConcrete(c, counts(['WE','WE','WE','WE','WW','WW','WW','WW','WS','WS','WS']), e).dist, 0);
  eq(MJ.evalConcrete(c, counts([]), [{ key: 'B5', size: 3 }]), null);
  eq(MJ.evalConcrete(MJ.CONCRETES.find(x => x.hand.conc), counts([]), e), null);
});
t('R8', 'charleston conserves tiles and refuses jokers', () => {
  const g = new MJ.Game({ seed: 5 }); const pk = {};
  for (let s = 0; s < 4; s++) pk[s] = g.pickTiles(s, 3, { style: 'advanced' });
  g.charlestonPass('right', pk); eq(g.allTileCount(), 152);
  const p = g.players[0]; const jt = p.hand.find(x => x.k === 'J') || (p.hand[0].k = 'J', p.hand[0]);
  let threw = false; try { g.charlestonPass('left', { 0: [jt.id] }); } catch (e) { threw = /Jokers/.test(e.message); } ok(threw);
});
t('R9', 'discarded joker can never be called', () => {
  const g = new MJ.Game({ seed: 3 }); g.lastDiscard = { t: { k: 'J' }, by: 1 };
  const co = g.callOptions(0, 'J'); eq(co.mahjong, null); eq(co.expose.length, 0);
});
t('R10', 'joker swap moves natural into exposure and joker to hand', () => {
  const g = new MJ.Game({ seed: 9 });
  const nat = g.players[0].hand.find(x => x.k !== 'J'); const k = nat.k;
  g.players[1].exp.push({ key: k, size: 3, tiles: [{ id: 900, k }, { id: 901, k }, { id: 902, k: 'J' }] });
  const sw = g.jokerSwaps(0).find(x => x.owner === 1); ok(sw);
  g.doSwap(0, sw); ok(g.players[0].hand.some(x => x.id === 902)); ok(!g.players[1].exp[0].tiles.some(x => x.k === 'J'));
});
t('R11', 'scoring: self-pick all pay double; discarder pays double; jokerless doubles', () => {
  const g = new MJ.Game({ seed: 2 });
  g.players[0].hand = ['WN','WN','WN','WE','WE','WE','WE','WW','WW','WW','WW','WS','WS','WS'].map((k, i) => ({ id: 500 + i, k })); g.players[0].exp = [];
  let r = g.finish(0, { self: true }); eq(r.jokerless, true); eq(r.pay[1], -100); eq(r.pay[0], 300);
  g.players[0].hand[0].k = 'J'; r = g.finish(0, { self: false, from: 2 }); eq(r.pay[2], -50); eq(r.pay[1], -25); eq(r.pay[0], 100);
});
t('R12', 'exposure claims take naturals before jokers and set turn', () => {
  const g = new MJ.Game({ seed: 4 });
  g.players[0].hand = [{ id: 700, k: 'C5' }, { id: 701, k: 'J' }, ...g.players[0].hand.slice(0, 11)].filter(x => x.k !== 'C5' || x.id === 700);
  g.lastDiscard = { t: { id: 800, k: 'C5' }, by: 3 }; g.discards.push(g.lastDiscard);
  g.applyCall(0, 'expose', 3); const e = g.players[0].exp[0];
  eq(e.tiles.length, 3); eq(e.tiles[1].id, 700); eq(g.turn, 0);
});
for (const level of ['beginner', 'intermediate', 'advanced']) {
  t('R13-' + level, `80 full bot games (${level}): conservation, termination, verified winners`, () => {
    let wins = 0, walls = 0;
    for (let i = 0; i < 80; i++) {
      const g = MJ.simulate({ seed: 1000 + i, level, dealer: i % 4 });
      ok(g.result, 'no result seed ' + i); eq(g.allTileCount(), 152, 'conservation seed ' + i);
      if (g.result.wall) walls++; else { wins++; eq(g.total(g.result.winner), 14); eq(g.result.pay.reduce((a, b) => a + b, 0), 0, 'zero-sum'); }
    }
    console.log(`     ${level}: ${wins} wins, ${walls} wall games`);
    ok(wins > 0, 'bots must be able to win');
  });
}
t('R14', 'stronger bots win more often than beginner bots', () => {
  const rate = lv => { let w = 0; for (let i = 0; i < 120; i++) if (!MJ.simulate({ seed: 5000 + i, level: lv }).result.wall) w++; return w; };
  const b = rate('beginner'), a = rate('advanced'); console.log(`     beginner ${b}/120, advanced ${a}/120`); ok(a > b);
});
t('R15', 'SCW view hides other racks, East is SCW1', () => {
  const g = new MJ.Game({ seed: 7, dealer: 1 }); const v = g.scwView(0);
  eq(v.children[0].scw, 'SCW1'); eq(v.children[0].wind, 'East'); ok(Array.isArray(v.children.find(c => c.seat === 0).rack));
  ok(typeof v.children.find(c => c.seat === 2).rack === 'string');
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
