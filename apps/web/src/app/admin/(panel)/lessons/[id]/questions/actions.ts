"use server";

import { revalidatePath } from "next/cache";
import {
  bankTargets, cleanQuestion, EXAM_DEFAULTS, importBlockFromParts, isUuid, LESSON_FILES, questionLanguage,
  type CleanQuestion, type ImportBlock, type QuestionType, type Difficulty,
} from "@rupshi/shared";
import { createClient, getSession } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractQuestionsFromPdf, generateQuestionBank, QuestionBankError, type GeneratedBank } from "@/lib/ai/questionBank";

type GenerateError = QuestionBankError["code"] | "notAllowed" | "busy" | "saveFailed";
export type GenerateResult = { ok: true; count: number; costUsd: number } | { ok: false; reason: GenerateError };

async function staff() {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") return null;
  return { supabase: await createClient(), session };
}

interface LessonForAi {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  transcript_path: string | null;
  note_pdf_path: string | null;
  subject: { class_id: number; version: string; code: string; name_bn: string; name_en: string } | null;
  exam: { mcq_count: number; written_count: number; mcq_marks: number; written_marks: number } | null;
}

/** Writes the AI cost to ai_usage_log (Admin → AI usage). Never blocks the main work. */
async function logUsage(lessonId: string, userId: string, usage: Pick<GeneratedBank, "model" | "inputTokens" | "outputTokens" | "costUsd">) {
  try {
    const { error } = await createAdminClient().from("ai_usage_log").insert({
      task: "question_bank",
      user_id: userId,
      lesson_id: lessonId,
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: usage.costUsd,
    });
    if (error) console.error("ai_usage_log insert failed", error);
  } catch (error) {
    console.error("ai_usage_log insert failed", error);
  }
}

function rowFor(q: CleanQuestion, lessonId: string, userId: string, marks: { mcq: number; written: number }, source: "ai" | "teacher") {
  return {
    lesson_id: lessonId,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    model_answer: q.modelAnswer,
    rubric: q.rubric,
    difficulty: q.difficulty,
    marks: q.type === "mcq" ? marks.mcq : marks.written,
    source,
    created_by: userId,
  };
}

/** Makes the lesson's question bank with Claude: reads the transcript and the note PDF. */
export async function generateQuestions(lessonId: string): Promise<GenerateResult> {
  const ctx = await staff();
  if (!ctx || !isUuid(lessonId)) return { ok: false, reason: "notAllowed" };
  const { supabase, session } = ctx;

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, description, status, updated_at, transcript_path, note_pdf_path, subject:subjects(class_id, version, code, name_bn, name_en), exam:exam_settings(mcq_count, written_count, mcq_marks, written_marks)",
    )
    .eq("id", lessonId)
    .maybeSingle<LessonForAi>();
  if (!lesson || !lesson.subject) return { ok: false, reason: "notAllowed" };
  // one run at a time; a run that died more than 6 minutes ago no longer blocks
  if (lesson.status === "generating" && Date.now() - Date.parse(lesson.updated_at) < 6 * 60_000) return { ok: false, reason: "busy" };
  if (!lesson.transcript_path && !lesson.note_pdf_path) return { ok: false, reason: "noMaterial" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "noKey" };

  const exam = {
    mcq_count: lesson.exam?.mcq_count ?? EXAM_DEFAULTS.mcqCount,
    written_count: lesson.exam?.written_count ?? EXAM_DEFAULTS.writtenCount,
    mcq_marks: Number(lesson.exam?.mcq_marks ?? EXAM_DEFAULTS.mcqMarks),
    written_marks: Number(lesson.exam?.written_marks ?? EXAM_DEFAULTS.writtenMarks),
  };
  const previousStatus = lesson.status === "generating" ? "draft" : lesson.status;
  await supabase.from("lessons").update({ status: "generating" }).eq("id", lessonId);

  try {
    const [transcript, note] = await Promise.all([
      lesson.transcript_path
        ? supabase.storage.from(LESSON_FILES.transcript.bucket).download(lesson.transcript_path).then(({ data }) => data?.text() ?? null)
        : null,
      lesson.note_pdf_path
        ? supabase.storage.from(LESSON_FILES.note.bucket).download(lesson.note_pdf_path)
            .then(async ({ data }) => (data ? Buffer.from(await data.arrayBuffer()) : null))
        : null,
    ]);

    const bank = await generateQuestionBank({
      classLevel: lesson.subject.class_id,
      subjectName: `${lesson.subject.name_bn} (${lesson.subject.name_en})`,
      lessonTitle: lesson.title,
      description: lesson.description,
      language: questionLanguage(lesson.subject.version, lesson.subject.code),
      transcript: transcript?.trim() || null,
      notePdf: note,
      targets: bankTargets(exam.mcq_count, exam.written_count),
      writtenMarks: exam.written_marks,
    });
    await logUsage(lessonId, session.user.id, bank);

    // replace the old AI questions: delete the ones never used in an exam, switch off the rest
    const { data: old } = await supabase.from("questions").select("id").eq("lesson_id", lessonId).eq("source", "ai").eq("is_active", true);
    const oldIds = (old ?? []).map((q) => q.id as string);
    if (oldIds.length) {
      const { data: used } = await supabase.from("attempt_answers").select("question_id").in("question_id", oldIds);
      const usedIds = new Set((used ?? []).map((u) => u.question_id as string));
      const unused = oldIds.filter((id) => !usedIds.has(id));
      if (unused.length) await supabase.from("questions").delete().in("id", unused);
      if (usedIds.size) await supabase.from("questions").update({ is_active: false }).in("id", [...usedIds]);
    }
    const marks = { mcq: exam.mcq_marks, written: exam.written_marks };
    const { error } = await supabase.from("questions").insert(bank.questions.map((q) => rowFor(q, lessonId, session.user.id, marks, "ai")));
    if (error) {
      console.error("question insert failed", error);
      await supabase.from("lessons").update({ status: "failed" }).eq("id", lessonId);
      return { ok: false, reason: "saveFailed" };
    }
    await supabase.from("lessons").update({ status: "ready" }).eq("id", lessonId);
    revalidatePath(`/admin/lessons/${lessonId}/questions`);
    revalidatePath("/admin/lessons");
    return { ok: true, count: bank.questions.length, costUsd: bank.costUsd };
  } catch (error) {
    const usage = (error as { usage?: GeneratedBank }).usage;
    if (usage) await logUsage(lessonId, session.user.id, usage);
    const reason = error instanceof QuestionBankError ? error.code : "aiFailed";
    if (!(error instanceof QuestionBankError)) console.error("generateQuestions failed", error);
    // a missing key or material is not a failed run: put the old status back
    await supabase.from("lessons")
      .update({ status: reason === "noKey" || reason === "noMaterial" || reason === "noteTooBig" ? previousStatus : "failed" })
      .eq("id", lessonId);
    revalidatePath("/admin/lessons");
    return { ok: false, reason };
  }
}

export interface QuestionInput {
  id?: string;
  lessonId: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  modelAnswer: string;
  rubric: string;
  difficulty: Difficulty;
}

/** Adds or edits one question by hand. */
export async function saveQuestion(input: QuestionInput): Promise<{ ok: boolean; reason?: "invalid" | "notAllowed" | "saveFailed" }> {
  const ctx = await staff();
  if (!ctx || !isUuid(input.lessonId) || (input.id && !isUuid(input.id))) return { ok: false, reason: "notAllowed" };
  const q = cleanQuestion({
    type: input.type,
    prompt: input.prompt,
    options: input.options,
    correct_index: input.correctIndex,
    explanation: input.explanation,
    model_answer: input.modelAnswer,
    rubric: input.rubric,
    difficulty: input.difficulty,
  });
  if (!q) return { ok: false, reason: "invalid" };
  const { supabase, session } = ctx;
  const { data: es } = await supabase.from("exam_settings").select("mcq_marks, written_marks").eq("lesson_id", input.lessonId).maybeSingle();
  const marks = { mcq: Number(es?.mcq_marks ?? EXAM_DEFAULTS.mcqMarks), written: Number(es?.written_marks ?? EXAM_DEFAULTS.writtenMarks) };
  const row = rowFor(q, input.lessonId, session.user.id, marks, "teacher");
  const { error } = input.id
    ? await supabase.from("questions").update({
        type: row.type, prompt: row.prompt, options: row.options, correct_index: row.correct_index,
        explanation: row.explanation, model_answer: row.model_answer, rubric: row.rubric,
        difficulty: row.difficulty, marks: row.marks,
      }).eq("id", input.id).eq("lesson_id", input.lessonId)
    : await supabase.from("questions").insert(row);
  if (error) {
    console.error("saveQuestion failed", error);
    return { ok: false, reason: "saveFailed" };
  }
  revalidatePath(`/admin/lessons/${input.lessonId}/questions`);
  return { ok: true };
}

export async function setQuestionActive(lessonId: string, id: string, active: boolean): Promise<{ ok: boolean }> {
  const ctx = await staff();
  if (!ctx || !isUuid(id) || !isUuid(lessonId)) return { ok: false };
  const { error } = await ctx.supabase.from("questions").update({ is_active: active }).eq("id", id).eq("lesson_id", lessonId);
  revalidatePath(`/admin/lessons/${lessonId}/questions`);
  return { ok: !error };
}

/** Deletes a question; one already used in an exam is switched off instead. */
export async function deleteQuestion(lessonId: string, id: string): Promise<{ ok: boolean }> {
  const ctx = await staff();
  if (!ctx || !isUuid(id) || !isUuid(lessonId)) return { ok: false };
  const { error } = await ctx.supabase.from("questions").delete().eq("id", id).eq("lesson_id", lessonId);
  if (error) await ctx.supabase.from("questions").update({ is_active: false }).eq("id", id).eq("lesson_id", lessonId);
  revalidatePath(`/admin/lessons/${lessonId}/questions`);
  return { ok: true };
}


export interface ImportItem {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const MAX_IMPORT = 200;

/** Saves many checked MCQs at once (from pasted text, a Word file or a PDF). */
export async function importQuestions(lessonId: string, items: ImportItem[]): Promise<{ ok: boolean; count?: number; reason?: "notAllowed" | "saveFailed" | "invalid" }> {
  const ctx = await staff();
  if (!ctx || !isUuid(lessonId) || !Array.isArray(items)) return { ok: false, reason: "notAllowed" };
  const clean = items.slice(0, MAX_IMPORT).map((i) => cleanQuestion({
    type: "mcq", prompt: i.prompt, options: i.options, correct_index: i.correctIndex,
    explanation: i.explanation, model_answer: "", rubric: "", difficulty: "medium",
  })).filter((q): q is CleanQuestion => q !== null);
  if (clean.length === 0) return { ok: false, reason: "invalid" };
  const { supabase, session } = ctx;
  const { data: es } = await supabase.from("exam_settings").select("mcq_marks, written_marks").eq("lesson_id", lessonId).maybeSingle();
  const marks = { mcq: Number(es?.mcq_marks ?? EXAM_DEFAULTS.mcqMarks), written: Number(es?.written_marks ?? EXAM_DEFAULTS.writtenMarks) };
  const { error } = await supabase.from("questions").insert(clean.map((q) => rowFor(q, lessonId, session.user.id, marks, "teacher")));
  if (error) {
    console.error("importQuestions failed", error);
    return { ok: false, reason: "saveFailed" };
  }
  revalidatePath(`/admin/lessons/${lessonId}/questions`);
  return { ok: true, count: clean.length };
}

export type ReadPdfResult =
  | { ok: true; blocks: ImportBlock[]; costUsd: number }
  | { ok: false; reason: QuestionBankError["code"] | "notAllowed" };

/** The browser uploads the PDF to lesson-private/<lesson>/import.pdf first; the AI copies its questions. Nothing is saved yet. */
export async function readQuestionPdf(lessonId: string): Promise<ReadPdfResult> {
  const ctx = await staff();
  if (!ctx || !isUuid(lessonId)) return { ok: false, reason: "notAllowed" };
  const { supabase, session } = ctx;
  const path = importPdfPath(lessonId);
  const bucket = supabase.storage.from(LESSON_FILES.transcript.bucket);
  try {
    const { data } = await bucket.download(path);
    if (!data) return { ok: false, reason: "noMaterial" };
    const bank = await extractQuestionsFromPdf(Buffer.from(await data.arrayBuffer()));
    await logUsage(lessonId, session.user.id, bank);
    const blocks = bank.questions.map((q, i) =>
      importBlockFromParts(i + 1, q.prompt, q.options, Number.isInteger(q.correct_index) ? q.correct_index : null, q.explanation ?? ""));
    return { ok: true, blocks, costUsd: bank.costUsd };
  } catch (error) {
    const usage = (error as { usage?: GeneratedBank }).usage;
    if (usage) await logUsage(lessonId, session.user.id, usage);
    if (!(error instanceof QuestionBankError)) console.error("readQuestionPdf failed", error);
    return { ok: false, reason: error instanceof QuestionBankError ? error.code : "aiFailed" };
  } finally {
    await bucket.remove([path]);
  }
}

function importPdfPath(lessonId: string) {
  return `${lessonId}/import.pdf`;
}
