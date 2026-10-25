import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "ignore",
  adapter: node({ mode: "standalone" }),
});
