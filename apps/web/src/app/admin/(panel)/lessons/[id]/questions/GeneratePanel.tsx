"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { Button, Card } from "@/components/ui";
import { generateQuestions } from "./actions";

export function GeneratePanel({
  lessonId, hasQuestions, target, material, hasMaterial, generating,
}: { lessonId: string; hasQuestions: boolean; target: string; material: string; hasMaterial: boolean; generating: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = pending || generating;

  const run = () =>
    start(async () => {
      setMessage(null);
      try {
        const r = await generateQuestions(lessonId);
        if (r.ok) {
          const n = locale === "bn" ? toBanglaDigits(r.count) : String(r.count);
          setMessage({ ok: true, text: t("admin.qbank.done", { n, cost: r.costUsd.toFixed(2) }) });
        } else {
          const key = (r.reason === "notAllowed" ? "admin.error.notAllowed" : `admin.qbank.error.${r.reason}`) as MessageKey;
          setMessage({ ok: false, text: t(key) });
        }
      } catch {
        // the connection dropped (e.g. phone went to sleep); the server may still finish
        setMessage({ ok: false, text: t("admin.qbank.error.aiFailed") });
      }
      router.refresh();
    });

  return (
    <Card className="space-y-2 border-primary-100 bg-primary-50/40">
      <p className="text-sm text-neutral-700">{t("admin.qbank.hint", { n: target })}</p>
      <p className="text-sm font-semibold text-neutral-800">{material}</p>
      {hasQuestions && <p className="text-xs text-neutral-600">{t("admin.qbank.regenerateWarn")}</p>}
      <Button type="button" onClick={run} disabled={busy || !hasMaterial} aria-busy={busy}>
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            {t("admin.status.generating")}
          </>
        ) : (
          t(hasQuestions ? "admin.qbank.regenerate" : "admin.qbank.generate")
        )}
      </Button>
      {busy && <p className="text-sm text-neutral-700" role="status">{t("admin.qbank.generating")}</p>}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-semibold text-primary-700" : "text-sm font-semibold text-accent-700"}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
