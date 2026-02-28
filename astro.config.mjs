import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://music-library.azhrak.dev",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
