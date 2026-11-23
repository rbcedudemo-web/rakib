export const CLASS_LEVELS = [6, 7, 8, 9, 10, 11, 12] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

/** Demo content exists only for these classes (Rakib, 22 Nov 2026). */
export const DEMO_CLASS_LEVELS: readonly ClassLevel[] = [9, 10];

export const VERSIONS = ["bangla", "english_version", "english_medium", "madrasa"] as const;
export type Version = (typeof VERSIONS)[number];

export const GROUPS = ["science", "commerce", "arts"] as const;
export type Group = (typeof GROUPS)[number];

/** Classes 9–12 choose a group (Science / Commerce / Arts); 6–8 do not. */
export function needsGroup(level: ClassLevel): boolean {
  return level >= 9;
}

/** SSC prep for 9–10, HSC prep for 11–12, none for 6–8. */
export function boardExamFor(level: ClassLevel): "ssc" | "hsc" | null {
  if (level === 9 || level === 10) return "ssc";
  if (level === 11 || level === 12) return "hsc";
  return null;
}

/** Bangla digits for display (১২৩...). */
export function toBanglaDigits(value: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/[0-9]/g, (d) => map[Number(d)]!);
}
