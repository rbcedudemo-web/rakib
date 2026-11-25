"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { deleteLesson, moveLesson, setLessonPublished } from "./actions";

const small = "inline-flex min-h-9 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40";

export function LessonRowActions({ id, published, first, last }: { id: string; published: boolean; first: boolean; last: boolean }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.reason ? (`admin.error.${r.reason}` as MessageKey) : "admin.form.saveFailed");
    });

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <div className="flex flex-wrap gap-1.5" aria-busy={pending}>
        <button type="button" className={cn(small, "border-neutral-300 text-neutral-700 hover:bg-neutral-50")} disabled={pending || first}
          onClick={() => run(() => moveLesson(id, -1))} aria-label={t("admin.action.up")} title={t("admin.action.up")}>↑</button>
        <button type="button" className={cn(small, "border-neutral-300 text-neutral-700 hover:bg-neutral-50")} disabled={pending || last}
          onClick={() => run(() => moveLesson(id, 1))} aria-label={t("admin.action.down")} title={t("admin.action.down")}>↓</button>
        <Link href={`/admin/lessons/${id}`} className={cn(small, "border-primary-600 text-primary-700 hover:bg-primary-50")}>
          {t("admin.action.edit")}
        </Link>
        <Link href={`/admin/lessons/${id}/questions`} className={cn(small, "border-primary-600 text-primary-700 hover:bg-primary-50")}>
          {t("admin.action.questions")}
        </Link>
        <button type="button" disabled={pending} onClick={() => run(() => setLessonPublished(id, !published))}
          className={cn(small, published ? "border-neutral-300 text-neutral-700 hover:bg-neutral-50" : "border-primary-600 bg-primary-600 text-white hover:bg-primary-700")}>
          {t(published ? "admin.action.unpublish" : "admin.action.publish")}
        </button>
        <button type="button" disabled={pending}
          onClick={() => (confirming ? run(() => deleteLesson(id)) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          className={cn(small, confirming ? "border-accent-600 bg-accent-600 text-white" : "border-accent-100 text-accent-700 hover:bg-accent-50")}>
          {t(confirming ? "admin.action.confirmDelete" : "admin.action.delete")}
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-accent-700">{t(error)}</p>}
    </div>
  );
}
