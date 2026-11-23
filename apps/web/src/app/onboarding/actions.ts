"use server";

import { redirect } from "next/navigation";
import { CLASS_LEVELS, GROUPS, needsGroup, VERSIONS, type ClassLevel, type MessageKey } from "@rupshi/shared";
import { createClient } from "@/lib/supabase/server";

export interface OnboardState {
  errors?: Partial<Record<"name" | "class" | "group" | "version" | "form", MessageKey>>;
}

export async function onboardAction(_prev: OnboardState, form: FormData): Promise<OnboardState> {
  const name = String(form.get("name") ?? "").trim();
  const classId = Number(form.get("class"));
  const group = String(form.get("group") ?? "");
  const version = String(form.get("version") ?? "");

  const errors: OnboardState["errors"] = {};
  if (!name || name.length > 100) errors.name = "onboard.error.name";
  const validClass = (CLASS_LEVELS as readonly number[]).includes(classId);
  if (!validClass) errors.class = "onboard.error.class";
  if (validClass && needsGroup(classId as ClassLevel) && !(GROUPS as readonly string[]).includes(group))
    errors.group = "onboard.error.group";
  if (!(VERSIONS as readonly string[]).includes(version)) errors.version = "onboard.error.version";
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_student", {
    p_full_name: name,
    p_class_id: classId,
    p_version: version,
    p_group: needsGroup(classId as ClassLevel) ? group : null,
  });
  if (error) {
    // already enrolled: just continue to the home page
    if (!error.message.includes("already enrolled")) {
      console.error("enroll_student failed", error);
      return { errors: { form: "login.error.server" } };
    }
  }
  redirect("/me");
}
