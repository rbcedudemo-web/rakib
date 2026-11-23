import { describe, expect, it } from "vitest";
import { formatBdPhone, isOtpShape, normalizeBdPhone } from "./phone";

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "8801712345678"],
    ["+8801712345678", "8801712345678"],
    ["8801712345678", "8801712345678"],
    ["01712-345678", "8801712345678"],
    ["017 1234 5678", "8801712345678"],
    ["০১৭১২৩৪৫৬৭৮", "8801712345678"],
    ["1912345678", "8801912345678"],
    ["01312345678", "8801312345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(["", "0171234567", "017123456789", "01212345678", "02712345678", "+1 415 555 0100", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizeBdPhone(input)).toBeNull();
    },
  );

  it("formats for display", () => {
    expect(formatBdPhone("8801712345678")).toBe("01712-345678");
  });

  it("checks OTP shape", () => {
    expect(isOtpShape("123456")).toBe(true);
    expect(isOtpShape("12345")).toBe(false);
    expect(isOtpShape("12a456")).toBe(false);
  });
});
