import { bench } from "./bench.mjs";
import { simulate, actualLevers, toSeconds, toClock } from "../engine/sim.mjs";
import { esc } from "./views.mjs";

const WALL = 45;
const ARMED = -0.45;
const THROWN = 0.85;

export function mountReplay(root, spec, { autoplay = true } = {}) {
  const B = bench(spec);
  const stage = root.querySelector(".iso-stage");
  if (!stage.querySelector("svg")) stage.innerHTML = B.svg;
  const svg = stage.querySelector("svg");
  const pick = (part) => [...svg.querySelectorAll(`[data-part="${part}"]`)];
  const needles = pick("needle");
  const leds = pick("led");
  const cards = pick("card");
  const [shuttle] = pick("shuttle");
  const [leverGroup] = pick("lever");
  const [gaugeEl] = pick("gauge-needle");
  const [head] = pick("playhead");
  const [pins] = pick("events");
  const readout = root.querySelector("[data-readout]");
  const panel = root.querySelector("[data-play]") ? root : null;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const { UNIT_X, SHUTTLE_HOME, TICK_FROM, PER_MIN } = B.geo;
  const COUNT = UNIT_X.length;
  const END = toSeconds(spec.clock.to, spec.clock.from);
  const actual = actualLevers(spec);
  const reenable = spec.events.find((event) => event.kind === "reenable");
  const reenableAt = reenable ? toSeconds(reenable.at, spec.clock.from) : Infinity;

  let levers = { ...actual };
  let run = simulate(spec, levers);
  const baseline = run.summary;
  let t = 0;
  let playing = autoplay && !still.matches;
  let visible = false;
  let frame = 0;
  let last = 0;
  let rest = 0;
  const shown = { dial: UNIT_X.map(() => 0.32), traffic: 1, shuttle: SHUTTLE_HOME, lever: ARMED, card: UNIT_X.map(() => 30), cardAlpha: UNIT_X.map(() => 0) };

  const follow = (value, target, dt, seconds) => (still.matches ? target : value + (target - value) * (1 - Math.exp(-dt / seconds)));
  const pct = (share) => `${Math.round(share * 100)}%`;
  const clockOf = (seconds) => toClock(seconds, spec.clock.from);
  const $ = (selector) => panel?.querySelector(selector);

  function sampleAt(time) {
    const list = run.samples;
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
    shown.shuttle = follow(shown.shuttle, front < 0 ? SHUTTLE_HOME : UNIT_X[front], dt, 0.18);
    shuttle.setAttribute("transform", B.translateAlong([shown.shuttle, 0, 0]));
    let hit = 0;
    for (let i = 0; i < COUNT; i += 1) {
      shown.dial[i] = follow(shown.dial[i], now.dial[i], dt, 0.12);
      needles[i].setAttribute("d", B.needleAt(i, Math.min(1, Math.max(0, shown.dial[i]))));
      const down = now.served[i] < 0.6;
      if (down) hit += 1;
      leds[i].toggleAttribute("data-on", down);
      const seated = now.exposed[i] && front >= i && shown.shuttle >= UNIT_X[i] - 3;
      shown.card[i] = follow(shown.card[i], seated ? 0 : 30, dt, seated ? 0.08 : 0.3);
      shown.cardAlpha[i] = follow(shown.cardAlpha[i], seated ? 1 : 0, dt, seated ? 0.05 : 0.25);
      cards[i].setAttribute("transform", B.translateAlong([0, 0, shown.card[i]]));
      cards[i].style.opacity = shown.cardAlpha[i].toFixed(3);
    }
    shown.traffic = follow(shown.traffic, now.traffic, dt, 0.15);
    gaugeEl.setAttribute("d", B.gaugeNeedle(Math.min(1, Math.max(0, shown.traffic))));
    const killed = run.summary.kill !== null && t >= run.summary.kill;
    shown.lever = follow(shown.lever, killed ? THROWN : ARMED, dt, 0.12);
    leverGroup.innerHTML = B.lever(shown.lever);
    head.setAttribute("transform", B.translateAlong([TICK_FROM + (t / 60) * PER_MIN, 0, 0]));
    const text = `${clockOf(t)} ${spec.clock.zone} · ${spec.figure.gauge} ${pct(now.traffic)} · ${hit} of ${COUNT} hit`;
    if (readout && readout.textContent !== text) readout.textContent = text;
    if (panel) {
      $("[data-scrub]").value = String(Math.round(t));
      $("[data-clock]").textContent = clockOf(t);
    }
  }

  function tick(stamp) {
    const dt = last ? Math.min((stamp - last) / 1000, 1 / 20) : 1 / 60;
    last = stamp;
    if (playing) {
      if (rest > 0) {
        rest -= dt;
        if (rest <= 0) t = 0;
      } else {
        t += (END / WALL) * dt;
        if (t >= END) { t = END; rest = 2.5; }
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
    start();
  }

  function pullNow() {
    const { page } = run.summary;
    const note = $("[data-pull-note]");
    const say = (text) => { if (note) note.textContent = text; };
    if (page === null) return say("Nothing to pull in this replay.");
    if (t < page) return say(`Nobody knows yet. It's first detected at ${clockOf(page)}.`);
    const lever = spec.levers.find((item) => item.kind === "response");
    const minutes = Math.max(lever.range[0], Math.min(lever.range[1], Math.round((t - page) / 60)));
    levers = { ...levers, [lever.id]: minutes };
    say(`Pulled ${minutes} min after detection.`);
    rerun();
  }

  leverGroup.style.cursor = "pointer";
  leverGroup.addEventListener("click", pullNow);

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
  }

  if (still.matches && run.summary.page !== null) t = Math.min(END, run.summary.page + 300);
  rerun();
  draw(1);
}
