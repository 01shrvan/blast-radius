import * as k from "../kit.mjs";
import * as G from "../../vendor/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../vendor/kit/tube.mjs";
import { basePlate, instruments, kitOf } from "./common.mjs";

export function pegboard(spec) {
  const WIDTH = 760;
  const HEIGHT = 440;
  const COUNT = spec.model.stages.order.length;

  const PLATE = { x: -262, y: -76, w: 524, d: 152, r: 8 };
  const BED = { x: -180, y: -40, w: 360, d: 46, r: 3 };
  const BED_H = 4;
  const PITCH = 43;
  const XS = Array.from({ length: COUNT }, (_, index) => -PITCH * (COUNT - 1) / 2 + index * PITCH);
  const BOARD_Y = -30;
  const BOARD_D = 9;
  const FRONT = BOARD_Y + BOARD_D;
  const BOARD_W = 34;
  const Z0 = BED_H;
  const Z1 = 80;
  const GLASS = { dx: 13.5, z0: Z0 + 12, z1: Z1 - 9 };
  const PILE_ROWS = 7;
  const PER_ROW = 6;
  const FALLING = 5;
  const R = 1.25;
  const MANIFOLD_Z = Z1 + 14;
  const STORE = { x: -236, y: -60, w: 30, d: 30, r: 3 };
  const LEVER_BOX = { x: -254, y: -6, w: 34, d: 38, r: 3 };
  const GAUGE = [226, 22];
  const STRIP = { x: -238, y: PLATE.y + PLATE.d - 18, w: 476, d: 9, r: 1 };

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [XS[0], BOARD_Y, MANIFOLD_Z + 8], [XS[COUNT - 1], BOARD_Y, MANIFOLD_Z + 8], [STORE.x, STORE.y, MANIFOLD_Z + 10]],
    WIDTH,
    HEIGHT,
    { pad: 26, azimuth: 60 },
  );
  const { at, S, L, D, depth, halo } = kitOf(P);
  const I = instruments(P, spec, { LEVER_BOX, GAUGE, STRIP });
  const plane = k.sideMatrix([0, FRONT], 0, P, "left");
  const PEGS = [];
  for (let row = 0, z = GLASS.z1 - 5; z > GLASS.z0 + PILE_ROWS * 2 * R + 3; row += 1, z -= 4.6) {
    for (let u = -GLASS.dx + 2.5 + (row % 2) * 2.1; u < GLASS.dx - 1.5; u += 4.2) PEGS.push([u, z]);
  }

  function bed() {
    return halo(BED) + S(k.slabOf(BED, 0, BED_H, P, 3, 0.6), { tone: "lo" });
  }

  function store() {
    const out = [halo(STORE)];
    out.push(S(k.slabOf(STORE, 0, MANIFOLD_Z + 6, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(STORE, 10, P, 4) + k.sideSeam(STORE, MANIFOLD_Z - 4, P, 4), { tone: "faint" }) }));
    const cap = k.insetPlan(STORE, -1.5);
    out.push(S(k.slabOf(cap, MANIFOLD_Z + 6, 3, P, 4, 0.6), { tone: "mid" }));
    out.push(D(k.corners(cap, 4).map(([x, y]) => at([x, y, MANIFOLD_Z + 9])), { size: 0.45 }));
    const sf = STORE.y + STORE.d;
    const gauge = [STORE.x + STORE.w / 2, sf, 52];
    const ring = k.sideRing(gauge, 6, "y", P, 32);
    out.push(`<path class="rr-store-dial" d="${ring}"/>`);
    out.push(L(k.sideRing(gauge, 4.6, "y", P, 32), { tone: "lo" }));
    out.push(L(`M${at([STORE.x + 6, sf, 22]).join(" ")}L${at([STORE.x + STORE.w - 6, sf, 22]).join(" ")}L${at([STORE.x + STORE.w - 6, sf, 34]).join(" ")}L${at([STORE.x + 6, sf, 34]).join(" ")}Z`, { tone: "lo" }));
    return out.join("");
  }

  function manifold() {
    const start = [STORE.x + STORE.w, STORE.y + STORE.d / 2, MANIFOLD_Z];
    const points = G.fillet([start, [STORE.x + STORE.w + 14, start[1], MANIFOLD_Z], [STORE.x + STORE.w + 14, BOARD_Y + BOARD_D / 2, MANIFOLD_Z], [XS[COUNT - 1] + 10, BOARD_Y + BOARD_D / 2, MANIFOLD_Z]], 6, 8);
    const pieces = tubePieces(points, 2.2, P, { maxLength: 60 });
    const out = pieces.map((piece) => tubeSvg(piece, { tone: "mid" }));
    const end = points[points.length - 1];
    out.push(S(G.disc(-1.2, 1.2, 3.2, G.frameAlong(end, [1, 0, 0]), P), { tone: "mid" }));
    return out.join("");
  }

  function board(index) {
    const cx = XS[index];
    const frame = { x: cx - BOARD_W / 2, y: BOARD_Y, w: BOARD_W, d: BOARD_D, r: 1.6 };
    const out = [];
    out.push(S(k.slabOf({ x: cx - BOARD_W / 2 - 2, y: BOARD_Y - 3, w: BOARD_W + 4, d: BOARD_D + 8, r: 2 }, BED_H, 4, P, 3, 0.6), { tone: "mid" }));
    out.push(S(k.slabOf(frame, Z0 + 4, Z1 - Z0 - 4, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(frame, Z0 + 10, P, 3), { tone: "faint" }) }));
    const local = (u, z) => [cx + u, -z];
    const rect = (u0, u1, z0, z1) => k.pathOf([local(u0, z0), local(u1, z0), local(u1, z1), local(u0, z1)], true);
    const pegs = PEGS.map(([u, z]) => `M${cx + u - 0.55} ${-z}a0.55 0.55 0 1 0 1.1 0a0.55 0.55 0 1 0 -1.1 0`).join("");
    const tray = rect(-GLASS.dx, GLASS.dx, GLASS.z0 - 4, GLASS.z0);
    const circles = [];
    for (let n = 0; n < PILE_ROWS * PER_ROW; n += 1) circles.push(`<circle data-part="pile" data-index="${index}" class="rr-marble rr-stuck" r="${R}" cx="0" cy="0" style="opacity:0"/>`);
    for (let n = 0; n < FALLING; n += 1) circles.push(`<circle data-part="fall" data-index="${index}" class="rr-marble" r="${R}" cx="${cx}" cy="${-GLASS.z1}" style="opacity:0"/>`);
    out.push(`<g transform="${plane}">
      <path class="rr-board-glass" d="${rect(-GLASS.dx, GLASS.dx, GLASS.z0, GLASS.z1)}"/>
      <path class="rr-peg" d="${pegs}"/>
      ${circles.join("")}
      <path class="rr-tray" d="${tray}"/>
      <path class="iso-line" data-tone="lo" d="${rect(-GLASS.dx, GLASS.dx, GLASS.z0 - 4, GLASS.z1)}"/>
    </g>`);
    const hopper = { x: cx - 8, y: BOARD_Y + 1, w: 16, d: BOARD_D - 2, r: 1 };
    out.push(S(k.slabOf(hopper, Z1, 4, P, 2, 0.4), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(hopper, 1.4), Z1 + 4, P, 2), { tone: "lo" }));
    const drop = { x: cx - 1.6, y: BOARD_Y + BOARD_D / 2 - 1.6, w: 3.2, d: 3.2, r: 1.4 };
    out.push(S(k.slabOf(drop, Z1 + 4, MANIFOLD_Z - Z1 - 6.2, P, 3), { tone: "mid", crease: "none" }));
    const gate = { x: cx - 10, y: BOARD_Y + 2, w: 20, d: 3, r: 0.6 };
    out.push(`<g data-part="gate" data-index="${index}" transform="${k.translateAlong(P, [0, 0, 14])}" style="opacity:0">${S(k.slabOf(gate, Z1 - 12, 10, P, 2, 0.3), { tone: "hi", lit: true })}</g>`);
    const led = at([cx + BOARD_W / 2 - 4, FRONT + 5, BED_H + 4]);
    out.push(`<circle data-part="led" data-index="${index}" class="rr-led" cx="${led[0]}" cy="${led[1]}" r="1.1"/>`);
    return out.join("");
  }

  const steps = { DOG: 1, PIG: 2, CANARY: 3, GLOBAL: 4 };
  const dots = spec.model.stages.order.map((stage, index) => {
    const count = steps[stage];
    return D(Array.from({ length: count }, (_, n) => at([XS[index] - (count - 1) * 1.6 + n * 3.2, BOARD_Y + BOARD_D + 9, BED_H])), { size: 0.55, tone: "mid" });
  }).join("");

  const boards = XS.map((x, index) => ({ key: depth([x, BOARD_Y, 0]), svg: board(index) }));
  const side = [
    { key: depth(I.leverAt), svg: I.leverBox() + I.lever(-0.45) },
    { key: depth(I.gaugeAt), svg: I.gauge() },
  ];
  const middle = [...boards, ...side].sort((a, b) => a.key - b.key).map((item) => item.svg);

  const label = `A row of ${COUNT} glass pegboards replaying the ${spec.company} outage of ${spec.date}. Each board is one ${spec.figure.unit}; requests fall through it like marbles. A pipe from the store on the left drops ${spec.figure.card.toLowerCase()}, a lit gate, into the top of each board. With the gate in, marbles bounce back and retry every path, and the pile that builds up is the CPU. A lever in front is the ${spec.figure.kill}, a dial on the right reads ${spec.figure.gauge}, and the ruler is the clock.`;
  const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label, body: [basePlate(P, PLATE), I.strip(), bed(), dots, store(), manifold(), ...middle, I.playhead()] });

  function mount(svgEl) {
    const pick = (part) => [...svgEl.querySelectorAll(`[data-part="${part}"]`)];
    const byIndex = (list) => XS.map((_, index) => list.filter((el) => el.dataset.index === String(index)));
    const piles = byIndex(pick("pile"));
    const falls = byIndex(pick("fall"));
    const gates = byIndex(pick("gate")).map((list) => list[0]);
    const leds = byIndex(pick("led")).map((list) => list[0]);
    const phase = XS.map((_, index) => Array.from({ length: FALLING }, (__, n) => (n / FALLING + index * 0.13) % 1));
    const gateZ = XS.map(() => 14);
    const level = XS.map(() => 0);
    const span = GLASS.z1 - GLASS.z0;
    return ({ now, dt, follow }) => {
      for (let i = 0; i < COUNT; i += 1) {
        const cx = XS[i];
        const live = now.exposed[i];
        gateZ[i] = follow(gateZ[i], live ? 0 : 14, dt, 0.12);
        gates[i].setAttribute("transform", k.translateAlong(P, [0, 0, gateZ[i]]));
        gates[i].style.opacity = String(Math.max(0, Math.min(1, 1 - gateZ[i] / 14)));
        const load = Math.max(0, Math.min(1, (now.dial[i] - 0.32) / 0.67));
        level[i] = follow(level[i], load, dt, 0.25);
        const stuck = Math.round(level[i] * PILE_ROWS * PER_ROW);
        piles[i].forEach((el, n) => {
          const row = Math.floor(n / PER_ROW);
          const col = n % PER_ROW;
          const u = -GLASS.dx + 2.6 + col * 4.4 + (row % 2) * 1.6;
          el.setAttribute("cx", (cx + u).toFixed(2));
          el.setAttribute("cy", (-(GLASS.z0 + R + 0.2 + row * 2.2 * R)).toFixed(2));
          el.style.opacity = n < stuck ? "1" : "0";
        });
        const served = now.served[i];
        const top = GLASS.z1 - 1.5;
        const floor = GLASS.z0 + R + Math.min(PILE_ROWS, stuck / PER_ROW) * 2.2 * R;
        falls[i].forEach((el, n) => {
          phase[i][n] = (phase[i][n] + dt * (0.25 + 0.85 * served)) % 1;
          const p = phase[i][n];
          const back = level[i] > 0.4 ? Math.abs(Math.sin(p * Math.PI * 3)) * level[i] : 0;
          const z = top - (top - floor) * p * (1 - back * 0.7);
          const row = Math.floor((top - z) / 4.6);
          const u = Math.max(-GLASS.dx + 1.6, Math.min(GLASS.dx - 1.6, (row % 2 ? 1 : -1) * 2.1 + Math.sin(n * 2.3 + row) * 6));
          el.setAttribute("cx", (cx + u).toFixed(2));
          el.setAttribute("cy", (-z).toFixed(2));
          el.style.opacity = p > 0.96 ? String((1 - p) * 25) : p < 0.04 ? String(p * 25) : "1";
        });
        leds[i].toggleAttribute("data-on", served < 0.6);
      }
    };
  }

  return { svg, geo: { P, TICK_FROM: I.TICK_FROM, PER_MIN: I.PER_MIN, WIDTH, HEIGHT }, gaugeNeedle: I.gaugeNeedle, leverPoints: I.leverPoints, translateAlong: (by) => k.translateAlong(P, by), pin: I.pin, mount };
}
