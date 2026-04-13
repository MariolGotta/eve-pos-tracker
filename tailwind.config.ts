import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        eve: {
          bg: "#0a0e1a",
          panel: "#0f1629",
          border: "#1e2d4a",
          accent: "#4a9eff",
          gold: "#c9a84c",
          red: "#e53e3e",
          orange: "#dd6b20",
          green: "#38a169",
          muted: "#718096",
        },
      },
    },
  },
  plugins: [],
};

export default config;
