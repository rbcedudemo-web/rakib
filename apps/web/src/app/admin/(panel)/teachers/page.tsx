import { DEMO_CLASS_LEVELS, formatBdPhone, toBanglaDigits } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { AddTeacher, TeacherActive, TeacherSubjects, type SubjectOption } from "./TeacherForms";

export const metadata = { title: "Teachers" };

interface TeacherRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  teacher_subjects: { subject_id: string }[];
}

export default async function TeachersPage() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: teachers }, { data: subjects }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, is_active, teacher_subjects(subject_id)")
      .eq("role", "teacher").order("created_at").returns<TeacherRow[]>(),
    supabase.from("subjects").select("id, class_id, version, name_bn, name_en")
      .in("class_id", [...DEMO_CLASS_LEVELS]).eq("is_active", true).order("class_id").order("version").order("sort").returns<SubjectOption[]>(),
  ]);
  const all = subjects ?? [];
  const byId = new Map(all.map((s) => [s.id, s]));

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("admin.teachers.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("admin.teachers.note")}</p>
      </div>
      <AddTeacher subjects={all} />
      {(teachers ?? []).length === 0 ? (
        <Card className="text-neutral-600">{t("admin.teachers.empty")}</Card>
      ) : (
        <ul className="space-y-3">
          {(teachers ?? []).map((tc) => {
            const mine = tc.teacher_subjects.map((x) => x.subject_id);
            return (
              <li key={tc.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {tc.full_name ?? "—"} {!tc.is_active && <Badge tone="red">{t("admin.teachers.off")}</Badge>}
                      </p>
                      {tc.phone && <p className="text-sm text-neutral-500">{formatBdPhone(tc.phone)}</p>}
                    </div>
                    <TeacherActive teacherId={tc.id} active={tc.is_active} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mine.length === 0 && <span className="text-sm text-neutral-500">{t("admin.teachers.noSubjects")}</span>}
                    {mine.map((id) => {
                      const s = byId.get(id);
                      return s && <Badge key={id} tone="green">{t("class.label")} {locale === "bn" ? toBanglaDigits(s.class_id) : s.class_id} · {locale === "bn" ? s.name_bn : s.name_en}</Badge>;
                    })}
                  </div>
                  <TeacherSubjects teacherId={tc.id} subjects={all} current={mine} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
