"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_CLASS_LEVELS, formatDuration, isSubtitleFile, LESSON_FILES, lessonFilePath, MAX_NOTE_BYTES,
  MAX_TRANSCRIPT_CHARS, MAX_VIDEO_BYTES, parseYouTubeId, subtitleToText, toBanglaDigits, validateLesson, VERSIONS,
  type LessonError, type LessonField, type LessonInput, type MessageKey, type Version,
} from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Card } from "@/components/ui";
import { saveLesson, type LessonFileChanges } from "./actions";
import { VideoPreview } from "./VideoPreview";

export interface FormSubject {
  id: string;
  class_id: number;
  version: Version;
  group_code: string | null;
  name_bn: string;
  name_en: string;
  is_active: boolean;
}
export interface FormChapter { id: string; subject_id: string; title: string }

export interface LessonFormProps {
  mode: "new" | "edit";
  lessonId: string;
  subjects: FormSubject[];
  chapters: FormChapter[];
  initial: {
    classId: number;
    version: Version;
    input: LessonInput;
    transcript: string;
  };
  existing: { videoPath: string | null; videoUrl: string | null; noteUrl: string | null; hasTranscript: boolean };
}

const inputClass = "h-11 w-full rounded-[10px] border border-neutral-300 bg-white px-3 text-base focus:border-primary-500";
const errText = "mt-1 text-sm font-semibold text-accent-700";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      {children}
    </Card>
  );
}

function Label({ text, htmlFor, children, error, hint }: {
  text: string; htmlFor?: string; children: ReactNode; error?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-neutral-700">{text}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && <p role="alert" className={errText}>{error}</p>}
    </div>
  );
}

export function LessonForm({ mode, lessonId, subjects, chapters, initial, existing }: LessonFormProps) {
  const { t, locale } = useT();
  const router = useRouter();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));

  const [classId, setClassId] = useState(initial.classId);
  const [version, setVersion] = useState<Version>(initial.version);
  const [v, setV] = useState<LessonInput>(initial.input);
  const set = <K extends keyof LessonInput>(k: K, value: LessonInput[K]) => setV((p) => ({ ...p, [k]: value }));

  const [transcript, setTranscript] = useState(initial.transcript);
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [durationAuto, setDurationAuto] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<LessonField, LessonError>>>({});
  const [fileError, setFileError] = useState<{ field: "video" | "note" | "transcript"; key: MessageKey } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const subjectOptions = useMemo(
    () => subjects.filter((s) => s.class_id === classId && s.version === version),
    [subjects, classId, version],
  );
  const chapterOptions = useMemo(() => chapters.filter((c) => c.subject_id === v.subjectId), [chapters, v.subjectId]);
  const youTubeId = parseYouTubeId(v.videoUrl);

  useEffect(() => {
    if (!videoFile) return setVideoFileUrl(null);
    const url = URL.createObjectURL(videoFile);
    setVideoFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const err = (f: LessonField) => (errors[f] ? t(`admin.error.${errors[f]}` as MessageKey) : undefined);
  const subjectLabel = (s: FormSubject) =>
    (locale === "bn" ? s.name_bn : s.name_en) + (s.group_code ? ` (${t(`group.${s.group_code}` as MessageKey)})` : "");

  const onDuration = (seconds: number) => {
    if (!v.duration || durationAuto) {
      set("duration", formatDuration(seconds));
      setDurationAuto(true);
    }
  };

  async function pickTranscriptFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!/\.(txt|srt|vtt)$/i.test(file.name)) return setFileError({ field: "transcript", key: "admin.form.wrongType" });
    const text = await file.text();
    setTranscript((isSubtitleFile(file.name) ? subtitleToText(text) : text).slice(0, MAX_TRANSCRIPT_CHARS));
    setTranscriptDirty(true);
  }

  function pickFile(kind: "video" | "note", file: File | undefined) {
    setFileError(null);
    if (!file) return kind === "video" ? setVideoFile(null) : setNoteFile(null);
    const okType = kind === "video" ? file.type === "video/mp4" : file.type === "application/pdf";
    if (!okType) return setFileError({ field: kind, key: "admin.form.wrongType" });
    if (file.size > (kind === "video" ? MAX_VIDEO_BYTES : MAX_NOTE_BYTES)) return setFileError({ field: kind, key: "admin.form.tooBig" });
    if (kind === "video") {
      setVideoFile(file);
      set("videoUrl", "");
      setDurationAuto(true);
    } else setNoteFile(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const usingFile = !youTubeId && (Boolean(videoFile) || Boolean(existing.videoPath));
    const check = validateLesson({ ...v, hasVideoFile: usingFile });
    if (!check.ok) {
      setErrors(check.errors);
      setBanner({ tone: "err", text: t("admin.form.fixErrors") });
      return;
    }
    setErrors({});

    const files: LessonFileChanges = {};
    const supabase = createBrowserSupabase();
    const upload = async (kind: keyof typeof LESSON_FILES, body: Blob, contentType: string, label: string) => {
      setBusy(t("admin.form.uploading", { file: label }));
      const path = lessonFilePath(lessonId, kind);
      const { error } = await supabase.storage.from(LESSON_FILES[kind].bucket).upload(path, body, { upsert: true, contentType });
      if (error) throw new Error(error.message);
      return path;
    };

    try {
      if (videoFile && !youTubeId) files.videoPath = await upload("video", videoFile, "video/mp4", t("admin.file.video"));
      if (noteFile) files.notePath = await upload("note", noteFile, "application/pdf", t("admin.file.note"));
      if (transcriptDirty) {
        if (transcript.trim()) {
          files.transcriptPath = await upload(
            "transcript", new Blob([transcript.trim()], { type: "text/plain" }), "text/plain", t("admin.file.transcript"),
          );
        } else if (existing.hasTranscript) {
          await supabase.storage.from(LESSON_FILES.transcript.bucket).remove([lessonFilePath(lessonId, "transcript")]);
          files.transcriptPath = null;
        }
      }
    } catch (error) {
      setBusy(null);
      setBanner({ tone: "err", text: t("admin.form.uploadFailed", { msg: (error as Error).message }) });
      return;
    }

    setBusy(t("admin.form.saving"));
    const result = await saveLesson({ id: lessonId, isNew: mode === "new", input: v, files });
    setBusy(null);
    if (!result.ok) {
      if (result.errors) setErrors(result.errors);
      setBanner({ tone: "err", text: t(result.errors ? "admin.form.fixErrors" : result.message === "notAllowed" ? "admin.error.notAllowed" : "admin.form.saveFailed") });
      return;
    }
    setBanner({ tone: "ok", text: t("admin.form.saved") });
    router.push(`/admin/lessons?class=${classId}&version=${version}&subject=${v.subjectId}`);
    router.refresh();
  }

  const total = v.mcqCount * v.mcqMarks + v.writtenCount * v.writtenMarks;
  const numberInput = (field: "mcqCount" | "writtenCount" | "minutes" | "mcqMarks" | "writtenMarks", label: MessageKey, step = 1) => (
    <Label text={t(label)} htmlFor={field} error={err(field)}>
      <input
        id={field}
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={Number.isFinite(v[field]) ? v[field] : ""}
        onChange={(e) => set(field, e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className={inputClass}
      />
    </Label>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/lessons" className="text-sm font-semibold text-primary-700 hover:underline">{t("admin.form.back")}</Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t(mode === "new" ? "admin.form.newTitle" : "admin.form.editTitle")}
          </h1>
        </div>
      </div>

      <Section title={t("admin.form.step.where")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Label text={t("admin.filter.class")} htmlFor="class">
            <select id="class" className={inputClass} value={classId}
              onChange={(e) => { setClassId(Number(e.target.value)); set("subjectId", ""); set("chapterId", ""); }}>
              {DEMO_CLASS_LEVELS.map((c) => <option key={c} value={c}>{num(c)}</option>)}
            </select>
          </Label>
          <Label text={t("admin.filter.version")} htmlFor="version">
            <select id="version" className={inputClass} value={version}
              onChange={(e) => { setVersion(e.target.value as Version); set("subjectId", ""); set("chapterId", ""); }}>
              {VERSIONS.map((x) => <option key={x} value={x}>{t(`version.${x}` as MessageKey)}</option>)}
            </select>
          </Label>
          <Label text={t("admin.filter.subject")} htmlFor="subject" error={err("subject")}>
            <select id="subject" className={inputClass} value={v.subjectId}
              onChange={(e) => { set("subjectId", e.target.value); set("chapterId", ""); }}>
              <option value="">{t("admin.form.chooseSubject")}</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}
            </select>
          </Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text={t("admin.form.chapter")} htmlFor="chapter" error={v.chapterId !== "new" ? err("chapter") : undefined}>
            <select id="chapter" className={inputClass} value={v.chapterId} disabled={!v.subjectId}
              onChange={(e) => set("chapterId", e.target.value)}>
              <option value="">{t("admin.form.noChapter")}</option>
              {chapterOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              <option value="new">{t("admin.form.newChapter")}</option>
            </select>
          </Label>
          {v.chapterId === "new" && (
            <Label text={t("admin.form.newChapterName")} htmlFor="chapterTitle" error={err("chapter")}>
              <input id="chapterTitle" className={inputClass} value={v.chapterTitle} maxLength={150}
                onChange={(e) => set("chapterTitle", e.target.value)} />
            </Label>
          )}
        </div>
      </Section>

      <Section title={t("admin.form.step.lesson")}>
        <Label text={t("admin.form.title")} htmlFor="title" error={err("title")}
          hint={mode === "new" ? t("admin.form.sequenceNote") : undefined}>
          <input id="title" className={inputClass} value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
        </Label>
        <Label text={t("admin.form.description")} htmlFor="description">
          <textarea id="description" rows={2} maxLength={2000} value={v.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full rounded-[10px] border border-neutral-300 px-3 py-2 text-base focus:border-primary-500" />
        </Label>
      </Section>

      <Section title={t("admin.form.step.video")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Label text={t("admin.form.videoLink")} htmlFor="videoUrl" error={err("video")} hint={t("admin.form.videoLinkHint")}>
              <input id="videoUrl" className={inputClass} inputMode="url" placeholder="https://youtu.be/…" value={v.videoUrl}
                onChange={(e) => { set("videoUrl", e.target.value); if (e.target.value) setVideoFile(null); }} />
            </Label>
            <Label text={t("admin.form.videoOr")} htmlFor="videoFile"
              error={fileError?.field === "video" ? t(fileError.key) : undefined}
              hint={existing.videoPath && !videoFile && !youTubeId ? t("admin.form.videoCurrentFile") : undefined}>
              <input id="videoFile" type="file" accept="video/mp4"
                onChange={(e) => pickFile("video", e.target.files?.[0])}
                className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:font-semibold file:text-primary-700" />
            </Label>
            <Label text={t("admin.form.duration")} htmlFor="duration" error={err("duration")}
              hint={durationAuto && v.duration ? t("admin.form.durationAuto") : t("admin.form.durationHint")}>
              <input id="duration" className={cn(inputClass, "max-w-40")} placeholder="12:34" value={v.duration}
                onChange={(e) => { set("duration", e.target.value); setDurationAuto(false); }} />
            </Label>
          </div>
          <VideoPreview
            youTubeId={youTubeId}
            fileUrl={!youTubeId ? (videoFileUrl ?? existing.videoUrl) : null}
            onDuration={onDuration}
          />
        </div>
      </Section>

      <Section title={t("admin.form.step.materials")}>
        <Label text={t("admin.form.transcript")} htmlFor="transcript" hint={t("admin.form.transcriptHint")}
          error={fileError?.field === "transcript" ? t(fileError.key) : undefined}>
          <textarea id="transcript" rows={8} value={transcript} maxLength={MAX_TRANSCRIPT_CHARS}
            onChange={(e) => { setTranscript(e.target.value); setTranscriptDirty(true); }}
            className="w-full rounded-[10px] border border-neutral-300 px-3 py-2 text-base leading-relaxed focus:border-primary-500" />
        </Label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            <input type="file" accept=".txt,.srt,.vtt,text/plain" className="sr-only" onChange={(e) => pickTranscriptFile(e.target.files?.[0])} />
            {t("admin.form.transcriptFile")}
          </label>
          <span className="text-xs text-neutral-500">{t("admin.form.chars", { n: num(transcript.length) })}</span>
        </div>
        <Label text={t("admin.form.note")} htmlFor="note" error={fileError?.field === "note" ? t(fileError.key) : undefined}>
          <input id="note" type="file" accept="application/pdf"
            onChange={(e) => pickFile("note", e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:font-semibold file:text-primary-700" />
        </Label>
        {existing.noteUrl && !noteFile && (
          <a href={existing.noteUrl} target="_blank" rel="noopener" className="inline-block text-sm font-semibold text-primary-700 hover:underline">
            📄 {t("admin.form.noteCurrent")}
          </a>
        )}
        <p className="text-xs text-neutral-500">{t("admin.form.aiNext")}</p>
      </Section>

      <Section title={t("admin.form.step.exam")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {numberInput("mcqCount", "admin.form.mcqCount")}
          {numberInput("writtenCount", "admin.form.writtenCount")}
          {numberInput("minutes", "admin.form.minutes")}
          {numberInput("mcqMarks", "admin.form.mcqMarks", 0.5)}
          {numberInput("writtenMarks", "admin.form.writtenMarks", 0.5)}
        </div>
        {Number.isFinite(total) && <p className="text-sm font-semibold text-neutral-700">{t("admin.form.totalMarks", { n: num(total) })}</p>}
      </Section>

      <Section title={t("admin.form.step.publish")}>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={v.publish} onChange={(e) => set("publish", e.target.checked)}
            className="mt-1 h-5 w-5 accent-primary-600" />
          <span>
            <span className="block font-semibold text-neutral-900">{t("admin.form.publish")}</span>
            <span className="block text-sm text-neutral-500">{t("admin.form.publishHint")}</span>
          </span>
        </label>
        {err("publish") && <p role="alert" className={errText}>{err("publish")}</p>}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Button type="submit" size="lg" disabled={Boolean(busy)}>{busy ?? t("admin.form.save")}</Button>
        {banner && (
          <p role={banner.tone === "err" ? "alert" : "status"}
            className={cn("text-sm font-semibold", banner.tone === "err" ? "text-accent-700" : "text-primary-700")}>
            {banner.text}
          </p>
        )}
      </div>
    </form>
  );
}
