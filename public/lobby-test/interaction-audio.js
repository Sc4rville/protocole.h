const ASSETS = {
  pickup: 'mechanics/tool_pickup_01.ogg',
  putdown: 'mechanics/tool_putdown_01.ogg',
  click1: 'mechanics/restraint_click_01.ogg',
  click2: 'mechanics/restraint_click_02.ogg',
  tightening: 'mechanics/restraint_mechanism_01.ogg',
  loosening: 'mechanics/restraint_mechanism_02.ogg',
  impact: 'mechanics/metal_impact_01.ogg',
  charge: 'electricity/probe_charge_01.ogg',
  connect: 'electricity/probe_connect_01.ogg',
  disconnect: 'electricity/probe_disconnect_01.ogg',
  arc: 'electricity/probe_arc_snap_01.ogg',
  confirm: 'ui/ui_confirm_01.ogg',
  warning: 'ui/ui_warning_01.ogg',
  strain: 'metal/metal_strain_01.ogg',
  lowImpact: 'impacts/metal_impact_low_01.ogg',
};

const EVENTS = new Map([
  ['probe.selected', ['pickup']],
  ['pliers.selected', ['pickup']],
  ['tools.put_down', ['putdown']],
  ['probe.connected', ['connect']],
  ['probe.disconnected_early', ['disconnect']],
  ['probe.disconnected_before_damage', ['disconnect']],
  ['probe.disconnected_after_damage', ['disconnect']],
  ['charge_restored', ['disconnect']],
  ['probe.safe_charge_reached', ['confirm']],
  ['probe.overload_warning', ['warning']],
  ['cable.damage_warning', ['warning']],
  ['restraint.damage_warning', ['warning']],
  ['overload_caused', ['arc']],
  ['probe.harm_repeated', ['arc']],
  ['debris.gripped', ['click1']],
  ['debris.extraction_started', ['strain']],
  ['debris_removed', ['click2']],
  ['cable_torn', ['arc', 'impact']],
  ['restraint.tightening', ['tightening']],
  ['restraint.loosening', ['loosening']],
  ['restraint_released', ['click2']],
  ['restraint_damaged', ['lowImpact']],
  ['review.ending', ['confirm']],
]);

export function createInteractionAudio() {
  let ctx = null;
  let master = null;
  let loading = null;
  let abort = null;
  let ready = false;
  let disposed = false;
  let muted = false;
  let active = true;
  let loop = null;
  const buffers = new Map();
  const shots = new Set();

  function disconnect(node) {
    try { node?.disconnect(); } catch {}
  }

  function forget(record) {
    record.source.onended = null;
    disconnect(record.source);
    disconnect(record.gain);
    shots.delete(record);
    if (loop === record) loop = null;
  }

  function stop(record) {
    if (!record) return;
    try { record.source.stop(); } catch {}
    forget(record);
  }

  function stopAll() {
    stop(loop);
    for (const record of shots) stop(record);
  }

  async function load(id, path) {
    for (const candidate of [path, path.replace(/\.ogg$/, '.mp3')]) {
      if (disposed) return;
      try {
        const response = await fetch(new URL('../audio/' + candidate, import.meta.url), {
          ...(abort ? { signal: abort.signal } : {}),
        });
        if (!response.ok) continue;
        const data = await response.arrayBuffer();
        if (disposed) return;
        const buffer = await ctx.decodeAudioData(data);
        if (!disposed) buffers.set(id, buffer);
        return;
      } catch {}
    }
  }

  function start() {
    if (disposed) return Promise.resolve(false);
    if (loading) return loading;
    loading = (async () => {
      try {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return false;
        ctx = new Context();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.25;
        master.connect(ctx.destination);
        if (typeof globalThis.AbortController === 'function') abort = new AbortController();
        await ctx.resume();
        if (disposed) return false;
        await Promise.all(Object.entries(ASSETS).map(([id, path]) => load(id, path)));
        ready = !disposed && buffers.size > 0;
        return ready;
      } catch {
        return false;
      }
    })();
    return loading;
  }

  function play(id, looping = false) {
    if (!ready || disposed || !active || !buffers.has(id)) return null;
    if (!looping && shots.size >= 8) stop(shots.values().next().value);
    let source;
    let gain;
    let record;
    try {
      source = ctx.createBufferSource();
      gain = ctx.createGain();
      source.buffer = buffers.get(id);
      source.loop = looping;
      gain.gain.value = looping ? 0.13 : 0.4;
      source.connect(gain);
      gain.connect(master);
      record = { source, gain };
      source.onended = () => forget(record);
      if (looping) loop = record;
      else shots.add(record);
      const now = ctx.currentTime;
      if (!looping) {
        const duration = Math.min(source.buffer.duration, 1.2);
        gain.gain.setValueAtTime(0.4, now + Math.max(0, duration - 0.02));
        gain.gain.linearRampToValueAtTime(0, now + duration);
        source.start(now);
        source.stop(now + duration);
      } else {
        source.start(now);
      }
      return record;
    } catch {
      if (record) stop(record);
      else {
        disconnect(source);
        disconnect(gain);
      }
      return null;
    }
  }

  function update({ active: nextActive, charging, charge }) {
    if (disposed) return;
    active = Boolean(nextActive);
    if (!active) {
      stopAll();
      return;
    }
    if (!charging) {
      stop(loop);
      return;
    }
    if (!loop) play('charge', true);
    if (loop) {
      const fraction = typeof charge === 'number' && !Number.isNaN(charge)
        ? Math.max(0, Math.min(1, charge)) : 0;
      try { loop.source.playbackRate.value = 0.85 + 0.45 * fraction; } catch {}
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master && !disposed) {
      try { master.gain.value = muted ? 0 : 0.25; } catch {}
    }
  }

  function cue(eventName) {
    for (const id of EVENTS.get(eventName) || []) play(id);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    abort?.abort();
    stopAll();
    buffers.clear();
    disconnect(master);
    if (ctx) {
      try { Promise.resolve(ctx.close()).catch(() => {}); } catch {}
    }
  }

  return { start, setMuted, update, cue, dispose };
}
