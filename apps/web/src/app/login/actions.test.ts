import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- mocks -------------------------------------------------------------
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, supabaseUrl: "http://x", supabaseAnonKey: "k" }));

const existingProfile = { value: null as null | { id: string; is_active: boolean } };
const authUserEmail = { value: null as string | null };
const admin = {
  createUser: vi.fn(async (_args: unknown) => ({ error: null })),
  getUserById: vi.fn(async () => ({ data: { user: { email: authUserEmail.value } }, error: null })),
  updateUserById: vi.fn(async (_id: string, _args: unknown) => ({ error: null })),
  generateLink: vi.fn(async (_args: { email: string }) => ({ data: { properties: { hashed_token: "hash" } }, error: null })),
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingProfile.value, error: null }) }) }),
    }),
  }),
}));

const signedInProfile = { value: { role: "student", enrolled_at: null } as Record<string, unknown> };
const verifyOtp = vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null }));
vi.mock("@/lib/supabase/server", async () => {
  const real = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
  return {
    homePathFor: real.homePathFor,
    createClient: async () => ({
      auth: { verifyOtp },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: signedInProfile.value }) }) }) }),
    }),
  };
});

const { loginAction } = await import("./actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
async function submit(fields: Record<string, string>) {
  try {
    return await loginAction({ step: "phone" }, form(fields));
  } catch (e) {
    return { redirected: (e as Error).message.replace("REDIRECT ", "") };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  existingProfile.value = null;
  authUserEmail.value = null;
  signedInProfile.value = { role: "student", enrolled_at: null };
});

// ---- tests ---------------------------------------------------------------
describe("demo OTP login", () => {
  it("rejects an invalid phone number", async () => {
    expect(await submit({ phone: "12345" })).toEqual({ step: "phone", error: "login.error.phone" });
  });

  it("moves to the code step with a normalised number", async () => {
    expect(await submit({ phone: "01712-345678" })).toEqual({ step: "code", phone: "8801712345678" });
  });

  it("rejects a wrong code without touching Supabase", async () => {
    const r = await submit({ step: "code", phone: "01712345679", code: "111111" });
    expect(r).toEqual({ step: "code", phone: "8801712345679", error: "login.error.code" });
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it("blocks a number after 5 wrong codes", async () => {
    for (let i = 0; i < 5; i++) await submit({ step: "code", phone: "01812345678", code: "000000" });
    const r = await submit({ step: "code", phone: "01812345678", code: "123456" });
    expect(r).toMatchObject({ error: "login.error.tooMany" });
  });

  it("creates a new number as a student and sends them to enrolment", async () => {
    const r = await submit({ step: "code", phone: "01712345678", code: "123456" });
    expect(admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "8801712345678", app_metadata: { role: "student" }, phone_confirm: true }),
    );
    expect(admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "p8801712345678@phone.rupshi-demo.app" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "magiclink" });
    expect(r).toEqual({ redirected: "/onboarding" });
  });

  it("signs in an existing enrolled student without creating a user", async () => {
    existingProfile.value = { id: "u1", is_active: true };
    authUserEmail.value = "p8801712345678@phone.rupshi-demo.app";
    signedInProfile.value = { role: "student", enrolled_at: "2026-11-23" };
    const r = await submit({ step: "code", phone: "01712345678", code: "123456" });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(r).toEqual({ redirected: "/me" });
  });

  it("gives a phone-only teacher an internal address, then opens the teacher page", async () => {
    existingProfile.value = { id: "t1", is_active: true };
    signedInProfile.value = { role: "teacher" };
    const r = await submit({ step: "code", phone: "01912345678", code: "123456" });
    expect(admin.updateUserById).toHaveBeenCalledWith("t1", { email: "p8801912345678@phone.rupshi-demo.app", email_confirm: true });
    expect(r).toEqual({ redirected: "/teacher" });
  });

  it("refuses a disabled account", async () => {
    existingProfile.value = { id: "u2", is_active: false };
    expect(await submit({ step: "code", phone: "01612345678", code: "123456" })).toEqual({
      step: "phone",
      error: "login.error.inactive",
    });
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it("reports a server error instead of crashing", async () => {
    admin.generateLink.mockResolvedValueOnce({ data: null, error: new Error("boom") } as never);
    const r = await submit({ step: "code", phone: "01512345678", code: "123456" });
    expect(r).toMatchObject({ error: "login.error.server" });
  });
});
