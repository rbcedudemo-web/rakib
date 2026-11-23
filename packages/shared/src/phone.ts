/**
 * Bangladesh mobile numbers. Stored as 8801XXXXXXXXX (13 digits, no plus),
 * the format Supabase Auth uses for phone users.
 * Valid operator prefixes: 013–019.
 */
const BD_MOBILE = /^8801[3-9]\d{8}$/;

export function normalizeBdPhone(input: string): string | null {
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  let digits = input.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d))).replace(/\D/g, "");
  if (digits.startsWith("01") && digits.length === 11) digits = "88" + digits;
  else if (digits.startsWith("1") && digits.length === 10) digits = "880" + digits;
  return BD_MOBILE.test(digits) ? digits : null;
}

/** 8801712345678 -> 01712-345678 for display. */
export function formatBdPhone(normalized: string): string {
  const local = normalized.startsWith("88") ? normalized.slice(2) : normalized;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

export const OTP_LENGTH = 6;
export function isOtpShape(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}
