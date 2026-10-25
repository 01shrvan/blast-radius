import * as k from "../kit.mjs";
import * as G from "../../vendor/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../vendor/kit/tube.mjs";
import { basePlate, instruments, kitOf } from "./common.mjs";

export function terminals(spec) {
  const WIDTH = 760;
  const HEIGHT = 460;
  const COUNT = spec.model.stages.order.length;
  const PER_ROW = Math.ceil(COUNT / 2);

  const PLATE = { x: -272, y: -104, w: 544, d: 180, r: 8 };
  const RACK = { x: -252, y: -90, w: 48, d: 42, r: 3 };
  const RACK_H = 98;
  const RACK_FRONT = RACK.y + RACK.d;
  const LEVER_BOX = { x: -254, y: -30, w: 34, d: 38, r: 3 };
  const GAUGE = [238, 22];
  const STRIP = { x: -248, y: PLATE.y + PLATE.d - 18, w: 496, d: 9, r: 1 };

  const DESK_W = 82;
  const DESK_D = 36;
  const DESK_Z = 27;
  const DESK_T = 3;
  const DESK_TOP = DESK_Z + DESK_T;
  const PITCH = 95;
  const ROW_Y = [-86, -28];
  const CENTERS = Array.from({ length: PER_ROW }, (_, index) => -140 + index * PITCH);
  const HOSTS = Array.from({ length: COUNT }, (_, index) => {
    const row = index < PER_ROW ? 0 : 1;
    const cx = CENTERS[index % PER_ROW];
    const desk = { x: cx - DESK_W / 2, y: ROW_Y[row], w: DESK_W, d: DESK_D, r: 2 };
    const tower = { x: desk.x + desk.w - 17, y: desk.y + 4, w: 12, d: 28, r: 1.4 };
    const monitor = { x: cx - 18, y: desk.y + 4, w: 36, d: 22, r: 2.6 };
    return { index, row, cx, desk, tower, monitor };
  });
  const MON_Z = DESK_TOP + 5;
  const MON_H = 29;
  const SCREEN = { dx: 14.5, z0: MON_Z + 3.2, z1: MON_Z + MON_H - 3.2 };

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [RACK.x, RACK.y, RACK_H + 6], [HOSTS[PER_ROW - 1].desk.x + DESK_W, ROW_Y[0], MON_Z + MON_H]],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 58, elevation: 32 },
  );
  const { at, S, L, D, depth, halo } = kitOf(P);
  const I = instruments(P, spec, { LEVER_BOX, GAUGE, STRIP });
  const face = (y) => k.sideMatrix([0, y], 0, P, "left");
  const quad = (x0, x1, z0, z1, y) => k.pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

  function rack() {
    const out = [halo(RACK)];
    const seam = (z) => k.sideSeam(RACK, z, P, 4);
    out.push(S(k.slabOf(RACK, 0, RACK_H, P, 4, 0.8), { tone: "mid", inner: L(seam(8) + seam(RACK_H - 8), { tone: "faint" }) }));
    const cap = k.insetPlan(RACK, -1.5);
    out.push(S(k.slabOf(cap, RACK_H, 3, P, 4, 0.6), { tone: "mid" }));
    out.push(D(k.corners(cap, 4).map(([x, y]) => at([x, y, RACK_H + 3])), { size: 0.45 }));
    const blades = [];
    const leds = [];
    for (let n = 0; n < 7; n += 1) {
      const z0 = 14 + n * 10.4;
      blades.push(`<path transform="${face(RACK_FRONT)}" d="${k.pathOf(k.roundedPlan({ x: RACK.x + 5, y: z0, w: RACK.w - 10, d: 7.6, r: 1.2 }, 3).map(([u, z]) => [u, -z]), true)}"/>`);
      leds.push(at([RACK.x + RACK.w - 9, RACK_FRONT, z0 + 3.8]));
      blades.push(`<path transform="${face(RACK_FRONT)}" d="${[0, 1, 2, 3, 4, 5].map((m) => `M${RACK.x + 9 + m * 3.6} ${-(z0 + 1.6)}V${-(z0 + 6)}`).join("")}"/>`);
    }
    out.push(`<g class="iso-line" data-tone="lo">${blades.join("")}</g>`);
    out.push(leds.map(([x, y], n) => `<circle data-part="rack-led" data-n="${n}" class="rr-rack-led" cx="${x}" cy="${y}" r="0.9"/>`).join(""));
    const plate = { x: RACK.x + 8, y: RACK_FRONT, z0: RACK_H - 12, z1: RACK_H - 5 };
    out.push(L(quad(plate.x, plate.x + 26, plate.z0, plate.z1, RACK_FRONT), { tone: "lo" }));
    out.push(L([18, 12].map((w, i) => `M${at([plate.x + 3, RACK_FRONT, plate.z1 - 2.2 - i * 2.4]).join(" ")}L${at([plate.x + 3 + w, RACK_FRONT, plate.z1 - 2.2 - i * 2.4]).join(" ")}`).join(""), { tone: "lo", free: true }));
    return out.join("");
  }

  const PORT = (row, lane) => [RACK.x + RACK.w, RACK.y + 10 + row * 16 + lane * 1.8, 3 + lane * 1.6];
  const TRUNK_Y = [PLATE.y + 8, ROW_Y[1] - 9];

  function route(host) {
    const lane = host.index % PER_ROW;
    const start = PORT(host.row, lane);
    const trunk = TRUNK_Y[host.row] + lane * 1.7;
    const tx = host.tower.x + host.tower.w / 2;
    const entry = host.tower.y;
    const points = [start, [start[0] + 6, start[1], start[2]], [start[0] + 10, start[1], 0.8], [start[0] + 10, trunk, 0.8], [tx, trunk, 0.8], [tx, entry - 0.2, 0.8]];
    return G.fillet(points, 3, 7);
  }

  function cable(host) {
    const points = route(host);
    const pieces = tubePieces(points, 0.7, P, { maxLength: 400, caps: [false, true] });
    const body = pieces.map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
    const glow = k.pathOf(points.map((point) => at([point[0], point[1], point[2] + 0.75])));
    return `${body}<path data-part="cable" data-index="${host.index}" class="rr-cable" d="${glow}"/>`;
  }

  function host(h) {
    const { desk, tower, monitor, cx } = h;
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(desk, 1), 0, 1, P)}" style="filter:blur(4px);opacity:.5"/>`];
    const legs = k.corners(desk, 3).sort((a, b) => depth(a) - depth(b));
    const back = legs.slice(0, 2);
    const front = legs.slice(2);
    for (const [x, y] of back) out.push(S(k.cylinder(x, y, 1.3, 0, DESK_Z, P, 14), { tone: "mid", crease: "none" }));
    out.push(halo(tower, 2));
    out.push(S(k.slabOf(tower, 0, 24, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(tower, 4, P, 3), { tone: "faint" }) }));
    const tf = tower.y + tower.d;
    out.push(L(quad(tower.x + 2.5, tower.x + tower.w - 2.5, 15.5, 17, tf), { tone: "lo" }));
    out.push(L([8, 10, 12].map((z) => `M${at([tower.x + 2.5, tf, z]).join(" ")}L${at([tower.x + tower.w - 2.5, tf, z]).join(" ")}`).join(""), { tone: "faint" }));
    const led = at([tower.x + tower.w - 3, tf, 20.5]);
    out.push(`<circle data-part="host-led" data-index="${h.index}" class="rr-host-led" cx="${led[0]}" cy="${led[1]}" r="0.85"/>`);
    out.push(D([at([tower.x + 3, tf, 20.5])], { size: 0.55, tone: "lo" }));
    for (const [x, y] of front) out.push(S(k.cylinder(x, y, 1.3, 0, DESK_Z, P, 14), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf(desk, DESK_Z, DESK_T, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(desk, DESK_Z + 1.2, P, 3), { tone: "faint" }) }));
    out.push(S(k.cylinder(cx, monitor.y + 9, 6.5, DESK_TOP, 1, P, 32), { tone: "lo" }));
    out.push(S(k.slabOf({ x: cx - 2.4, y: monitor.y + 7.5, w: 4.8, d: 3, r: 1 }, DESK_TOP + 1, MON_Z - DESK_TOP - 1 + 0.01, P, 2), { tone: "mid", crease: "none" }));
    const tube = { x: cx - 12, y: monitor.y - 3, w: 24, d: 6, r: 3 };
    out.push(S(k.slabOf(tube, MON_Z + 4, MON_H - 8, P, 5, 0.5), { tone: "mid" }));
    out.push(S(k.slabOf(monitor, MON_Z, MON_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(monitor, MON_Z + 2.2, P, 4), { tone: "faint" }) }));
    out.push(D([monitor.x + 8, monitor.x + monitor.w - 8].map((x) => at([x, monitor.y + 4, MON_Z + MON_H])), { size: 0.4, tone: "lo" }));
    out.push(screen(h));
    const kb = { x: cx - 14, y: desk.y + DESK_D - 9, w: 28, d: 7, r: 1 };
    out.push(S(k.slabOf(kb, DESK_TOP, 1.4, P, 2, 0.3), { tone: "mid" }));
    out.push(D(k.dotGrid(kb.x + 2.2, kb.y + 1.6, 12, 3, 2.15, DESK_TOP + 1.4, P), { size: 0.38, tone: "lo" }));
    const mouse = { x: cx + 18, y: desk.y + DESK_D - 8.5, w: 4.2, d: 6, r: 2 };
    out.push(S(k.slabOf(mouse, DESK_TOP, 1.4, P, 4, 0.3), { tone: "mid" }));
    return out.join("");
  }

  function screen(h) {
    const y = h.monitor.y + h.monitor.d;
    const x0 = h.cx - SCREEN.dx;
    const x1 = h.cx + SCREEN.dx;
    const local = (u, z) => [u, -z];
    const rect = (a0, a1, b0, b1) => k.pathOf([local(a0, b0), local(a1, b0), local(a1, b1), local(a0, b1)], true);
    const bezel = rect(x0 - 1.2, x1 + 1.2, SCREEN.z0 - 1.2, SCREEN.z1 + 1.2);
    const glass = rect(x0, x1, SCREEN.z0, SCREEN.z1);
    const scan = [];
    for (let z = SCREEN.z0 + 1.4; z < SCREEN.z1; z += 1.6) scan.push(`M${x0} ${-z}H${x1}`);
    const desktop = [
      `<path class="rr-win" d="${rect(x0 + 2.5, x0 + 13, SCREEN.z1 - 9.5, SCREEN.z1 - 2.5)}"/>`,
      `<path class="rr-win-bar" d="M${x0 + 2.5} ${-(SCREEN.z1 - 4)}H${x0 + 13}"/>`,
      `<path class="rr-task" d="M${x0} ${-(SCREEN.z0 + 1.8)}H${x1}"/>`,
    ].join("");
    const bsod = [
      `<text class="rr-bsod-face" x="${x0 + 2.4}" y="${-(SCREEN.z1 - 7.6)}" font-size="5.6">:(</text>`,
      `<path class="rr-bsod-text" d="M${x0 + 2.4} ${-(SCREEN.z1 - 10.6)}H${x1 - 4}M${x0 + 2.4} ${-(SCREEN.z1 - 12.4)}H${x1 - 8}M${x0 + 2.4} ${-(SCREEN.z1 - 14.2)}H${x1 - 11}"/>`,
      `<path class="rr-bsod-qr" d="${rect(x0 + 2.4, x0 + 5.6, SCREEN.z0 + 1.6, SCREEN.z0 + 4.8)}"/>`,
    ].join("");
    return `<g transform="${face(y)}">
      <path class="rr-bezel" d="${bezel}"/>
      <g data-part="screen" data-index="${h.index}" class="rr-crt">
        <path class="rr-glass" d="${glass}"/>
        <g class="rr-desktop">${desktop}</g>
        <g class="rr-bsod">${bsod}</g>
        <path class="rr-scanlines" d="${scan.join("")}"/>
      </g>
      <path class="iso-line" data-tone="lo" d="${glass}"/>
    </g>`;
  }

  const items = [];
  const put = (svg, point, bias = 0) => items.push({ svg, key: depth(point) + bias });
  put(I.leverBox() + I.lever(-0.45), I.leverAt, 0);
  put(I.gauge(), I.gaugeAt, 0);
  const backRow = HOSTS.filter((h) => h.row === 0);
  const frontRow = HOSTS.filter((h) => h.row === 1);
  const rowLayer = (row) => row.map((h) => ({ svg: host(h), key: depth([h.cx, h.desk.y + h.desk.d / 2, 0]) })).sort((a, b) => a.key - b.key).map((item) => item.svg).join("");
  const side = items.sort((a, b) => a.key - b.key).map((item) => item.svg);

  const label = `A small office replaying the ${spec.company} outage of ${spec.date}. A rack on the left is ${spec.company}'s cloud. Cables run from it to ${COUNT} desk computers, each a ${spec.figure.unit} with a CRT monitor, keyboard and tower. When ${spec.figure.card} arrives down a cable, that computer's screen turns blue and stays blue. A lever in front of the rack is the ${spec.figure.kill}; it stops the update but cannot bring a crashed computer back. A dial on the right reads ${spec.figure.gauge}, and the ruler along the front is the clock.`;
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label,
    body: [
      basePlate(P, PLATE),
      I.strip(),
      rack(),
      backRow.map(cable).join(""),
      rowLayer(backRow),
      frontRow.map(cable).join(""),
      rowLayer(frontRow),
      ...side,
      I.playhead(),
    ],
  });

  function mount(svgEl) {
    const pick = (part) => [...svgEl.querySelectorAll(`[data-part="${part}"]`)];
    const screens = pick("screen");
    const cables = pick("cable");
    const leds = pick("host-led");
    const rackLeds = pick("rack-led");
    let blink = 0;
    return ({ now, killed, dt }) => {
      blink += dt;
      let pushing = false;
      for (let i = 0; i < COUNT; i += 1) {
        const received = now.exposed[i];
        const crashed = now.served[i] < 0.6;
        if (received) pushing = true;
        cables[i].toggleAttribute("data-on", received);
        screens[i].toggleAttribute("data-on", crashed);
        leds[i].toggleAttribute("data-on", !crashed);
      }
      rackLeds.forEach((el, n) => el.toggleAttribute("data-on", killed ? n === 0 : pushing ? Math.floor(blink * 6 + n) % 2 === 0 : n < 3));
    };
  }

  return {
    svg,
    geo: { P, TICK_FROM: I.TICK_FROM, PER_MIN: I.PER_MIN, WIDTH, HEIGHT },
    gaugeNeedle: I.gaugeNeedle,
    leverPoints: I.leverPoints,
    translateAlong: (by) => k.translateAlong(P, by),
    pin: I.pin,
    mount,
  };
}
