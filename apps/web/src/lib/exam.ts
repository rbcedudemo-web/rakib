/** Shapes returned by the exam database functions (see 20261125000100_exams.sql). */

export interface ExamQuestionView {
  id: string;
  n: number;
  type: "mcq" | "written";
  prompt: string;
  options: string[] | null; // in the shuffled order shown to this student
  selected: number | null; // position in that order
  images: string[];
  marks: number;
  // after submission only
  correct: number | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  marking_status: "unanswered" | "auto" | "ai" | "pending_teacher" | "teacher" | null;
  feedback: string | null;
  explanation: string | null;
  model_answer: string | null;
}

export interface ExamAttemptView {
  id: string;
  lesson_id: string;
  attempt_no: number;
  attempt_date: string;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  now: string;
  score: number | null;
  max_score: number;
  questions: ExamQuestionView[];
}

export interface ExamHistoryRow {
  id: string;
  attempt_date: string;
  attempt_no: number;
  status: "submitted" | "expired";
  score: number | null;
  max_score: number;
  submitted_at: string | null;
  pending: boolean;
}

export interface ExamStatus {
  mcq_count: number;
  written_count: number;
  duration_minutes: number;
  mcq_marks: number;
  written_marks: number;
  bank_mcq: number;
  bank_written: number;
  attempts_used: number;
  attempts_limit: number;
  best_score: number | null;
  best_max_score: number | null;
  open_attempt_id: string | null;
  history: ExamHistoryRow[];
}

/** Questions an exam will actually have (the bank may hold fewer than the settings ask for). */
export function examSize(s: ExamStatus) {
  const mcq = Math.min(s.mcq_count, s.bank_mcq);
  const written = Math.min(s.written_count, s.bank_written);
  return { mcq, written, total: mcq + written, marks: mcq * Number(s.mcq_marks) + written * Number(s.written_marks) };
}

/** Score with at most one decimal, e.g. 7 or 7.5 */
export function scoreText(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  return String(Math.round(Number(n) * 10) / 10);
}
