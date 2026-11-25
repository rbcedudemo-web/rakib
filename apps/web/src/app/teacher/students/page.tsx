import { requireRole } from "@/lib/auth/guards";
import { ResultsOverview } from "@/components/reports/ResultsTables";

export const metadata = { title: "Student results" };

export default async function TeacherResultsPage() {
  await requireRole("teacher");
  return <main className="page py-6"><ResultsOverview basePath="/teacher/students" reviewPath="/teacher/review" /></main>;
}
