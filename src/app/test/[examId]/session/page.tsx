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
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-100 text-sm sm:text-base leading-relaxed">
          <MathView math={question.question_text} />
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

  // Load Exam, Questions, and existing Submission
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
        }

        const { data: qData } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", examId)
          .order("created_at", { ascending: true });

        if (!ignore && qData) {
          setQuestions(qData);

          const { data: subData } = await supabase
            .from("submissions")
            .select("*")
            .eq("user_id", user.id)
            .eq("exam_id", examId)
            .maybeSingle();

          if (subData?.status === "completed") {
            router.push(`/test/${examId}/result`);
            return;
          }

          if (subData?.answers && typeof subData.answers === "object") {
            setCandidateAnswers(subData.answers as Record<string, CandidateAnswer>);
          }

          if (subData?.start_time && examData) {
            const elapsedSeconds = Math.floor(
              (new Date().getTime() - new Date(subData.start_time).getTime()) / 1000
            );
            const remaining = Math.max(0, examData.duration_minutes * 60 - elapsedSeconds);
            setSecondsRemaining(remaining);
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

  // Mark current question as not_answered if it was not_visited
  const selectQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < sectionQuestions.length) {
        const targetQ = sectionQuestions[index];
        setCurrentQuestionIndex(index);

        setCandidateAnswers((prev) => {
          const qStatus = prev[targetQ.id]?.status;
          if (!qStatus || qStatus === "not_visited") {
            return {
              ...prev,
              [targetQ.id]: {
                question_id: targetQ.id,
                selected_answer: null,
                status: "not_answered",
              },
            };
          }
          return prev;
        });
      }
    },
    [sectionQuestions]
  );

  const syncAnswersToDb = useCallback(
    async (updatedAnswers: Record<string, CandidateAnswer>) => {
      if (!userId || !examId) return;
      try {
        await supabase
          .from("submissions")
          .update({ answers: updatedAnswers })
          .eq("user_id", userId)
          .eq("exam_id", examId);
      } catch (e) {
        console.warn("Auto-sync error:", e);
      }
    },
    [userId, examId, supabase]
  );

  const handleFinalSubmit = useCallback(async () => {
    if (isFinalizing.current) return;
    isFinalizing.current = true;
    setIsSubmitting(true);

    try {
      if (!userId || !examId || !exam) {
        router.push(`/test/${examId}/result`);
        return;
      }

      let calculatedScore = 0;
      questions.forEach((q) => {
        const candidateResp = candidateAnswers[q.id];
        if (
          candidateResp &&
          (candidateResp.status === "answered" ||
            candidateResp.status === "answered_and_marked_for_review") &&
          candidateResp.selected_answer
        ) {
          const isCorrect =
            q.type === "mcq"
              ? candidateResp.selected_answer.trim().toUpperCase() ===
                q.correct_answer.trim().toUpperCase()
              : candidateResp.selected_answer.trim() === q.correct_answer.trim();

          if (isCorrect) {
            calculatedScore += q.positive_marks ?? 4;
          } else {
            if (exam.has_negative_marking) {
              calculatedScore -= q.negative_marks ?? 1;
            }
          }
        }
      });

      await supabase
        .from("submissions")
        .update({
          status: "completed",
          end_time: new Date().toISOString(),
          total_score: calculatedScore,
          answers: candidateAnswers,
        })
        .eq("user_id", userId)
        .eq("exam_id", examId);

      router.push(`/test/${examId}/result`);
    } catch (err) {
      console.error("Submission error:", err);
      router.push(`/test/${examId}/result`);
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, examId, exam, questions, candidateAnswers, supabase, router]);

  // Countdown Timer
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
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, timerInitialized, handleFinalSubmit]);

  const formatTimer = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Action helpers called from QuestionArea
  const handleSaveAndNext = (answer: string | null) => {
    if (!currentQuestion) return;
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
    syncAnswersToDb(updated);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleSaveAndMarkForReview = (answer: string | null) => {
    if (!currentQuestion) return;
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
    syncAnswersToDb(updated);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const existing = candidateAnswers[currentQuestion.id]?.selected_answer ?? null;
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
    syncAnswersToDb(updated);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      selectQuestion(currentQuestionIndex + 1);
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
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
    syncAnswersToDb(updated);
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

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Confirm Final Submission</h2>
              <p className="text-xs text-slate-400">
                Please review your exam attempt summary before submitting.
              </p>
            </div>

            {/* Attempt Summary */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-slate-300">
                <span>Total Questions in Paper:</span>
                <span className="font-bold text-white">{questions.length}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-emerald-400">
                <span>Answered:</span>
                <span className="font-bold">{paletteStats.answered}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-red-400">
                <span>Not Answered:</span>
                <span className="font-bold">{paletteStats.notAnswered}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-purple-400">
                <span>Marked for Review:</span>
                <span className="font-bold">
                  {paletteStats.marked + paletteStats.answeredAndMarked}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 text-slate-400">
                <span>Not Visited:</span>
                <span className="font-bold">{paletteStats.notVisited}</span>
              </div>
            </div>

            <div className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Once submitted, you will not be able to change your answers. Your scorecard will be
                generated immediately.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Return to Exam
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Calculating Score...</span>
                  </>
                ) : (
                  <span>Submit Final Exam</span>
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
