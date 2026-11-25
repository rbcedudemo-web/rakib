"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";

const LIVE: { key: MessageKey; href: string }[] = [
  { key: "admin.nav.dashboard", href: "/admin" },
  { key: "admin.nav.lessons", href: "/admin/lessons" },
  { key: "admin.nav.marking", href: "/admin/marking" },
  { key: "admin.nav.results", href: "/admin/results" },
  { key: "admin.nav.teachers", href: "/admin/teachers" },
  { key: "admin.nav.subjects", href: "/admin/subjects" },
];
const SOON: MessageKey[] = ["admin.nav.students", "admin.nav.settings"];

export function AdminNav() {
  const { t } = useT();
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label={t("admin.title")} className="lg:w-56 lg:shrink-0">
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
        {LIVE.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-[10px] px-3 text-sm font-semibold transition-colors",
                active(item.href) ? "bg-primary-600 text-white" : "bg-white text-neutral-700 hover:bg-primary-50 lg:bg-transparent",
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden lg:block">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{t("admin.nav.soon")}</div>
        <ul className="mt-1 space-y-1">
          {SOON.map((k) => (
            <li key={k} className="px-3 py-1.5 text-sm text-neutral-400">{t(k)}</li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
