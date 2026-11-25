"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatClock, secondsLeft, toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Card } from "@/components/ui";
import type { ExamAttemptView, ExamQuestionView } from "@/lib/exam";
import { saveAnswer, submitExam } from "./actions";

const LETTERS_BN = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
const LETTERS_EN = ["A", "B", "C", "D", "E", "F"];
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type SaveState = "saving" | "saved" | "failed";

/** Shrinks a phone photo to at most 1600 px so it uploads fast on mobile data. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function ExamRunner({ initial, studentId, resultBase }: { initial: ExamAttemptView; studentId: string; resultBase: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const num = useCallback((n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n)), [locale]);
  const letters = locale === "bn" ? LETTERS_BN : LETTERS_EN;
  const attemptId = initial.id;

  // server clock minus this device's clock: a wrong phone clock cannot add time
  const offset = useMemo(() => Date.parse(initial.now) - Date.now(), [initial.now]);
  const [left, setLeft] = useState(() => secondsLeft(initial.deadline_at, offset));
  const [questions, setQuestions] = useState<ExamQuestionView[]>(initial.questions);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, MessageKey | null>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const submittedRef = useRef(false);
  const pendingSaves = useRef(new Set<Promise<unknown>>());

  const answered = questions.filter((q) => (q.type === "mcq" ? q.selected !== null : q.images.length > 0)).length;

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      await Promise.allSettled([...pendingSaves.current]);
      const r = await submitExam(attemptId);
      if (r.ok) {
        router.push(`${resultBase}/${attemptId}`);
        router.refresh();
      } else {
        submittedRef.current = false;
        setSubmitting(false);
        setError(auto ? "exam.error.timeUp" : r.error);
        if (auto) {
          // the server closes it anyway once the time is over; show the result
          router.push(`${resultBase}/${attemptId}`);
        }
      }
    },
    [attemptId, resultBase, router],
  );

  // the timer
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = secondsLeft(initial.deadline_at, offset);
      setLeft(s);
      if (s <= 0) {
        window.clearInterval(id);
        void submit(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [initial.deadline_at, offset, submit]);

  // signed links for photos saved earlier (when the student comes back to a running exam)
  useEffect(() => {
    const paths = initial.questions.flatMap((q) => q.images);
    if (!paths.length) return;
    void createBrowserSupabase()
      .storage.from("answer-sheets")
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
        setPhotoUrls((m) => ({ ...m, ...map }));
      });
  }, [initial.questions]);

  const track = <T,>(p: Promise<T>) => {
    pendingSaves.current.add(p);
    void p.finally(() => pendingSaves.current.delete(p));
    return p;
  };

  const choose = async (q: ExamQuestionView, pos: number) => {
    if (submitting) return;
    setQuestions((list) => list.map((x) => (x.id === q.id ? { ...x, selected: pos } : x)));
    setSaveState((s) => ({ ...s, [q.id]: "saving" }));
    const r = await track(saveAnswer(attemptId, q.id, { selected: pos }));
    setSaveState((s) => ({ ...s, [q.id]: r.ok ? "saved" : "failed" }));
    if (!r.ok && r.error === "exam.error.timeUp") void submit(true);
  };

  const savePhotos = async (q: ExamQuestionView, images: string[]) => {
    setQuestions((list) => list.map((x) => (x.id === q.id ? { ...x, images } : x)));
    setSaveState((s) => ({ ...s, [q.id]: "saving" }));
    const r = await track(saveAnswer(attemptId, q.id, { images }));
    setSaveState((s) => ({ ...s, [q.id]: r.ok ? "saved" : "failed" }));
  };

  const addPhotos = async (q: ExamQuestionView, files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError((e) => ({ ...e, [q.id]: null }));
    const room = MAX_PHOTOS - q.images.length;
    if (room <= 0) return setPhotoError((e) => ({ ...e, [q.id]: "exam.error.tooManyPhotos" }));
    setUploading((u) => ({ ...u, [q.id]: true }));
    const supabase = createBrowserSupabase();
    const added: string[] = [];
    const urls: Record<string, string> = {};
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const blob = await shrinkPhoto(file);
        if (blob.size > MAX_PHOTO_BYTES) {
          setPhotoError((e) => ({ ...e, [q.id]: "exam.photo.tooBig" }));
          continue;
        }
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${studentId}/${attemptId}/${q.id}-${Date.now()}-${added.length}.${ext}`;
        const { error: upErr } = await supabase.storage.from("answer-sheets").upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (upErr) {
          setPhotoError((e) => ({ ...e, [q.id]: "exam.photo.failed" }));
          continue;
        }
        added.push(path);
        urls[path] = URL.createObjectURL(blob);
      }
    } finally {
      setUploading((u) => ({ ...u, [q.id]: false }));
    }
    if (added.length) {
      setPhotoUrls((m) => ({ ...m, ...urls }));
      await savePhotos(q, [...q.images, ...added]);
    }
  };

  const removePhoto = async (q: ExamQuestionView, path: string) => {
    await savePhotos(q, q.images.filter((p) => p !== path));
    void createBrowserSupabase().storage.from("answer-sheets").remove([path]);
  };

  const low = left <= 60;

  return (
    <div className="space-y-4 pb-24">
      {/* timer bar stays on screen while scrolling */}
      <div className={cn("sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 shadow-sm sm:mx-0 sm:rounded-card sm:border",
        low ? "border-accent-100 bg-accent-50" : "border-neutral-200 bg-white")}>
        <div>
          <div className="text-xs font-semibold text-neutral-500">{t("exam.timeLeft")}</div>
          <div className={cn("font-mono text-2xl font-bold tabular-nums", low ? "text-accent-700" : "text-neutral-900")} role="timer" aria-live={low ? "assertive" : "off"}>
            {num(formatClock(left))}
          </div>
        </div>
        <div className="text-right text-sm text-neutral-700">
          {t("exam.answered", { n: num(answered), total: num(questions.length) })}
          {low && left > 0 && <div className="font-semibold text-accent-700">{t("exam.lowTime")}</div>}
        </div>
      </div>

      {submitting && (
        <p role="status" className="rounded-[10px] bg-highlight-100 px-3 py-2 text-sm font-semibold text-[#7a5300]">
          {left <= 0 ? t("exam.timeUpAuto") : t("exam.submitting")}
        </p>
      )}

      <ol className="space-y-4">
        {questions.map((q) => {
          const state = saveState[q.id];
          return (
            <li key={q.id}>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-primary-700">{t("exam.question", { n: num(q.n) })}</h2>
                  <span className="shrink-0 text-xs text-neutral-500">{t("exam.marks", { n: num(q.marks) })}</span>
                </div>
                <p className="whitespace-pre-line text-base font-semibold text-neutral-900">{q.prompt}</p>

                {q.type === "mcq" && q.options && (
                  <div role="radiogroup" aria-label={t("exam.question", { n: num(q.n) })} className="grid gap-2">
                    {q.options.map((o, i) => {
                      const on = q.selected === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={submitting}
                          onClick={() => void choose(q, i)}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-sm transition-colors",
                            on ? "border-primary-600 bg-primary-50 font-semibold text-primary-800" : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
                          )}
                        >
                          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                            on ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-300 text-neutral-600")}>
                            {letters[i]}
                          </span>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "written" && (
                  <div className="space-y-2">
                    {q.images.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {q.images.map((p) => (
                          <li key={p} className="relative">
                            {photoUrls[p] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photoUrls[p]} alt="" className="h-24 w-20 rounded-lg border border-neutral-200 object-cover" />
                            ) : (
                              <div className="h-24 w-20 rounded-lg bg-neutral-100" />
                            )}
                            <button type="button" disabled={submitting} onClick={() => void removePhoto(q, p)}
                              className="absolute -right-1 -top-1 rounded-full bg-accent-600 px-1.5 text-xs font-bold text-white" aria-label={t("exam.photo.remove")}>
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.images.length < MAX_PHOTOS && (
                      <label className={cn("inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50",
                        (uploading[q.id] || submitting) && "pointer-events-none opacity-50")}>
                        {uploading[q.id] ? t("exam.photo.uploading") : t("exam.photo.add")}
                        <input type="file" accept="image/*" capture="environment" multiple className="sr-only"
                          onChange={(e) => { void addPhotos(q, e.target.files); e.target.value = ""; }} />
                      </label>
                    )}
                    <p className="text-xs text-neutral-500">{t("exam.photo.max", { n: num(MAX_PHOTOS) })}</p>
                    {photoError[q.id] && <p role="alert" className="text-sm font-semibold text-accent-700">{t(photoError[q.id]!)}</p>}
                  </div>
                )}

                {state && (
                  <p className={cn("text-xs font-semibold", state === "failed" ? "text-accent-700" : "text-neutral-500")}>
                    {t(state === "saving" ? "exam.saving" : state === "saved" ? "exam.saved" : "exam.saveFailed")}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <Card className="space-y-2">
        {answered < questions.length && (
          <p className="text-sm font-semibold text-[#7a5300]">{t("exam.unanswered", { n: num(questions.length - answered) })}</p>
        )}
        {confirming && <p className="text-sm text-neutral-700">{t("exam.confirmSubmit")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" disabled={submitting} onClick={() => (confirming ? void submit(false) : setConfirming(true))}
            variant={confirming ? "danger" : "primary"}>
            {submitting ? t("exam.submitting") : confirming ? `${t("exam.submit")} ✓` : t("exam.submit")}
          </Button>
          {confirming && !submitting && (
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>{t("admin.qbank.cancel")}</Button>
          )}
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-accent-700">{t(error)}</p>}
      </Card>
    </div>
  );
}
