/** Rows returned by the marking and report functions (migration 20261125000200). */

export interface MarkingItem {
  answer_id: string;
  attempt_id: string;
  lesson_id: string;
  subject_id: string;
  lesson_title: string;
  subject_bn: string;
  subject_en: string;
  class_id: number;
  student_name: string | null;
  student_code: string | null;
  submitted_at: string;
  prompt: string;
  model_answer: string | null;
  rubric: string | null;
  images: string[];
  max_marks: number;
  marks_awarded: number | null;
  marking_status: "pending_teacher" | "ai" | "teacher";
  feedback: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
}

export interface MyReportRow {
  lesson_id: string;
  subject_id: string;
  lesson_title: string;
  sequence: number;
  subject_bn: string;
  subject_en: string;
  attempts: number;
  best_score: number | null;
  best_max: number;
  best_percent: number | null;
  last_at: string;
  last_attempt: string;
  pending: boolean;
}

export interface OverviewRow {
  lesson_id: string;
  subject_id: string;
  lesson_title: string;
  sequence: number;
  subject_bn: string;
  subject_en: string;
  class_id: number;
  version: string;
  students: number;
  attempts: number;
  avg_best_percent: number | null;
  pending: number;
}

export interface LessonResultRow {
  student_id: string;
  student_name: string | null;
  student_code: string | null;
  attempts: number;
  best_score: number | null;
  best_max: number;
  best_percent: number | null;
  best_attempt: string;
  last_at: string;
  pending: boolean;
}

/** The marking function's error hints, as message keys. */
export const MARKING_ERRORS = ["marking.error.marks", "marking.error.notAllowed", "marking.error.running", "marking.error.notWritten"] as const;
export type MarkingError = (typeof MARKING_ERRORS)[number] | "marking.error.failed";
