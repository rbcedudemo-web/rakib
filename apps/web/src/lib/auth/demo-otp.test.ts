import { afterEach, describe, expect, it } from "vitest";
import { AttemptLimiter, internalEmailFor, verifyDemoCode } from "./demo-otp";

afterEach(() => {
  delete process.env.DEMO_OTP_CODE;
});

describe("demo OTP", () => {
  it("accepts only the demo code", () => {
    expect(verifyDemoCode("123456")).toBe(true);
    expect(verifyDemoCode("123457")).toBe(false);
    expect(verifyDemoCode("12345")).toBe(false);
  });

  it("uses DEMO_OTP_CODE when set", () => {
    process.env.DEMO_OTP_CODE = "654321";
    expect(verifyDemoCode("654321")).toBe(true);
    expect(verifyDemoCode("123456")).toBe(false);
  });

  it("builds an internal address per phone", () => {
    expect(internalEmailFor("8801712345678")).toBe("p8801712345678@phone.rupshi-demo.app");
  });
});

describe("AttemptLimiter", () => {
  it("blocks after 5 wrong codes and frees after the window", () => {
    const l = new AttemptLimiter(5, 1000);
    for (let i = 0; i < 4; i++) l.fail("a", 0);
    expect(l.isBlocked("a", 10)).toBe(false);
    l.fail("a", 10);
    expect(l.isBlocked("a", 20)).toBe(true);
    expect(l.isBlocked("b", 20)).toBe(false);
    expect(l.isBlocked("a", 1500)).toBe(false);
  });

  it("resets after a correct code", () => {
    const l = new AttemptLimiter(1, 1000);
    l.fail("a", 0);
    l.reset("a");
    expect(l.isBlocked("a", 1)).toBe(false);
  });
});
