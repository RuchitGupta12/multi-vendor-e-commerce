import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F766E",
          hover: "#115E59",
          soft: "#CCFBF1",
          foreground: "#FAFAF9",
        },
        accent: {
          DEFAULT: "#D97706",
          hover: "#B45309",
          soft: "#FEF3C7",
          foreground: "#FAFAF9",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F3EFE8",
        },
        border: "#E7E1D8",
        background: "#FAF8F5",
        foreground: {
          DEFAULT: "#1C1917",
          muted: "#57534E",
        },
        success: "#15803D",
        warning: "#B45309",
        danger: "#B91C1C",
        info: "#0369A1",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Segoe UI"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,23,0.06), 0 8px 24px rgba(28,25,23,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
