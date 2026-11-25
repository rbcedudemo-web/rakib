"use server";

import { isUuid } from "@rupshi/shared";
import { createClient } from "@/lib/supabase/server";

export interface ProgressResult {
  ok: boolean;
  percent?: number;
  completed?: boolean;
}

/** Saves how much of the lesson video the student watched (the database keeps the highest value). */
export async function recordProgress(lessonId: string, watchedSeconds: number): Promise<ProgressResult> {
  if (!isUuid(lessonId) || !Number.isFinite(watchedSeconds) || watchedSeconds < 0) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("record_lesson_progress", { p_lesson_id: lessonId, p_watched_seconds: Math.floor(watchedSeconds) })
    .single<{ watched_percent: number; completed_at: string | null }>();
  if (error || !data) {
    if (error) console.error("record_lesson_progress failed", error.message);
    return { ok: false };
  }
  return { ok: true, percent: Number(data.watched_percent), completed: Boolean(data.completed_at) };
}
