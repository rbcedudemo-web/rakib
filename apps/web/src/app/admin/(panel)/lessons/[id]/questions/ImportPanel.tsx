"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { optionLetter, parseQuestionText, toBanglaDigits, type ImportBlock, type MessageKey, type QuestionLanguage } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Card } from "@/components/ui";
import { importQuestions, readQuestionPdf } from "./actions";

const SAMPLE_BN = `১. 'পদ্ম' শব্দের উচ্চারণ কোনটি?
ক) পদ্‌মো
খ) পদ্দোঁ
গ) পোদ্‌মো
ঘ) পদমো
উত্তর: খ
ব্যাখ্যা: শব্দের মাঝে ম-ফলা আগের বর্ণকে দ্বিত্ব করে।

২. ...`;

const SAMPLE_EN = `1. Which word is a noun?
A) quickly
B) happiness
C) run
D) beautiful
Answer: B
Explanation: "Happiness" names a feeling, so it is a noun.

2. ...`;

const input = "w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none";
const MAX_PDF = 10 * 1024 * 1024; // lesson-private bucket limit

type Mode = "text" | "pdf";

export function ImportPanel({ lessonId, lang }: { lessonId: string; lang: QuestionLanguage }) {
  const { t, locale } = useT();
  const router = useRouter();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const SAMPLE = lang === "en" ? SAMPLE_EN : SAMPLE_BN;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [blocks, setBlocks] = useState<ImportBlock[] | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open)
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {t("admin.import.open")}
      </Button>
    );

  const good = (blocks ?? []).filter((b) => b.question);
  const bad = (blocks ?? []).length - good.length;

  const readWord = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setText(value);
      setBlocks(parseQuestionText(value));
    } catch {
      setMessage({ ok: false, text: t("admin.import.error.word") });
    }
  };

  const readPdf = (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setBlocks(null);
    if (file.type !== "application/pdf") return setMessage({ ok: false, text: t("admin.form.wrongType") });
    if (file.size > MAX_PDF) return setMessage({ ok: false, text: t("admin.import.error.pdfBig") });
    start(async () => {
      const { error } = await createBrowserSupabase().storage
        .from("lesson-private")
        .upload(`${lessonId}/import.pdf`, file, { contentType: "application/pdf", upsert: true });
      if (error) return setMessage({ ok: false, text: t("admin.form.uploadFailed", { msg: error.message }) });
      const r = await readQuestionPdf(lessonId);
      if (r.ok) {
        setBlocks(r.blocks);
        setMessage({ ok: true, text: t("admin.import.pdfRead", { n: num(r.blocks.length), cost: r.costUsd.toFixed(2) }) });
      } else {
        const key = r.reason === "notAllowed" ? "admin.error.notAllowed" : r.reason === "noMaterial" ? "admin.import.error.noFile" : `admin.qbank.error.${r.reason}`;
        setMessage({ ok: false, text: t(key as MessageKey) });
      }
    });
  };

  const save = () =>
    start(async () => {
      const items = good.map((b) => ({
        prompt: b.question!.prompt,
        options: b.question!.options!,
        correctIndex: b.question!.correctIndex!,
        explanation: b.question!.explanation ?? "",
      }));
      const r = await importQuestions(lessonId, items, lang);
      if (r.ok) {
        setMessage({ ok: true, text: t("admin.import.saved", { n: num(r.count ?? 0) }) });
        setBlocks(null);
        setText("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: t(r.reason === "notAllowed" ? "admin.error.notAllowed" : "admin.qbank.error.saveFailed") });
      }
    });

  return (
    <Card className="w-full space-y-3 border-primary-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-900">{t("admin.import.title")}</h2>
        <button type="button" className="text-sm font-semibold text-neutral-600 hover:underline" onClick={() => setOpen(false)}>
          {t("admin.qbank.cancel")}
        </button>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {(["text", "pdf"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => { setMode(m); setBlocks(null); setMessage(null); }}
            className={cn("min-h-11 rounded-[10px] border px-4 text-sm font-semibold",
              mode === m ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")}>
            {t(m === "text" ? "admin.import.tab.text" : "admin.import.tab.pdf")}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">{t("admin.import.textHint")}</p>
          <details className="rounded-[10px] bg-neutral-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-primary-700">{t("admin.import.sample")}</summary>
            <pre className="mt-2 whitespace-pre-wrap font-[inherit] text-neutral-800">{SAMPLE}</pre>
            <p className="mt-2 text-xs text-neutral-600">{t(lang === "en" ? "admin.import.rulesEn" : "admin.import.rules")}</p>
          </details>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            📄 {t("admin.import.word")}
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only"
              onChange={(e) => { void readWord(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <textarea className={input} rows={10} value={text} placeholder={SAMPLE}
            onChange={(e) => { setText(e.target.value); setBlocks(null); }} aria-label={t("admin.import.tab.text")} />
          <Button type="button" variant="secondary" disabled={!text.trim()} onClick={() => setBlocks(parseQuestionText(text))}>
            {t("admin.import.check")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">{t("admin.import.pdfHint")}</p>
          <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50",
            pending && "pointer-events-none opacity-50")}>
            {pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" aria-hidden />{t("admin.import.pdfReading")}</> : <>📕 {t("admin.import.pdfPick")}</>}
            <input type="file" accept="application/pdf" className="sr-only"
              onChange={(e) => { readPdf(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-semibold text-primary-700" : "text-sm font-semibold text-accent-700"}>
          {message.text}
        </p>
      )}

      {blocks && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-800">
            {t("admin.import.summary", { good: num(good.length), bad: num(bad) })}
          </p>
          {bad > 0 && <p className="text-xs text-neutral-600">{t("admin.import.badNote")}</p>}
          <ol className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {blocks.map((b) => (
              <li key={b.index} className={cn("rounded-[10px] border p-3 text-sm", b.error ? "border-accent-600 bg-accent-50" : "border-neutral-200")}>
                <p className="font-semibold text-neutral-900">
                  {num(b.index)}. {b.prompt || "—"}
                </p>
                {b.options.length > 0 && (
                  <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                    {b.options.map((o, i) => (
                      <li key={i} className={cn(b.question?.correctIndex === i ? "font-semibold text-primary-700" : "text-neutral-700")}>
                        {optionLetter(i, lang)}) {o} {b.question?.correctIndex === i && "✓"}
                      </li>
                    ))}
                  </ul>
                )}
                {b.explanation && <p className="mt-1 text-xs text-neutral-600">💡 {b.explanation}</p>}
                {b.error && <p className="mt-1 font-semibold text-accent-700">⚠ {t(`admin.import.error.${b.error}` as MessageKey)}</p>}
              </li>
            ))}
          </ol>
          <Button type="button" disabled={pending || good.length === 0} onClick={save}>
            {pending ? t("admin.form.saving") : t("admin.import.save", { n: num(good.length) })}
          </Button>
        </div>
      )}
    </Card>
  );
}
