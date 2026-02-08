/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f0f",
          50: "#1a1a1a",
          100: "#252525",
          200: "#333333",
        },
        accent: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
        },
      },
    },
  },
  plugins: [],
};
