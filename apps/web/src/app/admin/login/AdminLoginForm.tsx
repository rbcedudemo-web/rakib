"use client";

import { useActionState } from "react";
import type { MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { Button } from "@/components/ui";
import { adminLoginAction } from "./actions";

const input = "h-12 w-full rounded-[10px] border border-neutral-300 px-4 focus:border-primary-500";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<{ error?: MessageKey }, FormData>(adminLoginAction, {});
  return (
    <form action={action} className="space-y-4">
      {!configured && (
        <p className="rounded-lg bg-highlight-100 px-3 py-2 text-sm text-[#7a5300]">{t("login.notConfigured")}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">{t("login.admin.email")}</span>
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-neutral-700">{t("login.admin.password")}</span>
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-700">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || !configured}>
        {t("header.login")}
      </Button>
    </form>
  );
}
