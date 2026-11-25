"use client";

import { useState } from "react";
import type { QuestionLanguage } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { ImportPanel } from "./ImportPanel";
import { QuestionEditor } from "./QuestionEditor";

/** Language of the questions being added: sets the option letters (ক খ গ ঘ or A B C D). */
export function QuestionTools({ lessonId, defaultLang }: { lessonId: string; defaultLang: QuestionLanguage }) {
  const { t } = useT();
  const [lang, setLang] = useState<QuestionLanguage>(defaultLang);
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mr-1 text-sm font-semibold text-neutral-700 sm:float-left sm:py-2.5">{t("admin.qbank.field.language")}:</legend>
        {(["bn", "en"] as const).map((l) => (
          <label key={l} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-4 text-sm font-semibold",
            lang === l ? "border-primary-600 bg-primary-50 text-primary-800" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")}>
            <input type="radio" name="qlang" className="h-4 w-4 accent-primary-600" checked={lang === l} onChange={() => setLang(l)} />
            {l === "bn" ? "বাংলা (ক খ গ ঘ)" : "English (A B C D)"}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-start gap-2">
        <QuestionEditor key={`e-${lang}`} lessonId={lessonId} lang={lang} />
        <ImportPanel key={`i-${lang}`} lessonId={lessonId} lang={lang} />
      </div>
    </div>
  );
}
