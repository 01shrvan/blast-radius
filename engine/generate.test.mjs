import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "./generate.mjs";

const PAGE = `<html><head><title>Acme outage report</title></head><body>
<p>At 09:00 UTC we pushed a routing config to every edge server at once. All of our servers crashed while loading it.
We were alerted at 09:04 by our monitoring. At 09:20 we identified the routing config as the cause.
At 09:30 we rolled back the routing config everywhere. By 09:40 traffic was back to normal.
About 90% of requests failed during the outage. Going forward we will validate configs before loading them.
We will also roll configs out to a small set of servers first. We will add a faster global kill switch.</p>
${"<p>Background detail about Acme's network and how it routes requests between regions.</p>".repeat(20)}
</body></html>`;

const quote = (text) => ({ quote: text });
const RAW = {
  fit: true,
  reason: "",
  company: "Acme",
  title: "A routing config everywhere",
  date: "2024-03-01",
  oneLine: "A routing config crashed every edge server at once.",
  clockFrom: "08:30",
  clockTo: "10:30",
  figure: { card: "The routing config", unit: "edge server", dial: "health", gauge: "requests served", kill: "rollback" },
  effectKind: "crash",
  servedShare: 0.1,
  recoveryKind: "drain",
  propagationSeconds: null,
  facts: [{ label: "Requests failed", value: "90%", ...quote("About 90% of requests failed during the outage.") }],
  events: [
    { at: "09:00", kind: "deploy", label: "Config pushed", ...quote("we pushed a routing config to every edge server at once") },
    { at: "09:04", kind: "page", label: "Alert", ...quote("We were alerted at 09:04 by our monitoring.") },
    { at: "09:20", kind: "identify", label: "Cause found", ...quote("At 09:20 we identified the routing config as the cause.") },
    { at: "09:30", kind: "kill", label: "Rolled back", ...quote("At 09:30 we rolled back the routing config everywhere.") },
    { at: "09:40", kind: "recovered", label: "Back", ...quote("By 09:40 traffic was back to normal.") },
  ],
  rollout: { why: "It went to every server", ...quote("We will also roll configs out to a small set of servers first.") },
  response: { label: "Alert to rollback", why: "No fast switch", ...quote("We will add a faster global kill switch.") },
  prevent: [{ id: "validate", label: "Config check", actual: "none", fix: "validated", why: "Nothing checked the config", ...quote("we will validate configs before loading them") }],
  afterwards: [quote("we will validate configs before loading them")],
  assumptions: [],
};

const clientAnswering = (answers) => {
  let index = 0;
  return {
    beta: {
      messages: {
        stream: () => ({
          finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answers[Math.min(index++, answers.length - 1)]) }] }),
        }),
      },
    },
  };
};
const fetcher = async () => new Response(PAGE, { status: 200 });

async function run(raw, options = {}) {
  const events = [];
  for await (const event of generate({ company: "Acme", url: "https://acme.example/outage" }, { client: clientAnswering(raw), fetcher, ...options })) events.push(event);
  return events;
}

test("a faithful extraction becomes a verified replay", async () => {
  const events = await run([RAW]);
  const last = events.at(-1);
  assert.equal(last.state, "done", JSON.stringify(events.filter((event) => event.state === "failed")));
  assert.equal(last.spec.id, "acme-2024-03-01");
  assert.equal(last.spec.model.detectMinutes, 4);
  assert.equal(last.spec.levers.find((lever) => lever.kind === "response").actual, 26);
});

test("a made-up quote is caught, and the repair round can fix it", async () => {
  const bad = { ...RAW, facts: [{ label: "Requests failed", value: "90%", quote: "nearly every request failed" }] };
  const events = await run([bad, RAW]);
  assert.ok(events.some((event) => event.step === "verify" && event.message?.startsWith("Fixing")));
  assert.equal(events.at(-1).state, "done");
});

test("a quote that never gets fixed stops the build", async () => {
  const bad = { ...RAW, facts: [{ label: "Requests failed", value: "90%", quote: "nearly every request failed" }] };
  const events = await run([bad]);
  const last = events.at(-1);
  assert.equal(last.state, "failed");
  assert.equal(last.step, "verify");
});

test("an outage of another kind is refused, not forced", async () => {
  const events = await run([{ ...RAW, fit: false, reason: "A power loss in one data center." }]);
  assert.equal(events.at(-1).step, "fit");
  assert.equal(events.at(-1).state, "failed");
});

test("a cached outage returns without calling the model", async () => {
  const cached = { id: "acme-2024-03-01" };
  const events = [];
  for await (const event of generate({ company: "Acme" }, { client: null, lookup: async () => cached })) events.push(event);
  assert.equal(events.at(-1).spec, cached);
});
