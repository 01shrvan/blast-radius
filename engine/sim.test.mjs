import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { simulate, actualLevers, check } from "./sim.mjs";
import { validate } from "./schema.mjs";

const dir = new URL("../incidents/", import.meta.url);
const specs = readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(new URL(name, dir), "utf8")));

for (const spec of specs) {
  test(`${spec.id} | spec is valid`, () => {
    assert.deepEqual(validate(spec), []);
  });

  const actual = simulate(spec);
  for (const item of spec.checks) {
    test(`${spec.id} | as it happened, ${item.metric} ${item.at ?? item.value}`, () => {
      const result = check(spec, actual, item);
      assert.ok(result.ok, `got ${result.got}`);
    });
  }

  for (const lever of spec.levers.filter((item) => item.kind === "prevent")) {
    test(`${spec.id} | ${lever.label} = ${lever.fix} prevents the outage`, () => {
      const run = simulate(spec, { ...actualLevers(spec), [lever.id]: lever.fix });
      assert.ok(run.summary.worstTraffic > 0.99);
      assert.equal(run.summary.page, null);
    });
  }

  test(`${spec.id} | a staged rollout reaches fewer units`, () => {
    const run = simulate(spec, { ...actualLevers(spec), rollout: "staged" });
    assert.ok(run.summary.exposedUnits < spec.model.stages.order.length || run.summary.worstTraffic > simulate(spec).summary.worstTraffic);
  });

  test(`${spec.id} | same levers, same result`, () => {
    assert.deepEqual(simulate(spec).summary, actual.summary);
  });
}
