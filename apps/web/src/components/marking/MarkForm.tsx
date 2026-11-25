"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toBanglaDigits } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { markAnswer } from "@/lib/marking/actions";
import type { MarkingError } from "@/lib/marking/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const input = "w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none";

/** Quick mark buttons (0, 0.5 … max) plus a comment. Used for new marks and for changing marks. */
export function MarkForm({ answerId, max, current, feedback, isChange }: {
  answerId: string; max: number; current: number | null; feedback: string | null; isChange: boolean;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const num = (n: number) => (locale === "bn" ? toBanglaDigits(String(n)) : String(n));
  const [marks, setMarks] = useState<number | null>(current);
  const [note, setNote] = useState(feedback ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<MarkingError | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const steps = Array.from({ length: Math.round(max * 2) + 1 }, (_, i) => i / 2);
  const whole = steps.filter((s) => Number.isInteger(s));
  const [showHalves, setShowHalves] = useState(current !== null && !Number.isInteger(current));

  const submit = () => {
    if (marks === null) return setError("marking.error.marks");
    start(async () => {
      setError(null);
      const r = await markAnswer({ answerId, marks, feedback: note, reason });
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else setError(r.error);
    });
  };

  return (
    <div className="space-y-3 rounded-[10px] border border-primary-100 bg-primary-50/50 p-3">
      <fieldset>
        <legend className="text-sm font-semibold text-neutral-700">{t("marking.marks", { max: num(max) })}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(showHalves ? steps : whole).map((s) => (
            <button key={s} type="button" aria-pressed={marks === s} onClick={() => { setMarks(s); setSaved(false); }}
              className={cn("min-h-11 min-w-11 rounded-[10px] border px-2 text-base font-bold tabular-nums transition-colors",
                marks === s ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-300 bg-white text-neutral-800 hover:border-primary-600")}>
              {num(s)}
            </button>
          ))}
          {!showHalves && max >= 1 && (
            <button type="button" onClick={() => setShowHalves(true)} className="min-h-11 rounded-[10px] px-2 text-sm font-semibold text-primary-700 hover:underline">
              {num(0.5)}…
            </button>
          )}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-semibold text-neutral-700">
        {t("marking.feedback")}
        <textarea className={input} rows={2} value={note} maxLength={2000} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
      </label>
      {isChange && (
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("marking.reason")}
          <input className={input} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-accent-700">{t(error, { max: num(max) })}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={pending || marks === null}>
          {pending ? t("admin.form.saving") : t(isChange ? "marking.update" : "marking.save")}
        </Button>
        {saved && !pending && <span role="status" className="text-sm font-semibold text-primary-700">{t("marking.saved")}</span>}
      </div>
    </div>
  );
}
