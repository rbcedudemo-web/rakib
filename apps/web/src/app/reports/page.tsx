import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { StudentReport } from "@/components/reports/StudentReport";

export const metadata = { title: "Reports" };

/** Students see their own results; teachers and admins go to the results of their subjects. */
export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (profile.role === "admin") redirect("/admin/results");
  if (profile.role === "teacher") redirect("/teacher/students");
  if (!profile.enrolled_at) redirect("/onboarding");
  return <StudentReport />;
}
