/**
 * Design tokens shared by the web portal and the Android app.
 * Palette: deep green (education, Bangladesh flag) as primary, flag red as a
 * sparing accent, warm amber for highlights, slate neutrals for text.
 */
export const colors = {
  primary: {
    50: "#ecf8f1",
    100: "#d0eedd",
    200: "#a3dcbd",
    300: "#6dc496",
    400: "#3aa771",
    500: "#1b8a56",
    600: "#006a4e", // Bangladesh flag green: main brand colour
    700: "#055a43",
    800: "#074836",
    900: "#073b2e",
  },
  accent: {
    50: "#fdeeee",
    100: "#fbd5d6",
    500: "#e2333b",
    600: "#c8202b", // flag red: alerts, live badge, small accents only
    700: "#a71922",
  },
  highlight: {
    100: "#fff3d6",
    400: "#f5b82e",
    500: "#e09f12",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f8f7",
    100: "#eef0ef",
    200: "#dde1df",
    300: "#c3c9c6",
    400: "#9aa29e",
    500: "#6f7873",
    600: "#545c58",
    700: "#3c4340",
    800: "#262b29",
    900: "#151918",
  },
  success: "#1b8a56",
  warning: "#e09f12",
  danger: "#c8202b",
  info: "#2563c9",
} as const;

export const fonts = {
  /** Hind Siliguri covers both Bangla and Latin script, so one family is used everywhere. */
  body: "Hind Siliguri",
  fallback: ["Noto Sans Bengali", "system-ui", "sans-serif"],
} as const;

export const radii = { sm: 6, md: 10, lg: 16, full: 9999 } as const;

/** 4px spacing scale. */
export const spacing = (step: number) => step * 4;

/** Minimum touch target in px (accessibility, low-end Android phones). */
export const minTouchTarget = 44;
