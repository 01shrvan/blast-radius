import type { APIRoute } from "astro";
import { generate } from "../../../engine/generate.mjs";
import { findByCompany, saveGenerated } from "../../lib/store";

export const prerender = false;

const running = new Map<string, number>();
const LIMIT_PER_HOUR = 6;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => ({}));
  const company = String(body.company ?? "").trim().slice(0, 80);
  const url = typeof body.url === "string" && /^https:\/\//.test(body.url) ? body.url : undefined;
  if (!company) return new Response(JSON.stringify({ error: "Say which company." }), { status: 400 });
  const offline = !process.env.ANTHROPIC_API_KEY;

  const hour = Math.floor(Date.now() / 3600000);
  const key = `${clientAddress}:${hour}`;
  const used = running.get(key) ?? 0;
  if (used >= LIMIT_PER_HOUR) return new Response(JSON.stringify({ error: "Too many builds this hour. Try again later." }), { status: 429 });
  running.set(key, used + 1);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const cached = await findByCompany(company);
        if (offline && !cached) {
          send({ step: "find", state: "failed", message: `Live building is switched off on this server for now, so ${company} can't be built automatically yet.` });
          controller.close();
          return;
        }
        for await (const event of generate({ company, url }, { lookup: findByCompany })) {
          if (event.spec && event.spec.generated) await saveGenerated(event.spec);
          send(event);
        }
      } catch (error) {
        console.error(error);
        send({ step: "build", state: "failed", message: "Something broke while building. Nothing was published." });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
};
