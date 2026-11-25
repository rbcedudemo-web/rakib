"use server";

import { revalidatePath } from "next/cache";
import { isUuid, normalizeBdPhone, type MessageKey } from "@rupshi/shared";
import { createClient, getSession } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalEmailFor } from "@/lib/auth/demo-otp";

export type TeacherResult = { ok: true } | { ok: false; error: MessageKey };

async function adminOnly() {
  const session = await getSession();
  return session?.profile.role === "admin" ? session : null;
}

const cleanIds = (ids: string[]) => [...new Set(ids.filter(isUuid))].slice(0, 40);

/** Creates a teacher account for a mobile number. The teacher signs in like a student, with the demo code. */
export async function addTeacher(input: { name: string; phone: string; subjectIds: string[] }): Promise<TeacherResult> {
  if (!(await adminOnly())) return { ok: false, error: "admin.error.notAllowed" };
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "admin.teachers.error.name" };
  const phone = normalizeBdPhone(input.phone);
  if (!phone) return { ok: false, error: "admin.teachers.error.phone" };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id, role").eq("phone", phone).maybeSingle<{ id: string; role: string }>();
  if (existing) return { ok: false, error: existing.role === "student" ? "admin.teachers.error.student" : "admin.teachers.error.exists" };

  const { data: created, error } = await admin.auth.admin.createUser({
    phone,
    email: internalEmailFor(phone),
    phone_confirm: true,
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: name },
  });
  if (error || !created.user) {
    console.error("add teacher failed", error);
    return { ok: false, error: "admin.form.saveFailed" };
  }
  const ids = cleanIds(input.subjectIds);
  if (ids.length) {
    const supabase = await createClient();
    const { error: subjectError } = await supabase.from("teacher_subjects").insert(ids.map((subject_id) => ({ teacher_id: created.user.id, subject_id })));
    if (subjectError) console.error("teacher subjects failed", subjectError);
  }
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  return { ok: true };
}

export async function setTeacherSubjects(teacherId: string, subjectIds: string[]): Promise<TeacherResult> {
  if (!(await adminOnly()) || !isUuid(teacherId)) return { ok: false, error: "admin.error.notAllowed" };
  const supabase = await createClient();
  const ids = cleanIds(subjectIds);
  const { error: delError } = await supabase.from("teacher_subjects").delete().eq("teacher_id", teacherId);
  if (delError) return { ok: false, error: "admin.form.saveFailed" };
  if (ids.length) {
    const { error } = await supabase.from("teacher_subjects").insert(ids.map((subject_id) => ({ teacher_id: teacherId, subject_id })));
    if (error) return { ok: false, error: "admin.form.saveFailed" };
  }
  revalidatePath("/admin/teachers");
  return { ok: true };
}

export async function setTeacherActive(teacherId: string, active: boolean): Promise<TeacherResult> {
  if (!(await adminOnly()) || !isUuid(teacherId)) return { ok: false, error: "admin.error.notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", teacherId).eq("role", "teacher");
  if (error) return { ok: false, error: "admin.form.saveFailed" };
  revalidatePath("/admin/teachers");
  return { ok: true };
}
