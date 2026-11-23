import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { ClassLevel, Group, Role, Version } from "@rupshi/shared";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes cookies instead.
        }
      },
    },
  });
}

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  student_code: string | null;
  class_id: ClassLevel | null;
  group_code: Group | null;
  version: Version | null;
  avatar_url: string | null;
  is_active: boolean;
  enrolled_at: string | null;
}

export interface Session {
  user: User;
  profile: Profile;
}

/** Signed-in user and profile, or null. Never throws when Supabase is not configured. */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  // A disabled account is treated as signed out everywhere.
  if (!profile || !profile.is_active) return null;
  return { user, profile };
}

/** Where a signed-in user lands. */
export function homePathFor(profile: Profile): string {
  if (profile.role === "admin") return "/admin";
  if (profile.role === "teacher") return "/teacher";
  return profile.enrolled_at ? "/me" : "/onboarding";
}
