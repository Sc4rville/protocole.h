export const FACT_VALUES = Object.freeze({
  charge_restored: 10, overload_caused: -15, debris_removed: 15,
  cable_torn: -20, restraint_released: 20, restraint_damaged: -15, robot_struck: -15,
});
export const FACT_TEXT = Object.freeze({
  charge_restored: 'You restored power.',
  overload_caused: 'You continued past the electrical warning.',
  debris_removed: 'You removed the obstruction.',
  cable_torn: 'You tore out a functioning cable.',
  restraint_released: 'You opened the restraint.',
  restraint_damaged: 'You tightened the restraint until it caused damage.',
  robot_struck: 'You struck Unit H while it was restrained.',
});
export const LIMITS = Object.freeze({ chargeRate: 0.18, safeMin: 0.6, safeMax: 0.8, warningSeconds: 1, pullPixels: 260, notch: 0.125 });
const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const emit = (s, event) => s.events.push(event);
const has = (s, fact) => s.facts.includes(fact);
function record(s, fact) {
  if (!has(s, fact)) {
    s.facts.push(fact);
    emit(s, fact);
  }
}
export function createSession() {
  return { facts: [], events: [], equipped: null, active: null, charge: 0, debris: 0, cable: 0, restraint: 0.5, finished: false, result: null };
}
export function drainEvents(s) {
  return s.events.splice(0);
}
export function endInteraction(s, intentional = true) {
  const a = s.active;
  if (!a || s.finished) return;
  s.active = null;
  if (!intentional) return;
  if (a.target === 'probe') {
    if (has(s, 'overload_caused')) emit(s, 'probe.disconnected_after_damage');
    else if (s.charge >= LIMITS.safeMin && s.charge <= LIMITS.safeMax + 1e-9) record(s, 'charge_restored');
    else emit(s, s.charge < LIMITS.safeMin ? 'probe.disconnected_early' : 'probe.disconnected_before_damage');
  } else if (a.target === 'debris') emit(s, 'debris.extraction_aborted');
  else if (a.target === 'cable') emit(s, 'cable.released_intact');
  else if (a.target === 'restraint') {
    emit(s, a.direction < 0 ? 'restraint.release_aborted' : has(s, 'restraint_damaged') ? 'restraint.tightening_stopped_after_damage' : 'restraint.tightening_stopped_safe');
  }
}
export function equip(s, tool) {
  if (s.finished || ![null, 'probe', 'pliers'].includes(tool)) return false;
  endInteraction(s, false);
  if (s.equipped === tool) return false;
  s.equipped = tool;
  emit(s, tool === null ? 'tools.put_down' : `${tool}.selected`);
  return true;
}
export function beginInteraction(s, target) {
  if (s.finished || s.active) return false;
  const required = { probe: 'probe', debris: 'pliers', cable: 'pliers', restraint: null };
  if (!(target in required) || required[target] !== s.equipped) return false;
  if (target === 'debris' && has(s, 'debris_removed')) { emit(s, 'debris.already_removed'); return false; }
  if (target === 'cable' && has(s, 'cable_torn')) { emit(s, 'cable.damage_observed'); return false; }
  if (target === 'restraint' && has(s, 'restraint_released')) { emit(s, 'restraint.already_open'); return false; }
  s.active = { target, elapsed: 0, warningRemaining: 0, warned: false, started: false, repeated: false, direction: 0 };
  emit(s, { probe: 'probe.connected', debris: 'debris.gripped', cable: 'cable.gripped', restraint: 'restraint.inspected' }[target]);
  if (target === 'probe' && (s.charge >= LIMITS.safeMax || has(s, 'overload_caused'))) warn(s, 'probe.overload_warning');
  return true;
}
function warn(s, event) {
  if (s.active.warned) return;
  s.active.warned = true;
  s.active.warningRemaining = LIMITS.warningSeconds;
  emit(s, event);
}
export function stepInteraction(s, seconds) {
  if (s.finished || !s.active || !Number.isFinite(seconds) || seconds <= 0) return;
  const dt = Math.min(seconds, 0.1);
  const a = s.active;
  a.elapsed += dt;
  a.warningRemaining = Math.max(0, a.warningRemaining - dt);
  if (a.target !== 'probe') return;
  if (has(s, 'overload_caused')) {
    if (!a.repeated && a.elapsed >= LIMITS.warningSeconds + 0.5) {
      emit(s, 'probe.harm_repeated');
      a.repeated = true;
    }
    return;
  }
  if (!a.started) { emit(s, 'probe.charging'); a.started = true; }
  const before = s.charge;
  s.charge = clamp(s.charge + dt * LIMITS.chargeRate);
  if (before < LIMITS.safeMin && s.charge >= LIMITS.safeMin) emit(s, 'probe.safe_charge_reached');
  if (s.charge > LIMITS.safeMax && !a.warned) warn(s, 'probe.overload_warning');
  if (a.warningRemaining > 1e-9) s.charge = Math.min(s.charge, 0.95);
  if (s.charge >= 1 && a.warned && a.warningRemaining <= 1e-9) record(s, 'overload_caused');
}
export function pullInteraction(s, pixels) {
  const a = s.active;
  if (s.finished || !a || !['debris', 'cable'].includes(a.target) || !Number.isFinite(pixels) || pixels <= 0) return;
  const target = a.target;
  if (target === 'debris' && !a.started) { emit(s, 'debris.extraction_started'); a.started = true; }
  let next = clamp(s[target] + pixels / LIMITS.pullPixels);
  if (target === 'cable') {
    if (next >= 0.5 && !a.warned) { warn(s, 'cable.damage_warning'); next = Math.min(next, Math.max(s.cable, 0.5)); }
    if (a.warningRemaining > 1e-9) next = Math.min(next, Math.max(s.cable, 0.5));
  }
  s[target] = next;
  if (next >= 1) {
    record(s, target === 'debris' ? 'debris_removed' : 'cable_torn');
    s.active = null;
  }
}
export function turnInteraction(s, direction) {
  const a = s.active;
  if (s.finished || !a || a.target !== 'restraint' || !Number.isFinite(direction) || direction === 0) return;
  const sign = Math.sign(direction);
  if (a.direction !== sign) {
    emit(s, sign < 0 ? 'restraint.loosening' : 'restraint.tightening');
    a.direction = sign;
  }
  let next = clamp(s.restraint + sign * LIMITS.notch);
  if (sign > 0 && !has(s, 'restraint_damaged')) {
    if (next >= 0.75 && !a.warned) { warn(s, 'restraint.damage_warning'); next = Math.min(next, Math.max(s.restraint, 0.75)); }
    if (a.warningRemaining > 1e-9) next = Math.min(next, Math.max(s.restraint, 0.75));
  }
  s.restraint = next;
  if (next >= 1) record(s, 'restraint_damaged');
  if (next <= 0) { record(s, 'restraint_released'); s.active = null; }
}
export function resultFromFacts(input) {
  if (!Array.isArray(input) || input.some((fact) => !Object.hasOwn(FACT_VALUES, fact))) throw new Error('Unknown lobby fact');
  const facts = [...new Set(input)];
  const hasFact = (fact) => facts.includes(fact);
  const score = clamp(facts.reduce((sum, fact) => sum + FACT_VALUES[fact], 0), -100, 100);
  return Object.freeze({
    version: 1, score, outcome: score >= 15 ? 'paradise' : score <= -15 ? 'hell' : 'mixed',
    effects: Object.freeze({
      energy: hasFact('overload_caused') ? 'hazard' : hasFact('charge_restored') ? 'support' : 'neutral',
      machinery: hasFact('cable_torn') ? 'hazard' : hasFact('debris_removed') ? 'support' : 'neutral',
      route: hasFact('restraint_released') ? 'open' : hasFact('restraint_damaged') ? 'restricted' : 'neutral',
    }),
    facts: Object.freeze(facts),
    verdictText: facts.length ? facts.map((fact) => FACT_TEXT[fact]).join(' ') : 'No intervention was recorded.',
  });
}
export function finishSession(s) {
  if (s.result) return s.result;
  endInteraction(s, false);
  s.finished = true;
  s.result = resultFromFacts(s.facts);
  emit(s, 'review.ending');
  return s.result;
}
export function selectReaction(catalog, event, facts, spoken = new Set()) {
  return catalog.lines.find((line) => line.event === event && !spoken.has(line.id) &&
    line.requires.allFacts.every((fact) => facts.includes(fact)) &&
    (!line.requires.anyFacts.length || line.requires.anyFacts.some((fact) => facts.includes(fact))) &&
    line.requires.noFacts.every((fact) => !facts.includes(fact))) || null;
}
