import Link from "next/link";
import { boardExamFor, toBanglaDigits, type ClassLevel, type Group, type MessageKey } from "@rupshi/shared";
import { requireRole } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "Home" };

type Service = "live" | "ssc_prep" | "hsc_prep";

export default async function StudentHome() {
  const { profile } = await requireRole("student");
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

  const subjectsQuery = supabase
    .from("subjects")
    .select("id, name_bn, name_en, group_code, sort")
    .eq("class_id", profile.class_id!)
    .eq("version", profile.version!)
    .eq("is_active", true)
    .order("sort");
  const [{ data: subjects }, { data: lessons }, { data: progress }, { data: subs }, { data: live }] = await Promise.all([
    profile.group_code
      ? subjectsQuery.or(`group_code.is.null,group_code.eq.${profile.group_code}`)
      : subjectsQuery.is("group_code", null),
    supabase.from("lessons").select("id, subject_id"), // RLS: only this student's published lessons
    supabase.from("lesson_progress").select("lesson_id, completed_at"),
    supabase.from("subscriptions").select("service, starts_on, ends_on"),
    supabase
      .from("live_classes")
      .select("kind, title, starts_at, class_id")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(20),
  ]);

  const lessonsBySubject = new Map<string, string[]>();
  for (const l of lessons ?? []) lessonsBySubject.set(l.subject_id, [...(lessonsBySubject.get(l.subject_id) ?? []), l.id]);
  const completed = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const isMember = (s: Service) => (subs ?? []).some((x) => x.service === s && x.starts_on <= today && x.ends_on >= today);
  const nextOf = (s: Service) =>
    (live ?? []).find((x) => x.kind === s && (x.class_id === null || x.class_id === profile.class_id));

  const board = boardExamFor(profile.class_id as ClassLevel);
  const liveButtons: { service: Service; label: MessageKey }[] = [
    { service: "live", label: "student.live" },
    ...(board ? [{ service: `${board}_prep` as Service, label: `student.prep.${board}` as MessageKey }] : []),
  ];
  const timeFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

  return (
    <main className="page py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t("student.greeting", { name: profile.full_name ?? "" })}
          </h1>
          <p className="mt-1 text-neutral-600">
            {t("class.label")} {num(profile.class_id!)} · {t(`version.${profile.version!}`)}
            {profile.group_code && <> · {t(`group.${profile.group_code}`)}</>}
          </p>
        </div>
        {profile.student_code && (
          <Badge tone="gray">
            {t("student.id")}: {profile.student_code}
          </Badge>
        )}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {liveButtons.map(({ service, label }) => {
          const member = isMember(service);
          const next = nextOf(service);
          return (
            <Link
              key={service}
              href={member ? (service === "live" ? "/live" : "/live/prep") : "/me/subscription"}
              className={cn(
                "flex items-center gap-4 rounded-card border p-4 transition-colors",
                member ? "border-accent-100 bg-white hover:border-accent-500" : "border-neutral-200 bg-neutral-100",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl",
                  member ? "bg-accent-600 text-white" : "bg-neutral-200 text-neutral-500",
                )}
              >
                {member ? "●" : "🔒"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-neutral-900">{t(label)}</span>
                <span className="block truncate text-sm text-neutral-600">
                  {next ? `${t("student.nextClass")}: ${timeFmt.format(new Date(next.starts_at))}` : t("student.noSchedule")}
                </span>
              </span>
              {member ? <Badge tone="red">{t("student.join")}</Badge> : <Badge tone="gray">{t("student.locked")}</Badge>}
            </Link>
          );
        })}
      </section>

      <h2 className="mb-3 mt-8 text-xl font-bold text-neutral-900">{t("student.subjects")}</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(subjects ?? []).map((s) => {
          const ids = lessonsBySubject.get(s.id) ?? [];
          const done = ids.filter((id) => completed.has(id)).length;
          const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
          const body = (
            <Card className={cn("h-full", ids.length ? "transition-shadow hover:shadow-md" : "opacity-80")}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">{locale === "bn" ? s.name_bn : s.name_en}</h3>
                {s.group_code && <Badge tone="green">{t(`group.${s.group_code as Group}`)}</Badge>}
              </div>
              {ids.length ? (
                <>
                  <p className="mt-1 text-sm text-neutral-600">{t("student.lessons", { n: num(ids.length) })}</p>
                  <div className="mt-3 h-2 rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </>
              ) : (
                <p className="mt-2">
                  <Badge tone="amber">{t("common.comingSoon")}</Badge>
                </p>
              )}
            </Card>
          );
          return ids.length ? (
            <Link key={s.id} href={`/learn/${s.id}`}>
              {body}
            </Link>
          ) : (
            <div key={s.id}>{body}</div>
          );
        })}
      </section>
    </main>
  );
}
