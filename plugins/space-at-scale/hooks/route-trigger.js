#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook: when the inline app sends "[Space-at-Scale trigger] event=... agent=...", add context that
// routes the job to that plugin agent. Any other prompt passes through untouched (no output).
const AGENTS = new Set(['space-architect', 'sky-historian', 'scw-checker']);
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = String(JSON.parse(raw).prompt || ''); } catch { return; }
  const m = /^\[Space-at-Scale trigger\]\s+event=(\S+)\s+agent=(\S+)/.exec(prompt);
  if (!m || !AGENTS.has(m[2])) return;
  process.stdout.write('This message came from a Space-at-Scale in-app trigger (event ' + m[1] + '). ' +
    'Delegate it to the space-at-scale:' + m[2] + ' agent with the Task tool, then reply with that agent\'s summary. ' +
    'Use only Space-at-Scale tools for numbers.\n');
});
