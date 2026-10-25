import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        panel: c("panel"),
        panel2: c("panel2"),
        fg: c("fg"),
        muted: c("muted"),
        line: c("line"),
        accent: c("accent"),
        rec: "#ff2d2d",
        ok: "#34d27b",
      },
      borderRadius: { "3xl": "1.75rem" },
    },
  },
  plugins: [],
};

export default config;
