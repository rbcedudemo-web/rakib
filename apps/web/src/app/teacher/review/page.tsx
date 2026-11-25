import { requireRole } from "@/lib/auth/guards";
import { ReviewQueue } from "@/components/marking/ReviewQueue";

export const metadata = { title: "Review scripts" };

export default async function TeacherReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("teacher");
  const { tab } = await searchParams;
  return <main className="page max-w-4xl py-6"><ReviewQueue basePath="/teacher/review" tab={tab === "marked" ? "marked" : "pending"} /></main>;
}
