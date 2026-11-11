export type Subject = "physics" | "chemistry" | "mathematics";

export type QuestionType = "mcq" | "numerical";

export interface Exam {
  id: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  total_marks: number;
  positive_marks: number;
  negative_marks: number;
  has_negative_marking: boolean;
  is_active: boolean;
  created_at?: string;
  questions_count?: number;
}

export interface Question {
  id: string;
  exam_id: string;
  subject: Subject;
  type: QuestionType;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation?: string | null;
  positive_marks: number;
  negative_marks: number;
  order_index?: number;
  created_at?: string;
}

export interface Profile {
  id: string;
  role: "admin" | "candidate";
  full_name?: string | null;
  email?: string | null;
  created_at?: string;
}

export type CandidateQuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked_for_review";

export interface CandidateAnswer {
  question_id: string;
  selected_answer: string | null;
  status: CandidateQuestionStatus;
}

export interface Submission {
  id: string;
  user_id: string;
  exam_id: string;
  status: "in_progress" | "completed";
  start_time: string;
  end_time?: string | null;
  total_score?: number | null;
  answers: Record<string, CandidateAnswer>;
  created_at?: string;
  exams?: Exam;
}

