"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { isUuid, type MessageKey } from "@rupshi/shared";
import { createClient } from "@/lib/supabase/server";
import type { ExamAttemptView } from "@/lib/exam";

export type ExamResult = { ok: true; view: ExamAttemptView } | { ok: false; error: MessageKey };

/** The database puts a text key in the error hint (e.g. exam.error.dailyLimit). */
function errorKey(error: PostgrestError | null): MessageKey {
  const hint = error?.hint ?? "";
  if (hint.startsWith("exam.error.")) return hint as MessageKey;
  if (error) console.error("exam rpc failed", error.message);
  return "exam.error.generic";
}

export async function startExam(lessonId: string): Promise<ExamResult> {
  if (!isUuid(lessonId)) return { ok: false, error: "exam.error.generic" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_exam", { p_lesson_id: lessonId });
  if (error || !data) return { ok: false, error: errorKey(error) };
  return { ok: true, view: data as ExamAttemptView };
}

/** selected = position in the shown order (MCQ); images = storage paths (written). */
export async function saveAnswer(
  attemptId: string, questionId: string, answer: { selected?: number | null; images?: string[] },
): Promise<{ ok: boolean; error?: MessageKey }> {
  if (!isUuid(attemptId) || !isUuid(questionId)) return { ok: false, error: "exam.error.generic" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_exam_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected: answer.selected ?? null,
    p_images: answer.images ?? null,
  });
  return error ? { ok: false, error: errorKey(error) } : { ok: true };
}

export async function submitExam(attemptId: string): Promise<ExamResult> {
  if (!isUuid(attemptId)) return { ok: false, error: "exam.error.generic" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exam", { p_attempt_id: attemptId });
  if (error || !data) return { ok: false, error: errorKey(error) };
  return { ok: true, view: data as ExamAttemptView };
}
