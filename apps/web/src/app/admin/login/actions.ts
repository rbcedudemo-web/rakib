"use server";

import { redirect } from "next/navigation";
import type { MessageKey } from "@rupshi/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function adminLoginAction(_prev: { error?: MessageKey }, form: FormData): Promise<{ error?: MessageKey }> {
  if (!isSupabaseConfigured) return { error: "login.notConfigured" };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "login.admin.error" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "login.admin.error" };

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
  if (profile?.role !== "admin" || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "login.admin.error" };
  }
  redirect("/admin");
}
