const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAGES = new Set(["DOG", "PIG", "CANARY", "GLOBAL"]);
const LEVER_KINDS = new Set(["rollout", "prevent", "response"]);

export const CLASSES = {
  "config-push": "A change pushed to every server at once",
};

export function validate(spec) {
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };
  need(typeof spec.id === "string" && /^[a-z0-9-]+$/.test(spec.id), "id must be kebab-case");
  for (const key of ["company", "title", "date", "oneLine"]) need(typeof spec[key] === "string" && spec[key].length > 0, `${key} is required`);
  need(spec.class in CLASSES, `class must be one of ${Object.keys(CLASSES).join(", ")}`);
  need(CLOCK.test(spec.clock?.from ?? "") && CLOCK.test(spec.clock?.to ?? ""), "clock.from and clock.to must be HH:MM");
  const sources = new Set((spec.sources ?? []).map((item) => item.id));
  need(sources.size > 0, "at least one source");
  for (const item of spec.sources ?? []) need(/^https:\/\//.test(item.url ?? ""), `source ${item.id} needs an https url`);
  const quoted = (item, where) => {
    need(typeof item.quote === "string" && item.quote.trim().length >= 3, `${where} needs a quote`);
    need(sources.has(item.source), `${where} cites unknown source ${item.source}`);
  };
  const order = spec.model?.stages?.order ?? [];
  const share = spec.model?.stages?.share ?? [];
  need(order.length >= 4 && order.length === share.length, "model.stages.order and share must match, 4 or more");
  for (const stage of order) need(STAGES.has(stage), `unknown stage ${stage}`);
  need(["instant", "flap"].includes(spec.model?.propagation?.mode), "propagation.mode must be instant or flap");
  if (spec.model?.propagation?.mode === "flap") need(CLOCK.test(spec.model.propagation.steadyAt ?? ""), "flap needs steadyAt");
  need(["saturate", "crash"].includes(spec.model?.effect?.kind), "effect.kind must be saturate or crash");
  need(spec.model?.effect?.served >= 0 && spec.model?.effect?.served < 1, "effect.served must be in [0, 1)");
  need(["drain", "manual"].includes(spec.model?.recovery?.kind), "recovery.kind must be drain or manual");
  for (const [index, event] of (spec.events ?? []).entries()) {
    need(CLOCK.test(event.at ?? ""), `event ${index} needs HH:MM`);
    quoted(event, `event ${event.kind}`);
  }
  for (const kind of ["deploy", "kill"]) need((spec.events ?? []).some((event) => event.kind === kind), `events need a ${kind}`);
  for (const fact of spec.facts ?? []) quoted(fact, `fact ${fact.label}`);
  for (const item of spec.afterwards ?? []) quoted(item, "afterwards item");
  const kinds = (spec.levers ?? []).map((lever) => lever.kind);
  need(kinds.includes("rollout") && kinds.includes("response"), "levers need a rollout and a response");
  for (const lever of spec.levers ?? []) {
    need(LEVER_KINDS.has(lever.kind), `lever ${lever.id} has unknown kind`);
    quoted(lever, `lever ${lever.id}`);
    if (lever.kind === "prevent") need(lever.options?.includes(lever.fix) && lever.options?.includes(lever.actual), `lever ${lever.id} options must hold actual and fix`);
    if (lever.kind === "response") need(lever.actual >= lever.range?.[0] && lever.actual <= lever.range?.[1], `lever ${lever.id} actual outside range`);
  }
  need(Array.isArray(spec.checks) && spec.checks.length > 0, "at least one check against the postmortem");
  need(Array.isArray(spec.assumptions), "assumptions list is required, even if empty");
  return errors;
}

export function quotesOf(spec) {
  const list = [];
  for (const event of spec.events ?? []) list.push({ where: `event ${event.kind}`, quote: event.quote, source: event.source });
  for (const fact of spec.facts ?? []) list.push({ where: `fact ${fact.label}`, quote: fact.quote, source: fact.source });
  for (const lever of spec.levers ?? []) list.push({ where: `lever ${lever.id}`, quote: lever.quote, source: lever.source });
  for (const item of spec.afterwards ?? []) list.push({ where: "afterwards", quote: item.quote, source: item.source });
  return list;
}

const squash = (text) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

export function verifyQuotes(spec, pages) {
  return quotesOf(spec)
    .filter((item) => !squash(pages[item.source] ?? "").includes(squash(item.quote)))
    .map((item) => `${item.where}: quote not found in source ${item.source}`);
}
