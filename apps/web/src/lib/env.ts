/** Public settings (safe in the browser). */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once Rakib's Supabase project is connected. The site still builds and renders without it. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
