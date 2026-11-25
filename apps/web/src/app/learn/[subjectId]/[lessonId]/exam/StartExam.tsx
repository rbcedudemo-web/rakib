"use client";

import { useState, useTransition } from "react";
import type { MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { Button } from "@/components/ui";
import type { ExamAttemptView } from "@/lib/exam";
import { startExam } from "./actions";
import { ExamRunner } from "./ExamRunner";

export function StartExam({ lessonId, resultBase, studentId, disabled }: { lessonId: string; resultBase: string; studentId: string; disabled: boolean }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [view, setView] = useState<ExamAttemptView | null>(null);

  if (view) {
    return (
      // shown in place of the start card; fixed overlay keeps the paper in focus
      <div className="fixed inset-0 z-40 overflow-y-auto bg-neutral-50">
        <div className="page max-w-3xl py-4">
          <ExamRunner initial={view} studentId={studentId} resultBase={resultBase} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startExam(lessonId);
            if (r.ok) setView(r.view);
            else setError(r.error);
          })
        }
      >
        {pending ? "…" : t("exam.start")}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-accent-700">{t(error)}</p>}
    </div>
  );
}
