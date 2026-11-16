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
  onAnswerChange: (ans: string | null) => void;
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
  onAnswerChange,
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

  useEffect(() => {
    setSelectedOption(question.type === "mcq" ? initialAnswer : null);
    setNumericalInput(question.type === "numerical" && initialAnswer ? initialAnswer : "");
  }, [question.id, initialAnswer, question.type]);

  const handleOptionSelect = (optKey: string) => {
    setSelectedOption(optKey);
    onAnswerChange(optKey);
  };

  const handleNumericalChange = (val: string) => {
    setNumericalInput(val);
    onAnswerChange(val.trim() || null);
  };

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
                  onClick={() => handleOptionSelect(optKey)}
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
                    onChange={() => handleOptionSelect(optKey)}
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
                onChange={(e) => handleNumericalChange(e.target.value)}
                placeholder="e.g. 24 or 3.14"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-base focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={handleClear}
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

  const telemetryRef = useRef<Record<string, QuestionTelemetry>>({});
  const activeQuestionIdRef = useRef<string | null>(null);
  const activeQuestionStartRef = useRef<number>(Date.now());
  const visitOrderCounterRef = useRef<number>(1);

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
    async (answersToSave: Record<string, CandidateAnswer>, remainingSecs: number) => {
      if (!userId || !examId || isFinalizing.current) return;
      const sessionPayload = {
        user_id: userId,
        exam_id: examId,
        status: "in_progress" as const,
        answers: answersToSave,
        time_remaining_seconds: Math.max(0, remainingSecs),
        updated_at: new Date().toISOString(),
      };
      try {
        await supabase.from("test_sessions").upsert(sessionPayload, { onConflict: "user_id,exam_id" });
      } catch (err) {}
    },
    [userId, examId, supabase]
  );

  // Instantly update answer in state when student selects an option
  const handleAnswerChange = (answer: string | null) => {
    if (!currentQuestion) return;
    const currentStatus = candidateAnswers[currentQuestion.id]?.status || "not_answered";
    const newStatus: CandidateQuestionStatus = answer ? (currentStatus === "marked_for_review" ? "answered_and_marked_for_review" : "answered") : "not_answered";

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
  };

  // Bulletproof Submission Handler
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

          subjQs.forEach((q) => {
            const qPos = Number(q.positive_marks ?? (q as any).marks ?? 4);
            const qNeg = Number(q.negative_marks ?? (q as any).negative ?? 1);
            const qCorrect = String(q.correct_answer ?? (q as any).answer ?? (q as any).correct_option ?? "").trim().toUpperCase();

            maxMarks += qPos;
            const t = telemetryRef.current[q.id];
            timeSpent += t?.time_spent_sec || 0;

            const ansObj = answersToGrade[q.id] || Object.values(answersToGrade).find((a: any) => a && a.question_id === q.id);
            const selectedAns = typeof ansObj === "string" ? ansObj : ansObj?.selected_answer;
            const isAttempted = Boolean(selectedAns !== null && selectedAns !== undefined && String(selectedAns).trim() !== "");

            if (isAttempted) {
              const given = String(selectedAns).trim().toUpperCase();
              const isCorrect = q.type === "mcq" ? given === qCorrect : String(selectedAns).trim() === qCorrect;

              if (isCorrect) {
                correct++;
                totalCorrectCount++;
                score += qPos;
                calculatedScore += qPos;
              } else {
                incorrect++;
                totalIncorrectCount++;
                if (exam?.has_negative_marking) {
                  score -= qNeg;
                  calculatedScore -= qNeg;
                }
              }
            } else {
              unattempted++;
              totalUnattemptedCount++;
            }
          });

          const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 1000) / 10 : 0;
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
        } catch (e) {}

        // 2. Insert into submissions for Admin Dashboard
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

        const { error: insErr } = await supabase.from("submissions").insert(submissionPayload);
        if (insErr) {
          console.error("Submission insert error:", insErr.message);
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
  useEffect(() => { handleFinalSubmitRef.current = handleFinalSubmit; }, [handleFinalSubmit]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!examId) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/login?redirectTo=/test/${examId}/session`);
          return;
        }
        if (!ignore) {
          setUserId(user.id);
          setUserEmail(user.email ?? "Candidate");
        }

        const { data: examData } = await supabase.from("exams").select("*").eq("id", examId).single();
        if (!ignore && examData) {
          setExam(examData);
          setSecondsRemaining(examData.duration_minutes * 60);
          secondsRemainingRef.current = examData.duration_minutes * 60;
        }

        const { data: qData } = await supabase.from("questions").select("*").or(`exam_id.eq.${examId},test_id.eq.${examId}`).order("created_at", { ascending: true });
        if (!ignore && qData) setQuestions(qData);

        const { data: subData } = await supabase.from("submissions").select("*").eq("user_id", user.id).eq("exam_id", examId).maybeSingle();
        if (subData?.status === "completed") {
          router.push(`/test/${examId}/result`);
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
          setTimerInitialized(true);
        }
      }
    }
    init();
    return () => { ignore = true; };
  }, [examId, router, supabase]);

  const sectionQuestions = useMemo(() => questions.filter((q) => q.subject === activeSubject), [questions, activeSubject]);
  const currentQuestion = sectionQuestions[currentQuestionIndex] ?? null;

  useEffect(() => {
    if (currentQuestion) activateQuestionTelemetry(currentQuestion.id);
  }, [currentQuestion?.id, activateQuestionTelemetry]);

  const selectQuestion = useCallback((index: number) => {
    if (index >= 0 && index < sectionQuestions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [sectionQuestions]);

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
        return nextSecs;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerInitialized, handleFinalSubmit]);

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSaveAndNext = (answer: string | null) => {
    handleAnswerChange(answer);
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleSaveAndMarkForReview = (answer: string | null) => {
    if (!currentQuestion) return;
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: answer, status: answer ? "answered_and_marked_for_review" as const : "marked_for_review" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const existing = candidateAnswers[currentQuestion.id]?.selected_answer ?? null;
    const updated = {
      ...candidateAnswers,
      [currentQuestion.id]: { question_id: currentQuestion.id, selected_answer: existing, status: existing ? "answered_and_marked_for_review" as const : "marked_for_review" as const },
    };
    setCandidateAnswers(updated);
    candidateAnswersRef.current = updated;
    if (currentQuestionIndex < sectionQuestions.length - 1) selectQuestion(currentQuestionIndex + 1);
  };

  const handleClearResponse = () => {
    handleAnswerChange(null);
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
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-white" />
          <h1 className="text-sm font-bold text-white">{exam?.title}</h1>
        </div>
        <div className="flex items-center gap-3 font-mono font-bold text-cyan-400">
          <Clock className="w-4 h-4" />
          <span>{formatTimer(secondsRemaining)}</span>
        </div>
      </header>

      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-1.5 flex items-center gap-2">
        {(["physics", "chemistry", "mathematics"] as Subject[]).map((subj) => (
          <button
            key={subj}
            onClick={() => { setActiveSubject(subj); setCurrentQuestionIndex(0); }}
            className={`py-1.5 px-4 rounded-lg text-xs font-bold uppercase ${activeSubject === subj ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}
          >
            {subj}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {currentQuestion && (
          <QuestionArea
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            initialAnswer={candidateAnswers[currentQuestion.id]?.selected_answer ?? null}
            onAnswerChange={handleAnswerChange}
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

        <aside className="w-72 border-l border-slate-800 bg-slate-900/90 flex flex-col justify-between p-4">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {sectionQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => selectQuestion(idx)}
                  className={`h-9 rounded-lg font-bold text-xs ${getPaletteBadgeClass(q.id)} ${currentQuestionIndex === idx ? "ring-2 ring-white" : ""}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs"
          >
            Submit Exam Paper
          </button>
        </aside>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Confirm Submission</h2>
            <p className="text-xs text-slate-400">Are you ready to submit your test? Your scores will be evaluated immediately.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
              <button onClick={() => handleFinalSubmit()} disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
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