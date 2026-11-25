/**
 * Reads many MCQs at once from text written in a fixed, teacher-friendly format
 * (typed, pasted from Word, or taken from a .docx file):
 *
 *   ১. 'পদ্ম' শব্দের উচ্চারণ কোনটি?
 *   ক) পদ্‌মো
 *   খ) পদ্দোঁ
 *   গ) পোদ্‌মো
 *   ঘ) পদমো
 *   উত্তর: খ
 *   ব্যাখ্যা: শব্দের মাঝে ম-ফলা আগের বর্ণকে দ্বিত্ব করে।
 *
 * Numbers, option letters (ক-ঘ or A-D) and the explanation are flexible; Word's
 * automatic numbering (lost when copied) is handled too. Free: no AI involved.
 */
import { cleanQuestion, MCQ_OPTION_COUNT, type CleanQuestion } from "./questions";

export type ImportError = "noPrompt" | "optionCount" | "noAnswer" | "badAnswer" | "sameOptions";

export interface ImportBlock {
  index: number; // 1-based position in the file
  prompt: string;
  options: string[];
  answer: string | null; // as written
  explanation: string;
  question: CleanQuestion | null; // ready to save
  error: ImportError | null;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const LETTERS: Record<string, number> = { "ক": 0, "খ": 1, "গ": 2, "ঘ": 3, a: 0, b: 1, c: 2, d: 3 };

const NUMBERED = /^\s*(?:প্রশ্ন|q(?:uestion)?)?\s*(?:নং|no\.?)?\s*[0-9০-৯]{1,3}\s*[.)।:\-–]\s*(.*)$/iu;
const OPTION = /^\s*[(\[]?\s*([কখগঘ]|[a-d])\s*[)\].।:\-–]\s*(.*)$/iu;
const ANSWER = /^\s*(?:সঠিক\s*)?(?:উত্তর|উঃ|উ:|answer|ans|correct(?:\s*answer)?)(?:\s*[:：ঃ\-–=]\s*|\s+)(.*)$/iu;
const EXPLAIN = /^\s*(?:ব্যাখ্যা|ব্যাখা|explanation|explain|exp)(?:\s*[:：ঃ\-–]\s*|\s+)(.*)$/iu;
// several options on one line: "ক) x  খ) y  গ) z  ঘ) w"
const INLINE_SPLIT = /\s+(?=[(\[]?\s*(?:[খগঘ]|[b-d])\s*[)\].।:]\s)/iu;

function cleanLine(s: string): string {
  return s.replace(/[ ​﻿]/g, " ").replace(/\s+/g, " ").trim();
}

function answerIndex(answer: string, options: string[]): number | null {
  const a = cleanLine(answer).replace(/^[(\[]|[)\].।]$/g, "").trim();
  const letter = a.match(/^([কখগঘ]|[a-d])(?:\s*[)\].।:\-–]|\s|$)/iu);
  if (letter) {
    const i = LETTERS[letter[1]!.toLowerCase()];
    if (i !== undefined && i < options.length) return i;
  }
  const n = toAscii(a).match(/^([1-4])(?:\D|$)/);
  if (n) return Number(n[1]) - 1;
  // the answer written out as text
  const byText = options.findIndex((o) => o.toLowerCase() === a.toLowerCase());
  return byText >= 0 ? byText : null;
}

/** Splits text into question blocks and checks each one. */
export function parseQuestionText(text: string): ImportBlock[] {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const numbered = lines.filter((l) => NUMBERED.test(l) && !OPTION.test(l)).length >= 2;

  interface Raw { head: string[]; options: string[]; answer: string | null; explanation: string[]; stage: "head" | "options" | "after" }
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  const start = (first: string) => {
    cur = { head: first ? [first] : [], options: [], answer: null, explanation: [], stage: "head" };
    raws.push(cur);
  };

  for (const line of lines) {
    const ans = line.match(ANSWER);
    const exp = line.match(EXPLAIN);
    const num = line.match(NUMBERED);
    const opt = line.match(OPTION);
    const c = cur as Raw | null;

    if (num && !opt && (numbered || !c || c.stage === "after")) {
      start(num[1]!.trim());
      continue;
    }
    if (ans && c) {
      c.answer = ans[1]!.trim();
      c.stage = "after";
      continue;
    }
    if (exp && c) {
      c.explanation.push(exp[1]!.trim());
      c.stage = "after";
      continue;
    }
    if (opt && c && c.stage !== "after") {
      for (const part of line.split(INLINE_SPLIT)) {
        const m = part.match(OPTION);
        if (m) c.options.push(m[2]!.trim());
      }
      c.stage = "options";
      continue;
    }
    // a plain line
    if (!c) start(line);
    else if (c.stage === "after") {
      // with numbered questions, extra lines belong to the explanation;
      // without numbers, a plain line after a finished question starts the next one
      if (numbered) c.explanation.push(line);
      else start(line);
    } else if (c.stage === "options") {
      // all 4 options are there and no answer line: this line is the next question
      if (c.options.length >= MCQ_OPTION_COUNT) start(line);
      else c.options[c.options.length - 1] += ` ${line}`;
    }
    else c.head.push(line);
  }

  return raws.map((r, i) => {
    let head = r.head;
    let options = r.options;
    // Word's automatic list letters are lost on copy: the last 4 plain lines are the options
    if (options.length === 0 && head.length > MCQ_OPTION_COUNT) {
      options = head.slice(-MCQ_OPTION_COUNT);
      head = head.slice(0, -MCQ_OPTION_COUNT);
    }
    const prompt = head.join("\n").trim();
    const explanation = r.explanation.join("\n").trim();
    const block: ImportBlock = { index: i + 1, prompt, options, answer: r.answer, explanation, question: null, error: null };
    if (!prompt) return { ...block, error: "noPrompt" };
    if (options.length !== MCQ_OPTION_COUNT) return { ...block, error: "optionCount" };
    if (!r.answer) return { ...block, error: "noAnswer" };
    const ci = answerIndex(r.answer, options);
    if (ci === null) return { ...block, error: "badAnswer" };
    const q = cleanQuestion({
      type: "mcq", prompt, options, correct_index: ci, explanation,
      model_answer: "", rubric: "", difficulty: "medium",
    });
    if (!q) return { ...block, error: new Set(options.map((o) => o.toLowerCase())).size < options.length ? "sameOptions" : "noPrompt" };
    return { ...block, question: q };
  });
}

/** Checks one question read by the AI from a PDF, in the same shape as the text import. */
export function importBlockFromParts(
  index: number, prompt: string, options: string[], correctIndex: number | null, explanation: string,
): ImportBlock {
  const p = cleanLine(prompt);
  const opts = options.map(cleanLine).filter(Boolean);
  const block: ImportBlock = {
    index, prompt: p, options: opts, answer: correctIndex !== null && correctIndex >= 0 ? String(correctIndex + 1) : null,
    explanation: explanation.trim(), question: null, error: null,
  };
  if (!p) return { ...block, error: "noPrompt" };
  if (opts.length !== MCQ_OPTION_COUNT) return { ...block, error: "optionCount" };
  if (correctIndex === null || correctIndex < 0) return { ...block, error: "noAnswer" };
  if (correctIndex >= opts.length) return { ...block, error: "badAnswer" };
  const q = cleanQuestion({ type: "mcq", prompt: p, options: opts, correct_index: correctIndex, explanation, model_answer: "", rubric: "", difficulty: "medium" });
  if (!q) return { ...block, error: "sameOptions" };
  return { ...block, question: q };
}
