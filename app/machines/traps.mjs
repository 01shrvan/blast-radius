import * as k from "../kit.mjs";
import { basePlate, instruments, kitOf } from "./common.mjs";

export function traps(spec) {
  const WIDTH = 760;
  const HEIGHT = 420;
  const COUNT = spec.model.stages.order.length;

  const PLATE = { x: -262, y: -76, w: 524, d: 152, r: 8 };
  const PITCH = 43;
  const XS = Array.from({ length: COUNT }, (_, index) => -PITCH * (COUNT - 1) / 2 + index * PITCH);
  const CAB = { w: 34, d: 34, y: -40, h: 18 };
  const BOARD = { w: 26, d: 14, h: 2.4 };
  const BOARD_Z = CAB.h;
  const BOARD_TOP = BOARD_Z + BOARD.h;
  const PIVOT_Y = -40 + 7 + BOARD.d / 2;
  const BAIL = 9.5;
  const BELT = { x: -200, y: 2, w: 400, d: 10, r: 2 };
  const BELT_Z = 6;
  const LEVER_BOX = { x: -254, y: -64, w: 34, d: 38, r: 3 };
  const GAUGE = [226, 26];
  const STRIP = { x: -238, y: PLATE.y + PLATE.d - 18, w: 476, d: 9, r: 1 };
  const DEPOT = { x: -236, y: -10, w: 28, d: 26, r: 3 };

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [XS[0], CAB.y, BOARD_TOP + BAIL + 4], [XS[COUNT - 1], CAB.y, BOARD_TOP + BAIL + 4], [-200, -60, 60]],
    WIDTH,
    HEIGHT,
    { pad: 26, azimuth: 58, elevation: 32 },
  );
  const { at, S, L, D, depth, halo } = kitOf(P);
  const I = instruments(P, spec, { LEVER_BOX, GAUGE, STRIP });

  const bailPath = (cx, angle) => {
    const cy = PIVOT_Y;
    const z = BOARD_TOP + 0.6;
    const half = BOARD.w / 2 - 2.5;
    const reach = (a) => [cy + Math.cos(a) * BAIL, z + Math.sin(a) * BAIL];
    const [ty, tz] = reach(angle);
    return `M${at([cx - half, cy, z]).join(" ")}L${at([cx - half, ty, tz]).join(" ")}L${at([cx + half, ty, tz]).join(" ")}L${at([cx + half, cy, z]).join(" ")}`;
  };
  const ARMED = Math.PI * 0.97;
  const SPRUNG = 0.05;

  function belt() {
    const out = [halo(BELT)];
    out.push(S(k.slabOf(BELT, 0, BELT_Z, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(BELT, 2, P, 3), { tone: "faint" }) }));
    const rollers = [];
    for (let x = BELT.x + 6; x < BELT.x + BELT.w - 4; x += 8) rollers.push(k.lineOnTop([x, BELT.y + 1.2], [x, BELT.y + BELT.d - 1.2], BELT_Z, P));
    out.push(L(rollers.join(""), { tone: "faint" }));
    out.push(L(k.planOutline(k.insetPlan(BELT, 1), BELT_Z, P, 3), { tone: "lo" }));
    for (const x of [BELT.x + 2.5, BELT.x + BELT.w - 2.5]) out.push(D([at([x, BELT.y + BELT.d / 2, BELT_Z])], { size: 0.5 }));
    return out.join("");
  }

  function depot() {
    const out = [halo(DEPOT)];
    out.push(S(k.slabOf(DEPOT, 0, 30, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(DEPOT, 8, P, 4), { tone: "faint" }) }));
    const chute = { x: DEPOT.x + DEPOT.w - 2, y: BELT.y + 1, w: 10, d: BELT.d - 2, r: 1 };
    out.push(S(k.slabOf(chute, BELT_Z, 2, P, 2, 0.3), { tone: "mid" }));
    const df = DEPOT.y + DEPOT.d;
    out.push(L(`M${at([DEPOT.x + 5, df, 14]).join(" ")}L${at([DEPOT.x + DEPOT.w - 5, df, 14]).join(" ")}L${at([DEPOT.x + DEPOT.w - 5, df, 24]).join(" ")}L${at([DEPOT.x + 5, df, 24]).join(" ")}Z`, { tone: "lo" }));
    out.push(L([16, 12, 8].map((w, i) => `M${at([DEPOT.x + 7, df, 21.5 - i * 2.6]).join(" ")}L${at([DEPOT.x + 7 + w, df, 21.5 - i * 2.6]).join(" ")}`).join(""), { tone: "lo", free: true }));
    return out.join("");
  }

  function trap(index) {
    const cx = XS[index];
    const cab = { x: cx - CAB.w / 2, y: CAB.y, w: CAB.w, d: CAB.d, r: 3 };
    const out = [halo(cab)];
    out.push(S(k.slabOf(cab, 0, CAB.h, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(cab, 5, P, 4), { tone: "faint" }) }));
    const cf = cab.y + cab.d;
    out.push(L([-9, -5, -1, 3, 7].map((dx) => `M${at([cx + dx, cf, 8]).join(" ")}L${at([cx + dx, cf, 13]).join(" ")}`).join(""), { tone: "faint" }));
    const led = at([cx + CAB.w / 2 - 4.5, cf, 13.5]);
    out.push(`<circle data-part="led" data-index="${index}" class="rr-led" cx="${led[0]}" cy="${led[1]}" r="1.1"/>`);
    const board = { x: cx - BOARD.w / 2, y: CAB.y + 7, w: BOARD.w, d: BOARD.d, r: 1.2 };
    out.push(S(k.slabOf(board, BOARD_Z, BOARD.h, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(board, BOARD_Z + 1, P, 3), { tone: "faint" }) }));
    const grain = [];
    for (let n = 1; n < 4; n += 1) grain.push(k.lineOnTop([board.x + 1.5, board.y + n * 3.4], [board.x + board.w - 1.5, board.y + n * 3.4], BOARD_TOP, P));
    out.push(L(grain.join(""), { tone: "faint" }));
    const coil = k.coil(cx - 5, cx + 5, [PIVOT_Y, BOARD_TOP + 1.2], 1.2, 5, "x", P);
    out.push(L(coil.back, { tone: "lo" }));
    out.push(L(k.segment([cx - BOARD.w / 2 + 2.5, PIVOT_Y, BOARD_TOP + 1.2], [cx + BOARD.w / 2 - 2.5, PIVOT_Y, BOARD_TOP + 1.2], P), { tone: "mid" }));
    out.push(L(coil.front, { tone: "mid" }));
    const plate = { x: cx - 3.5, y: CAB.y + 9, w: 7, d: 4, r: 0.8 };
    out.push(S(k.slabOf(plate, BOARD_TOP, 0.8, P, 2, 0.2), { tone: "mid" }));
    out.push(`<path data-part="bug" data-index="${index}" class="rr-bug" d="${k.ring(cx, CAB.y + 11, 1.4, BOARD_TOP + 0.8, P, 12)}"/>`);
    out.push(`<path data-part="bail" data-index="${index}" class="rr-bail" d="${bailPath(cx, ARMED)}"/>`);
    out.push(`<path data-part="bar" data-index="${index}" class="rr-bar" d="${k.segment([cx, CAB.y + 11, BOARD_TOP + 0.9], [cx, PIVOT_Y - BAIL + 0.6, BOARD_TOP + 0.9], P)}"/>`);
    return out.join("");
  }

  const token = { w: 7, d: 6, h: 5 };
  const tokenSvg = `<g data-part="token" transform="${k.translateAlong(P, [BELT.x + 4, 0, 0])}" style="opacity:0">${S(k.slabOf({ x: -token.w / 2, y: BELT.y + 2, w: token.w, d: token.d, r: 1 }, BELT_Z, token.h, P, 2, 0.4), { tone: "hi", lit: true })}${D([at([0, BELT.y + 2 + token.d, BELT_Z + 2.5])], { size: 0.5, tone: "lo" })}</g>`;

  const traps = XS.map((x, index) => ({ key: depth([x, CAB.y, 0]), svg: trap(index) }));
  const side = [
    { key: depth(I.leverAt), svg: I.leverBox() + I.lever(-0.45) },
    { key: depth(I.gaugeAt), svg: I.gauge() },
  ];
  const label = `A row of ${COUNT} cabinets, each a ${spec.figure.unit}, replaying the ${spec.company} outage of ${spec.date}. A mousetrap has sat set on top of every cabinet since the bug shipped. A conveyor in front carries ${spec.figure.card.toLowerCase()}, a lit token, from the depot on the left; every trap it reaches snaps shut and that cabinet stops serving. A lever is ${spec.figure.kill}, a dial on the right reads ${spec.figure.gauge}, and the ruler is the clock.`;
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label,
    body: [basePlate(P, PLATE), I.strip(), ...traps.sort((a, b) => a.key - b.key).map((item) => item.svg), depot(), belt(), tokenSvg, ...side.sort((a, b) => a.key - b.key).map((item) => item.svg), I.playhead()],
  });

  function mount(svgEl) {
    const pick = (part) => [...svgEl.querySelectorAll(`[data-part="${part}"]`)];
    const byIndex = (part) => XS.map((_, index) => svgEl.querySelector(`[data-part="${part}"][data-index="${index}"]`));
    const bails = byIndex("bail");
    const bars = byIndex("bar");
    const bugs = byIndex("bug");
    const leds = byIndex("led");
    const [tokenEl] = pick("token");
    const angle = XS.map(() => ARMED);
    let tokenX = BELT.x + 4;
    return ({ now, front, dt, follow }) => {
      const target = front < 0 ? BELT.x + 4 : XS[front];
      tokenX = follow(tokenX, target, dt, 0.2);
      tokenEl.setAttribute("transform", k.translateAlong(P, [tokenX, 0, 0]));
      tokenEl.style.opacity = front < 0 ? "0" : "1";
      for (let i = 0; i < COUNT; i += 1) {
        const sprung = now.served[i] < 0.6 || (now.exposed[i] && tokenX >= XS[i] - 2);
        angle[i] = follow(angle[i], sprung ? SPRUNG : ARMED, dt, sprung ? 0.04 : 0.6);
        bails[i].setAttribute("d", bailPath(XS[i], angle[i]));
        bars[i].style.opacity = angle[i] > 2.6 ? "1" : "0";
        bugs[i].toggleAttribute("data-on", sprung);
        leds[i].toggleAttribute("data-on", now.served[i] < 0.6);
      }
    };
  }

  return { svg, geo: { P, TICK_FROM: I.TICK_FROM, PER_MIN: I.PER_MIN, WIDTH, HEIGHT }, gaugeNeedle: I.gaugeNeedle, leverPoints: I.leverPoints, translateAlong: (by) => k.translateAlong(P, by), pin: I.pin, mount };
}
