import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@rupshi/shared";
import { getSession, homePathFor, type Session } from "@/lib/supabase/server";

/** Page guard: signed in, right role, and (for students) enrolled. */
export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(role === "admin" ? "/admin/login" : "/login");
  const { profile } = session;
  if (profile.role !== role) redirect(homePathFor(profile));
  if (role === "student" && !profile.enrolled_at) redirect("/onboarding");
  return session;
}
