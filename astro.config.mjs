import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://01shrvan.github.io",
  base: process.env.BASE_PATH ?? "/blast-radius",
  trailingSlash: "always",
});
