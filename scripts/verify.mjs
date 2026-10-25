import { readFileSync, readdirSync } from "node:fs";
import { validate } from "../engine/schema.mjs";
import { checkSpecQuotes } from "../engine/sources.mjs";

const dir = new URL("../incidents/", import.meta.url);
const only = process.argv[2];
const names = readdirSync(dir).filter((name) => name.endsWith(".json") && (!only || name.startsWith(only)));
let failed = 0;

for (const name of names) {
  const spec = JSON.parse(readFileSync(new URL(name, dir), "utf8"));
  const problems = validate(spec);
  try {
    problems.push(...(await checkSpecQuotes(spec)));
  } catch (error) {
    problems.push(String(error.message ?? error));
  }
  if (problems.length) failed += 1;
  console.log(`${problems.length ? "FAIL" : "ok  "} ${spec.id}`);
  for (const problem of problems) console.log(`     ${problem}`);
}

process.exitCode = failed ? 1 : 0;
