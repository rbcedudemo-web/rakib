import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  aiCostUsd, cleanGeneratedQuestions, QUESTION_BANK_JSON_SCHEMA,
  type CleanQuestion,
} from "@rupshi/shared";

export const AI_MODEL = "claude-opus-5-5";

/** Raised with a key from the admin.qbank.error.* texts, so the page can explain it in Bangla. */
export class QuestionBankError extends Error {
  constructor(public readonly code: "noKey" | "noMaterial" | "noteTooBig" | "aiBusy" | "aiFailed" | "refused" | "tooFew") {
    super(code);
  }
}

export interface LessonMaterial {
  classLevel: number;
  subjectName: string;
  lessonTitle: string;
  description: string | null;
  language: "bn" | "en";
  transcript: string | null;
  notePdf: Buffer | null;
  targets: { mcq: number; written: number };
  writtenMarks: number;
}

export interface GeneratedBank {
  questions: CleanQuestion[];
  dropped: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const MAX_PDF_BYTES = 30 * 1024 * 1024; // the API takes up to 32 MB per request

function systemPrompt(m: LessonMaterial): string {
  const lang = m.language === "bn" ? "Bangla (standard written Bangla, as in NCTB textbooks)" : "English";
  return [
    `You are an experienced Bangladeshi school teacher who writes exam questions for Class ${m.classLevel} students following the NCTB curriculum.`,
    "You write a question bank for one video lesson of a distance-learning platform. Students take short timed exams drawn at random from this bank right after watching the lesson, and see the explanation of every answer after they submit.",
    "",
    "Rules:",
    "- Ask only about what this lesson actually teaches (the transcript and the note). Do not test facts the lesson does not cover.",
    `- Write every question, option, explanation and model answer in ${lang}.`,
    "- Each question must stand on its own; never refer to \"the video\", \"the transcript\" or \"the note\".",
    "- Cover the whole lesson, not only its first part, and do not ask the same thing twice in different words.",
    "- Mix difficulty: about 40% easy (recall), 40% medium (understanding, applying a rule to a new example), 20% hard (analysis).",
    "",
    "Multiple choice (type \"mcq\"):",
    "- Exactly 4 options, exactly one correct; correct_index is its 0-based position. Spread the correct position evenly across 0 to 3.",
    "- Wrong options must be plausible mistakes a student could make, similar in length to the right one. Never use \"all of the above\" or \"none of the above\".",
    "- explanation: one or two sentences saying why the right option is right, so a student who got it wrong learns from it.",
    "- Set model_answer and rubric to \"\".",
    "",
    `Written (type "written"), worth ${m.writtenMarks} marks each:`,
    "- Short-answer or application questions a Class student can answer in a few lines on paper.",
    "- model_answer: a complete answer that would get full marks.",
    `- rubric: how the ${m.writtenMarks} marks are split (for example: definition 1, rule 2, example 2), so a marker can give part marks.`,
    "- Set options to [] and correct_index to -1. explanation may be \"\".",
  ].join("\n");
}

function userText(m: LessonMaterial): string {
  return [
    `Subject: ${m.subjectName}. Lesson: ${m.lessonTitle}.`,
    m.description ? `Lesson summary: ${m.description}` : "",
    m.transcript ? `\nLesson transcript (what the teacher says in the video):\n<transcript>\n${m.transcript}\n</transcript>` : "",
    m.notePdf ? "\nThe lesson note is the PDF above." : "",
    "",
    `Write ${m.targets.mcq} multiple-choice questions` + (m.targets.written > 0 ? ` and ${m.targets.written} written questions.` : " and no written questions."),
  ].filter(Boolean).join("\n");
}

/** Asks Claude for a question bank. Needs ANTHROPIC_API_KEY in the hosting settings. */
export async function generateQuestionBank(m: LessonMaterial): Promise<GeneratedBank> {
  if (!process.env.ANTHROPIC_API_KEY) throw new QuestionBankError("noKey");
  if (!m.transcript && !m.notePdf) throw new QuestionBankError("noMaterial");
  if (m.notePdf && m.notePdf.byteLength > MAX_PDF_BYTES) throw new QuestionBankError("noteTooBig");

  const client = new Anthropic({ maxRetries: 2, timeout: 280_000 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (m.notePdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: m.notePdf.toString("base64") },
    });
  }
  content.push({ type: "text", text: userText(m) });

  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 48_000,
      // If a safety check wrongly declines a lesson, the API retries it on another model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: systemPrompt(m),
      messages: [{ role: "user", content }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: QUESTION_BANK_JSON_SCHEMA as unknown as Record<string, unknown> },
      },
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      throw new QuestionBankError("noKey");
    if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError)
      throw new QuestionBankError("aiBusy");
    console.error("question bank: AI request failed", err);
    throw new QuestionBankError("aiFailed");
  }

  const inputTokens = (message.usage.input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
  const outputTokens = message.usage.output_tokens ?? 0;
  const base = { model: message.model, inputTokens, outputTokens, costUsd: aiCostUsd(message.model, inputTokens, outputTokens) };

  if (message.stop_reason === "refusal") throw Object.assign(new QuestionBankError("refused"), { usage: base });

  const json = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error("question bank: answer was not JSON", message.stop_reason);
  }
  const { questions, dropped } = cleanGeneratedQuestions(parsed, m.targets);
  // An exam needs enough questions to draw from; fewer than 10 usable ones means something went wrong.
  if (questions.length < Math.min(10, m.targets.mcq + m.targets.written))
    throw Object.assign(new QuestionBankError("tooFew"), { usage: base });
  return { questions, dropped, ...base };
}

// ---------------------------------------------------------------------------
// Reading teacher-written questions from a PDF (no new questions are made).

export const EXTRACT_MODEL = "claude-sonnet-5-5";

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["prompt", "options", "correct_index", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

export interface ExtractedQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface ExtractedBank {
  questions: ExtractedQuestion[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Copies the MCQs in a teacher's PDF into JSON, exactly as written. */
export async function extractQuestionsFromPdf(pdf: Buffer): Promise<ExtractedBank> {
  if (!process.env.ANTHROPIC_API_KEY) throw new QuestionBankError("noKey");
  if (pdf.byteLength > MAX_PDF_BYTES) throw new QuestionBankError("noteTooBig");
  const client = new Anthropic({ maxRetries: 2, timeout: 280_000 });

  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: EXTRACT_MODEL,
      max_tokens: 32_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        "You copy multiple-choice questions from a teacher's PDF into JSON. Do not write, improve, translate or add questions: copy them exactly as printed, in the same language and order.",
        "- prompt: the question text without its number.",
        "- options: the option texts in order, without their letters (ক খ গ ঘ or A B C D).",
        "- correct_index: 0-based position of the answer the PDF marks as correct (an 'উত্তর' / 'Answer' line, a tick, bold or underline). Use -1 if the PDF does not say.",
        "- explanation: the PDF's explanation for that question, or \"\" if there is none.",
        "Skip anything that is not a multiple-choice question.",
      ].join("\n"),
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: "Copy every multiple-choice question in this PDF." },
        ],
      }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: EXTRACT_SCHEMA as unknown as Record<string, unknown> },
      },
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      throw new QuestionBankError("noKey");
    if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError)
      throw new QuestionBankError("aiBusy");
    console.error("pdf import: AI request failed", err);
    throw new QuestionBankError("aiFailed");
  }

  const inputTokens = (message.usage.input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
  const outputTokens = message.usage.output_tokens ?? 0;
  const base = { model: message.model, inputTokens, outputTokens, costUsd: aiCostUsd(message.model, inputTokens, outputTokens) };
  if (message.stop_reason === "refusal") throw Object.assign(new QuestionBankError("refused"), { usage: base });

  let parsed: { questions?: unknown } = {};
  try {
    parsed = JSON.parse(message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join(""));
  } catch {
    console.error("pdf import: answer was not JSON", message.stop_reason);
  }
  const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).filter(
    (q): q is ExtractedQuestion => !!q && typeof q === "object" && typeof (q as ExtractedQuestion).prompt === "string" && Array.isArray((q as ExtractedQuestion).options),
  );
  if (questions.length === 0) throw Object.assign(new QuestionBankError("tooFew"), { usage: base });
  return { questions, ...base };
}
