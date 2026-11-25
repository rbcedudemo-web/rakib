"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/cn";
import { Button, Card } from "@/components/ui";
import { addTeacher, setTeacherActive, setTeacherSubjects } from "./actions";

export interface SubjectOption { id: string; class_id: number; version: string; name_bn: string; name_en: string }

const input = "w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none";

/** Subjects grouped by class and version; Bangla Version open first. */
function SubjectPicker({ subjects, value, onChange }: { subjects: SubjectOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t, locale } = useT();
  const groups = new Map<string, SubjectOption[]>();
  for (const s of subjects) {
    const k = `${s.class_id}|${s.version}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      {[...groups.entries()].map(([k, list]) => {
        const [cls, version] = k.split("|");
        const chosen = list.filter((s) => value.includes(s.id)).length;
        return (
          <details key={k} open={version === "bangla" || chosen > 0} className="rounded-[10px] border border-neutral-200 bg-white">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold text-neutral-800">
              {t("class.label")} {locale === "bn" ? toBanglaDigits(cls) : cls} · {t(`version.${version}` as MessageKey)}
              {chosen > 0 && <span className="rounded-full bg-primary-100 px-2 text-xs text-primary-800">{locale === "bn" ? toBanglaDigits(chosen) : chosen}</span>}
            </summary>
            <div className="grid gap-1 px-3 pb-3 sm:grid-cols-2">
              {list.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm text-neutral-800">
                  <input type="checkbox" className="h-5 w-5 accent-primary-600" checked={value.includes(s.id)} onChange={() => toggle(s.id)} />
                  {locale === "bn" ? s.name_bn : s.name_en}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function AddTeacher({ subjects }: { subjects: SubjectOption[] }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button type="button" onClick={() => setOpen(true)}>{t("admin.teachers.add")}</Button>;
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await addTeacher({ name, phone, subjectIds: ids });
      if (!r.ok) return setError(r.error);
      setOpen(false); setName(""); setPhone(""); setIds([]);
      router.refresh();
    });
  return (
    <Card className="w-full space-y-3 border-primary-600">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.teachers.name")}
          <input className={cn(input, "h-11")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.teachers.phone")}
          <input className={cn(input, "h-11")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01712345678" autoComplete="off" />
        </label>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-neutral-700">{t("admin.teachers.subjects")}</p>
        <SubjectPicker subjects={subjects} value={ids} onChange={setIds} />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-accent-700">{t(error)}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={pending}>{t(pending ? "admin.form.saving" : "admin.teachers.save")}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t("admin.qbank.cancel")}</Button>
      </div>
    </Card>
  );
}

export function TeacherSubjects({ teacherId, subjects, current }: { teacherId: string; subjects: SubjectOption[]; current: string[] }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState(current);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => { setIds(current); setOpen(true); }}
        className="inline-flex min-h-9 items-center rounded-lg border border-primary-600 px-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">
        {t("admin.teachers.editSubjects")}
      </button>
    );
  return (
    <div className="mt-2 w-full space-y-2">
      <SubjectPicker subjects={subjects} value={ids} onChange={setIds} />
      {error && <p role="alert" className="text-sm font-semibold text-accent-700">{t(error)}</p>}
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={() => start(async () => {
          const r = await setTeacherSubjects(teacherId, ids);
          if (!r.ok) return setError(r.error);
          setOpen(false); router.refresh();
        })}>{t(pending ? "admin.form.saving" : "admin.teachers.saveSubjects")}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t("admin.qbank.cancel")}</Button>
      </div>
    </div>
  );
}

export function TeacherActive({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();
  return (
    <button type="button" role="switch" aria-checked={on} disabled={pending}
      title={t(on ? "admin.action.turnOff" : "admin.action.turnOn")}
      onClick={() => start(async () => { const next = !on; setOn(next); const r = await setTeacherActive(teacherId, next); if (!r.ok) setOn(!next); })}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-primary-600" : "bg-neutral-300")}>
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      <span className="sr-only">{t(on ? "admin.action.turnOff" : "admin.action.turnOn")}</span>
    </button>
  );
}
