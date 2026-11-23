import type { Config } from "tailwindcss";
import { colors, fonts } from "@rupshi/shared/src/theme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        accent: colors.accent,
        highlight: colors.highlight,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
      },
      fontFamily: {
        sans: [`"${fonts.body}"`, ...fonts.fallback.map((f) => (f.includes(" ") ? `"${f}"` : f))],
      },
      borderRadius: { card: "16px" },
      maxWidth: { page: "1200px" },
    },
  },
  plugins: [],
};

export default config;
