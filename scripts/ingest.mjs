import { existsSync, writeFileSync } from "node:fs";
import { generate } from "../engine/generate.mjs";

const [company, url] = process.argv.slice(2);
if (!company) {
  console.log('usage: pnpm ingest "<company>" [postmortem url]');
  process.exit(1);
}

let saved = null;
for await (const event of generate({ company, url })) {
  console.log(`${event.state.padEnd(6)} ${event.step}${event.message ? `  ${event.message}` : ""}`);
  if (event.state === "failed") process.exitCode = 1;
  if (event.spec) {
    const spec = { ...event.spec };
    delete spec.generated;
    const path = new URL(`../incidents/${spec.id}.json`, import.meta.url);
    if (existsSync(path)) {
      console.log(`exists  incidents/${spec.id}.json, not overwritten`);
    } else {
      writeFileSync(path, `${JSON.stringify(spec, null, 2)}\n`);
      saved = spec.id;
    }
  }
}
if (saved) console.log(`wrote   incidents/${saved}.json`);
