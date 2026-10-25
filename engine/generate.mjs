import Anthropic from "@anthropic-ai/sdk";
import { validate, verifyQuotes } from "./schema.mjs";
import { textOf } from "./sources.mjs";
import { simulate, check, toSeconds } from "./sim.mjs";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];
const STAGES = {
  order: ["DOG", "PIG", "CANARY", "CANARY", "CANARY", "GLOBAL", "GLOBAL", "GLOBAL"],
  share: [0, 0.01, 0.02, 0.02, 0.02, 0.31, 0.31, 0.31],
};
const MAX_SOURCE_CHARS = 120000;
const REPAIRS = 2;

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const object = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: "array", items });

const FIND_SCHEMA = object({
  found: { type: "boolean" },
  company: str,
  outage: str,
  date: str,
  urls: list(str),
  reason: str,
});

const QUOTED = { quote: str };
const EXTRACT_SCHEMA = object({
  fit: { type: "boolean" },
  reason: str,
  company: str,
  title: str,
  date: str,
  oneLine: str,
  clockFrom: str,
  clockTo: str,
  figure: object({ card: str, unit: str, dial: str, gauge: str, kill: str }),
  effectKind: { type: "string", enum: ["saturate", "crash"] },
  servedShare: { type: ["number", "null"] },
  recoveryKind: { type: "string", enum: ["drain", "manual"] },
  propagationSeconds: { type: ["number", "null"] },
  facts: list(object({ label: str, value: str, ...QUOTED })),
  events: list(object({ at: str, kind: { type: "string", enum: ["change", "deploy", "page", "identify", "kill", "recovered", "status", "resolved", "note"] }, label: str, ...QUOTED })),
  rollout: object({ why: str, ...QUOTED }),
  response: object({ label: str, why: str, ...QUOTED }),
  prevent: list(object({ id: str, label: str, actual: str, fix: str, why: str, ...QUOTED })),
  afterwards: list(object({ ...QUOTED })),
  assumptions: list(object({ what: str, why: str })),
});

const FIND_SYSTEM = `You find the company's own public postmortem for an outage, so it can be replayed.

Return the company's own write-up: an engineering blog post, incident report, status page post-incident review or root cause analysis on the company's site. News coverage and third-party summaries do not count. If the user names a specific outage, find that one. Otherwise pick the company's most significant outage that has a detailed write-up with a timeline.

Set found to false when no first-party write-up with a timeline exists, and say why in reason. Put the best URL first in urls. Dates are YYYY-MM-DD.`;

const EXTRACT_SYSTEM = `You turn one outage postmortem into data for an interactive replay. A replay that misquotes a company is worse than no replay, so accuracy beats completeness.

The replay machine models one kind of outage: a change (config, rule, content file, feature file, code or customer configuration) reached many servers quickly and made them fail. If this postmortem describes a different kind of failure, such as a cloud dependency, a hardware or power loss, a routing or DNS withdrawal, a database failover or a capacity event, set fit to false, explain why in reason, and fill the other fields minimally.

Quotes are the most important rule. Every quote field must be copied exactly from SOURCE TEXT as one contiguous run of characters: same words, same punctuation, no ellipses, no joining of separate sentences, no paraphrase. Prefer a short exact clause over a long sentence. If you cannot find exact words that support an item, leave that item out.

Times: HH:MM in the time zone the postmortem uses, which is almost always UTC. events are the timeline. Use kind deploy for the moment the bad change reached production or impact began, page for the first detection or alert, identify for when the cause was identified, kill for when the change was stopped, reverted or disabled, recovered for when service was mostly back, and change, status, resolved or note for anything else worth showing. deploy and kill are required. Only use times the postmortem states. clockFrom is a whole half hour or hour a little before the first event and clockTo a little after recovery, at most 8 hours apart.

effectKind: saturate if servers stayed up but ran out of CPU or capacity, crash if they crashed, panicked, errored out or blue-screened. servedShare: the fraction of traffic still served at the worst point, only when the postmortem gives a number (85% errors means 0.15), otherwise null. recoveryKind: manual if affected machines stayed down after the change was reverted and needed hands-on repair, otherwise drain. propagationSeconds: only if the postmortem says how fast the change reached every machine, otherwise null.

prevent levers come only from fixes the company itself lists afterwards that would have stopped this outage on their own, each with a short id, the actual state and the fixed state as one or two plain words each, and the quote of that fix. rollout.quote supports how the change reached the fleet, ideally a staged rollout fix if the company lists one. response.quote supports how fast they could stop it, ideally a fix about kill switches, monitoring or remediation time.

figure names the parts of the replay machine in the company's terms: card is what the bad change was, unit is one server or host, dial is what each server's dial shows (CPU for saturate, health for crash), gauge is what the overall dial shows, kill is the name of what they did to stop it.

facts are 3 to 5 headline numbers with exact quotes, including duration and impact when stated. afterwards lists the company's own follow-up fixes as quotes. assumptions are only for things you could not find in the text and had to choose. title is a short, specific name for the outage, oneLine one plain sentence on what broke. Write in plain English without jargon.`;

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function ask(client, { system, schema, content, tools }) {
  let messages = [{ role: "user", content }];
  for (let turn = 0; turn < 6; turn += 1) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: BETAS,
      fallbacks: "default",
      system,
      messages,
      tools,
      output_config: { effort: "high", format: { type: "json_schema", schema } },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (message.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: message.content }];
      continue;
    }
    if (message.stop_reason === "max_tokens") throw new Error("The answer was cut off.");
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
    return JSON.parse(text);
  }
  throw new Error("Search took too many turns.");
}

export function assemble(raw, source) {
  const at = (kind) => raw.events.find((event) => event.kind === kind)?.at ?? null;
  const origin = raw.clockFrom;
  const sec = (hhmm) => toSeconds(hhmm, origin);
  const deploy = at("deploy");
  const page = at("page");
  const kill = at("kill");
  const recovered = at("recovered");
  const assumptions = [...raw.assumptions];
  const served = raw.servedShare ?? (raw.effectKind === "saturate" ? 0.2 : 0.25);
  if (raw.servedShare === null) assumptions.push({ what: `A hit server still serves ${Math.round(served * 100)}% of its traffic`, why: "The postmortem gives no number for how much traffic was lost." });
  const detectMinutes = page && deploy ? Math.max(0, (sec(page) - sec(deploy)) / 60) : 0;
  if (!page) assumptions.push({ what: "Detection is counted from the moment the change landed", why: "The postmortem gives no time for the first alert." });
  const responseMinutes = Math.max(1, Math.round((sec(kill) - sec(deploy)) / 60 - detectMinutes));
  let tauSeconds = 120;
  if (raw.recoveryKind === "drain" && recovered && sec(recovered) > sec(kill)) {
    tauSeconds = Math.max(5, Math.round((sec(recovered) - sec(kill)) / Math.log((1 - served) / 0.045)));
    assumptions.push({ what: `Service comes back with a ${tauSeconds} second time constant once the change is pulled`, why: `Fitted so the replay is back by ${recovered}, as the postmortem reports.` });
  } else if (raw.recoveryKind === "drain") {
    assumptions.push({ what: "Service comes back with a 120 second time constant once the change is pulled", why: "The postmortem gives no recovery time." });
  }
  if (raw.propagationSeconds === null) assumptions.push({ what: "The change reaches every server within a few seconds", why: "The postmortem does not say how fast it spread." });
  assumptions.push({ what: "Each staged rollout step waits 10 minutes, and early stages carry 1 to 2% of traffic each", why: "Used only when you switch the rollout to staged. The postmortem does not describe a staged path." });

  const checks = [];
  if (page) checks.push({ metric: "pageAt", at: page });
  checks.push({ metric: "killAt", at: kill });
  if (recovered && raw.recoveryKind === "drain") checks.push({ metric: "recoveredBy", at: recovered });
  if (raw.servedShare !== null) checks.push({ metric: "worstLost", value: +(1 - raw.servedShare).toFixed(3), tol: 0.03 });
  if (raw.recoveryKind === "manual") checks.push({ metric: "downAtEnd", value: 0.9 });

  const cite = (item) => ({ ...item, source: "pm" });
  return {
    id: `${slug(raw.company)}-${raw.date}`,
    company: raw.company,
    title: raw.title,
    date: raw.date,
    class: "config-push",
    oneLine: raw.oneLine,
    generated: true,
    clock: { from: raw.clockFrom, to: raw.clockTo, zone: "UTC" },
    sources: [source],
    figure: raw.figure,
    model: {
      stages: STAGES,
      propagation: { mode: "instant", seconds: raw.propagationSeconds ?? 5 },
      effect: { kind: raw.effectKind, served, ...(raw.effectKind === "saturate" ? { peak: 0.99, knee: 0.5, tauUpSeconds: 10 } : {}) },
      recovery: raw.recoveryKind === "manual" ? { kind: "manual" } : { kind: "drain", tauSeconds },
      detectMinutes,
      stageMinutes: 10,
    },
    facts: raw.facts.map(cite),
    events: raw.events.map(cite),
    levers: [
      { id: "rollout", kind: "rollout", label: "Rollout", actual: "global", options: ["global", "staged"], ...cite(raw.rollout) },
      ...raw.prevent.map((lever) => ({ kind: "prevent", ...cite(lever), id: slug(lever.id) || "fix", options: [lever.actual, lever.fix] })),
      { id: "response", kind: "response", label: raw.response.label, actual: responseMinutes, range: [Math.min(2, responseMinutes), Math.max(40, responseMinutes * 2)], why: raw.response.why, quote: raw.response.quote, source: "pm" },
    ],
    afterwards: raw.afterwards.map(cite),
    checks,
    assumptions,
  };
}

export function problemsOf(spec, page) {
  const problems = [...validate(spec), ...verifyQuotes(spec, { pm: page })];
  if (problems.length) return problems;
  const run = simulate(spec);
  for (const item of spec.checks) {
    const result = check(spec, run, item);
    if (!result.ok) problems.push(`replay check ${item.metric} ${item.at ?? item.value} failed, got ${result.got}`);
  }
  return problems;
}

export async function* generate({ company, url }, { client = new Anthropic(), fetcher = fetch, lookup } = {}) {
  const cached = lookup ? await lookup(company) : null;
  if (cached) {
    yield { step: "find", state: "done", message: "Already built" };
    yield { step: "build", state: "done", spec: cached };
    return;
  }

  yield { step: "find", state: "active" };
  let found;
  try {
    found = url
      ? { found: true, company, outage: "", date: "", urls: [url], reason: "" }
      : await ask(client, { system: FIND_SYSTEM, schema: FIND_SCHEMA, content: `Company: ${company}`, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] });
  } catch (error) {
    console.error(error);
    yield { step: "find", state: "failed", message: "The search for a postmortem did not go through. Try again in a minute." };
    return;
  }
  if (!found.found || found.urls.length === 0) {
    yield { step: "find", state: "failed", message: found.reason || `No public postmortem from ${company} turned up.` };
    return;
  }
  yield { step: "find", state: "done", message: found.urls[0] };

  yield { step: "read", state: "active" };
  let page = "";
  let source = null;
  for (const candidate of found.urls.slice(0, 3)) {
    try {
      const response = await fetcher(candidate, { headers: { "user-agent": "blast-radius quote checker (+https://github.com/01shrvan/blast-radius)" } });
      if (!response.ok) continue;
      const html = await response.text();
      page = textOf(html);
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || `${found.company} postmortem`;
      source = { id: "pm", title: textOf(title), url: candidate };
      break;
    } catch {}
  }
  if (!source || page.length < 1500) {
    yield { step: "read", state: "failed", message: "The postmortem page could not be read." };
    return;
  }
  if (page.length > MAX_SOURCE_CHARS) {
    yield { step: "read", state: "failed", message: "The postmortem is too long to read in one pass." };
    return;
  }

  let raw;
  let spec;
  let problems = [];
  let request = `SOURCE: ${source.url}\n\nSOURCE TEXT:\n${page}`;
  for (let attempt = 0; attempt <= REPAIRS; attempt += 1) {
    try {
      raw = await ask(client, { system: EXTRACT_SYSTEM, schema: EXTRACT_SCHEMA, content: request });
    } catch (error) {
      console.error(error);
      yield { step: "read", state: "failed", message: "Reading the postmortem did not go through. Try again in a minute." };
      return;
    }
    if (attempt === 0) yield { step: "read", state: "done" };
    if (!raw.fit) {
      yield { step: "fit", state: "failed", message: `This outage is a different kind than the machine we can draw yet. ${raw.reason}` };
      return;
    }
    yield { step: "verify", state: "active", message: attempt ? `Fixing ${problems.length} problems` : undefined };
    try {
      spec = assemble(raw, source);
      problems = problemsOf(spec, page);
    } catch (error) {
      problems = [`could not assemble the replay: ${error.message}`];
    }
    if (problems.length === 0) break;
    request = `SOURCE: ${source.url}\n\nSOURCE TEXT:\n${page}\n\nYOUR PREVIOUS ANSWER:\n${JSON.stringify(raw)}\n\nIT FAILED THESE CHECKS. Fix each one. Copy quotes exactly from SOURCE TEXT or remove the item:\n${problems.map((item) => `- ${item}`).join("\n")}`;
  }
  if (problems.length) {
    yield { step: "verify", state: "failed", message: `Could not verify every quote and number. ${problems.slice(0, 3).join("; ")}` };
    return;
  }
  yield { step: "verify", state: "done" };
  yield { step: "fit", state: "done" };
  yield { step: "build", state: "done", spec };
}
