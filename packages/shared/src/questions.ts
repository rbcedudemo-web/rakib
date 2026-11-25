/**
 * Question bank rules shared by the AI generator, the admin editor and tests.
 * The AI is asked for JSON in QUESTION_BANK_JSON_SCHEMA; whatever comes back
 * is checked again by cleanGeneratedQuestions before it is saved.
 */

export type QuestionType = "mcq" | "written";
export type Difficulty = "easy" | "medium" | "hard";

export interface CleanQuestion {
  type: QuestionType;
  prompt: string;
  options: string[] | null; // mcq only
  correctIndex: number | null; // mcq only, 0-based
  explanation: string | null;
  modelAnswer: string | null; // written only
  rubric: string | null; // written only
  difficulty: Difficulty;
}

export const MCQ_OPTION_COUNT = 4;
export const MAX_PROMPT_CHARS = 1500;
export const MAX_OPTION_CHARS = 300;
export const MAX_TEXT_CHARS = 4000;
export const BANK_TOTAL = 36; // Guideline: 30 to 40 questions per lesson

/** How many questions of each type to ask the AI for. */
export function bankTargets(mcqCount: number, writtenCount: number): { mcq: number; written: number } {
  const written = writtenCount > 0 ? Math.min(10, Math.max(4, writtenCount * 3)) : 0;
  const mcq = mcqCount > 0 ? Math.max(mcqCount * 2, BANK_TOTAL - written) : 0;
  return { mcq: Math.min(mcq, 50), written };
}

/** JSON schema for structured output. Every field is required; unused ones are "" or -1. */
export const QUESTION_BANK_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "written"] },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer" },
          explanation: { type: "string" },
          model_answer: { type: "string" },
          rubric: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["type", "prompt", "options", "correct_index", "explanation", "model_answer", "rubric", "difficulty"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function key(prompt: string): string {
  return prompt.toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();
}

/** Checks one question. Returns null when it cannot be used. */
export function cleanQuestion(raw: unknown): CleanQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === "mcq" || r.type === "written" ? r.type : null;
  const prompt = text(r.prompt, MAX_PROMPT_CHARS);
  if (!type || !prompt) return null;
  const difficulty = DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : "medium";
  const explanation = text(r.explanation, MAX_TEXT_CHARS) || null;

  if (type === "mcq") {
    if (!Array.isArray(r.options)) return null;
    const options = r.options.map((o) => text(o, MAX_OPTION_CHARS));
    if (options.length !== MCQ_OPTION_COUNT || options.some((o) => !o)) return null;
    if (new Set(options.map(key)).size !== options.length) return null; // two options the same
    const ci = r.correct_index;
    if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= options.length) return null;
    return { type, prompt, options, correctIndex: ci, explanation, modelAnswer: null, rubric: null, difficulty };
  }
  const modelAnswer = text(r.model_answer, MAX_TEXT_CHARS);
  if (!modelAnswer) return null;
  return {
    type, prompt, options: null, correctIndex: null, explanation,
    modelAnswer, rubric: text(r.rubric, MAX_TEXT_CHARS) || null, difficulty,
  };
}

/** Cleans the AI's answer: drops broken and repeated questions, keeps at most the targets. */
export function cleanGeneratedQuestions(
  raw: unknown,
  targets: { mcq: number; written: number },
): { questions: CleanQuestion[]; dropped: number } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)
    ? ((raw as { questions: unknown[] }).questions)
    : [];
  const seen = new Set<string>();
  const out: CleanQuestion[] = [];
  const count = { mcq: 0, written: 0 };
  for (const item of list) {
    const q = cleanQuestion(item);
    if (!q) continue;
    const k = key(q.prompt);
    if (seen.has(k) || count[q.type] >= targets[q.type]) continue;
    seen.add(k);
    count[q.type]++;
    out.push(q);
  }
  return { questions: out, dropped: list.length - out.length };
}

/** Language of the questions: Bangla subjects in Bangla, English subjects in English, others follow the version. */
export function questionLanguage(version: string, subjectCode: string): "bn" | "en" {
  if (subjectCode.startsWith("bangla")) return "bn";
  if (subjectCode.startsWith("english")) return "en";
  return version === "english_version" || version === "english_medium" ? "en" : "bn";
}

/** Opus 5.5 list prices (USD per million tokens), for the AI cost log. */
export const AI_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function aiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = AI_PRICES[model] ?? AI_PRICES["claude-opus-5-5"]!;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 1e6) / 1e6;
}

/**
 * Remaining time in whole seconds (never below 0). Used by the exam timer.
 * offsetMs = server clock minus this device's clock, measured when the paper loads,
 * so a wrong phone clock cannot add time.
 */
export function secondsLeft(deadlineIso: string, offsetMs: number, clientNow = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(deadlineIso) - (clientNow + offsetMs)) / 1000));
}

/** "05:07" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
