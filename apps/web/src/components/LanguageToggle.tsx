"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";

export function LanguageToggle() {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t("header.language")}
      className={cn("flex shrink-0 rounded-full border border-neutral-300 p-0.5 text-xs font-semibold", pending && "opacity-60")}
    >
      {(["en", "bn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={cn(
            "min-h-8 rounded-full px-2.5",
            locale === l ? "bg-primary-600 text-white" : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          {l === "en" ? "EN" : "বাংলা"}
        </button>
      ))}
    </div>
  );
}
