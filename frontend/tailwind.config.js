/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // Heroku-style Unstuck palette
        ink: {
          DEFAULT: "#1C1033",
          muted: "#5C5478",
          soft: "#8E87A6",
        },
        purple: {
          primary: "#5A1BA9",
          dark: "#3C0F77",
          light: "#7B3FD9",
          soft: "#EFE7FB",
        },
        canvas: {
          DEFAULT: "#FFFFFF",
          alt: "#F7F5FB",
        },
        line: "#E5E1EE",
        good: "#2E7D5B",
        warn: "#C77A0E",
        bad: "#C0392B",
        info: "#2563EB",
        // Shadcn (re-mapped to our palette so any shadcn component looks correct)
        background: "#FFFFFF",
        foreground: "#1C1033",
        card: { DEFAULT: "#FFFFFF", foreground: "#1C1033" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#1C1033" },
        primary: { DEFAULT: "#5A1BA9", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#EFE7FB", foreground: "#5A1BA9" },
        muted: { DEFAULT: "#F7F5FB", foreground: "#5C5478" },
        accent: { DEFAULT: "#EFE7FB", foreground: "#5A1BA9" },
        destructive: { DEFAULT: "#C0392B", foreground: "#FFFFFF" },
        border: "#E5E1EE",
        input: "#E5E1EE",
        ring: "#5A1BA9",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
        pill: "9999px",
      },
      maxWidth: {
        content: "1200px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(28, 16, 51, 0.06)",
        md: "0 4px 16px rgba(28, 16, 51, 0.08)",
        lg: "0 12px 32px rgba(28, 16, 51, 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "soft-pulse": "soft-pulse 2s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
