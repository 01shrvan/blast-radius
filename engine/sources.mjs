import { verifyQuotes } from "./schema.mjs";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: "-", ndash: "-", hellip: "..." };

export function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSources(spec, { fetcher = fetch } = {}) {
  const pages = {};
  for (const source of spec.sources) {
    const response = await fetcher(source.url, { headers: { "user-agent": "blast-radius quote checker (+https://github.com/01shrvan/blast-radius)" } });
    if (!response.ok) throw new Error(`${source.id}: ${source.url} answered ${response.status}`);
    pages[source.id] = textOf(await response.text());
  }
  return pages;
}

export async function checkSpecQuotes(spec, options) {
  const pages = await fetchSources(spec, options);
  return verifyQuotes(spec, pages);
}
