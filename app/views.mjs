import { CLASSES } from "../engine/schema.mjs";

export const esc = (text) => String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
export const shortDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

const cite = (spec, item, text = "source") => {
  const source = spec.sources.find((entry) => entry.id === item.source);
  return source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(text)}</a>` : "";
};

const minutesOf = (clock) => {
  const [fh, fm] = clock.from.split(":").map(Number);
  const [th, tm] = clock.to.split(":").map(Number);
  return th * 60 + tm - fh * 60 - fm;
};

export const SECTIONS = [
  { id: "replay", label: "The replay" },
  { id: "change", label: "Change one thing" },
  { id: "timeline", label: "Timeline" },
  { id: "afterwards", label: "What changed after" },
  { id: "assumptions", label: "Assumptions" },
  { id: "sources", label: "Sources" },
];

const head = (index, id) => `<div class="br-section-head"><span>${String(index + 1).padStart(2, "0")}</span><h2>${esc(SECTIONS.find((item) => item.id === id).label)}</h2></div>`;

export function figure(spec, svg, { keys = true } = {}) {
  const COUNT = spec.model.stages.order.length;
  const legend = keys
    ? `<ul>
      <li><kbd>card</kbd><span>${esc(spec.figure.card)}</span></li>
      <li><kbd>${COUNT}×</kbd><span>${esc(spec.figure.unit)}, dial reads ${esc(spec.figure.dial)}</span></li>
      <li><kbd>dial</kbd><span>${esc(spec.figure.gauge)}</span></li>
      <li><kbd>lever</kbd><span>${esc(spec.figure.kill)}, click or press Enter to pull</span></li>
      <li><kbd>← →</kbd><span>step a minute</span></li>
    </ul>`
    : "";
  return `<figure class="br-figure">
  <div class="iso-stage" tabindex="0" aria-label="Replay of the ${esc(spec.company)} outage">${svg}</div>
  <figcaption class="br-margin">
    <p data-readout>${esc(spec.clock.from)}:00 ${esc(spec.clock.zone)}</p>
    ${legend}
  </figcaption>
</figure>`;
}

export function outageBody(spec, svg) {
  const facts = (spec.facts ?? []).map((fact) => `<div><b>${esc(fact.value)}</b><span>${esc(fact.label)}</span>${cite(spec, fact)}</div>`).join("");
  const levers = spec.levers.map((lever) => {
    const control = lever.options
      ? `<span class="br-seg">${lever.options.map((option) => `<button type="button" data-value="${esc(option)}" aria-pressed="false">${esc(option)}${option === lever.actual ? "<i>real</i>" : ""}</button>`).join("")}</span>`
      : `<span class="br-range"><input id="lever-${esc(lever.id)}" type="range" min="${lever.range[0]}" max="${lever.range[1]}" step="1" value="${lever.actual}" aria-label="${esc(lever.label)}"><output data-value>${lever.actual} min</output></span>`;
    return `<div class="br-lever" data-lever="${esc(lever.id)}"><span class="br-lever-name">${esc(lever.label)}</span>${control}<span class="br-lever-why">${esc(lever.why)}. <q>${esc(lever.quote)}</q> ${cite(spec, lever)}</span></div>`;
  }).join("");
  const afterwards = (spec.afterwards ?? []).map((item) => `<li><q>${esc(item.quote)}</q> ${cite(spec, item)}</li>`).join("");
  const assumptions = spec.assumptions.map((item) => `<li><b>${esc(item.what)}.</b> ${esc(item.why)}</li>`).join("");
  const sources = spec.sources.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a></li>`).join("");
  const index = (id) => SECTIONS.findIndex((item) => item.id === id);
  return `
<p class="br-title"><b>${esc(spec.company)}</b><span>· ${esc(longDate(spec.date))}</span></p>
<p class="br-lede">${esc(spec.title)}. <em>${esc(spec.oneLine)}</em></p>
<hr class="br-rule">
<p class="br-meta"><span>${esc(CLASSES[spec.class])}</span><span>${spec.model.stages.order.length} machines</span><span>${esc(spec.clock.from)}–${esc(spec.clock.to)} ${esc(spec.clock.zone)}</span><a href="#sources">from the postmortem</a></p>
${facts ? `<div class="br-facts">${facts}</div>` : ""}
<section class="br-section" id="replay">${head(index("replay"), "replay")}
  <div class="br-controls">
    <div class="br-transport">
      <button type="button" class="br-play" data-play>Pause</button>
      <input id="scrub" type="range" data-scrub min="0" max="${minutesOf(spec.clock) * 60}" step="5" value="0" aria-label="Replay clock">
      <output data-clock>${esc(spec.clock.from)}:00</output>
    </div>
    <div class="br-modes">
      <button type="button" class="br-link-button" data-oncall-start>Take the on-call shift</button>
      <button type="button" class="br-link-button" data-sound aria-pressed="false">Sound off</button>
      <span class="br-muted" data-ghost-note hidden>Faint needle: what really happened</span>
    </div>
    <div class="br-oncall" data-oncall hidden>
      <p class="br-oncall-status" data-oncall-text></p>
      <div class="br-oncall-result" data-oncall-result hidden>
        <p data-oncall-score></p>
        <div class="br-actions"><button type="button" class="br-link-button" data-copy>Copy my result</button><button type="button" class="br-link-button" data-oncall-start>Try again</button><button type="button" class="br-link-button" data-oncall-exit>Back to the replay</button></div>
      </div>
    </div>
  </div>
</section>
${figure(spec, svg)}
<div class="br-results">
  <div><h3>As it happened, replayed</h3><p data-result="actual"></p></div>
  <div><h3>Your replay</h3><p data-result="replay"></p></div>
</div>
<section class="br-section" id="change">${head(index("change"), "change")}
  <p class="br-muted">Each lever is a fix ${esc(spec.company)} itself listed afterwards. Flip one and the bench runs again.</p>
  <div class="br-levers">${levers}</div>
  <div class="br-actions"><button type="button" class="br-link-button" data-pull>Pull the ${esc(spec.figure.kill)} now</button><button type="button" class="br-link-button" data-reset disabled>Back to what happened</button><span data-pull-note></span></div>
</section>
<section class="br-section" id="timeline">${head(index("timeline"), "timeline")}
  <ol class="br-log" data-log></ol>
</section>
${afterwards ? `<section class="br-section" id="afterwards">${head(index("afterwards"), "afterwards")}<ul class="br-after">${afterwards}</ul></section>` : ""}
<section class="br-section" id="assumptions">${head(index("assumptions"), "assumptions")}
  <p class="br-muted">Postmortems leave gaps. These are the places this replay had to fill one, and why.</p>
  <ul class="br-assume">${assumptions}</ul>
</section>
<section class="br-section" id="sources">${head(index("sources"), "sources")}
  <ul class="br-sources">${sources}</ul>
  <p class="br-note">Quoted lines are verbatim from these sources. Lines tagged modelled come from the simulation. The numbers at the top are the company's own, both replays are simulated.</p>
</section>`;
}

export function row(spec, svg, href) {
  const lost = (spec.facts ?? []).find((fact) => /lost|error|down|affected|devices/i.test(fact.label));
  return `<a class="br-row" href="${esc(href)}" data-search="${esc(`${spec.company} ${spec.title} ${spec.date} ${spec.oneLine}`.toLowerCase())}">
  <span class="br-row-fig iso">${svg}</span>
  <span class="br-row-text"><b>${esc(spec.company)} · ${esc(spec.title)}</b><span>${esc(spec.oneLine)}${lost ? ` ${esc(lost.value)} ${esc(lost.label.toLowerCase())}.` : ""}</span></span>
  <time datetime="${esc(spec.date)}">${esc(shortDate(spec.date))}</time>
</a>`;
}
