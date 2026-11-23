/**
 * Demo OTP (Guideline §8): no SMS is sent; one fixed code works for every
 * number. Replacing this with a real SMS gateway later only changes
 * verifyDemoCode() and the "send code" step.
 */

export const DEFAULT_DEMO_CODE = "123456";

export function demoCode(): string {
  return process.env.DEMO_OTP_CODE || DEFAULT_DEMO_CODE;
}

export function verifyDemoCode(code: string): boolean {
  const expected = demoCode();
  if (code.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < code.length; i++) diff |= code.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Supabase issues a session through an email magic link, so every phone user
 * also gets an internal address. Nothing is ever sent to it.
 */
export function internalEmailFor(phone: string): string {
  const domain = process.env.DEMO_EMAIL_DOMAIN || "phone.rupshi-demo.app";
  return `p${phone}@${domain}`;
}

/** Wrong-code limiter: 5 wrong codes per number per 10 minutes (per server instance). */
export class AttemptLimiter {
  private failures = new Map<string, number[]>();
  constructor(
    private readonly max = 5,
    private readonly windowMs = 10 * 60 * 1000,
  ) {}

  private recent(key: string, now: number) {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.failures.set(key, list);
    return list;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    return this.recent(key, now).length >= this.max;
  }

  fail(key: string, now = Date.now()): void {
    this.recent(key, now).push(now);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
