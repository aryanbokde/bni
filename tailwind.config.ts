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
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Brand — primary
        navy: {
          DEFAULT: "#1B2A4A",
          50: "#F1F3F8",
          100: "#DDE2EE",
          200: "#B8C1D7",
          300: "#8C99B8",
          400: "#5A6A8E",
          500: "#374668",
          600: "#243556",
          700: "#1B2A4A",
          800: "#141F38",
          900: "#0C1425",
        },
        "bni-blue": {
          DEFAULT: "#2E75B6",
          50: "#EAF2FA",
          100: "#D1E3F3",
          200: "#A3C7E6",
          300: "#6FA5D4",
          400: "#4089C4",
          500: "#2E75B6",
          600: "#235E94",
          700: "#1B4A74",
          800: "#143858",
          900: "#0E2740",
        },

        // Status colors
        "bni-green": {
          DEFAULT: "#2E7D32",
          50: "#F0F9F1",
          100: "#DBF0DE",
          500: "#2E7D32",
          600: "#256628",
        },
        "bni-amber": {
          DEFAULT: "#E65100",
          50: "#FFF5E6",
          100: "#FFE4BF",
          500: "#E65100",
          600: "#B84000",
        },
        "bni-red": {
          DEFAULT: "#B71C1C",
          50: "#FDEBEB",
          100: "#FACECE",
          500: "#B71C1C",
          600: "#8F1616",
        },

        // Neutral extras
        teal: "#007A6E",
      },

      fontSize: {
        // Custom typography scale
        display: ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        headline: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" }],
        title: ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        subtitle: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.6", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.5", fontWeight: "500" }],
        micro: ["0.6875rem", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.04em" }],
      },

      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
        "3xl": "32px",
      },

      boxShadow: {
        soft: "0 1px 3px rgba(27, 42, 74, 0.06), 0 1px 2px rgba(27, 42, 74, 0.04)",
        medium: "0 4px 12px rgba(27, 42, 74, 0.08), 0 2px 4px rgba(27, 42, 74, 0.05)",
        strong: "0 12px 32px rgba(27, 42, 74, 0.12), 0 4px 8px rgba(27, 42, 74, 0.06)",
        "glow-blue": "0 0 0 4px rgba(46, 117, 182, 0.15)",
        "glow-navy": "0 0 0 4px rgba(27, 42, 74, 0.12)",
      },

      transitionTimingFunction: {
        "ease-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "ease-bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "ease-out-back": "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
      },

      transitionDuration: {
        fast: "150ms",
        normal: "220ms",
        slow: "320ms",
      },

      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
      },

      animation: {
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fade-in 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slide-up 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-in-right": "slide-in-right 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        shake: "shake 400ms ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
