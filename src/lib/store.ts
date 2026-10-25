import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { incidents } from "./incidents";

const DIR = join(process.cwd(), "data", "generated");
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function listGenerated(): Promise<any[]> {
  try {
    const names = (await readdir(DIR)).filter((name) => name.endsWith(".json"));
    const specs = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(DIR, name), "utf8"))));
    return specs.filter((spec) => !incidents.some((item) => item.id === spec.id));
  } catch {
    return [];
  }
}

export async function getGenerated(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function saveGenerated(spec: any) {
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(join(DIR, `${spec.id}.json`), JSON.stringify(spec, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function findByCompany(name: string) {
  const key = slug(name);
  if (!key) return null;
  const all = [...incidents, ...(await listGenerated())];
  return all.find((spec) => slug(spec.company) === key) ?? null;
}

export async function allIncidents() {
  return [...incidents, ...(await listGenerated())].sort((a, b) => b.date.localeCompare(a.date));
}
