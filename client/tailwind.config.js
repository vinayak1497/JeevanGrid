/**
 * JeevanGrid design tokens.
 *
 * Direction: "Control Room" — a calm, high-legibility civic-operations
 * aesthetic. Deep forest + marine inks on cool paper, one live-signal colour
 * reserved for things that are actually happening right now, and layered
 * shadows instead of a single flat grey.
 *
 * Every colour below is referenced by the app through semantic names
 * (surface-container-*, on-surface-variant, signal-*), so the palette can
 * move without touching component code.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paper + ink
        "surface": "#F6F9FB",
        "surface-dim": "#CBD8E3",
        "surface-bright": "#FFFFFF",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#EFF4F8",
        "surface-container": "#E6EDF4",
        "surface-container-high": "#DCE5EE",
        "surface-container-highest": "#CFD9E4",
        "on-surface": "#0B1720",
        "on-surface-variant": "#4B5C6D",
        "inverse-surface": "#16242F",
        "inverse-on-surface": "#E9F0F6",
        "outline": "#74889A",
        "outline-variant": "#C6D2DD",
        "surface-tint": "#0F6B47",
        "surface-variant": "#DCE5EE",
        "background": "#F6F9FB",
        "on-background": "#0B1720",

        // Primary — deep forest ink (authority, verified, official)
        "primary": "#0A3A28",
        "on-primary": "#FFFFFF",
        "primary-container": "#12543C",
        "on-primary-container": "#8FDCB7",
        "inverse-primary": "#A6E8C6",

        // Secondary — teal (live operations, responders, telemetry)
        "secondary": "#11615C",
        "on-secondary": "#FFFFFF",
        "secondary-container": "#AEE9E4",
        "on-secondary-container": "#0B4B48",

        // Tertiary — marine (sea, coastal, intelligence)
        "tertiary": "#0B3A61",
        "on-tertiary": "#FFFFFF",
        "tertiary-container": "#0C4A7E",
        "on-tertiary-container": "#A9CDF2",

        // Critical
        "error": "#B3261E",
        "on-error": "#FFFFFF",
        "error-container": "#F9DDDA",
        "on-error-container": "#8C1D18",

        // Fixed variants (kept for parity with the Material naming used in code)
        "primary-fixed": "#C9EED9",
        "primary-fixed-dim": "#A6E8C6",
        "on-primary-fixed": "#00220F",
        "on-primary-fixed-variant": "#1E5138",
        "secondary-fixed": "#C4F1ED",
        "secondary-fixed-dim": "#AEE9E4",
        "on-secondary-fixed": "#00201F",
        "on-secondary-fixed-variant": "#06504D",
        "tertiary-fixed": "#D6E7FB",
        "tertiary-fixed-dim": "#A9CDF2",
        "on-tertiary-fixed": "#001D35",
        "on-tertiary-fixed-variant": "#0F4871",

        // Signal palette — status only. Never decorative.
        "signal-live": "#0E9F6E",
        "signal-live-soft": "#D5F3E6",
        "signal-warn": "#B36B00",
        "signal-warn-soft": "#FCEBD2",
        "signal-critical": "#C0271D",
        "signal-critical-soft": "#FBE0DD",
        "signal-info": "#1A6FD0",
        "signal-info-soft": "#DCEAFB",
        "signal-idle": "#6B7C8C",
        "signal-idle-soft": "#E4EAF0",
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "sm": "0.375rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "full": "9999px"
      },
      spacing: {
        "space-xxs": "0.25rem",
        "space-xs": "0.5rem",
        "space-sm": "0.75rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "space-2xl": "3rem",
        "space-3xl": "4rem",
        "gutter-mobile": "1rem",
        "gutter-tablet": "1.5rem",
        "gutter-desktop": "2rem",
        "margin-mobile": "1rem",
        "margin-tablet": "2rem",
        "margin-desktop": "3rem",
        "container-max": "80rem",
        "header-h": "4rem",
        "tap": "2.75rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "display-lg": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-xl": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "body-lg": ["Inter", "system-ui", "sans-serif"],
        "body-md": ["Inter", "system-ui", "sans-serif"],
        "body-sm": ["Inter", "system-ui", "sans-serif"],
        "label-lg": ["Inter", "system-ui", "sans-serif"],
        "label-md": ["Inter", "system-ui", "sans-serif"],
        "label-sm": ["Inter", "system-ui", "sans-serif"],
        "code-num": ["Inter", "ui-monospace", "monospace"]
      },
      fontSize: {
        // Fluid scale: every size compresses on a 360px phone and expands on
        // wide screens, so no page needs a separate mobile type override.
        "display-lg": ["clamp(2.125rem, 1.35rem + 3.4vw, 2.875rem)", { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display-lg-mobile": ["clamp(2rem, 1.4rem + 2.6vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-xl": ["clamp(1.625rem, 1.2rem + 1.9vw, 2rem)", { lineHeight: "1.18", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-xl-mobile": ["clamp(1.5rem, 1.2rem + 1.3vw, 1.75rem)", { lineHeight: "1.22", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-lg": ["clamp(1.25rem, 1.08rem + 0.8vw, 1.5rem)", { lineHeight: "1.24", letterSpacing: "-0.014em", fontWeight: "600" }],
        "headline-md": ["clamp(1.125rem, 1.04rem + 0.4vw, 1.25rem)", { lineHeight: "1.3", letterSpacing: "-0.008em", fontWeight: "600" }],
        "headline-sm": ["1.0625rem", { lineHeight: "1.4", letterSpacing: "-0.004em", fontWeight: "600" }],
        "body-lg": ["clamp(1rem, 0.96rem + 0.2vw, 1.125rem)", { lineHeight: "1.55", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body-md": ["1rem", { lineHeight: "1.55", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5", letterSpacing: "0.004em", fontWeight: "400" }],
        "label-lg": ["0.875rem", { lineHeight: "1.35", letterSpacing: "0.008em", fontWeight: "600" }],
        "label-md": ["0.8125rem", { lineHeight: "1.35", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.045em", fontWeight: "600" }],
        "code-num": ["0.9375rem", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "600" }]
      },
      boxShadow: {
        // Layered, low-contrast elevation. A single flat shadow reads cheap.
        "xs": "0 1px 2px 0 rgba(11, 23, 32, 0.06)",
        "sm": "0 1px 2px 0 rgba(11, 23, 32, 0.05), 0 2px 6px -1px rgba(11, 23, 32, 0.06)",
        "md": "0 2px 4px -1px rgba(11, 23, 32, 0.05), 0 8px 20px -6px rgba(11, 23, 32, 0.11)",
        "lg": "0 4px 8px -2px rgba(11, 23, 32, 0.05), 0 18px 36px -10px rgba(11, 23, 32, 0.16)",
        "xl": "0 8px 16px -4px rgba(11, 23, 32, 0.06), 0 32px 64px -20px rgba(11, 23, 32, 0.22)",
        "2xl": "0 12px 24px -6px rgba(11, 23, 32, 0.08), 0 44px 88px -28px rgba(11, 23, 32, 0.28)",
        "inner-hairline": "inset 0 0 0 1px rgba(11, 23, 32, 0.07)",
        "glass": "0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 28px -12px rgba(11,23,32,0.28)",
        "signal": "0 0 0 1px rgba(14,159,110,0.28), 0 10px 30px -12px rgba(14,159,110,0.55)",
      },
      maxWidth: {
        "prose-measure": "68ch",
        "shell": "80rem",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-soft": "cubic-bezier(0.4, 0, 0.2, 1)",
        "spring-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "signal-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "70%": { transform: "scale(2.6)", opacity: "0" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        "signal-breathe": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
      },
      animation: {
        "signal-pulse": "signal-pulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "signal-breathe": "signal-breathe 2.8s ease-in-out infinite",
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "sheet-up": "sheet-up 0.34s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.8s infinite",
        "scan-sweep": "scan-sweep 3.5s linear infinite",
      },
      screens: {
        "xs": "400px",
      },
    },
  },
  plugins: [],
};
