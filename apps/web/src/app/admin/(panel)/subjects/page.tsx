import { DEMO_CLASS_LEVELS, toBanglaDigits, VERSIONS, type MessageKey, type Version } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { subjectName, type SubjectRow } from "@/lib/admin/catalog";
import { Badge } from "@/components/ui";
import { SubjectToggle } from "./SubjectToggle";

export const metadata = { title: "Subjects" };

const selectClass = "h-11 rounded-[10px] border border-neutral-300 bg-white px-3 text-sm";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const sp = await searchParams;
  const classId = DEMO_CLASS_LEVELS.includes(Number(sp.class) as never) ? Number(sp.class) : DEMO_CLASS_LEVELS[0];
  const version: Version = (VERSIONS as readonly string[]).includes(sp.version ?? "") ? (sp.version as Version) : "bangla";

  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, class_id, version, group_code, name_bn, name_en, sort, is_active, lessons(count)")
    .eq("class_id", classId)
    .eq("version", version)
    .order("sort")
    .returns<(SubjectRow & { lessons: { count: number }[] })[]>();
  const subjects = data ?? [];

  return (
    <main>
      <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("admin.subjects.title")}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t("admin.subjects.note")}</p>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.filter.class")}
          <select name="class" defaultValue={classId} className={selectClass}>
            {DEMO_CLASS_LEVELS.map((c) => <option key={c} value={c}>{num(c)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          {t("admin.filter.version")}
          <select name="version" defaultValue={version} className={selectClass}>
            {VERSIONS.map((v) => <option key={v} value={v}>{t(`version.${v}` as MessageKey)}</option>)}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-[10px] border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50">
          {t("admin.filter.apply")}
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-card border border-neutral-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("admin.filter.subject")}</th>
              <th className="px-4 py-3 font-semibold">{t("onboard.group")}</th>
              <th className="px-4 py-3 font-semibold">{t("admin.col.lessons")}</th>
              <th className="px-4 py-3 font-semibold">{t("admin.col.active")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-semibold text-neutral-900">{subjectName(s, locale)}</td>
                <td className="px-4 py-3">
                  {s.group_code ? <Badge>{t(`group.${s.group_code}` as MessageKey)}</Badge> : <span className="text-neutral-500">{t("admin.subjects.compulsory")}</span>}
                </td>
                <td className="px-4 py-3">{num(s.lessons?.[0]?.count ?? 0)}</td>
                <td className="px-4 py-3"><SubjectToggle id={s.id} active={s.is_active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
