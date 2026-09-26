import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'public/dialogue/manifest.json'), 'utf8'));
const lines = manifest.lines;
const FACTS = new Set(manifest.facts);

test('60 lines with unique ids', () => {
  assert.equal(lines.length, 60);
  assert.equal(new Set(lines.map((l) => l.id)).size, 60);
});

test('every line has nonempty text', () => {
  for (const l of lines) assert.ok(l.text.trim().length > 0, l.id);
});

test('all conditions reference the six known facts', () => {
  for (const l of lines) {
    for (const key of ['allFacts', 'anyFacts', 'noFacts']) {
      for (const f of l.requires[key] || []) assert.ok(FACTS.has(f), `${l.id}.${key}: ${f}`);
    }
  }
});

test('no line conflicts allFacts vs noFacts', () => {
  for (const l of lines) {
    const all = new Set(l.requires.allFacts || []);
    for (const f of l.requires.noFacts || []) assert.ok(!all.has(f), l.id);
  }
});

test('six audition ids exist in the catalog', () => {
  assert.equal(manifest.auditionIds.length, 6);
  const ids = new Set(lines.map((l) => l.id));
  for (const id of manifest.auditionIds) assert.ok(ids.has(id), id);
});

test('all six outcome events are covered by lines', () => {
  const events = new Set(lines.map((l) => l.event));
  for (const f of FACTS) assert.ok(events.has(f), f);
});

test('h_probe_select_again requires overload_caused', () => {
  const l = lines.find((x) => x.id === 'h_probe_select_again');
  assert.ok(l.requires.allFacts.includes('overload_caused'));
});

test('h_restraint_free_after_damage requires restraint_damaged', () => {
  const l = lines.find((x) => x.id === 'h_restraint_free_after_damage');
  assert.ok(l.requires.allFacts.includes('restraint_damaged'));
});

test('helping does not erase harm facts', () => {
  assert.match(manifest.rules.memory, /does not clear harm/);
});
