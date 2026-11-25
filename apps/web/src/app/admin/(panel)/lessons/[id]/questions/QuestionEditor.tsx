"use client";

import { useState, useTransition } from "react";
import { MCQ_OPTION_COUNT, type Difficulty, type MessageKey, type QuestionType } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { Badge, Button, Card } from "@/components/ui";
import { deleteQuestion, saveQuestion, setQuestionActive, type QuestionInput } from "./actions";

export interface QuestionRow {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correct_index: number | null;
  explanation: string | null;
  model_answer: string | null;
  rubric: string | null;
  difficulty: Difficulty;
  source: "ai" | "teacher";
  is_active: boolean;
}

const LETTERS_BN = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
const LETTERS_EN = ["A", "B", "C", "D", "E", "F"];
const small = "inline-flex min-h-9 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40";
const input = "w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none";

export function optionLetter(i: number, locale: string) {
  return (locale === "bn" ? LETTERS_BN : LETTERS_EN)[i] ?? String(i + 1);
}

/** "+ add a question" button that opens an empty form. */
export function QuestionEditor({ lessonId }: { lessonId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {t("admin.qbank.add")}
      </Button>
    );
  return <QuestionForm lessonId={lessonId} onDone={() => setOpen(false)} />;
}

function QuestionForm({ lessonId, q, onDone }: { lessonId: string; q?: QuestionRow; onDone: () => void }) {
  const { t, locale } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [form, setForm] = useState<QuestionInput>({
    id: q?.id,
    lessonId,
    type: q?.type ?? "mcq",
    prompt: q?.prompt ?? "",
    options: q?.options ?? Array.from({ length: MCQ_OPTION_COUNT }, () => ""),
    correctIndex: q?.correct_index ?? 0,
    explanation: q?.explanation ?? "",
    modelAnswer: q?.model_answer ?? "",
    rubric: q?.rubric ?? "",
    difficulty: q?.difficulty ?? "medium",
  });
  const set = <K extends keyof QuestionInput>(k: K, v: QuestionInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveQuestion(form);
      if (r.ok) onDone();
      else setError(r.reason === "invalid" ? "admin.qbank.invalid" : r.reason === "notAllowed" ? "admin.error.notAllowed" : "admin.form.saveFailed");
    });

  return (
    <Card className="space-y-3 border-primary-600">
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.qbank.field.type")}
          <select className={cn(input, "h-11")} value={form.type} onChange={(e) => set("type", e.target.value as QuestionType)}>
            <option value="mcq">{t("admin.qbank.type.mcq")}</option>
            <option value="written">{t("admin.qbank.type.written")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.qbank.field.difficulty")}
          <select className={cn(input, "h-11")} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)}>
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>{t(`admin.qbank.diff.${d}`)}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-neutral-700">
        {t("admin.qbank.field.prompt")}
        <textarea className={input} rows={2} value={form.prompt} onChange={(e) => set("prompt", e.target.value)} />
      </label>
      {form.type === "mcq" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-neutral-700">{t("admin.qbank.field.correct")}</legend>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" className="h-5 w-5 accent-primary-600" checked={form.correctIndex === i}
                onChange={() => set("correctIndex", i)} aria-label={`${t("admin.qbank.field.correct")}: ${optionLetter(i, locale)}`} />
              <span className="w-5 text-sm font-bold text-neutral-600">{optionLetter(i, locale)}</span>
              <input className={input} value={o} placeholder={t("admin.qbank.field.option", { n: optionLetter(i, locale) })}
                onChange={(e) => set("options", form.options.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </fieldset>
      ) : (
        <>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            {t("admin.qbank.field.modelAnswer")}
            <textarea className={input} rows={3} value={form.modelAnswer} onChange={(e) => set("modelAnswer", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            {t("admin.qbank.field.rubric")}
            <textarea className={input} rows={2} value={form.rubric} onChange={(e) => set("rubric", e.target.value)} />
          </label>
        </>
      )}
      <label className="grid gap-1 text-sm font-semibold text-neutral-700">
        {t("admin.qbank.field.explanation")}
        <textarea className={input} rows={2} value={form.explanation} onChange={(e) => set("explanation", e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-accent-700">{t(error)}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={pending}>{t(pending ? "admin.form.saving" : "admin.form.save")}</Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>{t("admin.qbank.cancel")}</Button>
      </div>
    </Card>
  );
}

export function QuestionCard({ lessonId, q, n }: { lessonId: string; q: QuestionRow; n: string }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <QuestionForm lessonId={lessonId} q={q} onDone={() => setEditing(false)} />;
  const tone = { easy: "green", medium: "amber", hard: "red" } as const;

  return (
    <Card className={cn("space-y-2", !q.is_active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-bold text-neutral-500">{n}.</span>
        <Badge tone="gray">{t(`admin.qbank.type.${q.type}`)}</Badge>
        <Badge tone={tone[q.difficulty]}>{t(`admin.qbank.diff.${q.difficulty}`)}</Badge>
        <Badge tone={q.source === "ai" ? "green" : "amber"}>{t(`admin.qbank.source.${q.source}`)}</Badge>
        {!q.is_active && <Badge tone="red">{t("admin.qbank.off")}</Badge>}
      </div>
      <p className="whitespace-pre-line font-semibold text-neutral-900">{q.prompt}</p>
      {q.type === "mcq" && q.options && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <li key={i} className={cn("rounded-lg px-2.5 py-1.5 text-sm", i === q.correct_index ? "bg-primary-100 font-semibold text-primary-800" : "bg-neutral-50 text-neutral-700")}>
              {optionLetter(i, locale)}. {o} {i === q.correct_index && "✓"}
            </li>
          ))}
        </ul>
      )}
      {q.type === "written" && q.model_answer && (
        <p className="whitespace-pre-line rounded-lg bg-primary-50 px-2.5 py-1.5 text-sm text-neutral-800">
          <span className="font-semibold">{t("admin.qbank.field.modelAnswer")}:</span> {q.model_answer}
          {q.rubric && <><br /><span className="font-semibold">{t("admin.qbank.field.rubric")}:</span> {q.rubric}</>}
        </p>
      )}
      {q.explanation && <p className="text-sm text-neutral-600"><span className="font-semibold">{t("exam.result.explanation")}:</span> {q.explanation}</p>}
      <div className="flex flex-wrap gap-1.5 pt-1" aria-busy={pending}>
        <button type="button" className={cn(small, "border-primary-600 text-primary-700 hover:bg-primary-50")} onClick={() => setEditing(true)}>
          {t("admin.action.edit")}
        </button>
        <button type="button" disabled={pending} className={cn(small, "border-neutral-300 text-neutral-700 hover:bg-neutral-50")}
          onClick={() => start(async () => { await setQuestionActive(lessonId, q.id, !q.is_active); })}>
          {t(q.is_active ? "admin.action.turnOff" : "admin.action.turnOn")}
        </button>
        <button type="button" disabled={pending}
          onClick={() => (confirming ? start(async () => { await deleteQuestion(lessonId, q.id); setConfirming(false); }) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          className={cn(small, confirming ? "border-accent-600 bg-accent-600 text-white" : "border-accent-100 text-accent-700 hover:bg-accent-50")}>
          {t(confirming ? "admin.action.confirmDelete" : "admin.action.delete")}
        </button>
      </div>
    </Card>
  );
}
