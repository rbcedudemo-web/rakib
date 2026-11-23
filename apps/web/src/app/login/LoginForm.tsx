"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatBdPhone } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { Button } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "phone" });
  const [editingPhone, setEditingPhone] = useState(false);
  const onCodeStep = state.step === "code" && !editingPhone;

  return (
    <form
      action={(fd) => {
        setEditingPhone(false);
        return action(fd);
      }}
      className="space-y-4"
    >
      {!configured && (
        <p className="rounded-lg bg-highlight-100 px-3 py-2 text-sm text-[#7a5300]">{t("login.notConfigured")}</p>
      )}

      {onCodeStep ? (
        <>
          <input type="hidden" name="step" value="code" />
          <input type="hidden" name="phone" value={state.phone} />
          <p className="text-sm text-neutral-600">
            {t("login.codeSentTo")}: <strong className="text-neutral-900">{formatBdPhone(state.phone!)}</strong>{" "}
            <button type="button" className="font-semibold text-primary-700 underline" onClick={() => setEditingPhone(true)}>
              {t("login.changeNumber")}
            </button>
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-neutral-700">{t("login.code")}</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              className="h-12 w-full rounded-[10px] border border-neutral-300 px-4 text-center text-2xl tracking-[0.5em] focus:border-primary-500"
            />
          </label>
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">{t("login.demoHint")}</p>
        </>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-neutral-700">{t("login.phone")}</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            defaultValue={state.phone ? `0${state.phone.slice(3)}` : ""}
            required
            autoFocus
            className="h-12 w-full rounded-[10px] border border-neutral-300 px-4 text-lg focus:border-primary-500"
          />
        </label>
      )}

      {state.error && !editingPhone && (
        <p role="alert" className="text-sm font-semibold text-accent-700">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !configured}>
        {onCodeStep ? t("login.verify") : t("login.sendCode")}
      </Button>

      <p className="text-center text-sm">
        <Link href="/admin/login" className="text-neutral-500 underline hover:text-primary-700">
          {t("login.adminLink")}
        </Link>
      </p>
    </form>
  );
}
