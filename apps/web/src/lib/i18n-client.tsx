"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, translate, type Locale, type MessageKey } from "@rupshi/shared";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const locale = useContext(LocaleContext);
  return { locale, t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
