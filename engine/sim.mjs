const SAMPLE = 5;
const BASE = 0.32;
const STEP = { DOG: 0, PIG: 1, CANARY: 2, GLOBAL: 3 };
const COMPUTED = new Set(["page", "identify", "kill", "recovered"]);

export const toSeconds = (hhmm, origin) => {
  const [h, m] = hhmm.split(":").map(Number);
  const [oh, om] = origin.split(":").map(Number);
  return (h * 60 + m - (oh * 60 + om)) * 60;
};

export const toClock = (seconds, origin) => {
  const [oh, om] = origin.split(":").map(Number);
  const total = oh * 3600 + om * 60 + Math.round(seconds);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const actualLevers = (spec) => Object.fromEntries(spec.levers.map((lever) => [lever.id, lever.actual]));

const eventAt = (spec, kind) => {
  const event = spec.events.find((item) => item.kind === kind);
  return event ? toSeconds(event.at, spec.clock.from) : null;
};

export function simulate(spec, levers = actualLevers(spec)) {
  const origin = spec.clock.from;
  const model = spec.model;
  const end = toSeconds(spec.clock.to, origin);
  const deploy = eventAt(spec, "deploy");
  const reenable = eventAt(spec, "reenable");
  const actualPage = eventAt(spec, "page");
  const actualIdentify = eventAt(spec, "identify");
  const actualKill = eventAt(spec, "kill");
  const diagnoseShare = actualIdentify !== null && actualPage !== null ? (actualIdentify - actualPage) / (actualKill - actualPage) : null;
  const { order, share } = model.stages;
  const count = order.length;
  const isActual = spec.levers.every((lever) => String(lever.actual) === String(levers[lever.id]));
  const staged = spec.levers.some((lever) => lever.kind === "rollout" && levers[lever.id] === "staged");
  const harmless = spec.levers.some((lever) => lever.kind === "prevent" && levers[lever.id] === lever.fix);
  const spread = model.propagation.seconds ?? 0;
  const stageSeconds = (model.stageMinutes ?? 10) * 60;

  const arrival = order.map((stage, index) => (staged ? deploy + STEP[stage] * stageSeconds : deploy + (spread * index) / (count - 1)));
  const flap = model.propagation.mode === "flap";
  const period = (model.propagation.periodMinutes ?? 5) * 60;
  const steady = flap ? toSeconds(model.propagation.steadyAt, origin) : deploy;
  const badAt = (t) => !flap || t >= steady || Math.floor((t - deploy) / period) % 2 === 0;

  const firstHarm = harmless ? null : Math.min(...arrival);
  const page = firstHarm === null ? null : firstHarm + (model.detectMinutes ?? 0) * 60;
  const responseLever = spec.levers.find((lever) => lever.kind === "response");
  const kill = page === null ? null : page + levers[responseLever.id] * 60;
  const identify = page === null || diagnoseShare === null ? null : page + (kill - page) * diagnoseShare;

  const effect = model.effect;
  const recovery = model.recovery;
  const crash = effect.kind === "crash";
  const tauUp = effect.tauUpSeconds ?? (crash ? 4 : 10);
  const tauDown = recovery.tauSeconds ?? 120;
  const knee = effect.knee ?? 0.5;
  const peak = effect.peak ?? 0.99;

  const label = (kind, fallback) => spec.events.find((item) => item.kind === kind)?.label ?? fallback;
  const fired = [];
  const mark = (kind, at, text) => fired.push({ kind, at, clock: toClock(at, origin), label: text });
  for (const event of spec.events) {
    if (COMPUTED.has(event.kind)) continue;
    const at = toSeconds(event.at, origin);
    if (at <= deploy || isActual) mark(event.kind, at, event.label);
  }
  if (page !== null) mark("page", page, label("page", "Detected"));
  if (identify !== null) mark("identify", identify, label("identify", "Cause identified"));
  if (kill !== null) mark("kill", kill, label("kill", "Change pulled"));

  const level = order.map(() => 0);
  const crashed = order.map(() => false);
  const samples = [];
  let recovered = null;
  let worst = 1;
  let lostSeconds = 0;
  let downSeconds = 0;
  for (let t = 0; t <= end; t += 1) {
    const live = order.map((_, index) => !harmless && t >= arrival[index] && (kill === null || t < kill) && (reenable === null || t < reenable) && badAt(t));
    const exposed = order.map((_, index) => !harmless && t >= arrival[index] && (kill === null || arrival[index] < kill) && badAt(t) && (kill === null || t < kill));
    const served = order.map((_, index) => {
      if (live[index]) crashed[index] = true;
      const held = recovery.kind === "manual" && crashed[index];
      const target = live[index] || held ? 1 : 0;
      const tau = target > level[index] ? tauUp : tauDown;
      level[index] += (target - level[index]) * (1 - Math.exp(-1 / tau));
      const hit = crash ? level[index] : Math.min(1, Math.max(0, (level[index] - knee) / (1 - knee)));
      return 1 - (1 - effect.served) * hit;
    });
    const dial = order.map((_, index) => (crash ? BASE * (1 - level[index]) : BASE + (peak - BASE) * level[index]));
    const traffic = served.reduce((sum, value, index) => sum + value * share[index], 0) / share.reduce((a, b) => a + b, 0);
    worst = Math.min(worst, traffic);
    lostSeconds += 1 - traffic;
    if (traffic < 0.5) downSeconds += 1;
    if (kill !== null && t > kill && recovered === null && traffic > 0.95) {
      recovered = t;
      mark("recovered", t, label("recovered", "Back to normal"));
    }
    if (t % SAMPLE === 0) samples.push({ t, dial: dial.map((value) => +value.toFixed(3)), served: served.map((value) => +value.toFixed(3)), exposed, traffic: +traffic.toFixed(3) });
  }
  fired.sort((a, b) => a.at - b.at);
  const reached = arrival.filter((at) => kill === null || at < kill);

  return {
    levers,
    origin,
    end,
    arrival,
    samples,
    events: fired,
    summary: {
      worstTraffic: +worst.toFixed(3),
      endTraffic: samples[samples.length - 1].traffic,
      downMinutes: +(downSeconds / 60).toFixed(1),
      outageMinutes: recovered !== null && firstHarm !== null ? +((recovered - firstHarm) / 60).toFixed(1) : null,
      lostTrafficMinutes: +(lostSeconds / 60).toFixed(1),
      exposedUnits: harmless ? 0 : reached.length,
      fleetSeconds: harmless ? 0 : +(Math.max(...reached, deploy) - deploy).toFixed(2),
      firstHarm,
      page,
      kill,
      recovered,
    },
  };
}

export function check(spec, run, item) {
  const at = (hhmm) => toSeconds(hhmm, spec.clock.from);
  const s = run.summary;
  const within = (value, target, tol) => value !== null && Math.abs(value - target) <= tol;
  switch (item.metric) {
    case "worstLost": return { ok: within(1 - s.worstTraffic, item.value, item.tol ?? 0.02), got: +(1 - s.worstTraffic).toFixed(3) };
    case "outageMinutes": return { ok: within(s.outageMinutes, item.value, item.tol ?? 1), got: s.outageMinutes };
    case "recoveredBy": return { ok: s.recovered !== null && s.recovered <= at(item.at), got: s.recovered === null ? null : toClock(s.recovered, spec.clock.from) };
    case "killAt": return { ok: s.kill === at(item.at), got: s.kill === null ? null : toClock(s.kill, spec.clock.from) };
    case "pageAt": return { ok: s.page === at(item.at), got: s.page === null ? null : toClock(s.page, spec.clock.from) };
    case "fleetWithin": return { ok: s.fleetSeconds <= item.value && s.exposedUnits === spec.model.stages.order.length, got: s.fleetSeconds };
    case "downAtEnd": return { ok: 1 - s.endTraffic >= item.value, got: +(1 - s.endTraffic).toFixed(3) };
    default: return { ok: false, got: `unknown metric ${item.metric}` };
  }
}
