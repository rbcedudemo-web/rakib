import { notFound } from "next/navigation";
import { isUuid } from "@rupshi/shared";
import { LessonResults } from "@/components/reports/ResultsTables";

export const metadata = { title: "Lesson results" };

export default async function AdminLessonResultsPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!isUuid(lessonId)) notFound();
  const body = await LessonResults({ lessonId, backPath: "/admin/results" });
  if (!body) notFound();
  return <main>{body}</main>;
}
