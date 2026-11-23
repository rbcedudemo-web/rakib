import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, translate, type Locale, type MessageKey } from "@rupshi/shared";

export const LOCALE_COOKIE = "lang";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MessageKey) => translate(locale, key) };
}
