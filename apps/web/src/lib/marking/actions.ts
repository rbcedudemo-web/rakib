"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSession } from "@/lib/supabase/server";
import { MARKING_ERRORS, type MarkingError } from "./types";

export type MarkResult = { ok: true; marks: number } | { ok: false; error: MarkingError };

/** A teacher (or admin) gives marks to one written answer. The database checks who may mark what. */
export async function markAnswer(input: { answerId: string; marks: number; feedback: string; reason: string }): Promise<MarkResult> {
  const session = await getSession();
  if (!session || session.profile.role === "student") return { ok: false, error: "marking.error.notAllowed" };
  const marks = Number(input.marks);
  if (!Number.isFinite(marks) || marks < 0 || Math.round(marks * 2) !== marks * 2) return { ok: false, error: "marking.error.marks" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_answer", {
    p_answer_id: input.answerId,
    p_marks: marks,
    p_feedback: input.feedback.slice(0, 2000),
    p_reason: input.reason.slice(0, 500),
  });
  if (error) {
    const hint = (MARKING_ERRORS as readonly string[]).includes(error.hint ?? "") ? (error.hint as MarkingError) : "marking.error.failed";
    if (hint === "marking.error.failed") console.error("mark_answer failed", error);
    return { ok: false, error: hint };
  }
  revalidatePath("/admin/marking");
  revalidatePath("/teacher/review");
  revalidatePath("/teacher");
  return { ok: true, marks: Number((data as { marks: number }).marks) };
}
