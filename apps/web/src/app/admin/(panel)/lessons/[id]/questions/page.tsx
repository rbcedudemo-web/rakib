import Link from "next/link";
import { notFound } from "next/navigation";
import { bankTargets, EXAM_DEFAULTS, isUuid, toBanglaDigits, type MessageKey } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { GeneratePanel } from "./GeneratePanel";
import { QuestionCard, QuestionEditor, type QuestionRow } from "./QuestionEditor";

export const metadata = { title: "Question bank" };
// making a question bank with AI can take a few minutes
export const maxDuration = 300;

interface LessonHead {
  id: string;
  title: string;
  status: "draft" | "generating" | "ready" | "failed";
  transcript_path: string | null;
  note_pdf_path: string | null;
  subject: { name_bn: string; name_en: string; class_id: number } | null;
  exam: { mcq_count: number; written_count: number } | null;
}

export default async function QuestionBankPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const { t, locale } = await getT();
  const num = (n: number | string) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const supabase = await createClient();

  const [{ data: lesson }, { data: qData }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, title, status, transcript_path, note_pdf_path, subject:subjects(name_bn, name_en, class_id), exam:exam_settings(mcq_count, written_count)")
      .eq("id", id)
      .maybeSingle<LessonHead>(),
    supabase
      .from("questions")
      .select("id, type, prompt, options, correct_index, explanation, model_answer, rubric, difficulty, source, is_active")
      .eq("lesson_id", id)
      .order("is_active", { ascending: false })
      .order("type")
      .order("created_at")
      .returns<QuestionRow[]>(),
  ]);
  if (!lesson) notFound();
  const all = qData ?? [];
  const showOff = sp.off === "1";
  const questions = showOff ? all : all.filter((q) => q.is_active);
  const active = all.filter((q) => q.is_active);
  const mcqCount = lesson.exam?.mcq_count ?? EXAM_DEFAULTS.mcqCount;
  const writtenCount = lesson.exam?.written_count ?? EXAM_DEFAULTS.writtenCount;
  const targets = bankTargets(mcqCount, writtenCount);
  const material = [lesson.transcript_path ? t("admin.file.transcript") : null, lesson.note_pdf_path ? t("admin.file.note") : null].filter(Boolean);
  const statusTone = { draft: "gray", generating: "amber", ready: "green", failed: "red" } as const;

  return (
    <main className="space-y-5">
      <div>
        <Link href="/admin/lessons" className="text-sm font-semibold text-primary-700 hover:underline">{t("admin.form.back")}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t("admin.qbank.title")}</h1>
          {lesson.status !== "draft" && <Badge tone={statusTone[lesson.status]}>{t(`admin.status.${lesson.status}` as MessageKey)}</Badge>}
        </div>
        <p className="mt-1 text-neutral-700">
          {lesson.subject ? `${locale === "bn" ? lesson.subject.name_bn : lesson.subject.name_en} · ` : ""}
          <span className="font-semibold">{lesson.title}</span>{" "}
          <Link href={`/admin/lessons/${id}`} className="text-sm font-semibold text-primary-700 hover:underline">({t("admin.qbank.lessonLink")})</Link>
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          {t("admin.qbank.count", { mcq: num(active.filter((q) => q.type === "mcq").length), written: num(active.filter((q) => q.type === "written").length) })}
          {" · "}
          {t("admin.qbank.needs", { mcq: num(mcqCount), written: num(writtenCount) })}
        </p>
      </div>

      <GeneratePanel
        lessonId={id}
        hasQuestions={all.some((q) => q.source === "ai")}
        target={num(targets.mcq + targets.written)}
        material={material.length ? t("admin.qbank.material", { list: material.join(", ") }) : t("admin.qbank.noMaterial")}
        hasMaterial={material.length > 0}
        generating={lesson.status === "generating"}
      />

      <QuestionEditor lessonId={id} />

      <div className="flex justify-end">
        <Link href={showOff ? `?` : `?off=1`} className="text-sm font-semibold text-primary-700 hover:underline">
          {showOff ? "✓ " : ""}{t("admin.qbank.showOff")}
        </Link>
      </div>

      {questions.length === 0 ? (
        <Card className="text-center text-neutral-600">{t("admin.qbank.empty")}</Card>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id}>
              <QuestionCard lessonId={id} q={q} n={num(i + 1)} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
