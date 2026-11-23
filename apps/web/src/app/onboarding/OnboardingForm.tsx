"use client";

import { useActionState, useState } from "react";
import { CLASS_LEVELS, GROUPS, needsGroup, toBanglaDigits, VERSIONS, type ClassLevel } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import { onboardAction, type OnboardState } from "./actions";

function Choice({ name, value, label, checked, onChange }: {
  name: string; value: string; label: string; checked: boolean; onChange: (v: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border px-3 text-center text-sm font-semibold transition-colors",
        checked ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-400",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {label}
    </label>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-neutral-700">{label}</legend>
      {children}
      {error && <p role="alert" className="mt-1 text-sm font-semibold text-accent-700">{error}</p>}
    </fieldset>
  );
}

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const { t, locale } = useT();
  const [state, action, pending] = useActionState<OnboardState, FormData>(onboardAction, {});
  const [classId, setClassId] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [version, setVersion] = useState<string>("");
  const showGroup = classId !== "" && needsGroup(Number(classId) as ClassLevel);
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-neutral-700">{t("onboard.name")}</span>
        <input
          name="name"
          defaultValue={defaultName}
          maxLength={100}
          required
          autoComplete="name"
          className="h-12 w-full rounded-[10px] border border-neutral-300 px-4 text-lg focus:border-primary-500"
        />
        {e.name && <p role="alert" className="mt-1 text-sm font-semibold text-accent-700">{t(e.name)}</p>}
      </label>

      <Field label={t("onboard.class")} error={e.class && t(e.class)}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {CLASS_LEVELS.map((c) => (
            <Choice
              key={c}
              name="class"
              value={String(c)}
              label={locale === "bn" ? toBanglaDigits(c) : String(c)}
              checked={classId === String(c)}
              onChange={(v) => {
                setClassId(v);
                if (!needsGroup(Number(v) as ClassLevel)) setGroup("");
              }}
            />
          ))}
        </div>
      </Field>

      {showGroup && (
        <Field label={t("onboard.group")} error={e.group && t(e.group)}>
          <div className="grid grid-cols-3 gap-2">
            {GROUPS.map((g) => (
              <Choice key={g} name="group" value={g} label={t(`group.${g}`)} checked={group === g} onChange={setGroup} />
            ))}
          </div>
        </Field>
      )}

      <Field label={t("onboard.version")} error={e.version && t(e.version)}>
        <div className="grid grid-cols-2 gap-2">
          {VERSIONS.map((v) => (
            <Choice key={v} name="version" value={v} label={t(`version.${v}`)} checked={version === v} onChange={setVersion} />
          ))}
        </div>
      </Field>

      {e.form && <p role="alert" className="text-sm font-semibold text-accent-700">{t(e.form)}</p>}
      <p className="text-sm text-neutral-500">{t("onboard.note")}</p>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("onboard.submit")}
      </Button>
    </form>
  );
}
