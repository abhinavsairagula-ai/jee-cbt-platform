"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Exam,
  Question,
  Subject,
  CandidateQuestionStatus,
  CandidateAnswer,
  QuestionTelemetry,
  SubjectBreakdown,
} from "@/types/database";
import MathView from "@/components/MathView";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Shield,
  RotateCcw,
  Flag,
  Send,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

interface QuestionAreaProps {
  question: Question;
  questionNumber: number;
  initialAnswer: string | null;
  onSaveAndNext: (ans: string | null) => void;
  onSaveAndMarkForReview: (ans: string | null) => void;
  onMarkForReviewAndNext: () => void;
  onClearResponse: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function QuestionArea({
  question,
  questionNumber,
  initialAnswer,
  onSaveAndNext,
  onSaveAndMarkForReview,
  onMarkForReviewAndNext,
  onClearResponse,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: QuestionAreaProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    question.type === "mcq" ? initialAnswer : null
  );
  const [numericalInput, setNumericalInput] = useState<string>(
    question.type === "numerical" && initialAnswer ? initialAnswer : ""
  );

  const getCurrentAnswer = () => {
    if (question.type === "mcq") return selectedOption;
    return numericalInput.trim() || null;
  };

  const handleClear = () => {
    setSelectedOption(null);
    setNumericalInput("");
    onClearResponse();
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 bg-slate-950">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
              Question {questionNumber}
            </span>
            <span className="text-xs uppercase font-semibold text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              {question.type === "mcq" ? "Single Choice MCQ" : "Numerical Value"}
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Section: <span className="capitalize font-bold text-white">{question.subject}</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-100 text-sm sm:text-base leading-relaxed space-y-4">
          <MathView math={question.question_text} />
          {question.image_url && (
            <div className="pt-2">
              <img
                src={question.image_url}
                alt="Question Diagram"
                className="max-h-80 max-w-full rounded-xl border border-slate-800 bg-white/5 object-contain"
              />
            </div>
          )}
        </div>

        {question.type === "mcq" && question.options && (
          <div className="space-y-3 pt-2">
            {(["A", "B", "C", "D"] as const).map((optKey, idx) => {
              const optText = question.options![idx];
              const isChecked = selectedOption === optKey;

              return (
                <label
                  key={optKey}
                  onClick={() => setSelectedOption(optKey)}
                  className={`p-3.5 sm:p-4 rounded-xl border text-sm flex items-start gap-3.5 transition cursor-pointer ${
                    isChecked
                      ? "bg-blue-600/15 border-blue-500 text-white ring-1 ring-blue-500"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    value={optKey}
                    checked={isChecked}
                    onChange={() => setSelectedOption(optKey)}
                    className="mt-1 w-4 h-4 text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex-1">
                    <span className="font-bold mr-2 text-slate-400">({optKey})</span>
                    <MathView math={optText} />
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {question.type === "numerical" && (
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3 max-w-md">
            <label className="text-xs font-semibold text-slate-300">
              Enter Numerical Answer (Integer or Decimal):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={numericalInput}
                onChange={(e) => setNumericalInput(e.target.value)}
                placeholder="e.g. 24 or 3.14"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-base focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setNumericalInput("")}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800/80 pt-4 mt-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSaveAndNext(getCurrentAnswer())}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
            >
              Save &amp; Next
            </button>

            <button
              type="button"
              onClick={() => onSaveAndMarkForReview(getCurrentAnswer())}
              className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs transition active:scale-[0.98] cursor-pointer"
            >
              Save &amp; Mark for Review
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Response</span>
            </button>

            <button
              type="button"
              onClick={onMarkForReviewAndNext}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <Flag className="w-3.5 h-3.5 text-purple-400" />
              <span>Mark for Review &amp; Next</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              title="Previous Question"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition cursor-pointer"
              title="Next Question"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamSessionContent() {
  const params = useParams();
  const examId = params?.examId as string;
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userEmail, setUserEmail] = useState<string>("Candidate");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeSubject, setActiveSubject] = useState<Subject>("physics");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [candidateAnswers, setCandidateAnswers] = useState<Record<string, CandidateAnswer>>({});

  const [secondsRemaining, setSecondsRemaining] = useState<number>(180 * 60);
  const [timerInitialized, setTimerInitialized] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);

  const isFinalizing = useRef(false);
  const candidateAnswersRef = useRef<Record<string, CandidateAnswer>>({});
  const secondsRemainingRef = useRef<number>(180 * 60);

  useEffect(() => {
    candidateAnswersRef.current = candidateAnswers;
  }, [candidateAnswers]);

  useEffect(() => {
    secondsRemainingRef.current = secondsRemaining;
  }, [secondsRemaining]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isFinalizing.current && !isSubmitting) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isSubmitting]);

  const telemetryRef = useRef<Record<string, QuestionTelemetry>>({});
  const activeQuestionIdRef = useRef<string | null>(null);
  const activeQuestionStartRef = useRef<number>(Date.now());
  const visitOrderCounterRef = useRef<number>(1);
  const subjectVisitOrderRef = useRef<string[]>([]);

  const flushActiveQuestionTime = useCallback(() => {
    const qId = activeQuestionIdRef.current;
    if (qId && activeQuestionStartRef.current) {
      const elapsed = Math.max(0, Math.round((Date.now() - activeQuestionStartRef.current) / 1000));
      if (elapsed > 0) {
        if (!telemetryRef.current[qId]) {
          telemetryRef.current[qId] = {
            question_id: qId,
            time_spent_sec: 0,
            visit_count: 1,
            first_visited_order: visitOrderCounterRef.current++,
            answer_switches: 0,
            marked_for_review: false,
          };
        }
        telemetryRef.current[qId].time_spent_sec =
          (telemetryRef.current[qId].time_spent_sec || 0) + elapsed;
      }
      activeQuestionStartRef.current = Date.now();
    }
  }, []);

  const activateQuestionTelemetry = useCallback(
    (qId: string) => {
      flushActiveQuestionTime();

      if (!telemetryRef.current[qId]) {
        telemetryRef.current[qId] = {
          question_id: qId,
          time_spent_sec: 0,
          visit_count: 0,
          first_visited_order: visitOrderCounterRef.current++,
          answer_switches: 0,
          marked_for_review: false,
        };
      }

      telemetryRef.current[qId].visit_count = (telemetryRef.current[qId].visit_count || 0) + 1;
      activeQuestionIdRef.current = qId;
      activeQuestionStartRef.current = Date.now();
    },
    [flushActiveQuestionTime]
  );

  const persistSessionProgress = useCallback(
    async (
      answersToSave: Record<string, CandidateAnswer>,
      remainingSecs: number
    ) => {
      if (!userId || !examId || isFinalizing.current) return;

      const markedList: string[] = [];
      const visitedList: string[] = [];

      Object.values(answersToSave).forEach((ans) => {
        if (ans.status !== "not_visited") {
          visitedList.push(ans.question_id);
        }
        if (
          ans.status === "marked_for_review" ||
          ans.status === "answered_and_marked_for_review"
        ) {
          markedList.push(ans.question_id);
        }
      });

      const sessionPayload = {
        user_id: userId,
        exam_id: examId,
        status: "in_progress" as const,
        answers: answersToSave,
        marked_for_review: markedList,
        visited: visitedList,
        time_remaining_seconds: Math.max(0, remainingSecs),
        updated_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem(
          `cbt_session_${examId}_${userId}`,
          JSON.stringify(sessionPayload)
        );
      } catch (err) {}

      try {
        await supabase
          .from("test_sessions")
          .upsert(sessionPayload, { onConflict: "user_id,exam_id" });
      } catch (err) {}
    },
    [userId, examId, supabase]
  );

  // Bulletproof Final Exam Submission with Column Fallbacks
  const handleFinalSubmit = useCallback(
    async (forcedAnswers?: Record<string, CandidateAnswer>) => {
      if (isFinalizing.current) return;
      isFinalizing.current = true;
      setIsSubmitting(true);
      flushActiveQuestionTime();

      try {
        const answersToGrade = forcedAnswers || candidateAnswersRef.current;
        const subjects: Subject[] = ["physics", "chemistry", "mathematics"];
        const subjectBreakdownData: Record<string, SubjectBreakdown> = {};
        let calculatedScore = 0;
        let totalCorrectCount = 0;
        let totalIncorrectCount = 0;
        let totalUnattemptedCount = 0;

        subjects.forEach((subj) => {
          const subjQs = questions.filter((q) => q.subject === subj);
          let score = 0;
          let correct = 0;
          let incorrect = 0;
          let unattempted = 0;
          let timeSpent = 0;
          let maxMarks = 0;

          subjQs.forEach((q, qIdx) => {
            const qPosMarks = Number(q.positive_marks ?? (q as any).marks ?? 4);
            const qNegMarks = Number(q.negative_marks ?? (q as any).negative ?? 1);
            const qCorrectAns = String(q.correct_answer ?? (q as any).answer ?? (q as any).correct_option ?? "").trim().toUpperCase();

            maxMarks += qPosMarks;
            const t = telemetryRef.current[q.id];
            timeSpent += t?.time_spent_sec || 0;

            const ansObj = answersToGrade[q.id] || answersToGrade[q.order_index ?? -1] || Object.values(answersToGrade).find((a: any) => a && a.question_id === q.id);
            const selectedAns = typeof ansObj === "string" ? ansObj : ansObj?.selected_answer;
            const isAttempted = Boolean(selectedAns !== null && selectedAns !== undefined && String(selectedAns).trim() !== "");

            if (isAttempted && selectedAns !== null && selectedAns !== undefined) {
              const given = String(selectedAns).trim().toUpperCase();
              const isCorrect =
                q.type === "mcq"
                  ? given === qCorrectAns
                  : String(selectedAns).trim() === qCorrectAns;

              if (isCorrect) {
                correct++;
                totalCorrectCount++;
                score += qPosMarks;
                calculatedScore += qPosMarks;
              } else {
                incorrect++;
                totalIncorrectCount++;
                const neg = exam?.has_negative_marking ? qNegMarks : 0;
                score -= neg;
                calculatedScore -= neg;
              }
            } else {
              unattempted++;
              totalUnattemptedCount++;
            }
          });

          const accuracy =
            correct + incorrect > 0
              ? Math.round((correct / (correct + incorrect)) * 1000) / 10
              : 0;

          subjectBreakdownData[subj] = {
            subject: subj,
            score,
            max_marks: maxMarks,
            correct,
            incorrect,
            unattempted,
            accuracy,
            time_spent_sec: timeSpent,
          };
        });

        // 1. Mark test_sessions as submitted
        try {
          await supabase.from("test_sessions").upsert(
            {
              user_id: userId,
              exam_id: examId,
              status: "submitted",
              answers: answersToGrade,
              time_remaining_seconds: 0,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,exam_id" }
          );
        } catch (err) {}

        try {
          localStorage.removeItem(`cbt_session_${examId}_${userId}`);
        } catch (_) {}

        // 2. Insert into submissions for Admin Leaderboard
        try {
          await supabase.from("submissions").delete().match({ user_id: userId, exam_id: examId });
        } catch (e) {}

        const submissionPayload = {
          user_id: userId,
          exam_id: examId,
          student_id: userId,
          test_id: examId,
          status: "completed",
          end_time: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: calculatedScore,
          correct_count: totalCorrectCount,
          incorrect_count: totalIncorrectCount,
          unattempted_count: totalUnattemptedCount,
          answers: answersToGrade,
          question_telemetry: telemetryRef.current,
          subject_breakdown: subjectBreakdownData,
        };

        const { error: insertErr } = await supabase.from("submissions").insert(submissionPayload);
        if (insertErr) {
          const { question_telemetry, subject_breakdown, ...fallback } = submissionPayload;
          await supabase.from("submissions").insert(fallback);
        }

        router.push(`/test/${examId}/result`);
      } catch (err) {
        console.error("Submission error:", err);
        router.push(`/test/${examId}/result`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, examId, exam, questions, supabase, router, flushActiveQuestionTime]
  );

  const handleFinalSubmitRef = useRef(handleFinalSubmit);
  useEffect(() => {
    handleFinalSubmitRef.current = handleFinalSubmit;
  }, [handleFinalSubmit]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!examId) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/login?redirectTo=/test/${examId}/session`);
          return;
        }

        if (!ignore) {
          setUserId(user.id);
          setUserEmail(user.email ?? "Candidate");
        }

        const { data: examData } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (!ignore && examData) {
          setExam(examData);
          setSecondsRemaining(examData.duration_minutes * 60);
          secondsRemainingRef.current = examData.duration_minutes * 60;
        }

        const { data: qData } = await supabase
          .from("questions")
          .select("*")
          .or(`exam_id.eq.${examId},test_id.eq.${examId}`)
          .order("created_at", { ascending: true });

        if (!ignore && qData) {
          setQuestions(qData);

          let sessionData: any = null;
          try {
            const { data: dbSession } = await supabase
              .from("test_sessions")
              .select("*")
              .eq("user_id", user.id)
              .eq("exam_id", examId)
              .maybeSingle();

            if (dbSession) sessionData = dbSession;
          } catch (e) {}

          if (!sessionData && typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem(`cbt_session_${examId}_${user.id}`);
              if (raw) sessionData = JSON.parse(raw);
            } catch (e) {}
          }

          const { data: subData } = await supabase
            .from("submissions")
            .select("*")
            .eq("user_id", user.id)
            .eq("exam_id", examId)
            .maybeSingle();

          if (sessionData?.status === "submitted" || subData?.status === "completed") {
            router.push(`/test/${examId}/result`);
            return;
          }

          if (sessionData && sessionData.status === "in_progress") {
            const savedSecs = sessionData.time_remaining_seconds ?? (examData ? examData.duration_minutes * 60 : 10800);
            if (savedSecs <= 0) {
              await handleFinalSubmitRef.current(sessionData.answers || {});
              return;
            }
            setSecondsRemaining(savedSecs);
            secondsRemainingRef.current = savedSecs;
            setCandidateAnswers(sessionData.answers || {});
            candidateAnswersRef.current = sessionData.answers || {};
          }
        }
      } catch (err) {
        console.error("Session init error:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
          setTimerInitialized(true);
        }
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, [examId, router, supabase]);

  const sectionQuestions = useMemo(() => {
    return questions.filter((q) => q.subject === activeSubject);
  }, [questions, activeSubject]);

  const currentQuestion = sectionQuestions[currentQuestionIndex] ?? null;

  useEffect(() => {
    if (currentQuestion) activateQuestionTelemetry(currentQuestion.id);
  }, [currentQuestion?.id, activateQuestionTelemetry]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) flushActiveQuestionTime();
      else activeQuestionStartRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushActiveQuestionTime();
    };
  }, [flushActiveQuestionTime]);

  const selectQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < sectionQuestions.length) {
        const targetQ = sectionQuestions[index];
        setCurrentQuestionIndex(index);
        setCandidateAnswers((prev) => {
          if (!prev[targetQ.id]) {
            const updated = {
              ...prev,
              [targetQ.id]: { question_id: targetQ.id, selected_answer: null, status: "not_answered" as const },
            };
            candidateAnswersRef.current = updated;
            persistSessionProgress(updated, secondsRemainingRef.current);
            return updated;
          }
          return prev;
        });
      }
    },
    [sectionQuestions, persistSessionProgress]
  );

  useEffect(() => {
    if (!timerInitialized) return;
    if (secondsRemaining <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        const nextSecs = prev - 1;
        secondsRemainingRef.current = nextSecs;
        if (nextSecs % 15 === 0) persistSessionProgress(candidateAnswersRef.current, nextSecs);
        return nextSecs;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerInitialized, handleFinalSubmit, persistSessionProgress]);

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const recordAnswerTelemetry = (qId: string, answer: string | null, isMarked: boolean) => {
    const prevAnswer = candidateAnswers[qId]?.selected_answer;
    if (!telemetryRef.current[qId]) {
      telemetryRef.current[qId] = {
        question_id: qId,
        time_spent_sec: 0,
        visit_count: 1,
        first_visited_order: visitOrderCounterRef.current++,
        answer_switches: 0,
        marked_for_review: false,
      };
    }
    if (prevAnswer && answer && prevAnswer !== answer) {
      telemetryRef.current[qId].answer_switches = (telemetryRef.current[qId].answer_switches || 0) + 1;
    }
    if (isMarked) telemetryRef.current[qId].marked_for_review = true;
  };

  const handleSaveAndNext = (answer: string | null) => {
    if (!currentQuestion) return;
    recordAnswerTelemetry(currentQuestion.id, answer, false);
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: answer, status: answer ? "answered" as const : "not_answered" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleSaveAndMarkForReview = (answer: string | null) => {
    if (!currentQuestion) return;
    recordAnswerTelemetry(currentQuestion.id, answer, true);
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: answer, status: answer ? "answered_and_marked_for_review" as const : "marked_for_review" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const existing = candidateAnswers[currentQuestion.id]?.selected_answer ?? null;
    recordAnswerTelemetry(currentQuestion.id, existing, true);
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: existing, status: existing ? "answered_and_marked_for_review" as const : "marked_for_review" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: null, status: "not_answered" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);
  };

  const paletteStats = useMemo(() => {
    let answered = 0, notAnswered = 0, marked = 0, answeredAndMarked = 0, notVisited = 0;
    questions.forEach((q) => {
      const state = candidateAnswers[q.id]?.status ?? "not_visited";
      if (state === "answered") answered++;
      else if (state === "not_answered") notAnswered++;
      else if (state === "marked_for_review") marked++;
      else if (state === "answered_and_marked_for_review") answeredAndMarked++;
      else notVisited++;
    });
    return { answered, notAnswered, marked, answeredAndMarked, notVisited };
  }, [questions, candidateAnswers]);

  const sectionSummary = useMemo(() => {
    const subjects: Subject[] = ["physics", "chemistry", "mathematics"];
    return subjects.map((subj) => {
      const subjQs = questions.filter((q) => q.subject === subj);
      let answered = 0, notAnswered = 0, marked = 0, notVisited = 0;
      subjQs.forEach((q) => {
        const state = candidateAnswers[q.id]?.status ?? "not_visited";
        if (state === "answered" || state === "answered_and_marked_for_review") answered++;
        if (state === "not_answered") notAnswered++;
        if (state === "marked_for_review" || state === "answered_and_marked_for_review") marked++;
        if (state === "not_visited") notVisited++;
      });
      return { subject: subj, total: subjQs.length, answered, notAnswered, marked, notVisited };
    });
  }, [questions, candidateAnswers]);

  const getPaletteBadgeClass = (qId: string) => {
    const status = candidateAnswers[qId]?.status ?? "not_visited";
    switch (status) {
      case "answered": return "bg-emerald-600 text-white border-emerald-500";
      case "not_answered": return "bg-red-600 text-white border-red-500";
      case "marked_for_review": return "bg-purple-600 text-white border-purple-500";
      case "answered_and_marked_for_review": return "bg-purple-600 text-white border-purple-500 ring-2 ring-emerald-400";
      default: return "bg-slate-700 text-slate-200 border-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Entering CBT Environment...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2 truncate max-w-[280px] sm:max-w-md">
              {exam?.title}
            </h1>
            <div className="text-[11px] text-slate-400">JEE (Main) Computer Based Test</div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] truncate max-w-[180px]">{userEmail}</span>
          </div>

          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm sm:text-base font-bold transition shadow-inner ${
              secondsRemaining < 300
                ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                : "bg-slate-950 text-cyan-400 border-slate-800"
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          {(["physics", "chemistry", "mathematics"] as Subject[]).map((subj) => {
            const count = questions.filter((q) => q.subject === subj).length;
            const isSelected = activeSubject === subj;

            return (
              <button
                key={subj}
                onClick={() => {
                  setActiveSubject(subj);
                  setCurrentQuestionIndex(0);
                }}
                className={`py-1.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80"
                }`}
              >
                <span>{subj}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {currentQuestion && (
          <QuestionArea
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            initialAnswer={candidateAnswers[currentQuestion.id]?.selected_answer ?? null}
            onSaveAndNext={handleSaveAndNext}
            onSaveAndMarkForReview={handleSaveAndMarkForReview}
            onMarkForReviewAndNext={handleMarkForReviewAndNext}
            onClearResponse={handleClearResponse}
            onPrev={() => selectQuestion(currentQuestionIndex - 1)}
            onNext={() => selectQuestion(currentQuestionIndex + 1)}
            hasPrev={currentQuestionIndex > 0}
            hasNext={currentQuestionIndex < sectionQuestions.length - 1}
          />
        )}

        {paletteOpen && (
          <aside className="w-72 sm:w-80 border-l border-slate-800 bg-slate-900/90 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="p-4 space-y-5">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Question Palette Status
                </h3>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {paletteStats.answered}
                    </span>
                    <span className="text-slate-300">Answered</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="w-5 h-5 rounded bg-red-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {paletteStats.notAnswered}
                    </span>
                    <span className="text-slate-300">Not Answered</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="text-xs font-bold text-white capitalize mb-2.5">
                  {activeSubject} Section Questions:
                </div>
                <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                  {sectionQuestions.map((q, idx) => {
                    const isSelected = currentQuestionIndex === idx;
                    const badgeClass = getPaletteBadgeClass(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => selectQuestion(idx)}
                        className={`h-9 rounded-lg font-bold text-xs flex items-center justify-center transition border cursor-pointer ${badgeClass} ${
                          isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/70">
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Exam Paper</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Confirm Submission</h2>
            <p className="text-xs text-slate-400">Are you ready to submit your exam paper and view your scorecard?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalSubmit()}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                {isSubmitting ? "Submitting..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamSessionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <ExamSessionContent />
    </Suspense>
  );
}