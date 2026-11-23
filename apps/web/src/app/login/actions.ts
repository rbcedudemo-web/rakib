"use server";

import { redirect } from "next/navigation";
import { isOtpShape, normalizeBdPhone, type MessageKey } from "@rupshi/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { AttemptLimiter, internalEmailFor, verifyDemoCode } from "@/lib/auth/demo-otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, homePathFor, type Profile } from "@/lib/supabase/server";

export interface LoginState {
  step: "phone" | "code";
  phone?: string;
  error?: MessageKey;
}

const limiter = new AttemptLimiter();

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured) return { step: "phone", error: "login.notConfigured" };

  const phone = normalizeBdPhone(String(form.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "login.error.phone" };

  // Step 1: "send" the code. In the demo nothing is sent.
  if (form.get("step") !== "code") return { step: "code", phone };

  // Step 2: check the code.
  if (limiter.isBlocked(phone)) return { step: "code", phone, error: "login.error.tooMany" };
  const code = String(form.get("code") ?? "").trim();
  if (!isOtpShape(code) || !verifyDemoCode(code)) {
    limiter.fail(phone);
    return { step: "code", phone, error: "login.error.code" };
  }
  limiter.reset(phone);

  let destination: string;
  try {
    destination = await signInPhoneUser(phone);
  } catch (error) {
    console.error("demo login failed", error);
    return { step: "code", phone, error: "login.error.server" };
  }
  if (destination === "inactive") return { step: "phone", error: "login.error.inactive" };
  redirect(destination);
}

/** Finds or creates the user for this number and starts a session in the browser cookie. */
async function signInPhoneUser(phone: string): Promise<string> {
  const admin = createAdminClient();
  const email = internalEmailFor(phone);

  const { data: existing, error: findError } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("phone", phone)
    .maybeSingle<{ id: string; is_active: boolean }>();
  if (findError) throw findError;

  let linkEmail = email;
  if (!existing) {
    // New number: always a student. Teachers and admins are created by an admin.
    const { error } = await admin.auth.admin.createUser({
      phone,
      email,
      phone_confirm: true,
      email_confirm: true,
      app_metadata: { role: "student" },
    });
    if (error) throw error;
  } else {
    if (!existing.is_active) return "inactive";
    const { data, error } = await admin.auth.admin.getUserById(existing.id);
    if (error) throw error;
    if (data.user.email) {
      linkEmail = data.user.email;
    } else {
      // e.g. a teacher added with a phone number only
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, { email, email_confirm: true });
      if (updateError) throw updateError;
    }
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: linkEmail });
  if (linkError) throw linkError;

  const supabase = await createClient();
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.user) throw verifyError ?? new Error("no user after verifyOtp");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", verified.user.id).single<Profile>();
  return profile ? homePathFor(profile) : "/onboarding";
}
