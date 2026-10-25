import * as k from "../kit.mjs";

export const SWEEP = Math.PI * 1.5;

export const minutesOf = (clock) => {
  const [fh, fm] = clock.from.split(":").map(Number);
  const [th, tm] = clock.to.split(":").map(Number);
  return th * 60 + tm - fh * 60 - fm;
};

export function kitOf(P) {
  const at = (point) => k.iso(point, P);
  return {
    at,
    S: (paths, style) => k.solidSvg(paths, style),
    L: (d, style) => k.lineSvg(d, style),
    D: (points, style) => k.dotsSvg(points, style),
    depth: ([x, y, z = 0]) => k.depthOf([x, y, z], P),
    byDepth: (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P)),
    halo: (plan, blur = 3) => `<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, -2), 0, 1, P)}" style="filter:blur(${blur}px)"/>`,
  };
}

export function basePlate(P, PLATE, { height = 12, foot = 5 } = {}) {
  const { S, L, D, at, byDepth } = kitOf(P);
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -height - foot, height, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -height - foot, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -height - foot + 1.6, foot - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -height, height, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

export function instruments(P, spec, { LEVER_BOX, LEVER_BOX_H = 20, LEVER_L = 30, GAUGE, GAUGE_R = 24, GAUGE_Z = 22, STRIP }) {
  const { S, L, D, at } = kitOf(P);
  const PIVOT = [LEVER_BOX.x + 17, LEVER_BOX.y + LEVER_BOX.d / 2, LEVER_BOX_H + 6];
  const GAUGE_TOP = GAUGE_Z + 5;
  const TICK_FROM = STRIP.x + 6;
  const TICK_TO = STRIP.x + STRIP.w - 6;
  const PER_MIN = (TICK_TO - TICK_FROM) / minutesOf(spec.clock);

  function leverBox() {
    const out = [kitOf(P).halo(LEVER_BOX)];
    out.push(S(k.slabOf(LEVER_BOX, 0, LEVER_BOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(LEVER_BOX, 6, P, 4), { tone: "faint" }) }));
    out.push(D(k.corners(LEVER_BOX, 3.4).map(([x, y]) => at([x, y, LEVER_BOX_H])), { size: 0.45 }));
    const guide = { x: LEVER_BOX.x + 5, y: PIVOT[1] - 2, w: LEVER_BOX.w - 10, d: 4, r: 1.6 };
    out.push(L(k.planOutline(guide, LEVER_BOX_H, P, 3), { tone: "lo" }));
    for (const dy of [-5.5, 3]) out.push(S(k.slabOf({ x: PIVOT[0] - 4, y: PIVOT[1] + dy, w: 8, d: 2.5, r: 1 }, LEVER_BOX_H, 6, P, 2, 0.3), { tone: "mid" }));
    return out.join("");
  }

  function leverPoints(angle) {
    const [px, py, pz] = PIVOT;
    return { a: at([px, py, pz]), b: at([px + Math.sin(angle) * LEVER_L, py, pz + Math.cos(angle) * LEVER_L]) };
  }

  function lever(angle) {
    const { a, b } = leverPoints(angle);
    const d = `M${a.join(" ")}L${b.join(" ")}`;
    return `<g data-part="lever"><path class="rr-lever-hit" data-lever-part="hit" d="${d}"/><path class="iso-line" data-lever-part="rod" data-tone="hi" d="${d}" style="stroke-width:2.2;stroke-linecap:round"/><circle class="rr-knob" data-lever-part="knob" cx="${b[0]}" cy="${b[1]}" r="${(4 * P.scale).toFixed(2)}"/><circle class="rr-pin" cx="${a[0]}" cy="${a[1]}" r="${(1.6 * P.scale).toFixed(2)}"/></g>`;
  }

  function gaugeNeedle(share) {
    const angle = -SWEEP / 2 + SWEEP * share;
    const [x, y] = GAUGE;
    return k.lineOnTop([x - Math.sin(angle) * 3.4, y + Math.cos(angle) * 3.4], [x + Math.sin(angle) * (GAUGE_R - 4), y - Math.cos(angle) * (GAUGE_R - 4)], GAUGE_TOP + 0.2, P);
  }

  function gauge() {
    const [x, y] = GAUGE;
    const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 20, y: y - 20, w: 40, d: 40, r: 20 }, 0, 1, P)}" style="filter:blur(3px)"/>`];
    out.push(S(k.cylinder(x, y, 16, 0, 2, P, 48), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, 2, GAUGE_Z - 4, P, 32), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 7, 10, P, 20), { tone: "faint" }) }));
    out.push(S(k.cylinder(x, y, 10, GAUGE_Z - 2, 2, P, 40), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, GAUGE_R, GAUGE_Z, 5, P, 72, 0.8), { tone: "hi", crease: "lo" }));
    out.push(L(k.knurl(x, y, GAUGE_R, GAUGE_TOP - 2.6, GAUGE_TOP, 96, P, 0.3), { tone: "lo" }));
    out.push(L(k.ring(x, y, GAUGE_R - 2.4, GAUGE_TOP, P, 72), { tone: "lo" }));
    const ticks = k.radialTicks(x, y, GAUGE_R - 3, 50, 5, GAUGE_TOP, [1.4, 3], P, -SWEEP / 2, SWEEP);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(L(k.ring(x, y, 1.8, GAUGE_TOP, P, 16), { tone: "mid" }));
    out.push(k.faceTextSvg(k.topMatrix([x, y + 10], GAUGE_TOP, P, "x"), "%", { size: 3, tone: "lo", anchor: "middle" }));
    out.push(`<path data-part="ghost-needle" class="rr-ghost" data-free="start" d="${gaugeNeedle(1)}"/>`);
    out.push(`<path data-part="gauge-needle" class="iso-line" data-tone="lit" data-free="start" d="${gaugeNeedle(1)}" style="stroke-width:1.2"/>`);
    return out.join("");
  }

  function strip() {
    const out = [S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" })];
    const ticks = k.topTicks(TICK_FROM, TICK_TO, PER_MIN, 10, STRIP.y + 0.8, 0.8, [2.2, 4.4], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([at([STRIP.x + 2.5, STRIP.y + STRIP.d / 2, 0.8]), at([STRIP.x + STRIP.w - 2.5, STRIP.y + STRIP.d / 2, 0.8])], { size: 0.45 }));
    const label = { x: STRIP.x + 10, y: STRIP.y - 17, w: 30, d: 9, r: 1 };
    out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 6.4], 0.8, P, "x"), spec.clock.zone, { size: 3.4, tone: "lo" }));
    return out.join("") + `<g data-part="events"></g>`;
  }

  function playhead() {
    const block = { x: -4, y: STRIP.y - 1.5, w: 8, d: STRIP.d + 3, r: 1.2 };
    const out = [S(k.slabOf(block, 0.8, 3, P, 2, 0.4), { tone: "hi", lit: true })];
    out.push(L(k.lineOnTop([0, block.y], [0, block.y + block.d], 3.8, P), { tone: "lit" }));
    return `<g data-part="playhead" transform="${k.translateAlong(P, [TICK_FROM, 0, 0])}">${out.join("")}</g>`;
  }

  const pin = (x, h, tone) => k.solidSvg(k.cylinder(x, STRIP.y - 3.2, 1.5, 0, h, P, 16), { tone, crease: "none" });

  return {
    TICK_FROM,
    PER_MIN,
    leverBox,
    lever,
    leverPoints,
    gauge,
    gaugeNeedle,
    strip,
    playhead,
    pin,
    leverAt: [LEVER_BOX.x + LEVER_BOX.w / 2, LEVER_BOX.y + LEVER_BOX.d / 2, 0],
    gaugeAt: [GAUGE[0], GAUGE[1], 0],
  };
}

export function figureFrom(P, spec, width, height, label, body) {
  return k.figureSvg({ width, height, label, body });
}
