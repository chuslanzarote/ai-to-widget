import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#f8f3ee",
          500: "#8b6f47",
          700: "#5a4632",
          900: "#2e241a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
