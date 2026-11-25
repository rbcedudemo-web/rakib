import { notFound } from "next/navigation";
import { isUuid } from "@rupshi/shared";
import { requireRole } from "@/lib/auth/guards";
import { LessonResults } from "@/components/reports/ResultsTables";

export const metadata = { title: "Lesson results" };

export default async function TeacherLessonResultsPage({ params }: { params: Promise<{ lessonId: string }> }) {
  await requireRole("teacher");
  const { lessonId } = await params;
  if (!isUuid(lessonId)) notFound();
  const body = await LessonResults({ lessonId, backPath: "/teacher/students" });
  if (!body) notFound();
  return <main className="page py-6">{body}</main>;
}
