import { simulate } from "../../engine/sim.mjs";

const files = import.meta.glob("../../incidents/*.json", { eager: true, import: "default" }) as Record<string, any>;

export const incidents = Object.values(files).sort((a, b) => b.date.localeCompare(a.date));

export const byId = (id: string) => incidents.find((spec) => spec.id === id);

export const neighbours = (list: any[], id: string) => {
  const index = list.findIndex((spec) => spec.id === id);
  return { newer: list[index - 1] ?? null, older: list[index + 1] ?? null };
};

export const summaryOf = (spec: any) => simulate(spec).summary;
