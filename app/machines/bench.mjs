import * as k from "../kit.mjs";

export function benchMachine(spec) {
  const WIDTH = 760;
  const HEIGHT = 420;
  const COUNT = spec.model.stages.order.length;
  const MACHINE = spec.figure.machine ?? "pop";
  const THICK = MACHINE === "tray" ? 2 : 1;
  const SEAT = MACHINE === "tray" ? 7 : 0;

  const PLATE = { x: -262, y: -76, w: 524, d: 152, r: 8 };
  const PLATE_H = 12;
  const FOOT_H = 5;
  const BED = { x: -176, y: -36, w: 352, d: 62, r: 3 };
  const BED_H = 4;
  const UNIT_W = 34;
  const UNIT_D = 44;
  const UNIT_Y = -30;
  const UNIT_H = 30;
  const UNIT_TOP = BED_H + UNIT_H;
  const PITCH = 43;
  const UNIT_X = Array.from({ length: COUNT }, (_, index) => -PITCH * (COUNT - 1) / 2 + index * PITCH);
  const SLOT_Y = UNIT_Y + 5;
  const CARD = { w: 20, d: 2.4, h: 17 };
  const DIAL_Y = UNIT_Y + UNIT_D - 15;
  const DIAL_R = 9;
  const DIAL_H = 3;
  const DIAL_TOP = UNIT_TOP + DIAL_H;
  const SWEEP = Math.PI * 1.5;
  const STORE = { x: -214, y: -66, w: 30, d: 30, r: 3 };
  const STORE_H = 74;
  const RAIL_Z = 76;
  const RAIL = { x: -204, y: -56, w: 398, d: 8, r: 1.5 };
  const RAIL_H = 6;
  const POST = [184, -52];
  const SHUTTLE_HOME = -199;
  const ARM_Y = [-58, SLOT_Y + CARD.d + 2];
  const MAG_Z = 58;
  const LEVER_BOX = { x: -252, y: -18, w: 34, d: 38, r: 3 };
  const LEVER_BOX_H = 20;
  const PIVOT = [-235, 1, LEVER_BOX_H + 6];
  const LEVER_L = 30;
  const GAUGE = [222, 6];
  const GAUGE_R = 24;
  const GAUGE_Z = 22;
  const GAUGE_H = 5;
  const GAUGE_TOP = GAUGE_Z + GAUGE_H;
  const STRIP = { x: -236, y: PLATE.y + PLATE.d - 18, w: 472, d: 9, r: 1 };
  const MINUTES = (() => { const [fh, fm] = spec.clock.from.split(":").map(Number); const [th, tm] = spec.clock.to.split(":").map(Number); return th * 60 + tm - fh * 60 - fm; })();
  const TICK_FROM = STRIP.x + 6;
  const TICK_TO = STRIP.x + STRIP.w - 6;
  const PER_MIN = (TICK_TO - TICK_FROM) / MINUTES;

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [STORE.x, STORE.y, RAIL_Z + RAIL_H + 14], [POST[0], POST[1], RAIL_Z + RAIL_H], [PIVOT[0], PIVOT[1] + 14, PIVOT[2] + LEVER_L]],
    WIDTH,
    HEIGHT,
    { pad: 26, azimuth: 60 },
  );

  const at = (point) => k.iso(point, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
  const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));

  function plate() {
    const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
      out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
    const screws = k.corners(PLATE, 11);
    out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    return out.join("");
  }

  function strip() {
    const out = [S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" })];
    const ticks = k.topTicks(TICK_FROM, TICK_TO, PER_MIN, 10, STRIP.y + 0.8, 0.8, [2.2, 4.4], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([at([STRIP.x + 2.5, STRIP.y + STRIP.d / 2, 0.8]), at([STRIP.x + STRIP.w - 2.5, STRIP.y + STRIP.d / 2, 0.8])], { size: 0.45 }));
    const plateAt = { x: STRIP.x + 10, y: STRIP.y - 17, w: 30, d: 9, r: 1 };
    out.push(S(k.slabOf(plateAt, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(plateAt, 1.4), 0.8, P, 3), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([plateAt.x + 4, plateAt.y + 6.4], 0.8, P, "x"), "UTC", { size: 3.4, tone: "lo" }));
    return out.join("");
  }

  function store() {
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(STORE, -3), 0, 1, P)}" style="filter:blur(3px)"/>`];
    const seam = (z) => k.sideSeam(STORE, z, P, 4);
    out.push(S(k.slabOf(STORE, 0, STORE_H, P, 4, 0.8), { tone: "mid", inner: L(seam(10) + seam(STORE_H - 10), { tone: "faint" }) }));
    const cap = k.insetPlan(STORE, -1.5);
    out.push(S(k.slabOf(cap, STORE_H, 3, P, 4, 0.6), { tone: "mid" }));
    out.push(D(k.corners(cap, 4).map(([x, y]) => at([x, y, STORE_H + 3])), { size: 0.45 }));
    const window = { x: STORE.x + 6, y: STORE.y + STORE.d, w: STORE.w - 12 };
    const face = (x, z) => at([x, window.y, z]);
    const slots = [];
    for (let z = 18; z <= 58; z += 4) slots.push(`M${face(window.x, z).join(" ")}L${face(window.x + window.w, z).join(" ")}`);
    out.push(L(`M${face(window.x, 16).join(" ")}L${face(window.x + window.w, 16).join(" ")}L${face(window.x + window.w, 60).join(" ")}L${face(window.x, 60).join(" ")}Z`, { tone: "lo" }));
    out.push(L(slots.join(""), { tone: "faint" }));
    const ledge = { x: SHUTTLE_HOME - CARD.w / 2 - 4, y: STORE.y + STORE.d, w: CARD.w + 8, d: SLOT_Y + CARD.d + 5 - STORE.y - STORE.d, r: 1.4 };
    for (const dx of [3, ledge.w - 6]) {
      out.push(S(k.slabOf({ x: ledge.x + dx, y: ledge.y, w: 3, d: ledge.d - 4, r: 0.8 }, MAG_Z - 14, 10, P, 2, 0.3), { tone: "mid" }));
    }
    out.push(S(k.slabOf(ledge, MAG_Z - 4, 4, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([ledge.x + 3, ledge.y + ledge.d - 2.5, MAG_Z]), at([ledge.x + ledge.w - 3, ledge.y + ledge.d - 2.5, MAG_Z])], { size: 0.45 }));
    return out.join("");
  }

  function rail() {
    const out = [];
    out.push(S(k.cylinder(POST[0], POST[1], 6, 0, 3, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(POST[0], POST[1], 4, 3, RAIL_Z - 3, P, 28), { tone: "mid", crease: "none", inner: L([24, 50].map((z) => k.sideArc(POST[0], POST[1], 4, z, P, 16)).join(""), { tone: "faint" }) }));
    out.push(S(k.slabOf(RAIL, RAIL_Z, RAIL_H, P, 3, 0.6), { tone: "mid" }));
    const groove = { x: RAIL.x + 4, y: RAIL.y + RAIL.d / 2 - 0.6, w: RAIL.w - 8, d: 1.2, r: 0.5 };
    out.push(L(k.planOutline(groove, RAIL_Z + RAIL_H, P, 2), { tone: "faint" }));
    out.push(D([RAIL.x + 8, RAIL.x + RAIL.w - 8].map((x) => at([x, RAIL.y + RAIL.d / 2, RAIL_Z + RAIL_H])), { size: 0.45 }));
    return out.join("");
  }

  function bed() {
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BED, -2), 0, 1, P)}" style="filter:blur(3px)"/>`];
    out.push(S(k.slabOf(BED, 0, BED_H, P, 3, 0.6), { tone: "lo" }));
    const steps = { DOG: 1, PIG: 2, CANARY: 3, GLOBAL: 4 };
    spec.model.stages.order.forEach((stage, index) => {
      const x = UNIT_X[index];
      const count = steps[stage];
      const row = Array.from({ length: count }, (_, n) => at([x - (count - 1) * 1.6 + n * 3.2, UNIT_Y + UNIT_D + 4, BED_H]));
      out.push(D(row, { size: 0.55, tone: "mid" }));
    });
    return out.join("");
  }

  function unit(index) {
    const x = UNIT_X[index];
    const plan = { x: x - UNIT_W / 2, y: UNIT_Y, w: UNIT_W, d: UNIT_D, r: 3 };
    const out = [];
    out.push(S(k.slabOf(plan, BED_H, UNIT_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, BED_H + 8, P, 4), { tone: "faint" }) }));
    out.push(D(k.corners(plan, 3.2).map(([cx, cy]) => at([cx, cy, UNIT_TOP])), { size: 0.45 }));
    const slot = { x: x - CARD.w / 2 - 1.2, y: SLOT_Y - 1, w: CARD.w + 2.4, d: CARD.d + 2, r: 1 };
    out.push(S(k.slabOf(slot, UNIT_TOP, 1.2, P, 2, 0.3), { tone: "mid" }));
    out.push(L(k.planOutline({ x: x - CARD.w / 2 - 0.2, y: SLOT_Y - 0.2, w: CARD.w + 0.4, d: CARD.d + 0.4, r: 0.4 }, UNIT_TOP + 1.2, P, 2), { tone: "lo" }));
    if (MACHINE === "tray") {
      const ruler = k.topTicks(slot.x + 1.2, slot.x + slot.w - 1.2, (slot.w - 2.4) / 20, 5, slot.y + slot.d - 0.8, UNIT_TOP + 1.2, [0.6, 1.2], P);
      out.push(L(ruler.minor, { tone: "faint" }), L(ruler.major, { tone: "lo" }));
    }
    if (MACHINE === "latch") {
      const pivot = [x - UNIT_W / 2 + 5, UNIT_Y + UNIT_D - 5, UNIT_TOP];
      out.push(S(k.cylinder(pivot[0], pivot[1], 1.8, UNIT_TOP, 1.6, P, 16), { tone: "mid" }));
      const armed = `M${at([pivot[0], pivot[1], UNIT_TOP + 1.6]).join(" ")}L${at([pivot[0] + 9, pivot[1], UNIT_TOP + 1.6]).join(" ")}`;
      const sprung = `M${at([pivot[0], pivot[1], UNIT_TOP + 1.6]).join(" ")}L${at([pivot[0], pivot[1], UNIT_TOP + 11]).join(" ")}`;
      const flag = (top) => `M${at([pivot[0], pivot[1], top]).join(" ")}L${at([pivot[0] + 5, pivot[1], top - 1.6]).join(" ")}L${at([pivot[0], pivot[1], top - 3.2]).join(" ")}Z`;
      out.push(`<g data-part="trip" data-index="${index}" class="rr-trip"><path class="rr-trip-armed" d="${armed}"/><g class="rr-trip-sprung"><path d="${sprung}"/><path class="rr-flag" d="${flag(UNIT_TOP + 11)}"/></g></g>`);
    }
    const face = UNIT_Y + UNIT_D;
    const quad = (x0, x1, z0, z1) => `M${at([x0, face, z0]).join(" ")}L${at([x1, face, z0]).join(" ")}L${at([x1, face, z1]).join(" ")}L${at([x0, face, z1]).join(" ")}Z`;
    if (MACHINE === "terminal") {
      out.push(L(quad(x - 13, x + 13, BED_H + 9, BED_H + 27), { tone: "lo" }));
      out.push(`<path data-part="screen" data-index="${index}" class="rr-screen" d="${quad(x - 11.5, x + 11.5, BED_H + 10.5, BED_H + 25.5)}"/>`);
      const lines = [];
      for (let z = BED_H + 13; z <= BED_H + 23; z += 2.5) lines.push(`M${at([x - 11.5, face, z]).join(" ")}L${at([x + 11.5, face, z]).join(" ")}`);
      out.push(`<path class="rr-scan" d="${lines.join("")}"/>`);
    } else {
      const vent = (vx) => `M${at([vx, face, BED_H + 12]).join(" ")}L${at([vx, face, BED_H + 24]).join(" ")}`;
      const vents = [];
      for (let n = -4; n <= 4; n += 1) vents.push(vent(x + n * 2.6));
      out.push(L(quad(x - 12, x + 12, BED_H + 11, BED_H + 25), { tone: "lo" }));
      out.push(L(vents.join(""), { tone: "faint" }));
    }
    out.push(S(k.cylinder(x, DIAL_Y, DIAL_R + 1.2, UNIT_TOP, 1, P, 40), { tone: "lo" }));
    out.push(S(k.cylinder(x, DIAL_Y, DIAL_R, UNIT_TOP + 1, DIAL_H - 1, P, 48, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(x, DIAL_Y, DIAL_R - 1.4, DIAL_TOP, P, 48), { tone: "lo" }));
    const ticks = k.radialTicks(x, DIAL_Y, DIAL_R - 1.8, 20, 5, DIAL_TOP, [1, 2], P, -SWEEP / 2, SWEEP);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(L(k.ring(x, DIAL_Y, 1, DIAL_TOP, P, 12), { tone: "mid" }));
    const led = [x + UNIT_W / 2 - 4.5, UNIT_Y + UNIT_D - 4.5];
    out.push(S(k.cylinder(led[0], led[1], 1.6, UNIT_TOP, 0.8, P, 16), { tone: "mid" }));
    out.push(`<circle data-part="led" data-index="${index}" class="rr-led" cx="${at([led[0], led[1], UNIT_TOP + 0.8])[0]}" cy="${at([led[0], led[1], UNIT_TOP + 0.8])[1]}" r="1.1"/>`);
    out.push(`<path data-part="needle" data-index="${index}" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(index, 0.32)}" style="stroke-width:1"/>`);
    return out.join("");
  }

  function needleAt(index, cpu) {
    const angle = -SWEEP / 2 + SWEEP * cpu;
    const x = UNIT_X[index];
    return k.lineOnTop([x - Math.sin(angle) * 2, DIAL_Y + Math.cos(angle) * 2], [x + Math.sin(angle) * (DIAL_R - 2.4), DIAL_Y - Math.cos(angle) * (DIAL_R - 2.4)], DIAL_TOP + 0.2, P);
  }

  function card(index) {
    const x = UNIT_X[index];
    const plan = { x: x - CARD.w / 2, y: SLOT_Y - (THICK - 1) * CARD.d / 2, w: CARD.w, d: CARD.d * THICK, r: 0.4 };
    const body = S(k.slabOf(plan, UNIT_TOP + 1.2, CARD.h, P, 2, 0.3), { tone: "hi", lit: true });
    const holes = [];
    for (let n = 0; n < 5; n += 1) holes.push(at([x - 7 + n * 3.5, plan.y + plan.d, UNIT_TOP + 1.2 + CARD.h - 4 - (n % 2) * 3]));
    return `<g data-part="card" data-index="${index}" style="opacity:0">${body}${D(holes, { size: 0.55, tone: "lo" })}</g>`;
  }

  function shuttle() {
    const out = [];
    const block = { x: -11, y: RAIL.y - 3, w: 22, d: RAIL.d + 6, r: 2 };
    out.push(S(k.slabOf(block, RAIL_Z + RAIL_H, 7, P, 3, 0.6), { tone: "mid" }));
    out.push(D(k.corners(block, 2.6).map(([x, y]) => at([x, y, RAIL_Z + RAIL_H + 7])), { size: 0.45 }));
    const arm = { x: -3, y: ARM_Y[0] + 6, w: 6, d: ARM_Y[1] - ARM_Y[0] - 2, r: 1.2 };
    out.push(S(k.slabOf(arm, RAIL_Z - 3, 3, P, 2, 0.4), { tone: "mid" }));
    const hanger = { x: -2, y: RAIL.y + 2, w: 4, d: 4, r: 1 };
    out.push(S(k.slabOf(hanger, RAIL_Z - 3, 3 + RAIL_H + 0.01, P, 2), { tone: "mid", crease: "none" }));
    const mag = { x: -CARD.w / 2 - 3, y: SLOT_Y - 3, w: CARD.w + 6, d: CARD.d + 6, r: 1.6 };
    const neck = { x: -2.5, y: SLOT_Y - 1, w: 5, d: 5, r: 1 };
    out.push(S(k.slabOf(neck, MAG_Z + 10, RAIL_Z - 3 - MAG_Z - 10, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf(mag, MAG_Z, 10, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(mag, MAG_Z + 3, P, 3), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(mag, 1.6), MAG_Z + 10, P, 3), { tone: "faint" }));
    return `<g data-part="shuttle" transform="${k.translateAlong(P, [SHUTTLE_HOME, 0, 0])}">${out.join("")}</g>`;
  }

  function leverBox() {
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(LEVER_BOX, -2), 0, 1, P)}" style="filter:blur(3px)"/>`];
    out.push(S(k.slabOf(LEVER_BOX, 0, LEVER_BOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(LEVER_BOX, 6, P, 4), { tone: "faint" }) }));
    out.push(D(k.corners(LEVER_BOX, 3.4).map(([x, y]) => at([x, y, LEVER_BOX_H])), { size: 0.45 }));
    const guide = { x: LEVER_BOX.x + 5, y: PIVOT[1] - 2, w: LEVER_BOX.w - 10, d: 4, r: 1.6 };
    out.push(L(k.planOutline(guide, LEVER_BOX_H, P, 3), { tone: "lo" }));
    for (const dy of [-5.5, 3]) {
      out.push(S(k.slabOf({ x: PIVOT[0] - 4, y: PIVOT[1] + dy, w: 8, d: 2.5, r: 1 }, LEVER_BOX_H, 6, P, 2, 0.3), { tone: "mid" }));
    }
    return out.join("");
  }

  function leverPoints(angle) {
    const [px, py, pz] = PIVOT;
    return { a: at([px, py, pz]), b: at([px + Math.sin(angle) * LEVER_L, py, pz + Math.cos(angle) * LEVER_L]) };
  }

  function lever(angle) {
    const { a, b } = leverPoints(angle);
    const d = `M${a.join(" ")}L${b.join(" ")}`;
    return `<path class="rr-lever-hit" data-lever-part="hit" d="${d}"/><path class="iso-line" data-lever-part="rod" data-tone="hi" d="${d}" style="stroke-width:2.2;stroke-linecap:round"/><circle class="rr-knob" data-lever-part="knob" cx="${b[0]}" cy="${b[1]}" r="${(4 * P.scale).toFixed(2)}"/><circle class="rr-pin" cx="${a[0]}" cy="${a[1]}" r="${(1.6 * P.scale).toFixed(2)}"/>`;
  }

  function gauge() {
    const [x, y] = GAUGE;
    const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 20, y: y - 20, w: 40, d: 40, r: 20 }, 0, 1, P)}" style="filter:blur(3px)"/>`];
    out.push(S(k.cylinder(x, y, 16, 0, 2, P, 48), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, 2, GAUGE_Z - 4, P, 32), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 7, 10, P, 20), { tone: "faint" }) }));
    out.push(S(k.cylinder(x, y, 10, GAUGE_Z - 2, 2, P, 40), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, GAUGE_R, GAUGE_Z, GAUGE_H, P, 72, 0.8), { tone: "hi", crease: "lo" }));
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

  function gaugeNeedle(share) {
    const angle = -SWEEP / 2 + SWEEP * share;
    const [x, y] = GAUGE;
    return k.lineOnTop([x - Math.sin(angle) * 3.4, y + Math.cos(angle) * 3.4], [x + Math.sin(angle) * (GAUGE_R - 4), y - Math.cos(angle) * (GAUGE_R - 4)], GAUGE_TOP + 0.2, P);
  }

  function playhead() {
    const block = { x: -4, y: STRIP.y - 1.5, w: 8, d: STRIP.d + 3, r: 1.2 };
    const out = [S(k.slabOf(block, 0.8, 3, P, 2, 0.4), { tone: "hi", lit: true })];
    out.push(L(k.lineOnTop([0, block.y], [0, block.y + block.d], 3.8, P), { tone: "lit" }));
    return `<g data-part="playhead" transform="${k.translateAlong(P, [TICK_FROM, 0, 0])}">${out.join("")}</g>`;
  }

  const units = UNIT_X.map((x, index) => ({ at: [x, UNIT_Y + UNIT_D / 2, 0], svg: unit(index) + card(index) }));
  const side = [
    { at: [LEVER_BOX.x + LEVER_BOX.w / 2, LEVER_BOX.y + LEVER_BOX.d / 2, 0], svg: leverBox() + `<g data-part="lever">${lever(-0.45)}</g>` },
    { at: [GAUGE[0], GAUGE[1], 0], svg: gauge() },
  ];
  const middle = [...units, ...side].sort((a, b) => depth(a.at) - depth(b.at)).map((item) => item.svg);

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A bench replay of the ${spec.company} outage of ${spec.date}. A store on the left loads a shuttle that runs along an overhead rail and drops ${spec.figure.card.toLowerCase()}, drawn as a punched card, into each of ${COUNT} machines, each a ${spec.figure.unit}. Each machine's dial reads ${spec.figure.dial}. A dial on the right reads ${spec.figure.gauge}. A lever on the left is the ${spec.figure.kill}, and the ruler along the front is the clock.`,
    body: [plate(), strip(), store(), rail(), bed(), `<g data-part="events"></g>`, ...middle, shuttle(), playhead()],
  });


  const geo = { P, UNIT_X, SHUTTLE_HOME, TICK_FROM, PER_MIN, STRIP, WIDTH, HEIGHT, SEAT, MACHINE };

  function mount(svgEl) {
    const pick = (part) => [...svgEl.querySelectorAll(`[data-part="${part}"]`)];
    const needles = pick("needle");
    const leds = pick("led");
    const cards = pick("card");
    const flags = [...pick("screen"), ...pick("trip")];
    const [shuttleEl] = pick("shuttle");
    const shown = { dial: UNIT_X.map(() => 0.32), shuttle: SHUTTLE_HOME, card: UNIT_X.map(() => 30), cardAlpha: UNIT_X.map(() => 0) };
    return ({ now, front, dt, follow }) => {
      shown.shuttle = follow(shown.shuttle, front < 0 ? SHUTTLE_HOME : UNIT_X[front], dt, 0.18);
      shuttleEl.setAttribute("transform", k.translateAlong(P, [shown.shuttle, 0, 0]));
      for (let i = 0; i < COUNT; i += 1) {
        shown.dial[i] = follow(shown.dial[i], now.dial[i], dt, 0.12);
        needles[i].setAttribute("d", needleAt(i, Math.min(1, Math.max(0, shown.dial[i]))));
        const down = now.served[i] < 0.6;
        leds[i].toggleAttribute("data-on", down);
        flags.filter((el) => el.dataset.index === String(i)).forEach((el) => el.toggleAttribute("data-on", down));
        const seated = now.exposed[i] && front >= i && shown.shuttle >= UNIT_X[i] - 3;
        shown.card[i] = follow(shown.card[i], seated ? SEAT : 30, dt, seated ? 0.08 : 0.3);
        shown.cardAlpha[i] = follow(shown.cardAlpha[i], seated ? 1 : 0, dt, seated ? 0.05 : 0.25);
        cards[i].setAttribute("transform", k.translateAlong(P, [0, 0, shown.card[i]]));
        cards[i].style.opacity = shown.cardAlpha[i].toFixed(3);
      }
    };
  }
  return { svg, geo, mount, needleAt, gaugeNeedle, lever, leverPoints, cylinder: (x, y, r, z, h) => k.solidSvg(k.cylinder(x, y, r, z, h, P, 16), { tone: "mid", crease: "none" }), translateAlong: (by) => k.translateAlong(P, by), pin: (x, h, tone) => k.solidSvg(k.cylinder(x, STRIP.y - 3.2, 1.5, 0, h, P, 16), { tone, crease: "none" }) };
}
