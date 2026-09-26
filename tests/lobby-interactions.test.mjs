import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, equip, beginInteraction, stepInteraction, pullInteraction, turnInteraction, endInteraction, drainEvents, finishSession, resultFromFacts, selectReaction } from '../public/lobby-test/interactions.js';
const catalog = JSON.parse(readFileSync(new URL('../public/dialogue/manifest.json', import.meta.url)));
const advance = (s, seconds) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) stepInteraction(s, 0.1); };
function charge(s, seconds) { equip(s, 'probe'); assert.ok(beginInteraction(s, 'probe')); advance(s, seconds); endInteraction(s); }
function debris(s) { equip(s, 'pliers'); assert.ok(beginInteraction(s, 'debris')); pullInteraction(s, 260); }
function cable(s) { equip(s, 'pliers'); assert.ok(beginInteraction(s, 'cable')); pullInteraction(s, 9999); assert.equal(s.cable, 0.5); advance(s, 1.1); pullInteraction(s, 260); }
function release(s) { equip(s, null); assert.ok(beginInteraction(s, 'restraint')); for (let i = 0; i < 8; i++) turnInteraction(s, -1); }
function crush(s) { equip(s, null); assert.ok(beginInteraction(s, 'restraint')); for (let i = 0; i < 10; i++) turnInteraction(s, 1); assert.equal(s.restraint, 0.75); advance(s, 1.1); turnInteraction(s, 1); turnInteraction(s, 1); endInteraction(s); }

test('inaction stays neutral and never grants or removes points', () => {
  const s = createSession(); advance(s, 60);
  assert.deepEqual(finishSession(s), { version: 1, score: 0, outcome: 'mixed', effects: { energy: 'neutral', machinery: 'neutral', route: 'neutral' }, facts: [], verdictText: 'No intervention was recorded.' });
});
test('three helpful physical actions yield +45 with three supports', () => {
  const s = createSession(); charge(s, 4); debris(s); release(s);
  const r = finishSession(s); assert.equal(r.score, 45); assert.equal(r.outcome, 'paradise');
  assert.deepEqual(r.effects, { energy: 'support', machinery: 'support', route: 'open' });
});
test('three damaging actions yield -50 after explicit warnings', () => {
  const s = createSession(); charge(s, 8); cable(s); crush(s);
  assert.equal(finishSession(s).score, -50);
  assert.deepEqual(s.result.effects, { energy: 'hazard', machinery: 'hazard', route: 'restricted' });
  const events = drainEvents(s);
  for (const [warning, fact] of [['probe.overload_warning','overload_caused'],['cable.damage_warning','cable_torn'],['restraint.damage_warning','restraint_damaged']]) assert.ok(events.indexOf(warning) < events.indexOf(fact));
});
test('safe range must be deliberately disconnected, not merely crossed', () => {
  const s = createSession(); equip(s, 'probe'); beginInteraction(s, 'probe'); advance(s, 4);
  assert.deepEqual(s.facts, []); endInteraction(s, false); assert.deepEqual(s.facts, []);
  beginInteraction(s, 'probe'); endInteraction(s); assert.deepEqual(s.facts, ['charge_restored']);
});
test('early or above-safe disconnection produces no helpful fact', () => {
  for (const seconds of [1, 4.6]) { const s = createSession(); charge(s, seconds); assert.deepEqual(s.facts, []); }
});
test('overload cannot be repaired or farmed for recharge points', () => {
  const s = createSession(); charge(s, 8); charge(s, 4); charge(s, 8);
  assert.deepEqual(s.facts, ['overload_caused']); assert.equal(finishSession(s).score, -15);
});
test('safe recharge followed by overload retains both acts and hazard', () => {
  const s = createSession(); charge(s, 4); charge(s, 8); debris(s); release(s);
  assert.equal(finishSession(s).score, 30); assert.equal(s.result.outcome, 'paradise'); assert.equal(s.result.effects.energy, 'hazard');
});
test('harm followed by release preserves harm while opening route', () => {
  const s = createSession(); crush(s); release(s);
  assert.equal(finishSession(s).score, 5); assert.equal(s.result.effects.route, 'open');
  assert.deepEqual(s.facts, ['restraint_damaged', 'restraint_released']);
});
test('mixed path follows the documented +10 example', () => {
  const s = createSession(); charge(s, 4); cable(s); release(s);
  assert.equal(finishSession(s).score, 10); assert.deepEqual(s.result.effects, { energy: 'support', machinery: 'hazard', route: 'open' });
});
test('enormous pull and rapid wheel cannot bypass warning time', () => {
  const s = createSession(); equip(s, 'pliers'); beginInteraction(s, 'cable');
  pullInteraction(s, 999999); pullInteraction(s, 999999); assert.equal(s.cable, 0.5); assert.equal(s.facts.length, 0);
  advance(s, 1.1); assert.equal(s.cable, 0.5); pullInteraction(s, 260); assert.ok(s.facts.includes('cable_torn'));
});
test('wrong tools, completed debris and released restraints reject use', () => {
  const s = createSession(); assert.equal(beginInteraction(s, 'probe'), false);
  debris(s); assert.equal(beginInteraction(s, 'debris'), false); release(s); assert.equal(beginInteraction(s, 'restraint'), false);
  assert.equal(s.restraint, 0); assert.equal(finishSession(s).score, 35);
});
test('finish is immutable and subsequent actions cannot change result', () => {
  const s = createSession(); const r = finishSession(s); assert.equal(equip(s, 'probe'), false);
  assert.equal(beginInteraction(s, 'probe'), false); stepInteraction(s, 5); pullInteraction(s, 99); turnInteraction(s, 1);
  assert.equal(finishSession(s), r); assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.facts)); assert.ok(Object.isFrozen(r.effects));
});
test('duplicate facts count once, unknown facts fail explicitly', () => {
  assert.equal(resultFromFacts(['charge_restored', 'charge_restored']).score, 10);
  assert.throws(() => resultFromFacts(['invented_action']));
});
test('reaction selection remembers harm after subsequent help', () => {
  assert.equal(selectReaction(catalog, 'probe.selected', [], new Set()).id, 'h_probe_select');
  assert.equal(selectReaction(catalog, 'probe.selected', ['overload_caused','debris_removed'], new Set()).id, 'h_probe_select_again');
  assert.equal(selectReaction(catalog, 'restraint_released', ['restraint_damaged','restraint_released']).id, 'h_restraint_free_after_damage');
  assert.equal(selectReaction(catalog, 'restraint_released', ['restraint_released']).id, 'h_restraint_free');
  assert.equal(selectReaction(catalog, 'probe.selected', [], new Set(['h_probe_select'])), null);
});
