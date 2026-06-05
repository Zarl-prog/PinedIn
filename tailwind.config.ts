import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#1a1a1a",
        input: "#1a1a1a",
        ring: "#333",
        background: "#000",
        foreground: "#ededed",
        primary: {
          DEFAULT: "#fff",
          foreground: "#000",
        },
        secondary: {
          DEFAULT: "#0a0a0a",
          foreground: "#888",
        },
        destructive: {
          DEFAULT: "#444",
          foreground: "#ededed",
        },
        muted: {
          DEFAULT: "#0d0d0d",
          foreground: "#444",
        },
        accent: {
          DEFAULT: "#111",
          foreground: "#ededed",
        },
        popover: {
          DEFAULT: "#0a0a0a",
          foreground: "#ededed",
        },
        card: {
          DEFAULT: "#0a0a0a",
          foreground: "#ededed",
        },
      },
      fontFamily: {
        mono: ["'Geist Mono'", "monospace"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
