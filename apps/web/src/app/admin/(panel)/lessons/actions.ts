"use server";

import { revalidatePath } from "next/cache";
import {
  isUuid, LESSON_FILES, lessonFilePath, validateLesson, youTubeWatchUrl,
  type LessonError, type LessonField, type LessonInput,
} from "@rupshi/shared";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

/**
 * File changes for one save. undefined = leave as it is, null = remove,
 * a path = the file the browser just uploaded (must be this lesson's own path).
 */
export interface LessonFileChanges {
  videoPath?: string | null;
  transcriptPath?: string | null;
  notePath?: string | null;
}

export interface SaveLessonPayload {
  id: string;
  isNew: boolean;
  input: LessonInput;
  files: LessonFileChanges;
}

export type SaveLessonResult =
  | { ok: true; id: string }
  | { ok: false; errors?: Partial<Record<LessonField, LessonError>>; message?: "notAllowed" | "saveFailed" };

async function adminClient() {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") return null;
  return { supabase: await createClient(), session };
}

function fileOk(value: string | null | undefined, id: string, kind: keyof typeof LESSON_FILES) {
  return value === undefined || value === null || value === lessonFilePath(id, kind);
}

/** Saves the Video Upload form. Files are already in storage (uploaded straight from the browser). */
export async function saveLesson(payload: SaveLessonPayload): Promise<SaveLessonResult> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, message: "notAllowed" };
  const { supabase, session } = ctx;
  const { id, isNew, files } = payload;
  if (!isUuid(id)) return { ok: false, message: "saveFailed" };
  if (!fileOk(files.videoPath, id, "video") || !fileOk(files.transcriptPath, id, "transcript") || !fileOk(files.notePath, id, "note"))
    return { ok: false, message: "notAllowed" };

  let existing: { video_path: string | null; subject_id: string; status: string } | null = null;
  if (!isNew) {
    const { data } = await supabase.from("lessons").select("video_path, subject_id, status").eq("id", id).maybeSingle();
    if (!data) return { ok: false, message: "saveFailed" };
    existing = data;
  }

  const videoPathAfter = files.videoPath !== undefined ? files.videoPath : (existing?.video_path ?? null);
  const checked = validateLesson({ ...payload.input, hasVideoFile: Boolean(videoPathAfter) });
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const v = checked.value;

  try {
    // chapter: existing, none, or a new one at the end of the subject's chapters
    let chapterId: string | null = null;
    if (v.chapter && "id" in v.chapter) {
      const { data } = await supabase.from("chapters").select("id").eq("id", v.chapter.id).eq("subject_id", v.subjectId).maybeSingle();
      if (!data) return { ok: false, errors: { chapter: "required" } };
      chapterId = data.id;
    } else if (v.chapter) {
      const { data: last } = await supabase
        .from("chapters").select("sort").eq("subject_id", v.subjectId).order("sort", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase
        .from("chapters")
        .insert({ subject_id: v.subjectId, title: v.chapter.newTitle, sort: (last?.sort ?? 0) + 1 })
        .select("id")
        .single();
      if (error) throw error;
      chapterId = data.id;
    }

    const lessonFields = {
      subject_id: v.subjectId,
      chapter_id: chapterId,
      title: v.title,
      description: v.description,
      // a YouTube link wins over a file; a new file replaces the link
      video_url: v.youTubeId ? youTubeWatchUrl(v.youTubeId) : null,
      video_path: v.youTubeId ? null : videoPathAfter,
      duration_seconds: v.durationSeconds,
      is_published: v.publish,
      ...(files.transcriptPath !== undefined ? { transcript_path: files.transcriptPath } : {}),
      ...(files.notePath !== undefined ? { note_pdf_path: files.notePath } : {}),
    };
    const materialsChanged = files.transcriptPath !== undefined || files.notePath !== undefined;

    if (isNew) {
      const { data: last } = await supabase
        .from("lessons").select("sequence").eq("subject_id", v.subjectId).order("sequence", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase.from("lessons").insert({
        id,
        ...lessonFields,
        sequence: (last?.sequence ?? 0) + 1,
        status: "draft",
        created_by: session.user.id,
      });
      if (error) throw error;
    } else {
      let sequence: number | undefined;
      if (existing && existing.subject_id !== v.subjectId) {
        // moved to another subject: goes to the end of that list
        const { data: last } = await supabase
          .from("lessons").select("sequence").eq("subject_id", v.subjectId).order("sequence", { ascending: false }).limit(1).maybeSingle();
        sequence = (last?.sequence ?? 0) + 1;
      }
      const { error } = await supabase
        .from("lessons")
        .update({
          ...lessonFields,
          ...(sequence ? { sequence } : {}),
          // new transcript or note: the AI question bank must be rebuilt (D3)
          ...(materialsChanged && existing?.status !== "draft" ? { status: "draft" } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    }

    const { error: examError } = await supabase.from("exam_settings").upsert({
      lesson_id: id,
      mcq_count: v.exam.mcqCount,
      written_count: v.exam.writtenCount,
      duration_minutes: v.exam.minutes,
      mcq_marks: v.exam.mcqMarks,
      written_marks: v.exam.writtenMarks,
    });
    if (examError) throw examError;
  } catch (error) {
    console.error("saveLesson failed", error);
    return { ok: false, message: "saveFailed" };
  }

  revalidatePath("/admin/lessons");
  revalidatePath("/admin");
  return { ok: true, id };
}

export async function moveLesson(id: string, direction: -1 | 1): Promise<{ ok: boolean }> {
  const ctx = await adminClient();
  if (!ctx || !isUuid(id)) return { ok: false };
  const { error } = await ctx.supabase.rpc("move_lesson", { p_lesson_id: id, p_direction: direction });
  if (error) console.error("move_lesson failed", error);
  revalidatePath("/admin/lessons");
  return { ok: !error };
}

export async function setLessonPublished(id: string, publish: boolean): Promise<{ ok: boolean; reason?: LessonError }> {
  const ctx = await adminClient();
  if (!ctx || !isUuid(id)) return { ok: false };
  if (publish) {
    const { data } = await ctx.supabase.from("lessons").select("video_url, video_path, duration_seconds").eq("id", id).maybeSingle();
    if (!data) return { ok: false };
    if (!data.video_url && !data.video_path) return { ok: false, reason: "publishNeedsVideo" };
    if (!data.duration_seconds) return { ok: false, reason: "publishNeedsDuration" };
  }
  const { error } = await ctx.supabase.from("lessons").update({ is_published: publish }).eq("id", id);
  if (error) console.error("publish failed", error);
  revalidatePath("/admin/lessons");
  return { ok: !error };
}

export async function deleteLesson(id: string): Promise<{ ok: boolean }> {
  const ctx = await adminClient();
  if (!ctx || !isUuid(id)) return { ok: false };
  const { supabase } = ctx;
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) {
    console.error("deleteLesson failed", error);
    return { ok: false };
  }
  // best effort: remove the lesson's files
  await Promise.all([
    supabase.storage.from(LESSON_FILES.note.bucket).remove([lessonFilePath(id, "note"), lessonFilePath(id, "video")]),
    supabase.storage.from(LESSON_FILES.transcript.bucket).remove([lessonFilePath(id, "transcript")]),
  ]);
  revalidatePath("/admin/lessons");
  revalidatePath("/admin");
  return { ok: true };
}

export async function setSubjectActive(id: string, active: boolean): Promise<{ ok: boolean }> {
  const ctx = await adminClient();
  if (!ctx || !isUuid(id)) return { ok: false };
  const { error } = await ctx.supabase.from("subjects").update({ is_active: active }).eq("id", id);
  if (error) console.error("setSubjectActive failed", error);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin");
  return { ok: !error };
}
