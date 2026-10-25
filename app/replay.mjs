import { bench } from "./bench.mjs";
import { simulate, actualLevers, toSeconds, toClock } from "../engine/sim.mjs";
import { esc } from "./views.mjs";

const WALL = 45;
const SLOW = 0.35;

function synth() {
  let context = null;
  const ensure = () => (context ??= new (window.AudioContext || window.webkitAudioContext)());
  const tone = (freq, duration, { type = "sine", gain = 0.06, slide = 0, delay = 0 } = {}) => {
    const ctx = ensure();
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), at + duration);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  };
  return {
    wake: () => ensure().resume(),
    drop: () => tone(1400, 0.05, { type: "square", gain: 0.025 }),
    alarm: () => { for (let n = 0; n < 3; n += 1) tone(880, 0.16, { type: "triangle", gain: 0.07, delay: n * 0.24 }); },
    thunk: () => { tone(140, 0.22, { type: "sine", gain: 0.12, slide: -80 }); tone(60, 0.3, { type: "triangle", gain: 0.08 }); },
    crash: () => tone(220, 0.35, { type: "sawtooth", gain: 0.03, slide: -150 }),
  };
}
const ARMED = -0.45;
const THROWN = 0.85;

export function mountReplay(root, spec, { autoplay = true } = {}) {
  const B = bench(spec);
  const stage = root.querySelector(".iso-stage");
  if (!stage.querySelector("svg")) stage.innerHTML = B.svg;
  const svg = stage.querySelector("svg");
  const pick = (part) => [...svg.querySelectorAll(`[data-part="${part}"]`)];
  const machine = B.mount(svg);
  const [leverGroup] = pick("lever");
  const leverParts = Object.fromEntries([...leverGroup.querySelectorAll("[data-lever-part]")].map((el) => [el.dataset.leverPart, el]));
  const [gaugeEl] = pick("gauge-needle");
  const [ghostEl] = pick("ghost-needle");
  const [head] = pick("playhead");
  const [pins] = pick("events");
  const readout = root.querySelector("[data-readout]");
  const panel = root.querySelector("[data-play]") ? root : null;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const { TICK_FROM, PER_MIN } = B.geo;
  const COUNT = spec.model.stages.order.length;
  const END = toSeconds(spec.clock.to, spec.clock.from);
  const actual = actualLevers(spec);
  const reenable = spec.events.find((event) => event.kind === "reenable");
  const reenableAt = reenable ? toSeconds(reenable.at, spec.clock.from) : Infinity;

  const responseLever = spec.levers.find((item) => item.kind === "response");
  const fromHash = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    const next = { ...actual };
    for (const lever of spec.levers) {
      const value = params.get(lever.id);
      if (value === null) continue;
      if (lever.options?.includes(value)) next[lever.id] = value;
      if (lever.range && Number(value) >= lever.range[0] && Number(value) <= lever.range[1]) next[lever.id] = Number(value);
    }
    return next;
  };
  let levers = panel ? fromHash() : { ...actual };
  const baselineRun = simulate(spec, actual);
  const baseline = baselineRun.summary;
  let run = simulate(spec, levers);
  let mode = "free";
  let holdUntil = 0;
  let sound = null;
  let lastT = 0;
  let lastFront = -1;
  let wasDown = 0;
  let t = 0;
  let playing = autoplay && !still.matches;
  let visible = false;
  let frame = 0;
  let last = 0;
  let rest = 0;
  const shown = { traffic: 1, lever: ARMED };

  const follow = (value, target, dt, seconds) => (still.matches ? target : value + (target - value) * (1 - Math.exp(-dt / seconds)));
  const pct = (share) => `${Math.round(share * 100)}%`;
  const clockOf = (seconds) => toClock(seconds, spec.clock.from);
  const $ = (selector) => panel?.querySelector(selector);

  function sampleAt(time, source = run) {
    const list = source.samples;
    const index = Math.min(list.length - 1, Math.max(0, time / 5));
    const lo = list[Math.floor(index)];
    const hi = list[Math.min(list.length - 1, Math.ceil(index))];
    const f = index - Math.floor(index);
    return {
      dial: lo.dial.map((value, i) => value + (hi.dial[i] - value) * f),
      served: lo.served.map((value, i) => value + (hi.served[i] - value) * f),
      exposed: (f < 0.5 ? lo : hi).exposed,
      traffic: lo.traffic + (hi.traffic - lo.traffic) * f,
    };
  }

  function frontAt(time, exposed) {
    if (run.summary.kill !== null && time >= run.summary.kill) return -1;
    if (time >= reenableAt) return -1;
    let front = -1;
    exposed.forEach((on, index) => { if (on) front = Math.max(front, index); });
    return front;
  }

  function drawPins() {
    const marks = run.events.filter((event) => ["deploy", "page", "identify", "kill", "recovered"].includes(event.kind));
    pins.innerHTML = marks.map((event) => B.pin(TICK_FROM + (event.at / 60) * PER_MIN, event.kind === "kill" ? 4 : 2.6, event.kind === "kill" ? "hi" : "mid")).join("");
  }

  function draw(dt) {
    const now = sampleAt(t);
    const front = frontAt(t, now.exposed);
    const hit = now.served.filter((value) => value < 0.6).length;
    machine({ now, front, dt, follow, t, killed: run.summary.kill !== null && t >= run.summary.kill });
    shown.traffic = follow(shown.traffic, now.traffic, dt, 0.15);
    gaugeEl.setAttribute("d", B.gaugeNeedle(Math.min(1, Math.max(0, shown.traffic))));
    const differs = mode === "free" && !sameAsActual();
    if (ghostEl) {
      ghostEl.toggleAttribute("data-on", differs);
      if (differs) ghostEl.setAttribute("d", B.gaugeNeedle(Math.min(1, Math.max(0, sampleAt(t, baselineRun).traffic))));
    }
    const killed = run.summary.kill !== null && t >= run.summary.kill;
    shown.lever = follow(shown.lever, killed ? THROWN : ARMED, dt, 0.12);
    const { a, b } = B.leverPoints(shown.lever);
    const d = `M${a.join(" ")}L${b.join(" ")}`;
    leverParts.rod.setAttribute("d", d);
    leverParts.hit.setAttribute("d", d);
    leverParts.knob.setAttribute("cx", b[0]);
    leverParts.knob.setAttribute("cy", b[1]);
    head.setAttribute("transform", B.translateAlong([TICK_FROM + (t / 60) * PER_MIN, 0, 0]));
    const text = `${clockOf(t)} ${spec.clock.zone}
${spec.figure.gauge} ${pct(now.traffic)}
${hit} of ${COUNT} machines hit`;
    if (readout && readout.textContent !== text) readout.textContent = text;
    if (panel) {
      $("[data-scrub]").value = String(Math.round(t));
      $("[data-clock]").textContent = clockOf(t);
    }
    cues(front, hit);
    if (mode === "oncall") shift();
    lastT = t;
  }

  function cues(front, hit) {
    if (!sound || t < lastT) { lastFront = front; wasDown = hit; return; }
    if (front > lastFront && front >= 0) sound.drop();
    const page = run.summary.page;
    if (page !== null && lastT < page && t >= page) sound.alarm();
    const kill = run.summary.kill;
    if (kill !== null && lastT < kill && t >= kill) sound.thunk();
    if (hit > wasDown && hit === COUNT) sound.crash();
    lastFront = front;
    wasDown = hit;
  }

  const sameAsActual = () => Object.keys(actual).every((id) => String(actual[id]) === String(levers[id]));
  const realPage = baseline.page;
  const realKill = baseline.kill;
  const pageQuote = spec.events.find((event) => event.kind === "page")?.quote;
  const deployAt = toSeconds(spec.events.find((event) => event.kind === "deploy").at, spec.clock.from);

  function shift() {
    const text = $("[data-oncall-text]");
    if (realPage === null || t < realPage) {
      if (performance.now() < holdUntil) return;
      text.removeAttribute("data-alert");
      const said = t < deployAt ? "Quiet shift. Everything on the board is green." : "Something on the board looks off. Nobody has paged you yet.";
      if (text.textContent !== said) text.textContent = said;
      return;
    }
    if (!text.hasAttribute("data-alert")) {
      text.setAttribute("data-alert", "");
      text.textContent = pageQuote ? `You've been paged: "${pageQuote}". Pull the ${spec.figure.kill} when you're sure.` : `Something is badly wrong. Pull the ${spec.figure.kill} when you're sure.`;
    }
    if (t >= realPage + responseLever.range[1] * 60) finishShift(null);
  }

  function lock(locked) {
    for (const control of panel.querySelectorAll("[data-lever] button, [data-lever] input, [data-reset], [data-scrub]")) control.disabled = locked;
    root.querySelector("#timeline")?.classList.toggle("br-hidden", locked);
  }

  function startShift() {
    mode = "oncall";
    levers = { ...actual, [responseLever.id]: responseLever.range[1] };
    run = simulate(spec, levers);
    t = 0;
    lastT = 0;
    playing = true;
    rest = 0;
    $("[data-oncall]").hidden = false;
    $("[data-oncall-result]").hidden = true;
    $("[data-oncall-text]").removeAttribute("data-alert");
    $("[data-play]").textContent = "Pause";
    $("[data-copy]").textContent = "Copy my result";
    lock(true);
    drawPins();
    render();
    stage.scrollIntoView({ behavior: still.matches ? "auto" : "smooth", block: "center" });
    start();
  }

  function finishShift(minutes) {
    if (minutes !== null) levers = { ...actual, [responseLever.id]: minutes };
    run = simulate(spec, levers);
    mode = "done";
    const mine = run.summary;
    const text = $("[data-oncall-text]");
    text.removeAttribute("data-alert");
    text.textContent = minutes === null ? `You never pulled the ${spec.figure.kill}.` : `You pulled the ${spec.figure.kill} at ${clockOf(mine.kill)}.`;
    const diff = Math.round((realKill - mine.kill) / 60);
    const saved = baseline.lostTrafficMinutes > 0 ? Math.round((1 - mine.lostTrafficMinutes / baseline.lostTrafficMinutes) * 100) : 0;
    const team = `${esc(spec.company)}'s team`;
    const versus = diff > 0 ? `<b>${diff} min faster</b> than ${team}` : diff < 0 ? `<b>${-diff} min slower</b> than ${team}` : `the same minute as ${team}`;
    const traffic = saved > 0 ? `, and your replay lost <b>${saved}% less traffic</b>` : saved < 0 ? `, and your replay lost <b>${-saved}% more traffic</b>` : "";
    $("[data-oncall-score]").innerHTML = minutes === null
      ? `The real team pulled it at ${clockOf(realKill)}.`
      : `That's ${versus}${traffic}. They found out in real time, under pressure. You had a replay, so read the timeline below to see what slowed them down.`;
    $("[data-oncall-result]").hidden = false;
    const said = diff > 0 ? `${diff} min faster than the real team` : diff < 0 ? `${-diff} min slower than the real team` : "at the same minute as the real team";
    $("[data-oncall-result]").dataset.share = minutes === null ? "" : `I took the on-call shift for the ${spec.company} outage of ${spec.date} on Blast Radius and pulled the ${spec.figure.kill} ${said}. ${location.origin}${location.pathname}`;
    $("[data-copy]").hidden = minutes === null;
    lock(false);
    for (const control of panel.querySelectorAll("[data-lever] button, [data-lever] input, [data-reset]")) control.disabled = true;
    playing = true;
    drawPins();
    render();
  }

  function exitShift() {
    mode = "free";
    levers = { ...actual };
    $("[data-oncall]").hidden = true;
    lock(false);
    rerun();
  }

  function tick(stamp) {
    const dt = last ? Math.min((stamp - last) / 1000, 1 / 20) : 1 / 60;
    last = stamp;
    if (playing) {
      if (rest > 0) {
        rest -= dt;
        if (rest <= 0) t = 0;
      } else {
        const alert = mode === "oncall" && realPage !== null && t >= realPage;
        t += (END / WALL) * dt * (alert ? SLOW : 1);
        if (t >= END) {
          t = END;
          if (mode === "oncall") finishShift(null);
          if (mode === "done") playing = false;
          else rest = 2.5;
        }
      }
    }
    draw(dt);
    frame = visible ? requestAnimationFrame(tick) : 0;
  }

  const start = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) start(); }, { rootMargin: "120px 0px" }).observe(stage);

  const summaryHtml = (summary) => summary.page === null
    ? `<b>No outage</b><span>The change never takes a machine down, so nothing pages anyone.</span>`
    : `<b>${pct(1 - summary.worstTraffic)} lost at worst</b><span>${summary.downMinutes} min under half · ${summary.exposedUnits} of ${COUNT} machines got it${1 - summary.endTraffic > 0.05 ? ` · ${pct(1 - summary.endTraffic)} still down when the clock ends` : ""}</span>`;

  function render() {
    if (!panel) return;
    for (const box of panel.querySelectorAll("[data-lever]")) {
      const id = box.dataset.lever;
      for (const button of box.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.value === String(levers[id])));
      const range = box.querySelector("input");
      if (range) {
        range.value = String(levers[id]);
        box.querySelector("[data-value]").textContent = `${levers[id]} min`;
      }
    }
    $("[data-reset]").disabled = Object.keys(actual).every((id) => String(actual[id]) === String(levers[id]));
    $('[data-result="actual"]').innerHTML = summaryHtml(baseline);
    $('[data-result="replay"]').innerHTML = summaryHtml(run.summary);
    const source = Object.fromEntries(spec.sources.map((item) => [item.id, item]));
    $("[data-log]").innerHTML = run.events.map((event) => {
      const match = spec.events.find((item) => item.kind === event.kind && item.at === event.clock.slice(0, 5));
      const note = match ? `<q>${esc(match.quote)}</q> <a href="${esc(source[match.source].url)}" target="_blank" rel="noopener">source</a>` : `<span class="br-tag">modelled</span>`;
      return `<li><time>${event.clock}</time><span class="br-log-label">${esc(event.label)}</span><span class="br-log-note">${note}</span></li>`;
    }).join("");
  }

  function rerun() {
    run = simulate(spec, levers);
    drawPins();
    render();
    if (panel && mode === "free") {
      const params = new URLSearchParams();
      for (const lever of spec.levers) if (String(levers[lever.id]) !== String(actual[lever.id])) params.set(lever.id, String(levers[lever.id]));
      const hash = params.toString();
      history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
      $("[data-ghost-note]").hidden = !hash;
    }
    start();
  }

  function pullNow() {
    if (mode === "oncall") {
      if (realPage === null || t < realPage) {
        holdUntil = performance.now() + 2600;
        $("[data-oncall-text]").textContent = "Nobody has paged you yet. Pulling a global switch on a hunch is how outages start.";
        return;
      }
      const minutes = Math.max(responseLever.range[0], Math.min(responseLever.range[1], Math.round((t - realPage) / 60)));
      return finishShift(minutes);
    }
    if (mode === "done") return;
    const { page } = run.summary;
    const note = root.querySelector("[data-pull-note]");
    const say = (text) => { if (note) note.textContent = text; };
    if (page === null) return say("Nothing to pull in this replay.");
    if (run.summary.kill !== null && t >= run.summary.kill) return say(`Already pulled at ${clockOf(run.summary.kill)}. Let the clock loop round to try pulling it sooner.`);
    if (t < page) return say(`Nobody knows yet. It's first detected at ${clockOf(page)}.`);
    const lever = spec.levers.find((item) => item.kind === "response");
    const minutes = Math.max(lever.range[0], Math.min(lever.range[1], Math.round((t - page) / 60)));
    levers = { ...levers, [lever.id]: minutes };
    say(`Pulled ${minutes} min after detection.`);
    rerun();
  }

  leverGroup.style.cursor = "pointer";
  leverGroup.addEventListener("click", pullNow);
  stage.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); pullNow(); }
    if (event.key === " " && panel) { event.preventDefault(); $("[data-play]").click(); }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && panel) {
      event.preventDefault();
      t = Math.max(0, Math.min(END, t + (event.key === "ArrowRight" ? 60 : -60)));
      playing = false;
      $("[data-play]").textContent = "Play";
      start();
    }
  });

  if (panel) {
    $("[data-play]").addEventListener("click", (event) => {
      playing = !playing;
      rest = 0;
      if (playing && t >= END) t = 0;
      event.currentTarget.textContent = playing ? "Pause" : "Play";
      start();
    });
    $("[data-scrub]").addEventListener("input", (event) => {
      t = Number(event.currentTarget.value);
      playing = false;
      rest = 0;
      $("[data-play]").textContent = "Play";
      start();
    });
    for (const box of panel.querySelectorAll("[data-lever]")) {
      const id = box.dataset.lever;
      for (const button of box.querySelectorAll("button")) button.addEventListener("click", () => { levers = { ...levers, [id]: button.dataset.value }; rerun(); });
      const range = box.querySelector("input");
      if (range) range.addEventListener("input", () => { levers = { ...levers, [id]: Number(range.value) }; rerun(); });
    }
    $("[data-reset]").addEventListener("click", () => { levers = { ...actual }; rerun(); });
    $("[data-pull]").addEventListener("click", pullNow);
    $("[data-play]").textContent = playing ? "Pause" : "Play";
    for (const button of panel.querySelectorAll("[data-oncall-start]")) button.addEventListener("click", () => { sound?.wake(); startShift(); });
    $("[data-oncall-exit]").addEventListener("click", exitShift);
    $("[data-copy]").addEventListener("click", async (event) => {
      const share = $("[data-oncall-result]").dataset.share;
      if (!share) return;
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(share);
        button.textContent = "Copied";
      } catch {
        button.textContent = "Could not copy";
      }
    });
    $("[data-sound]").addEventListener("click", (event) => {
      const button = event.currentTarget;
      sound = sound ? null : synth();
      sound?.wake();
      button.setAttribute("aria-pressed", String(!!sound));
      button.textContent = sound ? "Sound on" : "Sound off";
    });
  }

  if (still.matches && run.summary.page !== null) t = Math.min(END, run.summary.page + 300);
  rerun();
  draw(1);
}
