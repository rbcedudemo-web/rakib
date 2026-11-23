import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

const PROTECTED = ["/me", "/teacher", "/admin", "/onboarding"];
const PUBLIC_UNDER_PROTECTED = ["/admin/login"];

/** Refreshes the auth cookie on every request and sends signed-out visitors to the login page. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsLogin =
    PROTECTED.some((p) => path === p || path.startsWith(p + "/")) && !PUBLIC_UNDER_PROTECTED.includes(path);
  if (needsLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/admin") ? "/admin/login" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
