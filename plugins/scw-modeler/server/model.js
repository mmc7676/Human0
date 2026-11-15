'use strict';
// SCW Modeler core: schema, validation, deterministic text rendering. No I/O.
const RELATIONS = {
  'contains':       'Bound inside the parent; ends at a boundary computed from the parent (a tidal radius, a scope, a permission edge).',
  'superposes':     'Shares the parent\'s space as one additive term; no single component is the center.',
  'passes-through': 'A pattern or process with its own speed that members move through; it owns no members.',
  'signals':        'An event that reaches other SCWs only when its signal arrives (light cone, message, notification).',
  'shares-gravity': 'Influence adds across the link but nothing observable crosses it (hidden or isolated sibling).',
  'feeds':          'One-way flow of matter, energy, data or work from this SCW to the parent.',
  'governs':        'Sets or switches laws (rules, policy, configuration) for the parent without being contained by it.'
};
const EVIDENCE = ['FACT', 'EXEC', 'DERIVED', 'HYPOTHESIS', 'BLOCKED'];
const LAW_STATES = ['on', 'off', 'inherit'];
const ID = /^SCW-[A-Za-z0-9][A-Za-z0-9_.-]{0,40}$/;

function str(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }

function validate(m) {
  const errs = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['model must be an object'] };
  if (!str(m.title, 200)) errs.push('title: non-empty string up to 200 characters');
  if (!Array.isArray(m.scws) || m.scws.length < 1 || m.scws.length > 200) { errs.push('scws: array of 1 to 200 SCWs'); return { ok: false, errors: errs }; }
  const ids = new Set();
  m.scws.forEach((s, i) => {
    const at = 'scws[' + i + ']';
    if (!s || typeof s !== 'object') { errs.push(at + ': must be an object'); return; }
    if (!ID.test(s.id || '')) errs.push(at + '.id: must match SCW-<name> (letters, digits, _ . -)');
    else if (ids.has(s.id)) errs.push(at + '.id: duplicate ' + s.id); else ids.add(s.id);
    if (!str(s.name, 120)) errs.push(at + '.name: required');
    if (!str(s.role, 400)) errs.push(at + '.role: required');
    if (s.holds != null && !str(s.holds, 600)) errs.push(at + '.holds: string up to 600 characters');
    if (s.evidence != null && !EVIDENCE.includes(s.evidence)) errs.push(at + '.evidence: one of ' + EVIDENCE.join(', '));
    if (s.laws != null) {
      if (!Array.isArray(s.laws)) errs.push(at + '.laws: array');
      else s.laws.forEach((l, j) => {
        if (!l || !str(l.text, 300)) errs.push(at + '.laws[' + j + '].text: required');
        if (l && !LAW_STATES.includes(l.state)) errs.push(at + '.laws[' + j + '].state: one of on, off, inherit');
      });
    }
    if (s.data != null) {
      if (!Array.isArray(s.data)) errs.push(at + '.data: array');
      else s.data.forEach((d, j) => { if (!d || !str(d.source, 300)) errs.push(at + '.data[' + j + '].source: required (tool, server or citation)'); });
    }
  });
  const byId = new Map(m.scws.filter(s => s && s.id).map(s => [s.id, s]));
  const roots = m.scws.filter(s => s && !s.parent);
  if (roots.length !== 1) errs.push('exactly one root SCW (no parent) is required; found ' + roots.length);
  m.scws.forEach((s, i) => {
    if (!s || !s.parent) { if (s && s.relation) errs.push('scws[' + i + ']: the root has no relation'); return; }
    if (!byId.has(s.parent)) errs.push('scws[' + i + '].parent: unknown SCW ' + s.parent);
    if (!RELATIONS[s.relation]) errs.push('scws[' + i + '].relation: one of ' + Object.keys(RELATIONS).join(', '));
  });
  // cycle check
  for (const s of m.scws) {
    if (!s || !s.id) continue;
    const seen = new Set(); let c = s;
    while (c && c.parent) { if (seen.has(c.id)) { errs.push('cycle through ' + s.id); break; } seen.add(c.id); c = byId.get(c.parent); }
  }
  if (m.tables != null) {
    if (!Array.isArray(m.tables)) errs.push('tables: array');
    else m.tables.forEach((t, i) => {
      if (!t || !str(t.title, 200) || !Array.isArray(t.columns) || !Array.isArray(t.rows)) { errs.push('tables[' + i + ']: title, columns and rows required'); return; }
      t.rows.forEach((r, j) => { if (!Array.isArray(r) || r.length !== t.columns.length) errs.push('tables[' + i + '].rows[' + j + ']: needs ' + t.columns.length + ' cells'); });
    });
  }
  if (m.context != null && typeof m.context !== 'object') errs.push('context: object');
  return { ok: errs.length === 0, errors: errs };
}

function children(m, id) { return m.scws.filter(s => s.parent === id); }
const ORDER = Object.keys(RELATIONS);
function sortKids(k) { return k; } // declared order is the author's order
function short(s) { return s.tag || s.role.split(/[;.]/)[0]; }

function tree(m) {
  const root = m.scws.find(s => !s.parent), w = Math.max(...m.scws.map(s => s.id.length)) + 2;
  const nw = Math.max(...m.scws.map(s => s.name.length)) + 2;
  const lines = [root.id.padEnd(w) + root.name.padEnd(nw) + short(root)];
  (function walk(id, pre) {
    const k = sortKids(children(m, id));
    k.forEach((c, i) => {
      const last = i === k.length - 1, rel = ' ' + c.relation + ' ';
      const pad = '─'.repeat(Math.max(1, 16 - rel.length));
      lines.push(pre + (last ? '└─' : '├─') + rel + pad + ' ' + c.id.padEnd(w) + c.name.padEnd(nw) + '(' + short(c) + ')');
      walk(c.id, pre + (last ? '   ' : '│  '));
    });
  })(root.id, ' ');
  return lines.join('\n');
}
function cell(v) { return String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' '); }
function mdTable(cols, rows) { return '| ' + cols.map(cell).join(' | ') + ' |\n|' + cols.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.map(cell).join(' | ') + ' |').join('\n'); }
function lawText(s) { return (s.laws || []).map(l => l.text + (l.state === 'on' ? '' : l.state === 'off' ? ' (switched off)' : ' (inherited)')).join('; ') || 'none of its own'; }

function toText(m) {
  const v = validate(m); if (!v.ok) throw new Error('Invalid SCW model:\n- ' + v.errors.join('\n- '));
  const out = ['```', tree(m), '```'];
  if (m.structural_note) out.push('', m.structural_note);
  out.push('', '### What each SCW holds', '', mdTable(['SCW', 'Role', 'Holds', 'Its laws'], m.scws.map(s => [s.name, (s.relation ? s.relation + ': ' : '') + s.role, s.holds || '', lawText(s)])));
  const used = [...new Set(m.scws.filter(s => s.relation).map(s => s.relation))];
  out.push('', '### How they interact', '', 'The model uses ' + (used.length === 1 ? 'one relation type' : used.length + ' relation types') + ':', '');
  used.forEach(r => { const ks = m.scws.filter(s => s.relation === r); out.push('- **' + r + '** (' + ks.map(k => (m.scws.find(p => p.id === k.parent) || {}).name + ' to ' + k.name).join(', ') + '): ' + RELATIONS[r]); });
  (m.tables || []).forEach(t => out.push('', '### ' + t.title, '', mdTable(t.columns, t.rows)));
  const src = []; m.scws.forEach(s => (s.data || []).forEach(d => src.push([s.name, d.value || '', d.source, d.evidence || s.evidence || ''])));
  if (src.length) out.push('', '### Data and sources', '', mdTable(['SCW', 'Value', 'Source', 'Evidence'], src));
  if (m.context && (m.context.path || (m.context.mcp && m.context.mcp.length))) {
    out.push('', '### Context Plane', '');
    if (m.context.path) out.push('Route: ' + m.context.path);
    if (m.context.mcp && m.context.mcp.length) out.push('Data servers: ' + m.context.mcp.map(x => typeof x === 'string' ? x : x.name).join(', '));
  }
  if (m.one_line) out.push('', '### The one-line answer', '', m.one_line);
  if (m.notes && m.notes.length) out.push('', m.notes.map(n => '- ' + n).join('\n'));
  return out.join('\n');
}

module.exports = { RELATIONS, EVIDENCE, LAW_STATES, validate, toText, tree };
