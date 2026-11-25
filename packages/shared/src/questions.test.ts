import { describe, expect, it } from "vitest";
import {
  aiCostUsd, bankTargets, cleanGeneratedQuestions, cleanQuestion, formatClock, optionLetter, questionLanguage, secondsLeft,
} from "./questions";

const mcq = (prompt: string, extra: Record<string, unknown> = {}) => ({
  type: "mcq", prompt, options: ["ক", "খ", "গ", "ঘ"], correct_index: 1,
  explanation: "কারণ", model_answer: "", rubric: "", difficulty: "easy", ...extra,
});
const written = (prompt: string, extra: Record<string, unknown> = {}) => ({
  type: "written", prompt, options: [], correct_index: -1,
  explanation: "", model_answer: "আদর্শ উত্তর", rubric: "২ নম্বর সংজ্ঞা", difficulty: "hard", ...extra,
});

describe("bankTargets", () => {
  it("asks for 30 to 40 questions", () => {
    expect(bankTargets(10, 2)).toEqual({ mcq: 30, written: 6 });
    expect(bankTargets(15, 0)).toEqual({ mcq: 36, written: 0 }); // Rakib's sample lesson
    expect(bankTargets(25, 1)).toEqual({ mcq: 50, written: 4 });
    expect(bankTargets(0, 3)).toEqual({ mcq: 0, written: 9 });
  });
});

describe("cleanQuestion", () => {
  it("keeps a good MCQ and a good written question", () => {
    expect(cleanQuestion(mcq("প্রশ্ন"))).toMatchObject({ type: "mcq", correctIndex: 1, options: ["ক", "খ", "গ", "ঘ"], modelAnswer: null });
    expect(cleanQuestion(written("লেখো"))).toMatchObject({ type: "written", options: null, correctIndex: null, rubric: "২ নম্বর সংজ্ঞা" });
  });
  it("drops broken questions", () => {
    expect(cleanQuestion(mcq(""))).toBeNull();
    expect(cleanQuestion(mcq("প্র", { options: ["ক", "খ", "গ"] }))).toBeNull();
    expect(cleanQuestion(mcq("প্র", { options: ["ক", "ক", "গ", "ঘ"] }))).toBeNull();
    expect(cleanQuestion(mcq("প্র", { correct_index: 4 }))).toBeNull();
    expect(cleanQuestion(mcq("প্র", { correct_index: -1 }))).toBeNull();
    expect(cleanQuestion(written("লেখো", { model_answer: " " }))).toBeNull();
    expect(cleanQuestion({ type: "essay", prompt: "x" })).toBeNull();
    expect(cleanQuestion(null)).toBeNull();
  });
  it("defaults an unknown difficulty to medium", () => {
    expect(cleanQuestion(mcq("প্র", { difficulty: "extreme" }))?.difficulty).toBe("medium");
  });
});

describe("cleanGeneratedQuestions", () => {
  it("drops repeats and keeps at most the targets", () => {
    const raw = { questions: [mcq("এক?"), mcq("এক ?"), mcq("দুই?"), mcq("তিন?"), written("লেখো"), mcq("")] };
    const r = cleanGeneratedQuestions(raw, { mcq: 2, written: 0 });
    expect(r.questions.map((q) => q.prompt)).toEqual(["এক?", "দুই?"]);
    expect(r.dropped).toBe(4);
  });
  it("handles a missing list", () => {
    expect(cleanGeneratedQuestions({}, { mcq: 5, written: 5 })).toEqual({ questions: [], dropped: 0 });
  });
});

describe("questionLanguage", () => {
  it("uses Bangla for Bangla subjects and English for English subjects", () => {
    expect(questionLanguage("bangla", "bangla-2")).toBe("bn");
    expect(questionLanguage("english_version", "bangla-1")).toBe("bn");
    expect(questionLanguage("bangla", "english-1")).toBe("en");
    expect(questionLanguage("bangla", "math")).toBe("bn");
    expect(questionLanguage("english_medium", "math")).toBe("en");
  });
});

describe("cost and timer", () => {
  it("prices Opus 5.5 tokens", () => {
    expect(aiCostUsd("claude-opus-5-5", 20_000, 15_000)).toBeCloseTo(0.38, 6);
  });
  it("counts down using the server clock", () => {
    const now = Date.parse("2026-11-25T10:00:00Z");
    expect(secondsLeft("2026-11-25T10:05:00Z", 0, now)).toBe(300);
    expect(secondsLeft("2026-11-25T10:05:00Z", 60_000, now)).toBe(240); // phone clock 1 minute slow
    expect(secondsLeft("2026-11-25T09:00:00Z", 0, now)).toBe(0);
    expect(formatClock(307)).toBe("05:07");
    expect(formatClock(-3)).toBe("00:00");
  });
});

describe("optionLetter", () => {
  it("follows the question's language, not the site's", () => {
    expect([0, 1, 2, 3].map((i) => optionLetter(i, "bn")).join("")).toBe("কখগঘ");
    expect([0, 1, 2, 3].map((i) => optionLetter(i, "en")).join("")).toBe("ABCD");
    expect(optionLetter(0, null)).toBe("ক");
  });
});
