// /** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: [
//     "./src/app/**/*.{js,ts,jsx,tsx}",
//     "./src/components/**/*.{js,ts,jsx,tsx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         brand: { DEFAULT: "#4F46E5", dark: "#4338CA", light: "#EEF2FF" },
//         // "success" = credit / money-in (was brand-green)
//         success: { DEFAULT: "#059669", dark: "#065F46", light: "#ECFDF5" },
//         // "danger" = debit / money-out / errors (was brand-red)
//         danger: { DEFAULT: "#DC2626", dark: "#991B1B", light: "#FEF2F2" },
//         // "warning" = neutral stat accent, e.g. customer count (was brand-amber)
//         warning: { DEFAULT: "#D97706", dark: "#92400E", light: "#FFFBEB" },
//         // "info" = neutral stat accent, e.g. entries today (was brand-blue)
//         info: { DEFAULT: "#2563EB", dark: "#1E40AF", light: "#EFF6FF" },

//         text: { primary: "#111827", secondary: "#6B7280", tertiary: "#9CA3AF" },

//         line: { DEFAULT: "#E5E7EB", strong: "#D1D5DB" },

//         page: "#F8F9FC",

//         surface: "#FFFFFF",
//       },

//       borderRadius: { input: "12px", card: "20px" },
//       fontFamily: {
//         sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
//         mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
//       },
//       boxShadow: {
//         card: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -8px rgba(16,24,40,0.10)",
//         brand: "0 10px 24px -6px rgba(79,70,229,0.45)",
//       },
//     },
//   },
//   plugins: [],
// };


/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#3d30ce", dark: "#1e0ce9", light: "#d1c4f3" },
        // "success" = credit / money-in (was brand-green)
        success: { DEFAULT: "#0EA96B", dark: "#065F46", light: "#ECFDF5" },
        // "danger" = debit / money-out / errors (was brand-red)
        danger: { DEFAULT: "#E23F4E", dark: "#991B1B", light: "#FEF2F2" },
        // "warning" = neutral stat accent, e.g. customer count (was brand-amber)
        warning: { DEFAULT: "#D97706", dark: "#92400E", light: "#FFFBEB" },
        // "info" = neutral stat accent, e.g. entries today (was brand-blue)
        info: { DEFAULT: "#2563EB", dark: "#1E40AF", light: "#EFF6FF" },
        // "gold" = the one signature accent — used sparingly and deliberately
        gold: { DEFAULT: "#D4A054", dark: "#A97A2E", light: "#FBF3E4" },

        text: { primary: "#111827", secondary: "#6B7280", tertiary: "#9CA3AF" },

        line: { DEFAULT: "#E5E7EB", strong: "#D1D5DB" },

        page: "#e0ddeb",

        surface: "#FFFFFF",
      },

      backgroundImage: {
        // Soft three-color mesh instead of a flat two-stop gradient —
        // gives the page depth without needing extra decorative elements.
        "mesh-light":
          "radial-gradient(120% 90% at 0% 0%, #EEF2FF 0%, transparent 55%), radial-gradient(100% 80% at 100% 0%, #FBF3E4 0%, transparent 50%), radial-gradient(120% 100% at 50% 100%, #ECFDF5 0%, transparent 45%), linear-gradient(180deg, #F8F9FC 0%, #F8F9FC 100%)",
      },

      borderRadius: { input: "12px", card: "20px" },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        // Signature display face — greeting + net-outstanding label only.
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -8px rgba(16,24,40,0.10)",
        brand: "0 10px 24px -6px rgba(91,79,232,0.45)",
        // Soft color-matched glows, used behind stat cards / blobs
        "glow-success": "0 8px 24px -6px rgba(14,169,107,0.35)",
        "glow-danger": "0 8px 24px -6px rgba(226,63,78,0.35)",
        "glow-warning": "0 8px 24px -6px rgba(217,119,6,0.30)",
        "glow-info": "0 8px 24px -6px rgba(37,99,235,0.30)",
        "glow-gold": "0 8px 24px -6px rgba(212,160,84,0.35)",
        "glow-brand": "0 8px 24px -6px rgba(91,79,232,0.35)",
      },
    },
  },
  plugins: [],
};