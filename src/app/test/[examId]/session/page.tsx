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
        {/* Question Header */}
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

        {/* Question Statement */}
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

        {/* MCQ 4 Options */}
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

        {/* Numerical Input Box */}
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

      {/* Action Controls Bar */}
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

  // Active section & current question index within filtered questions
  const [activeSubject, setActiveSubject] = useState<Subject>("physics");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Candidate answers map: question_id -> CandidateAnswer
  const [candidateAnswers, setCandidateAnswers] = useState<Record<string, CandidateAnswer>>({});

  // Timer: remaining seconds
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180 * 60);
  const [timerInitialized, setTimerInitialized] = useState(false);

  // Submission modal state
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

  // Browser Exit Guard: prevent accidental tab close or page reload during active test
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

  // Granular Question & Subject Telemetry Refs (No extra re-renders per second)
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

  // Auto-Save & Upsert progress to public.test_sessions and localStorage
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

      // 1. Instant fallback in localStorage
      try {
        localStorage.setItem(
          `cbt_session_${examId}_${userId}`,
          JSON.stringify(sessionPayload)
        );
      } catch (err) {
        console.warn("Could not cache test session in localStorage:", err);
      }

      // 2. Upsert to public.test_sessions
      try {
        const { error: sessErr } = await supabase
          .from("test_sessions")
          .upsert(sessionPayload, { onConflict: "user_id,exam_id" });

        if (sessErr) {
          console.warn("Auto-save to test_sessions notice:", sessErr.message);
        }
      } catch (err) {
        console.warn("Error upserting to test_sessions:", err);
      }

      // 3. Keep public.submissions updated in parallel for backward compatibility
      try {
        await supabase
          .from("submissions")
          .update({ answers: answersToSave })
          .eq("user_id", userId)
          .eq("exam_id", examId);
      } catch (e) {
        console.warn("Submissions answers sync notice:", e);
      }
    },
    [userId, examId, supabase]
  );

  // Final Exam Submission & Evaluation
        const handleFinalSubmit = useCallback(async () => {
    if (isFinalizing.current) return;
    isFinalizing.current = true;
    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;

    if (!currentUserId) {
      setIsSubmitting(false);
      isFinalizing.current = false;
      return;
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let totalScore = 0;

    questions.forEach((q) => {
      const studentAns = candidateAnswers[q.id];

      if (!studentAns || !studentAns.selected_answer) {
        unattemptedCount++;
      } else {
        const given = String(studentAns.selected_answer).trim().toUpperCase();
        const correct = String(q.correct_answer).trim().toUpperCase();

        if (given === correct) {
          correctCount++;
          totalScore += Number(q.positive_marks || 4);
        } else {
          incorrectCount++;
          totalScore -= Number(q.negative_marks || 1);
        }
      }
    });

    const { error } = await supabase.from('submissions').upsert({
      student_id: currentUserId,
      test_id: examId,
      total_score: totalScore,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unattempted_count: unattemptedCount,
      answers: candidateAnswers,
      status: 'completed',
      submitted_at: new Date().toISOString()
    }, { onConflict: 'student_id, test_id' });

    if (error) {
      console.error("Submission error:", error.message);
      setIsSubmitting(false);
      isFinalizing.current = false;
    } else {
      router.push(`/test/${examId}/result`);
    }
  }, [userId, examId, questions, candidateAnswers, router]);
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

        // 1. Mark test_sessions as 'submitted'
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
        } catch (err) {
          console.warn("Could not mark test_session as submitted:", err);
        }

        // 2. Clear localStorage in-progress cache
        try {
          localStorage.removeItem(`cbt_session_${examId}_${userId}`);
        } catch (_) {}

        // 3. Update submissions table for result and admin analytics
        const updatePayload: Record<string, any> = {
          status: "completed",
          end_time: new Date().toISOString(),
          total_score: calculatedScore,
          answers: answersToGrade,
          question_telemetry: telemetryRef.current,
          subject_breakdown: subjectBreakdownData,
        };

        let { error: subUpdateError } = await supabase
          .from("submissions")
          .update(updatePayload)
          .eq("user_id", userId)
          .eq("exam_id", examId);

        // Safe fallback if telemetry columns not yet created in remote DB
        if (
          subUpdateError &&
          (subUpdateError.message.includes("question_telemetry") ||
            subUpdateError.message.includes("subject_breakdown"))
        ) {
          console.warn(
            "Columns not found in submissions table, saving without telemetry:",
            subUpdateError.message
          );
          const { question_telemetry, subject_breakdown, ...fallbackPayload } = updatePayload;
          await supabase
            .from("submissions")
            .update(fallbackPayload)
            .eq("user_id", userId)
            .eq("exam_id", examId);
        }

        // LocalStorage cache for instant results view
        try {
          localStorage.setItem(
            `cbt_telemetry_${examId}_${userId}`,
            JSON.stringify({
              question_telemetry: telemetryRef.current,
              subject_breakdown: subjectBreakdownData,
            })
          );
        } catch (e) {
          console.warn("Could not cache telemetry in localStorage:", e);
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

  // Load Exam, Questions, and Hydrate Session (test_sessions & submissions)
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
          .eq("exam_id", examId)
          .order("created_at", { ascending: true });

        if (!ignore && qData) {
          setQuestions(qData);

          // 1. Check if an active or submitted test_sessions entry exists
          let sessionData: any = null;
          try {
            const { data: dbSession, error: sessErr } = await supabase
              .from("test_sessions")
              .select("*")
              .eq("user_id", user.id)
              .eq("exam_id", examId)
              .maybeSingle();

            if (!sessErr && dbSession) {
              sessionData = dbSession;
            }
          } catch (e) {
            console.warn("test_sessions query notice:", e);
          }

          // Check localStorage fallback
          if (!sessionData && typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem(`cbt_session_${examId}_${user.id}`);
              if (raw) {
                sessionData = JSON.parse(raw);
              }
            } catch (e) {
              console.warn("localStorage session read notice:", e);
            }
          }

// 2. Check public.submissions for already completed exam
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

          if (subData?.question_telemetry && typeof subData.question_telemetry === "object") {
            telemetryRef.current = { ...(subData.question_telemetry as Record<string, QuestionTelemetry>) };
          }

          if (
            subData?.subject_breakdown?.subject_visit_order &&
            Array.isArray(subData.subject_breakdown.subject_visit_order)
          ) {
            subjectVisitOrderRef.current = [...subData.subject_breakdown.subject_visit_order];
          }

          // Hydrate from test_sessions if in progress
          if (sessionData && sessionData.status === "in_progress") {
            const savedSecs =
              typeof sessionData.time_remaining_seconds === "number"
                ? sessionData.time_remaining_seconds
                : examData
                ? examData.duration_minutes * 60
                : 180 * 60;

            if (savedSecs <= 0) {
              const finalAns =
                sessionData.answers && typeof sessionData.answers === "object"
                  ? (sessionData.answers as Record<string, CandidateAnswer>)
                  : {};
              await handleFinalSubmitRef.current(finalAns);
              return;
            }

            setSecondsRemaining(savedSecs);
            secondsRemainingRef.current = savedSecs;

            let hydratedAnswers: Record<string, CandidateAnswer> = {};
            if (sessionData.answers && typeof sessionData.answers === "object") {
              hydratedAnswers = { ...sessionData.answers };
            }

            if (Array.isArray(sessionData.visited)) {
              sessionData.visited.forEach((qId: string) => {
                if (!hydratedAnswers[qId]) {
                  hydratedAnswers[qId] = {
                    question_id: qId,
                    selected_answer: null,
                    status: "not_answered",
                  };
                }
              });
            }

            if (Array.isArray(sessionData.marked_for_review)) {
              sessionData.marked_for_review.forEach((qId: string) => {
                if (hydratedAnswers[qId]) {
                  hydratedAnswers[qId].status = hydratedAnswers[qId].selected_answer
                    ? "answered_and_marked_for_review"
                    : "marked_for_review";
                } else {
                  hydratedAnswers[qId] = {
                    question_id: qId,
                    selected_answer: null,
                    status: "marked_for_review",
                  };
                }
              });
            }

            setCandidateAnswers(hydratedAnswers);
            candidateAnswersRef.current = hydratedAnswers;
          } else if (subData) {
            if (subData.answers && typeof subData.answers === "object") {
              setCandidateAnswers(subData.answers as Record<string, CandidateAnswer>);
              candidateAnswersRef.current = subData.answers as Record<string, CandidateAnswer>;
            }

            // Fresh start timer calculation
            const nowTime = new Date().getTime();
            let startTimestamp = subData.start_time ? new Date(subData.start_time).getTime() : 0;
            
            if (!startTimestamp || (nowTime - startTimestamp) > (examData.duration_minutes * 60 * 1000)) {
              await supabase
                .from("submissions")
                .update({ start_time: new Date().toISOString() })
                .eq("user_id", user.id)
                .eq("exam_id", examId);
              
              startTimestamp = nowTime;
            }

            const elapsedSeconds = Math.floor((nowTime - startTimestamp) / 1000);
            const remaining = Math.max(0, examData.duration_minutes * 60 - elapsedSeconds);
            setSecondsRemaining(remaining);
            secondsRemainingRef.current = remaining;
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

  // Track telemetry on question change
  useEffect(() => {
    if (currentQuestion) {
      activateQuestionTelemetry(currentQuestion.id);
    }
  }, [currentQuestion?.id, activateQuestionTelemetry]);

  // Track subject transition sequence
  useEffect(() => {
    if (activeSubject) {
      const list = subjectVisitOrderRef.current;
      if (list.length === 0 || list[list.length - 1] !== activeSubject) {
        list.push(activeSubject);
      }
    }
  }, [activeSubject]);

  // Track visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushActiveQuestionTime();
      } else {
        activeQuestionStartRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushActiveQuestionTime();
    };
  }, [flushActiveQuestionTime]);

  // Mark current question as not_answered if it was not_visited
  const selectQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < sectionQuestions.length) {
        const targetQ = sectionQuestions[index];
        setCurrentQuestionIndex(index);

        setCandidateAnswers((prev) => {
          const qStatus = prev[targetQ.id]?.status;
          if (!qStatus || qStatus === "not_visited") {
            const updated = {
              ...prev,
              [targetQ.id]: {
                question_id: targetQ.id,
                selected_answer: null,
                status: "not_answered" as const,
              },
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

  // Countdown Timer with 15-second periodic auto-save
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

        // Auto-save progress every 15 seconds
        if (nextSecs > 0 && nextSecs % 15 === 0) {
          persistSessionProgress(candidateAnswersRef.current, nextSecs);
        }

        return nextSecs;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerInitialized, handleFinalSubmit, persistSessionProgress]);

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Action helpers called from QuestionArea
  const recordAnswerTelemetry = (
    qId: string,
    answer: string | null,
    isMarkedForReview: boolean
  ) => {
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
      telemetryRef.current[qId].answer_switches =
        (telemetryRef.current[qId].answer_switches || 0) + 1;
    }
    if (isMarkedForReview) {
      telemetryRef.current[qId].marked_for_review = true;
    }
  };

  const handleSaveAndNext = (answer: string | null) => {
    if (!currentQuestion) return;
    recordAnswerTelemetry(currentQuestion.id, answer, false);
    const newStatus: CandidateQuestionStatus = answer ? "answered" : "not_answered";
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_answer: answer,
        status: newStatus,
      },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleSaveAndMarkForReview = (answer: string | null) => {
    if (!currentQuestion) return;
    recordAnswerTelemetry(currentQuestion.id, answer, true);
    const newStatus: CandidateQuestionStatus = answer
      ? "answered_and_marked_for_review"
      : "marked_for_review";

    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_answer: answer,
        status: newStatus,
      },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const existing = candidateAnswers[currentQuestion.id]?.selected_answer ?? null;
    recordAnswerTelemetry(currentQuestion.id, existing, true);
    const newStatus: CandidateQuestionStatus = existing
      ? "answered_and_marked_for_review"
      : "marked_for_review";

    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_answer: existing,
        status: newStatus,
      },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const prevAnswer = candidateAnswers[currentQuestion.id]?.selected_answer;
    if (prevAnswer && telemetryRef.current[currentQuestion.id]) {
      telemetryRef.current[currentQuestion.id].answer_switches =
        (telemetryRef.current[currentQuestion.id].answer_switches || 0) + 1;
    }
    const clearStatus: CandidateQuestionStatus = "not_answered";
    const updated: Record<string, CandidateAnswer> = {
      ...candidateAnswers,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_answer: null,
        status: clearStatus,
      },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    persistSessionProgress(updated, secondsRemainingRef.current);
  };

  // Palette Status Counters
  const paletteStats = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredAndMarked = 0;
    let notVisited = 0;

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

  // Section Breakdown Summary for Confirmation Modal
  const sectionSummary = useMemo(() => {
    const subjects: Subject[] = ["physics", "chemistry", "mathematics"];
    return subjects.map((subj) => {
      const subjQuestions = questions.filter((q) => q.subject === subj);
      let answered = 0;
      let notAnswered = 0;
      let marked = 0;
      let notVisited = 0;

      subjQuestions.forEach((q) => {
        const state = candidateAnswers[q.id]?.status ?? "not_visited";
        if (state === "answered" || state === "answered_and_marked_for_review") {
          answered++;
        }
        if (state === "not_answered") {
          notAnswered++;
        }
        if (state === "marked_for_review" || state === "answered_and_marked_for_review") {
          marked++;
        }
        if (state === "not_visited") {
          notVisited++;
        }
      });

      return {
        subject: subj,
        total: subjQuestions.length,
        answered,
        notAnswered,
        marked,
        notVisited,
      };
    });
  }, [questions, candidateAnswers]);

  const getPaletteBadgeClass = (qId: string) => {
    const status = candidateAnswers[qId]?.status ?? "not_visited";
    switch (status) {
      case "answered":
        return "bg-emerald-600 text-white border-emerald-500";
      case "not_answered":
        return "bg-red-600 text-white border-red-500";
      case "marked_for_review":
        return "bg-purple-600 text-white border-purple-500";
      case "answered_and_marked_for_review":
        return "bg-purple-600 text-white border-purple-500 ring-2 ring-emerald-400";
      default:
        return "bg-slate-700 text-slate-200 border-slate-600";
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

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Examination Paper Empty</h2>
        <p className="text-sm text-slate-400 max-w-md">
          This examination currently has no authored questions. Please contact the administrator.
        </p>
        <button
          onClick={() => router.push("/test")}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Official Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2 truncate max-w-[280px] sm:max-w-md">
              {exam.title}
            </h1>
            <div className="text-[11px] text-slate-400">JEE (Main) Computer Based Test</div>
          </div>
        </div>

        {/* Candidate Info & Countdown Clock */}
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

          <button
            onClick={() => setPaletteOpen(!paletteOpen)}
            className="lg:hidden p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
            title="Toggle Question Palette"
          >
            {paletteOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Section Tabs Bar */}
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

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span>
            Marking: <strong className="text-emerald-400">+{exam.positive_marks}</strong> /{" "}
            <strong className="text-red-400">
              -{exam.has_negative_marking ? exam.negative_marks : 0}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Terminal Area */}
      <div className="flex-1 flex overflow-hidden">
        {currentQuestion ? (
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
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            No questions in this section.
          </div>
        )}

        {/* Right Sidebar: Question Palette */}
        {paletteOpen && (
          <aside className="w-72 sm:w-80 border-l border-slate-800 bg-slate-900/90 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Legend Counters */}
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

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="w-5 h-5 rounded bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-[10px]">
                      {paletteStats.notVisited}
                    </span>
                    <span className="text-slate-300">Not Visited</span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="w-5 h-5 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {paletteStats.marked}
                    </span>
                    <span className="text-slate-300">Marked Review</span>
                  </div>

                  <div className="col-span-2 flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="relative w-5 h-5 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {paletteStats.answeredAndMarked}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-950" />
                    </span>
                    <span className="text-slate-300">Ans. &amp; Marked Review</span>
                  </div>
                </div>
              </div>

              {/* Section Header */}
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

            {/* Bottom Final Submit Button */}
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

      {/* Submit Confirmation Modal (Prevent Accidental Submission) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Examination Submission Summary
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Please review your attempt breakdown across all sections before submitting. Once confirmed, your answers are locked and final evaluation will occur immediately.
                </p>
              </div>
            </div>

            {/* Overall Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-500">Total Qs</div>
                <div className="text-xl font-black text-white mt-0.5">{questions.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-400">Answered</div>
                <div className="text-xl font-black text-emerald-400 mt-0.5">
                  {paletteStats.answered + paletteStats.answeredAndMarked}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-center">
                <div className="text-[10px] uppercase font-bold text-red-400">Not Answered</div>
                <div className="text-xl font-black text-red-400 mt-0.5">
                  {paletteStats.notAnswered}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-center">
                <div className="text-[10px] uppercase font-bold text-purple-400">Marked Review</div>
                <div className="text-xl font-black text-purple-400 mt-0.5">
                  {paletteStats.marked + paletteStats.answeredAndMarked}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Not Visited</div>
                <div className="text-xl font-black text-slate-300 mt-0.5">
                  {paletteStats.notVisited}
                </div>
              </div>
            </div>

            {/* Detailed Progress Table */}
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 font-bold">
                  <tr>
                    <th className="py-2.5 px-3.5">Section Name</th>
                    <th className="py-2.5 px-3 text-center">Total</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Answered</th>
                    <th className="py-2.5 px-3 text-center text-red-400">Not Answered</th>
                    <th className="py-2.5 px-3 text-center text-purple-400">Marked Review</th>
                    <th className="py-2.5 px-3 text-center text-slate-400">Not Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {sectionSummary.map((sec) => (
                    <tr key={sec.subject} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3.5 capitalize font-sans font-semibold text-white">
                        {sec.subject}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-300">{sec.total}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                        {sec.answered}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-red-400">
                        {sec.notAnswered}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-400">
                        {sec.marked}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {sec.notVisited}
                      </td>
                    </tr>
                  ))}
                  {/* Overall Total Row */}
                  <tr className="bg-slate-900/80 font-bold border-t-2 border-slate-800">
                    <td className="py-2.5 px-3.5 font-sans text-white uppercase tracking-wider">
                      Overall Total
                    </td>
                    <td className="py-2.5 px-3 text-center text-white">{questions.length}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">
                      {paletteStats.answered + paletteStats.answeredAndMarked}
                    </td>
                    <td className="py-2.5 px-3 text-center text-red-400">
                      {paletteStats.notAnswered}
                    </td>
                    <td className="py-2.5 px-3 text-center text-purple-400">
                      {paletteStats.marked + paletteStats.answeredAndMarked}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {paletteStats.notVisited}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warning Callout */}
            <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold text-amber-200">
                  Are you sure you want to submit your final paper?
                </span>
                <p className="text-[11px] text-amber-300/80">
                  After clicking &quot;Confirm &amp; Submit Final Paper&quot;, your test session will be marked as submitted. No further modifications to your answers are permitted.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700/60 cursor-pointer disabled:opacity-50"
              >
                Cancel / Return to Test
              </button>

              <button
                type="button"
                onClick={() => handleFinalSubmit()}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Grading &amp; Submitting Final Paper...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Confirm &amp; Submit Final Paper</span>
                  </>
                )}
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ExamSessionContent />
    </Suspense>
  );
}
