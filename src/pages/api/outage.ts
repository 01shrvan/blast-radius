import type { APIRoute } from "astro";
import { getGenerated } from "../../lib/store";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const spec = await getGenerated(url.searchParams.get("id") ?? "");
  if (!spec) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify(spec), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
};
