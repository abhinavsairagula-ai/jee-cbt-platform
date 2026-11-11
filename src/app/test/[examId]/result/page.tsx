"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam, Question, Subject, Submission, CandidateAnswer } from "@/types/database";
import MathView from "@/components/MathView";
import {
  GraduationCap,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Home,
  RotateCcw,
  Atom,
  FlaskConical,
  Calculator,
  ChevronDown,
  ChevronUp,
  Percent,
  Target,
} from "lucide-react";

interface SubjectStats {
  subject: Subject;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  maxScore: number;
}

function ExamResultContent() {
  const params = useParams();
  const examId = params?.examId as string;
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [userEmail, setUserEmail] = useState<string>("Candidate");
  const [loading, setLoading] = useState(true);

  // Toggle for question review solutions
  const [showQuestionReview, setShowQuestionReview] = useState(false);
  const [filterSubject, setFilterSubject] = useState<"all" | Subject>("all");

  useEffect(() => {
    let ignore = false;
    async function loadResults() {
      if (!examId) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/login?redirectTo=/test/${examId}/result`);
          return;
        }

        if (!ignore) {
          setUserEmail(user.email ?? "Candidate");
        }

        // Fetch Exam
        const { data: examData } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (!ignore && examData) setExam(examData);

        // Fetch Questions
        const { data: qData } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", examId)
          .order("created_at", { ascending: true });

        if (!ignore && qData) setQuestions(qData);

        // Fetch Submission
        const { data: subData } = await supabase
          .from("submissions")
          .select("*")
          .eq("user_id", user.id)
          .eq("exam_id", examId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!ignore && subData) {
          setSubmission(subData as Submission);
        }
      } catch (err) {
        console.error("Error loading scorecard:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadResults();
    return () => {
      ignore = true;
    };
  }, [examId, router, supabase]);

  // Analytics Calculation
  const { subjectStats, totalCorrect, totalIncorrect, totalAttempted, calculatedScore, accuracy } =
    useMemo(() => {
      const answers = (submission?.answers ?? {}) as Record<string, CandidateAnswer>;
      const subjects: Subject[] = ["physics", "chemistry", "mathematics"];

      let overallCorrect = 0;
      let overallIncorrect = 0;
      let overallAttempted = 0;
      let overallScore = 0;

      const stats: SubjectStats[] = subjects.map((subj) => {
        const subjQuestions = questions.filter((q) => q.subject === subj);
        let sCorrect = 0;
        let sIncorrect = 0;
        let sAttempted = 0;
        let sScore = 0;

        subjQuestions.forEach((q) => {
          const ans = answers[q.id];
          const isAnswered =
            ans &&
            (ans.status === "answered" || ans.status === "answered_and_marked_for_review") &&
            ans.selected_answer;

          if (isAnswered) {
            sAttempted++;
            overallAttempted++;

            const isCorrect =
              q.type === "mcq"
                ? ans.selected_answer?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()
                : ans.selected_answer?.trim() === q.correct_answer.trim();

            if (isCorrect) {
              sCorrect++;
              overallCorrect++;
              sScore += q.positive_marks ?? 4;
              overallScore += q.positive_marks ?? 4;
            } else {
              sIncorrect++;
              overallIncorrect++;
              const neg = exam?.has_negative_marking ? q.negative_marks ?? 1 : 0;
              sScore -= neg;
              overallScore -= neg;
            }
          }
        });

        const sMaxScore = subjQuestions.reduce((acc, q) => acc + (q.positive_marks ?? 4), 0);

        return {
          subject: subj,
          total: subjQuestions.length,
          attempted: sAttempted,
          correct: sCorrect,
          incorrect: sIncorrect,
          score: sScore,
          maxScore: sMaxScore,
        };
      });

      const acc =
        overallAttempted > 0 ? Math.round((overallCorrect / overallAttempted) * 100) : 0;

      return {
        subjectStats: stats,
        totalCorrect: overallCorrect,
        totalIncorrect: overallIncorrect,
        totalAttempted: overallAttempted,
        calculatedScore: overallScore,
        accuracy: acc,
      };
    }, [questions, submission, exam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Computing CBT Scorecard &amp; Solutions...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Scorecard Not Available</h2>
        <Link href="/test" className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
          Return to Portal
        </Link>
      </div>
    );
  }

  const filteredReviewQuestions =
    filterSubject === "all" ? questions : questions.filter((q) => q.subject === filterSubject);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Official Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                JEE (Main) Official Scorecard
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Verified CBT Result
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                National Testing Agency • Candidate Result Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/test"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>All Exams</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Scorecard View */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8 my-4">
        {/* Exam Title & Candidate Info Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Examination Paper Completed
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">{exam.title}</h2>
              <div className="text-xs text-slate-400 mt-1 font-mono">Candidate: {userEmail}</div>
            </div>

            {/* Score Highlight Badge */}
            <div className="flex items-baseline gap-2 p-4 rounded-2xl bg-slate-950 border border-slate-800 shrink-0 text-center sm:text-right">
              <div>
                <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  Total Score
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400">
                  {calculatedScore}
                  <span className="text-base text-slate-500 font-normal"> / {exam.total_marks}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Duration: {exam.duration_minutes} Mins</span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Marking: +{exam.positive_marks} / -{exam.negative_marks}</span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>Total Questions: {questions.length}</span>
            </div>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Accuracy */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Accuracy</span>
              <Percent className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white">{accuracy}%</div>
            <div className="text-[11px] text-slate-500">Correct / Attempted</div>
          </div>

          {/* Attempted */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Attempted</span>
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-cyan-400">
              {totalAttempted}
              <span className="text-sm text-slate-500 font-normal"> / {questions.length}</span>
            </div>
            <div className="text-[11px] text-slate-500">Questions Answered</div>
          </div>

          {/* Correct */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Correct</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">{totalCorrect}</div>
            <div className="text-[11px] text-slate-500">Right Responses</div>
          </div>

          {/* Incorrect */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Incorrect</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-3xl font-black text-red-400">{totalIncorrect}</div>
            <div className="text-[11px] text-slate-500">Wrong Responses</div>
          </div>
        </div>

        {/* Subject-Wise Performance Table */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Subject-Wise Performance Breakdown</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-3 text-center">Total Questions</th>
                  <th className="py-3 px-3 text-center">Attempted</th>
                  <th className="py-3 px-3 text-center">Correct</th>
                  <th className="py-3 px-3 text-center">Incorrect</th>
                  <th className="py-3 px-4 text-right">Section Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {subjectStats.map((stat) => {
                  const Icon =
                    stat.subject === "physics"
                      ? Atom
                      : stat.subject === "chemistry"
                      ? FlaskConical
                      : Calculator;

                  const color =
                    stat.subject === "physics"
                      ? "text-cyan-400"
                      : stat.subject === "chemistry"
                      ? "text-emerald-400"
                      : "text-indigo-400";

                  return (
                    <tr key={stat.subject} className="hover:bg-slate-950/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white capitalize flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span>{stat.subject}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-300">
                        {stat.total}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-300">
                        {stat.attempted}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-emerald-400 font-bold">
                        {stat.correct}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-red-400 font-bold">
                        {stat.incorrect}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        <span className={stat.score >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {stat.score > 0 ? `+${stat.score}` : stat.score}
                        </span>
                        <span className="text-slate-500 font-normal"> / {stat.maxScore}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Question Solutions & Review Collapsible Section */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <span>Question Review &amp; Step-by-Step Solutions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect question statements, correct answers, your responses, and mathematical explanations.
              </p>
            </div>

            <button
              onClick={() => setShowQuestionReview(!showQuestionReview)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <span>{showQuestionReview ? "Hide Solutions" : "Review All Questions"}</span>
              {showQuestionReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showQuestionReview && (
            <div className="space-y-6 pt-2 border-t border-slate-800/80">
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(["all", "physics", "chemistry", "mathematics"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterSubject(tab)}
                    className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                      filterSubject === tab
                        ? "bg-blue-600 text-white"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredReviewQuestions.map((q, idx) => {
                  const candidateResp = submission?.answers?.[q.id];
                  const userAns = candidateResp?.selected_answer;
                  const isAnswered = Boolean(
                    userAns &&
                      (candidateResp.status === "answered" ||
                        candidateResp.status === "answered_and_marked_for_review")
                  );

                  const isCorrect =
                    isAnswered &&
                    (q.type === "mcq"
                      ? userAns?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()
                      : userAns?.trim() === q.correct_answer.trim());

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-2xl border space-y-3.5 transition ${
                        !isAnswered
                          ? "bg-slate-950/60 border-slate-800/80"
                          : isCorrect
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : "bg-red-500/5 border-red-500/30"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                            Q{idx + 1}
                          </span>
                          <span className="capitalize font-semibold text-slate-400">
                            {q.subject}
                          </span>
                          <span className="uppercase text-[10px] text-slate-500">
                            {q.type === "mcq" ? "MCQ" : "Numerical"}
                          </span>
                        </div>

                        <div>
                          {!isAnswered ? (
                            <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                              Not Attempted (0)
                            </span>
                          ) : isCorrect ? (
                            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                              Correct (+{q.positive_marks})
                            </span>
                          ) : (
                            <span className="text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                              Incorrect (-{exam.has_negative_marking ? q.negative_marks : 0})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="text-sm text-slate-200 leading-relaxed font-normal">
                        <MathView math={q.question_text} />
                      </div>

                      {/* MCQ Options Display */}
                      {q.type === "mcq" && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                          {(["A", "B", "C", "D"] as const).map((optKey, optIdx) => {
                            const isCorrectOpt = q.correct_answer === optKey;
                            const isUserSelected = userAns === optKey;

                            let optClass = "bg-slate-950 border-slate-800/80 text-slate-300";
                            if (isCorrectOpt) {
                              optClass = "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold";
                            } else if (isUserSelected && !isCorrectOpt) {
                              optClass = "bg-red-500/15 border-red-500/40 text-red-300";
                            }

                            return (
                              <div
                                key={optKey}
                                className={`p-2.5 rounded-xl border flex items-start gap-2 ${optClass}`}
                              >
                                <span className="font-bold shrink-0">({optKey})</span>
                                <div className="flex-1">
                                  <MathView math={q.options![optIdx]} />
                                </div>
                                {isCorrectOpt && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                )}
                                {isUserSelected && !isCorrectOpt && (
                                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Numerical Answer Review */}
                      {q.type === "numerical" && (
                        <div className="flex items-center gap-4 text-xs font-mono pt-1">
                          <div>
                            <span className="text-slate-400">Correct Answer: </span>
                            <span className="font-bold text-emerald-400">{q.correct_answer}</span>
                          </div>
                          {userAns && (
                            <div>
                              <span className="text-slate-400">Your Response: </span>
                              <span className={isCorrect ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                {userAns}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Solution / Explanation */}
                      {q.explanation && (
                        <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400 space-y-1">
                          <span className="font-semibold text-slate-300">Detailed Solution:</span>
                          <div className="text-slate-300 leading-relaxed">
                            <MathView math={q.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/test"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Take Another Mock Test</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-sm transition"
          >
            <Home className="w-4 h-4" />
            <span>Return to Portal Home</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        © 2026 National Testing Agency / JEE (Main). CBT Simulated Terminal Scorecard.
      </footer>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ExamResultContent />
    </Suspense>
  );
}
