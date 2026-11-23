"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAIN_MENU, PROFILE_MENU, type NavItem, type Role } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { buttonClass } from "./ui";
import { LanguageToggle } from "./LanguageToggle";
import { Logo } from "./Logo";

export interface HeaderUser {
  name: string;
  role: Role;
  avatarUrl?: string;
  /** student ID or phone, shown under the name in the dropdown */
  detail?: string;
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function isActive(pathname: string, item: NavItem) {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

function MenuWithChildren({ item, pathname }: { item: NavItem; pathname: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium",
          isActive(pathname, item) ? "text-primary-700" : "text-neutral-700 hover:bg-neutral-100",
        )}
      >
        {t(item.key)}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          {item.children!.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              {t(c.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }: { user: HeaderUser }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const items = PROFILE_MENU[user.role];
  const initial = user.name.trim().charAt(0) || "?";
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={user.name}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 items-center gap-1 rounded-full p-0.5 hover:bg-neutral-100"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
            {initial}
          </span>
        )}
        <span aria-hidden="true" className="text-xs text-neutral-500">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <div className="border-b border-neutral-100 px-3 py-2">
            <div className="font-semibold text-neutral-800">{user.name}</div>
            <div className="text-xs text-neutral-500">
              {t(`role.${user.role}`)}
              {user.detail && <> · {user.detail}</>}
            </div>
          </div>
          {items.map((c) =>
            c.key === "profile.logout" ? (
              <form key={c.key} action="/logout" method="post">
                <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-accent-700 hover:bg-accent-50">
                  {t(c.key)}
                </button>
              </form>
            ) : (
              <Link
                key={c.key}
                href={c.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
              >
                {t(c.key)}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ user }: { user?: HeaderUser | null }) {
  const { t } = useT();
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="page flex h-16 items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-neutral-100 lg:hidden"
          aria-label={t("nav.menu")}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-xl">☰</span>
        </button>
        <Logo name={t("app.name")} org={t("app.org")} />

        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label={t("nav.menu")}>
          {MAIN_MENU.map((item) =>
            item.children ? (
              <MenuWithChildren key={item.href} item={item} pathname={pathname} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-10 items-center rounded-lg px-3 text-sm font-medium",
                  isActive(pathname, item) ? "text-primary-700" : "text-neutral-700 hover:bg-neutral-100",
                )}
              >
                {t(item.key)}
              </Link>
            ),
          )}
        </nav>

        <form action="/search" role="search" className="ml-auto hidden min-w-0 flex-1 md:block md:max-w-xs">
          <input
            name="q"
            type="search"
            placeholder={t("header.search")}
            aria-label={t("header.search")}
            className="h-10 w-full rounded-full border border-neutral-300 bg-neutral-50 px-4 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white"
          />
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageToggle />
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Link href="/login" className={buttonClass("primary")}>
              {t("header.login")}
            </Link>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-neutral-200 bg-white lg:hidden" aria-label={t("nav.menu")}>
          <div className="page flex flex-col py-2">
            <form action="/search" role="search" className="py-2 md:hidden">
              <input
                name="q"
                type="search"
                placeholder={t("header.search")}
                aria-label={t("header.search")}
                className="h-11 w-full rounded-full border border-neutral-300 bg-neutral-50 px-4 text-sm"
              />
            </form>
            {MAIN_MENU.flatMap((item) => item.children ?? [item]).map((item) => (
              <Link
                key={item.href + item.key}
                href={item.href}
                className="flex min-h-11 items-center rounded-lg px-3 text-base text-neutral-700 hover:bg-primary-50"
              >
                {t(item.key)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
