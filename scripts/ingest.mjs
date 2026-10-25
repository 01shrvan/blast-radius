import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generate } from "../engine/generate.mjs";

const args = process.argv.slice(2);
const flag = args.indexOf("--extracted");
const extracted = flag >= 0 ? readFileSync(args.splice(flag, 2)[1], "utf8") : null;
const [company, url] = args;
if (!company || (extracted && !url)) {
  console.log('usage: pnpm ingest "<company>" [postmortem url] [--extracted extraction.json]');
  process.exit(1);
}

const replay = extracted && {
  beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: extracted }] }) }) } },
};

let saved = null;
for await (const event of generate({ company, url }, replay ? { client: replay } : {})) {
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
