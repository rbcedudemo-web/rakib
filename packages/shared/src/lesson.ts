/**
 * Lesson helpers shared by the admin "Video Upload" form, the server action
 * and (later) the student player and the Android app.
 */

/** Exam defaults from the guideline: 10 MCQ, 2 written, 15 minutes. */
export const EXAM_DEFAULTS = { mcqCount: 10, writtenCount: 2, minutes: 15, mcqMarks: 1, writtenMarks: 5 } as const;

/** Limits match the database checks on public.exam_settings. */
export const EXAM_LIMITS = {
  mcqCount: [0, 50],
  writtenCount: [0, 10],
  minutes: [1, 180],
  mcqMarks: [0.5, 100],
  writtenMarks: [0.5, 100],
} as const;

/** Largest files the admin can upload (bucket limits). */
export const MAX_NOTE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARS = 200_000;

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Returns the 11-character video id of a YouTube link, or null. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (YT_ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[2] ?? null;
    }
  }
  return id && YT_ID.test(id) ? id : null;
}

export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** 754 -> "12:34", 3723 -> "1:02:03". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
function asciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** "12:34", "1:02:03" or plain minutes "15" -> seconds; null when unreadable. Accepts Bangla digits. */
export function parseDuration(input: string): number | null {
  const raw = asciiDigits(input.trim());
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const minutes = Number(raw);
    return minutes > 0 ? minutes * 60 : null;
  }
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  const seconds = nums.reduce((acc, n) => acc * 60 + n, 0);
  return seconds > 0 ? seconds : null;
}

/**
 * Turns a subtitle file (.srt / .vtt) into plain text for the AI: drops the
 * header, cue numbers, timestamps, tags and repeated lines.
 */
export function subtitleToText(input: string): string {
  const lines = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let skipBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      skipBlock = false;
      continue;
    }
    if (skipBlock) continue;
    if (/^WEBVTT/.test(t)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(t)) {
      skipBlock = true;
      continue;
    }
    if (/^\d+$/.test(t)) continue;
    if (/-->/.test(t)) continue;
    const text = t.replace(/<[^>]+>/g, "").replace(/\{\\[^}]*\}/g, "").trim();
    if (text && out[out.length - 1] !== text) out.push(text);
  }
  return out.join("\n");
}

export function isSubtitleFile(name: string): boolean {
  return /\.(srt|vtt)$/i.test(name);
}

export type LessonField =
  | "subject" | "chapter" | "title" | "video" | "duration" | "transcript"
  | "mcqCount" | "writtenCount" | "minutes" | "mcqMarks" | "writtenMarks" | "publish";

export type LessonError =
  | "required" | "tooLong" | "badYouTube" | "badDuration" | "range" | "noQuestions" | "publishNeedsVideo"
  | "publishNeedsDuration";

export interface LessonInput {
  subjectId: string;
  chapterId: string;        // existing chapter id, "" for none, "new" to create chapterTitle
  chapterTitle: string;
  title: string;
  description: string;
  videoUrl: string;         // YouTube link, "" when a file is used
  hasVideoFile: boolean;
  duration: string;         // "mm:ss"
  mcqCount: number;
  writtenCount: number;
  minutes: number;
  mcqMarks: number;
  writtenMarks: number;
  publish: boolean;
}

export interface CleanLesson {
  subjectId: string;
  chapter: { id: string } | { newTitle: string } | null;
  title: string;
  description: string | null;
  youTubeId: string | null;
  durationSeconds: number | null;
  exam: { mcqCount: number; writtenCount: number; minutes: number; mcqMarks: number; writtenMarks: number };
  publish: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function inRange(n: number, [min, max]: readonly [number, number], integer: boolean) {
  return Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
}

/** Checks the Video Upload form. Same rules run in the browser and on the server. */
export function validateLesson(
  input: LessonInput,
): { ok: true; value: CleanLesson } | { ok: false; errors: Partial<Record<LessonField, LessonError>> } {
  const errors: Partial<Record<LessonField, LessonError>> = {};
  if (!isUuid(input.subjectId)) errors.subject = "required";

  let chapter: CleanLesson["chapter"] = null;
  if (input.chapterId === "new") {
    const t = input.chapterTitle.trim();
    if (!t) errors.chapter = "required";
    else if (t.length > 150) errors.chapter = "tooLong";
    else chapter = { newTitle: t };
  } else if (input.chapterId) {
    if (isUuid(input.chapterId)) chapter = { id: input.chapterId };
    else errors.chapter = "required";
  }

  const title = input.title.trim();
  if (!title) errors.title = "required";
  else if (title.length > 200) errors.title = "tooLong";
  const description = input.description.trim();

  let youTubeId: string | null = null;
  if (input.videoUrl.trim()) {
    youTubeId = parseYouTubeId(input.videoUrl);
    if (!youTubeId) errors.video = "badYouTube";
  }

  let durationSeconds: number | null = null;
  if (input.duration.trim()) {
    durationSeconds = parseDuration(input.duration);
    if (durationSeconds === null) errors.duration = "badDuration";
  }

  if (!inRange(input.mcqCount, EXAM_LIMITS.mcqCount, true)) errors.mcqCount = "range";
  if (!inRange(input.writtenCount, EXAM_LIMITS.writtenCount, true)) errors.writtenCount = "range";
  if (!inRange(input.minutes, EXAM_LIMITS.minutes, true)) errors.minutes = "range";
  if (!inRange(input.mcqMarks, EXAM_LIMITS.mcqMarks, false)) errors.mcqMarks = "range";
  if (!inRange(input.writtenMarks, EXAM_LIMITS.writtenMarks, false)) errors.writtenMarks = "range";
  if (!errors.mcqCount && !errors.writtenCount && input.mcqCount + input.writtenCount === 0) errors.mcqCount = "noQuestions";

  if (input.publish && !errors.video && !errors.duration) {
    if (!youTubeId && !input.hasVideoFile) errors.publish = "publishNeedsVideo";
    else if (durationSeconds === null) errors.publish = "publishNeedsDuration";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      subjectId: input.subjectId,
      chapter,
      title,
      description: description ? description.slice(0, 2000) : null,
      youTubeId,
      durationSeconds,
      exam: {
        mcqCount: input.mcqCount,
        writtenCount: input.writtenCount,
        minutes: input.minutes,
        mcqMarks: input.mcqMarks,
        writtenMarks: input.writtenMarks,
      },
      publish: input.publish,
    },
  };
}

/** Storage object names: '<lesson id>/<file>' (storage policies read the folder). */
export const LESSON_FILES = {
  note: { bucket: "lesson-media", name: "note.pdf" },
  video: { bucket: "lesson-media", name: "video.mp4" },
  transcript: { bucket: "lesson-private", name: "transcript.txt" },
} as const;

export function lessonFilePath(lessonId: string, kind: keyof typeof LESSON_FILES): string {
  return `${lessonId}/${LESSON_FILES[kind].name}`;
}
