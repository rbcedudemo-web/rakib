import { describe, expect, it } from "vitest";
import {
  boardExamFor,
  CLASS_LEVELS,
  MAIN_MENU,
  messages,
  needsGroup,
  PROFILE_MENU,
  toBanglaDigits,
  translate,
  VERSIONS,
  GROUPS,
  type MessageKey,
} from "./index";

describe("i18n", () => {
  it("has the same keys in Bangla and English, none empty", () => {
    const bnKeys = Object.keys(messages.bn).sort();
    expect(Object.keys(messages.en).sort()).toEqual(bnKeys);
    for (const locale of ["bn", "en"] as const) {
      for (const key of bnKeys) expect(messages[locale][key as MessageKey].trim()).not.toBe("");
    }
  });

  it("has a label for every menu, version and group", () => {
    const keys: string[] = [
      ...MAIN_MENU.flatMap((m) => [m.key, ...(m.children ?? []).map((c) => c.key)]),
      ...PROFILE_MENU.student.map((m) => m.key),
      ...PROFILE_MENU.teacher.map((m) => m.key),
      ...PROFILE_MENU.admin.map((m) => m.key),
      ...VERSIONS.map((v) => `version.${v}`),
      ...GROUPS.map((g) => `group.${g}`),
    ];
    for (const key of keys) expect(messages.bn).toHaveProperty(key);
  });

  it("translates", () => {
    expect(translate("en", "nav.home")).toBe("Home");
    expect(translate("bn", "nav.home")).toBe("হোম");
    expect(translate("en", "student.greeting", { name: "Rafi" })).toBe("Welcome, Rafi");
  });
});

describe("navigation", () => {
  it("keeps the approved header order", () => {
    expect(MAIN_MENU.map((m) => m.key)).toEqual([
      "nav.home",
      "nav.live",
      "nav.reports",
      "nav.community",
      "nav.terms",
      "nav.notice",
      "nav.contact",
    ]);
  });
});

describe("academic rules", () => {
  it("asks for a group only from class 9", () => {
    expect(CLASS_LEVELS.filter(needsGroup)).toEqual([9, 10, 11, 12]);
  });

  it("maps board-exam prep to classes", () => {
    expect(boardExamFor(8)).toBeNull();
    expect(boardExamFor(10)).toBe("ssc");
    expect(boardExamFor(12)).toBe("hsc");
  });

  it("converts digits to Bangla", () => {
    expect(toBanglaDigits(2026)).toBe("২০২৬");
    expect(toBanglaDigits("10/2")).toBe("১০/২");
  });
});
