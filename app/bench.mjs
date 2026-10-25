import { benchMachine } from "./machines/bench.mjs";
import { terminals } from "./machines/terminals.mjs";
import { pegboard } from "./machines/pegboard.mjs";
import { traps } from "./machines/traps.mjs";

const MACHINES = { terminal: terminals, pegboard, traps };

export function bench(spec) {
  return (MACHINES[spec.figure.machine] ?? benchMachine)(spec);
}
