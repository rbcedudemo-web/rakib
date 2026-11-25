import "server-only";
import { EXAM_DEFAULTS, type ClassLevel, type Group, type Version } from "@rupshi/shared";
import { createClient } from "@/lib/supabase/server";

export interface SubjectRow {
  id: string;
  class_id: ClassLevel;
  version: Version;
  group_code: Group | null;
  name_bn: string;
  name_en: string;
  sort: number;
  is_active: boolean;
}

export interface ChapterRow {
  id: string;
  subject_id: string;
  title: string;
  sort: number;
}

/** Everything the Video Upload form needs to fill its dropdowns. */
export async function loadCatalog() {
  const supabase = await createClient();
  const [{ data: subjects }, { data: chapters }, { data: settings }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, class_id, version, group_code, name_bn, name_en, sort, is_active")
      .order("class_id")
      .order("sort")
      .returns<SubjectRow[]>(),
    supabase.from("chapters").select("id, subject_id, title, sort").order("sort").returns<ChapterRow[]>(),
    supabase.from("settings").select("key, value").in("key", ["default_mcq_count", "default_written_count", "default_exam_minutes"]),
  ]);
  const setting = (key: string, fallback: number) => {
    const v = Number((settings ?? []).find((s) => s.key === key)?.value);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    subjects: subjects ?? [],
    chapters: chapters ?? [],
    examDefaults: {
      mcqCount: setting("default_mcq_count", EXAM_DEFAULTS.mcqCount),
      writtenCount: setting("default_written_count", EXAM_DEFAULTS.writtenCount),
      minutes: setting("default_exam_minutes", EXAM_DEFAULTS.minutes),
      mcqMarks: EXAM_DEFAULTS.mcqMarks,
      writtenMarks: EXAM_DEFAULTS.writtenMarks,
    },
  };
}

export function subjectName(s: { name_bn: string; name_en: string }, locale: string) {
  return locale === "bn" ? s.name_bn : s.name_en;
}
