"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Exam,
  Question,
  Subject,
  Submission,
  Profile,
  QuestionTelemetry,
  SubjectBreakdown,
} from "@/types/database";
import MathView from "@/components/MathView";
import {
  ArrowLeft,
  Trophy,
  BarChart3,
  Users,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Search,
  ExternalLink,
  Atom,
  FlaskConical,
  Calculator,
  Zap,
  HelpCircle,
  Eye,
  X,
  RefreshCw,
  Flame,
  Hourglass,
  ArrowRight,
  TrendingUp,
  Percent,
} from "lucide-react";

interface ProcessedCandidate {
  submission: Submission;
  rank: number;
  userName: string;
  userEmail: string;
  totalScore: number;
  accuracy: number;
  totalTimeSec: number;
  subjectBreakdown: {
    physics: SubjectBreakdown;
    chemistry: SubjectBreakdown;
    mathematics: SubjectBreakdown;
    subject_visit_order: string[];
  };
  telemetry: Record<string, QuestionTelemetry>;
  attemptPattern: string;
  rushedWrongCount: number;
  overtimeTrapCount: number;
  revisitCount: number;
  switchCount: number;
}

const SUBJECT_CONFIG: Record<
  Subject,
  { label: string; icon: typeof Atom; color: string; badge: string; bg: string }
> = {
  physics: {
    label: "Physics",
    icon: Atom,
    color: "text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    bg: "bg-cyan-950/20 border-cyan-800/40",
  },
  chemistry: {
    label: "Chemistry",
    icon: FlaskConical,
    color: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    bg: "bg-emerald-950/20 border-emerald-800/40",
  },
  mathematics: {
    label: "Mathematics",
    icon: Calculator,
    color: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    bg: "bg-indigo-950/20 border-indigo-800/40",
  },
};

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "0m 00s";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function formatMinSec(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "0:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ExamAnalyticsPage() {
  const params = useParams();
  const examId = params?.id as string;

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"cohort" | "leaderboard" | "questions">("cohort");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "score" | "accuracy" | "time">("rank");
  const [selectedCandidate, setSelectedCandidate] = useState<ProcessedCandidate | null>(null);
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState<"all" | Subject>("all");

  const loadData = useCallback(
    async (isManual = false) => {
      if (!examId) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);

      try {
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (examError || !examData) {
          throw new Error(examError?.message || "Exam not found.");
        }
        setExam(examData);

        const { data: qData, error: qError } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", examId)
          .order("order_index", { ascending: true });

        if (qError) throw new Error(qError.message);
        setQuestions(qData || []);

        // Robust submissions fetch supporting both exam_id and test_id
        let fetchedSubmissions: Submission[] = [];
        const { data: subData } = await supabase
          .from("submissions")
          .select("*")
          .or(`exam_id.eq.${examId},test_id.eq.${examId}`)
          .order("submitted_at", { ascending: false });

        if (subData && subData.length > 0) {
          fetchedSubmissions = subData;
        } else {
          // Fallback check test_sessions if submissions table query is empty
          const { data: sessData } = await supabase
            .from("test_sessions")
            .select("*")
            .eq("exam_id", examId);

          if (sessData && sessData.length > 0) {
            fetchedSubmissions = sessData.map((s: any) => ({
              id: s.id || `${s.user_id}_${s.exam_id}`,
              user_id: s.user_id,
              exam_id: s.exam_id,
              answers: s.answers || {},
              status: s.status || "completed",
              created_at: s.updated_at || new Date().toISOString(),
              submitted_at: s.updated_at || new Date().toISOString(),
              total_score: 0,
            }));
          }
        }

        setSubmissions(fetchedSubmissions);

        const userIds = Array.from(new Set(fetchedSubmissions.map((s) => s.user_id || (s as any).student_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          const profMap: Record<string, Profile> = {};
          (profData || []).forEach((p) => {
            profMap[p.id] = p;
          });
          setProfiles(profMap);
        }
      } catch (err: unknown) {
        console.error("Analytics load error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load examination analytics.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [examId, supabase]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processedCandidates = useMemo((): ProcessedCandidate[] => {
    if (!exam || questions.length === 0 || submissions.length === 0) return [];

    const candidates = submissions.map((sub) => {
      const uId = sub.user_id || (sub as any).student_id || "unknown";
      const profile = profiles[uId];
      const userName = profile?.full_name || profile?.email?.split("@")[0] || "Candidate";
      const userEmail = profile?.email || `ID: ${uId.slice(0, 8)}...`;

      const telemetry: Record<string, QuestionTelemetry> =
        sub.question_telemetry && typeof sub.question_telemetry === "object"
          ? (sub.question_telemetry as Record<string, QuestionTelemetry>)
          : {};

      let totalTimeSec = 0;
      if (sub.start_time && sub.end_time) {
        totalTimeSec = Math.max(
          0,
          Math.floor((new Date(sub.end_time).getTime() - new Date(sub.start_time).getTime()) / 1000)
        );
      } else {
        totalTimeSec = Object.values(telemetry).reduce((acc, t) => acc + (t.time_spent_sec || 0), 0);
      }

      const subjects: Subject[] = ["physics", "chemistry", "mathematics"];
      const existingBreakdown = sub.subject_breakdown || {};
      const breakdownResult: {
        physics: SubjectBreakdown;
        chemistry: SubjectBreakdown;
        mathematics: SubjectBreakdown;
        subject_visit_order: string[];
      } = {
        physics: { subject: "physics", score: 0, max_marks: 0, correct: 0, incorrect: 0, unattempted: 0, accuracy: 0, time_spent_sec: 0 },
        chemistry: { subject: "chemistry", score: 0, max_marks: 0, correct: 0, incorrect: 0, unattempted: 0, accuracy: 0, time_spent_sec: 0 },
        mathematics: { subject: "mathematics", score: 0, max_marks: 0, correct: 0, incorrect: 0, unattempted: 0, accuracy: 0, time_spent_sec: 0 },
        subject_visit_order: existingBreakdown.subject_visit_order || [],
      };

      let totalCorrect = 0;
      let totalIncorrect = 0;
      let rushedWrongCount = 0;
      let overtimeTrapCount = 0;
      let revisitCount = 0;
      let switchCount = 0;

      subjects.forEach((subj) => {
        const subjQs = questions.filter((q) => q.subject === subj);
        let sScore = 0;
        let sCorrect = 0;
        let sIncorrect = 0;
        let sUnattempted = 0;
        let sTime = 0;
        let sMax = 0;

        subjQs.forEach((q) => {
          sMax += q.positive_marks ?? 4;
          const t = telemetry[q.id];
          const timeOnQ = t?.time_spent_sec || 0;
          sTime += timeOnQ;

          if (t) {
            if ((t.visit_count || 0) > 1) revisitCount += (t.visit_count || 1) - 1;
            if ((t.answer_switches || 0) > 0) switchCount += t.answer_switches || 0;
            if (timeOnQ > 180) overtimeTrapCount++;
          }

          const ans = sub.answers?.[q.id];
          const isAttempted =
            ans &&
            (ans.status === "answered" || ans.status === "answered_and_marked_for_review") &&
            Boolean(ans.selected_answer);

          if (isAttempted && ans.selected_answer) {
            const isCorrect =
              q.type === "mcq"
                ? ans.selected_answer.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()
                : ans.selected_answer.trim() === q.correct_answer.trim();

            if (isCorrect) {
              sCorrect++;
              totalCorrect++;
              sScore += q.positive_marks ?? 4;
            } else {
              sIncorrect++;
              totalIncorrect++;
              if (timeOnQ < 15 && timeOnQ > 0) rushedWrongCount++;
              if (exam.has_negative_marking) {
                sScore -= q.negative_marks ?? 1;
              }
            }
          } else {
            sUnattempted++;
          }
        });

        const sAccuracy =
          sCorrect + sIncorrect > 0
            ? Math.round((sCorrect / (sCorrect + sIncorrect)) * 1000) / 10
            : 0;

        const savedSubj = existingBreakdown[subj];
        breakdownResult[subj] = {
          subject: subj,
          score: savedSubj?.score ?? sScore,
          max_marks: savedSubj?.max_marks ?? sMax,
          correct: savedSubj?.correct ?? sCorrect,
          incorrect: savedSubj?.incorrect ?? sIncorrect,
          unattempted: savedSubj?.unattempted ?? sUnattempted,
          accuracy: savedSubj?.accuracy ?? sAccuracy,
          time_spent_sec: savedSubj?.time_spent_sec || sTime,
        };
      });

      const overallAccuracy =
        totalCorrect + totalIncorrect > 0
          ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 1000) / 10
          : 0;

      let patternList = breakdownResult.subject_visit_order;
      if (!patternList || patternList.length === 0) {
        patternList = subjects
          .slice()
          .sort((a, b) => breakdownResult[b].time_spent_sec - breakdownResult[a].time_spent_sec);
      }
      const attemptPattern = patternList
        .slice(0, 3)
        .map((s) => s.slice(0, 4).toUpperCase())
        .join(" → ");

      const computedTotalScore =
        sub.total_score !== null && sub.total_score !== undefined
          ? Number(sub.total_score)
          : breakdownResult.physics.score +
            breakdownResult.chemistry.score +
            breakdownResult.mathematics.score;

      return {
        submission: sub,
        rank: 0,
        userName,
        userEmail,
        totalScore: computedTotalScore,
        accuracy: overallAccuracy,
        totalTimeSec,
        subjectBreakdown: breakdownResult,
        telemetry,
        attemptPattern,
        rushedWrongCount,
        overtimeTrapCount,
        revisitCount,
        switchCount,
      };
    });

    candidates.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.totalTimeSec !== b.totalTimeSec) return a.totalTimeSec - b.totalTimeSec;
      return b.accuracy - a.accuracy;
    });

    return candidates.map((c, idx) => ({ ...c, rank: idx + 1 }));
  }, [exam, questions, submissions, profiles]);

  const cohortStats = useMemo(() => {
    if (processedCandidates.length === 0 || !exam) {
      return {
        totalAttempts: 0,
        avgScore: 0,
        highestScore: 0,
        lowestScore: 0,
        avgAccuracy: 0,
        avgTimeSec: 0,
        subjectAverages: {
          physics: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
          chemistry: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
          mathematics: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
        },
      };
    }

    const n = processedCandidates.length;
    const scores = processedCandidates.map((c) => c.totalScore);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / n) * 10) / 10;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    const avgAccuracy =
      Math.round((processedCandidates.reduce((a, b) => a + b.accuracy, 0) / n) * 10) / 10;
    const avgTimeSec = Math.round(
      processedCandidates.reduce((a, b) => a + b.totalTimeSec, 0) / n
    );

    const subjectAverages: Record<
      Subject,
      { avgScore: number; avgAccuracy: number; avgTime: number; attemptRate: number }
    > = {
      physics: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
      chemistry: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
      mathematics: { avgScore: 0, avgAccuracy: 0, avgTime: 0, attemptRate: 0 },
    };

    (["physics", "chemistry", "mathematics"] as const).forEach((subj) => {
      const subjScores = processedCandidates.map((c) => c.subjectBreakdown[subj].score);
      const subjAccs = processedCandidates.map((c) => c.subjectBreakdown[subj].accuracy);
      const subjTimes = processedCandidates.map((c) => c.subjectBreakdown[subj].time_spent_sec);
      const totalSubjectQs = questions.filter((q) => q.subject === subj).length || 25;

      const avgAttempted =
        processedCandidates.reduce(
          (acc, c) =>
            acc + (c.subjectBreakdown[subj].correct + c.subjectBreakdown[subj].incorrect),
          0
        ) / n;

      subjectAverages[subj] = {
        avgScore: Math.round((subjScores.reduce((a, b) => a + b, 0) / n) * 10) / 10,
        avgAccuracy: Math.round((subjAccs.reduce((a, b) => a + b, 0) / n) * 10) / 10,
        avgTime: Math.round(subjTimes.reduce((a, b) => a + b, 0) / n),
        attemptRate: Math.round((avgAttempted / totalSubjectQs) * 1000) / 10,
      };
    });

    return {
      totalAttempts: n,
      avgScore,
      highestScore,
      lowestScore,
      avgAccuracy,
      avgTimeSec,
      subjectAverages,
    };
  }, [processedCandidates, exam, questions]);

  const questionAnalytics = useMemo(() => {
    if (questions.length === 0) return [];
    const n = submissions.length;

    return questions.map((q, idx) => {
      let correctCount = 0;
      let incorrectCount = 0;
      let unattemptedCount = 0;
      let totalTimeSpent = 0;
      let timedCount = 0;

      submissions.forEach((sub) => {
        const t = (sub.question_telemetry as Record<string, QuestionTelemetry>)?.[q.id];
        if (t?.time_spent_sec) {
          totalTimeSpent += t.time_spent_sec;
          timedCount++;
        }

        const ans = sub.answers?.[q.id];
        const isAttempted =
          ans &&
          (ans.status === "answered" || ans.status === "answered_and_marked_for_review") &&
          Boolean(ans.selected_answer);

        if (isAttempted && ans.selected_answer) {
          const isCorrect =
            q.type === "mcq"
              ? ans.selected_answer.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()
              : ans.selected_answer.trim() === q.correct_answer.trim();
          if (isCorrect) correctCount++;
          else incorrectCount++;
        } else {
          unattemptedCount++;
        }
      });

      const attemptedTotal = correctCount + incorrectCount;
      const accuracy =
        attemptedTotal > 0 ? Math.round((correctCount / attemptedTotal) * 1000) / 10 : 0;
      const attemptRate = n > 0 ? Math.round((attemptedTotal / n) * 1000) / 10 : 0;
      const negativeRate = n > 0 ? Math.round((incorrectCount / n) * 1000) / 10 : 0;
      const avgTimeSec = timedCount > 0 ? Math.round(totalTimeSpent / timedCount) : 0;

      let difficulty: "Easy" | "Moderate" | "Challenging" = "Moderate";
      if (accuracy >= 70) difficulty = "Easy";
      else if (accuracy < 40) difficulty = "Challenging";

      return {
        question: q,
        qNumber: q.order_index ?? idx + 1,
        correctCount,
        incorrectCount,
        unattemptedCount,
        accuracy,
        attemptRate,
        negativeRate,
        avgTimeSec,
        difficulty,
      };
    });
  }, [questions, submissions]);

  const filteredCandidates = useMemo(() => {
    let list = processedCandidates.filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        c.userName.toLowerCase().includes(q) ||
        c.userEmail.toLowerCase().includes(q) ||
        c.attemptPattern.toLowerCase().includes(q)
      );
    });

    if (sortBy === "score") {
      list.sort((a, b) => b.totalScore - a.totalScore);
    } else if (sortBy === "accuracy") {
      list.sort((a, b) => b.accuracy - a.accuracy);
    } else if (sortBy === "time") {
      list.sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [processedCandidates, searchQuery, sortBy]);

  const handleExportCSV = () => {
    if (processedCandidates.length === 0 || !exam) {
      alert("No completed submissions available to export.");
      return;
    }

    const headers = [
      "Rank",
      "Candidate Name",
      "Candidate Email",
      "Total Score",
      "Max Marks",
      "Accuracy (%)",
      "Total Time (s)",
      "Total Time (Formatted)",
      "Physics Score",
      "Physics Time (s)",
      "Chemistry Score",
      "Chemistry Time (s)",
      "Math Score",
      "Math Time (s)",
      "Subject Pattern",
      "Rushed Wrong Answers (<15s)",
      "Overtime Traps (>180s)",
      "Total Answer Switches",
      "Submission ID",
      "Submitted At",
    ];

    const rows = processedCandidates.map((c) => [
      c.rank,
      `"${c.userName.replace(/"/g, '""')}"`,
      `"${c.userEmail.replace(/"/g, '""')}"`,
      c.totalScore,
      exam.total_marks,
      c.accuracy,
      c.totalTimeSec,
      `"${formatDuration(c.totalTimeSec)}"`,
      c.subjectBreakdown.physics.score,
      c.subjectBreakdown.physics.time_spent_sec,
      c.subjectBreakdown.chemistry.score,
      c.subjectBreakdown.chemistry.time_spent_sec,
      c.subjectBreakdown.mathematics.score,
      c.subjectBreakdown.mathematics.time_spent_sec,
      `"${c.attemptPattern}"`,
      c.rushedWrongCount,
      c.overtimeTrapCount,
      c.switchCount,
      c.submission.id,
      `"${c.submission.end_time || c.submission.created_at || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `JEE_Main_Analytics_${exam.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading exam analytics &amp; candidate telemetry...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Exam Not Found</h2>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-white transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exams</span>
            </Link>
            <span>/</span>
            <Link
              href={`/admin/exams/${exam.id}/questions`}
              className="hover:text-white transition"
            >
              {exam.title}
            </Link>
            <span>/</span>
            <span className="text-slate-200">Analytics &amp; Results</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>{exam.title}</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                exam.is_active
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {exam.is_active ? "Published CBT" : "Draft Paper"}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Duration: {exam.duration_minutes} Mins • Total Marks: {exam.total_marks} • Total Questions:{" "}
            {questions.length} • Submissions:{" "}
            <span className="text-white font-bold">{submissions.length} completed</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-xs transition shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <Link
            href={`/admin/exams/${exam.id}/questions`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/25"
          >
            <span>Question Manager</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("cohort")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "cohort"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Cohort Overview &amp; Subject Averages</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "leaderboard"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Candidate Leaderboard ({submissions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "questions"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>Question-Level Time &amp; Accuracy</span>
        </button>
      </div>

      {activeTab === "cohort" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Total Attempts</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-white">{cohortStats.totalAttempts}</div>
              <div className="text-xs text-slate-500">Completed CBT test papers</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Average Score</span>
                <Award className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-black text-purple-400">
                {cohortStats.avgScore}
                <span className="text-sm font-normal text-slate-500"> / {exam.total_marks}</span>
              </div>
              <div className="text-xs text-slate-500">
                {exam.total_marks > 0
                  ? `${Math.round((cohortStats.avgScore / exam.total_marks) * 100)}% class average`
                  : "Cohort performance"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Highest Score</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400">
                {cohortStats.highestScore}
                <span className="text-sm font-normal text-slate-500"> / {exam.total_marks}</span>
              </div>
              <div className="text-xs text-slate-500">Rank 1 Benchmark</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Avg Accuracy</span>
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-400">{cohortStats.avgAccuracy}%</div>
              <div className="text-xs text-slate-500">Correct vs Attempted ratio</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Avg Test Duration</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-cyan-400">
                {formatDuration(cohortStats.avgTimeSec)}
              </div>
              <div className="text-xs text-slate-500">Allowed: {exam.duration_minutes} Mins</div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <span>Subject-Wise Cohort Performance &amp; Time Allocation</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparative performance benchmarks across Physics, Chemistry, and Mathematics for all{" "}
                  {cohortStats.totalAttempts} candidates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(["physics", "chemistry", "mathematics"] as const).map((subj) => {
                const conf = SUBJECT_CONFIG[subj];
                const Icon = conf.icon;
                const subjStats = cohortStats.subjectAverages[subj];
                const totalSubjQs = questions.filter((q) => q.subject === subj).length || 25;
                const maxMarks = totalSubjQs * (exam.positive_marks ?? 4);

                const timeRatio =
                  cohortStats.avgTimeSec > 0
                    ? Math.round((subjStats.avgTime / cohortStats.avgTimeSec) * 100)
                    : 33;

                return (
                  <div
                    key={subj}
                    className={`p-5 rounded-2xl border ${conf.bg} space-y-4 shadow-lg flex flex-col justify-between`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${conf.color}`} />
                          <h3 className="text-base font-bold text-white capitalize">{conf.label}</h3>
                        </div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${conf.badge}`}>
                          {totalSubjQs} Questions
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                          <div className="text-[11px] text-slate-400">Average Score</div>
                          <div className="text-xl font-black text-white">
                            {subjStats.avgScore}
                            <span className="text-xs font-normal text-slate-500"> / {maxMarks}</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                          <div className="text-[11px] text-slate-400">Average Accuracy</div>
                          <div className={`text-xl font-black ${conf.color}`}>
                            {subjStats.avgAccuracy}%
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                          <div className="text-[11px] text-slate-400">Average Time Spent</div>
                          <div className="text-xl font-black text-white">
                            {formatDuration(subjStats.avgTime)}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5">
                          <div className="text-[11px] text-slate-400">Attempt Rate</div>
                          <div className="text-xl font-black text-white">{subjStats.attemptRate}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Time Share of Total Test</span>
                        <span className="font-bold text-slate-200">{timeRatio}% of time</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            subj === "physics"
                              ? "bg-cyan-500"
                              : subj === "chemistry"
                              ? "bg-emerald-500"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${Math.min(100, timeRatio)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {cohortStats.totalAttempts === 0 && (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
              <Users className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Candidate Submissions Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Once candidates complete and submit their CBT mock test, live subject breakdowns, score
                averages, and time distributions will populate here.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by name, email, pattern..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 text-xs focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="rank">Rank / Score (High to Low)</option>
                <option value="accuracy">Accuracy %</option>
                <option value="time">Fastest Time Taken</option>
              </select>
            </div>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-2">
              <Trophy className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-white">No Matching Candidates Found</div>
              <p className="text-xs text-slate-400">
                {searchQuery ? `No candidates matching "${searchQuery}".` : "No completed test attempts."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4 text-center">Total Score</th>
                    <th className="py-3 px-4 text-center">Physics (Score &amp; Time)</th>
                    <th className="py-3 px-4 text-center">Chemistry (Score &amp; Time)</th>
                    <th className="py-3 px-4 text-center">Math (Score &amp; Time)</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-center">Attempt Pattern</th>
                    <th className="py-3 px-4 text-center">Total Time</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredCandidates.map((cand) => {
                    return (
                      <tr key={cand.submission.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                              cand.rank === 1
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : cand.rank === 2
                                ? "bg-slate-400/20 text-slate-200 border border-slate-400/30"
                                : cand.rank === 3
                                ? "bg-amber-700/20 text-amber-400 border border-amber-700/30"
                                : "bg-slate-950 text-slate-400 border border-slate-800"
                            }`}
                          >
                            {cand.rank}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white leading-tight">{cand.userName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{cand.userEmail}</div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-extrabold text-base text-purple-400">
                            {cand.totalScore}
                          </span>
                          <span className="text-[10px] text-slate-500 block">/ {exam.total_marks}</span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="font-bold text-cyan-400">
                            {cand.subjectBreakdown.physics.score}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatMinSec(cand.subjectBreakdown.physics.time_spent_sec)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="font-bold text-emerald-400">
                            {cand.subjectBreakdown.chemistry.score}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatMinSec(cand.subjectBreakdown.chemistry.time_spent_sec)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="font-bold text-indigo-400">
                            {cand.subjectBreakdown.mathematics.score}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatMinSec(cand.subjectBreakdown.mathematics.time_spent_sec)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-white">
                          <span
                            className={
                              cand.accuracy >= 75
                                ? "text-emerald-400"
                                : cand.accuracy >= 50
                                ? "text-amber-400"
                                : "text-red-400"
                            }
                          >
                            {cand.accuracy}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                            {cand.attemptPattern || "Standard"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                          {formatDuration(cand.totalTimeSec)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(cand)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Full Analysis</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "questions" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Section:</span>
              {(["all", "physics", "chemistry", "mathematics"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuestionSubjectFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer capitalize ${
                    questionSubjectFilter === s
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-bold text-white">
                {
                  questionAnalytics.filter(
                    (item) =>
                      questionSubjectFilter === "all" || item.question.subject === questionSubjectFilter
                  ).length
                }
              </span>{" "}
              of {questions.length} Questions
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Q#</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 min-w-[280px]">Question Statement</th>
                  <th className="py-3 px-4 text-center">Key</th>
                  <th className="py-3 px-4 text-center">Cohort Accuracy</th>
                  <th className="py-3 px-4 text-center">Attempt Rate</th>
                  <th className="py-3 px-4 text-center">Avg Time Spent</th>
                  <th className="py-3 px-4 text-center">Neg. Mark Rate</th>
                  <th className="py-3 px-4 text-center">Difficulty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {questionAnalytics
                  .filter(
                    (item) =>
                      questionSubjectFilter === "all" ||
                      item.question.subject === questionSubjectFilter
                  )
                  .map((item) => {
                    const conf = SUBJECT_CONFIG[item.question.subject];
                    return (
                      <tr key={item.question.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          Q{item.qNumber}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${conf.badge}`}>
                            {conf.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="line-clamp-2 text-slate-200 text-xs">
                            <MathView math={item.question.question_text} />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold font-mono text-emerald-400">
                          {item.question.correct_answer}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-black text-sm ${
                              item.accuracy >= 70
                                ? "text-emerald-400"
                                : item.accuracy >= 40
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            {item.accuracy}%
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {item.correctCount} / {item.correctCount + item.incorrectCount} correct
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                          {item.attemptRate}%
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-cyan-400">
                          {formatDuration(item.avgTimeSec)}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-red-400">
                          {item.negativeRate}%
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.difficulty === "Easy"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : item.difficulty === "Moderate"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-red-500/15 text-red-400 border-red-500/30"
                            }`}
                          >
                            {item.difficulty}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black">
                    Rank #{selectedCandidate.rank}
                  </span>
                  <h3 className="text-lg font-bold text-white">{selectedCandidate.userName}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {selectedCandidate.userEmail} • Attempt ID: {selectedCandidate.submission.id.slice(0, 8)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(["physics", "chemistry", "mathematics"] as const).map((s) => {
                  const conf = SUBJECT_CONFIG[s];
                  const Icon = conf.icon;
                  const sb = selectedCandidate.subjectBreakdown[s];
                  return (
                    <div key={s} className={`p-4 rounded-xl border ${conf.bg} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-4 h-4 ${conf.color}`} />
                          <span className="font-bold text-white text-xs capitalize">{conf.label}</span>
                        </div>
                        <span className="text-sm font-black text-white">
                          {sb.score}
                          <span className="text-[10px] text-slate-500 font-normal"> / {sb.max_marks}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Accuracy</span>
                          <span className={`font-bold ${conf.color}`}>{sb.accuracy}%</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Time Spent</span>
                          <span className="font-bold text-white">{formatDuration(sb.time_spent_sec)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>
                          <strong className="text-emerald-400">{sb.correct}</strong> Correct
                        </span>
                        <span>
                          <strong className="text-red-400">{sb.incorrect}</strong> Incorrect
                        </span>
                        <span>
                          <strong className="text-slate-500">{sb.unattempted}</strong> Left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  <span>Attempting Strategy &amp; Behavioral Telemetry</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Subject Flow</span>
                    <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                      {selectedCandidate.attemptPattern}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Question Revisits</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm mt-0.5 block">
                      {selectedCandidate.revisitCount} times
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Answer Switches</span>
                    <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">
                      {selectedCandidate.switchCount} changes
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Rushed Mistakes (&lt;15s)</span>
                    <span className="font-mono font-bold text-red-400 text-sm mt-0.5 block">
                      {selectedCandidate.rushedWrongCount} Qs
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Time Sinks (&gt;3m)</span>
                    <span className="font-mono font-bold text-purple-400 text-sm mt-0.5 block">
                      {selectedCandidate.overtimeTrapCount} Qs
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Question-by-Question Response &amp; Time Log (Q1–Q{questions.length})
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Q#</th>
                        <th className="py-2.5 px-3">Section</th>
                        <th className="py-2.5 px-3 min-w-[240px]">Question Preview</th>
                        <th className="py-2.5 px-3 text-center">Candidate Ans</th>
                        <th className="py-2.5 px-3 text-center">Key</th>
                        <th className="py-2.5 px-3 text-center">Marks</th>
                        <th className="py-2.5 px-3 text-center">Time Spent</th>
                        <th className="py-2.5 px-3 text-center">Visits</th>
                        <th className="py-2.5 px-3 text-center">Telemetry Tag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {questions.map((q, idx) => {
                        const ans = selectedCandidate.submission.answers?.[q.id];
                        const t = selectedCandidate.telemetry[q.id];
                        const timeSec = t?.time_spent_sec || 0;
                        const visits = t?.visit_count || (ans ? 1 : 0);
                        const isAttempted =
                          ans &&
                          (ans.status === "answered" || ans.status === "answered_and_marked_for_review") &&
                          Boolean(ans.selected_answer);

                        let isCorrect = false;
                        if (isAttempted && ans.selected_answer) {
                          isCorrect =
                            q.type === "mcq"
                              ? ans.selected_answer.trim().toUpperCase() ===
                                q.correct_answer.trim().toUpperCase()
                              : ans.selected_answer.trim() === q.correct_answer.trim();
                        }

                        let markGained = 0;
                        if (isAttempted) {
                          if (isCorrect) markGained = q.positive_marks ?? 4;
                          else if (exam.has_negative_marking) markGained = -(q.negative_marks ?? 1);
                        }

                        return (
                          <tr key={q.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-2 px-3 font-mono font-bold text-white">
                              Q{q.order_index ?? idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  SUBJECT_CONFIG[q.subject].badge
                                }`}
                              >
                                {SUBJECT_CONFIG[q.subject].label.slice(0, 4)}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="line-clamp-1 text-slate-200">
                                <MathView math={q.question_text} />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              {ans?.selected_answer ? (
                                <span
                                  className={
                                    isCorrect
                                      ? "text-emerald-400"
                                      : "text-red-400 line-through"
                                  }
                                >
                                  {ans.selected_answer}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-emerald-400">
                              {q.correct_answer}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              <span
                                className={
                                  markGained > 0
                                    ? "text-emerald-400"
                                    : markGained < 0
                                    ? "text-red-400"
                                    : "text-slate-500"
                                }
                              >
                                {markGained > 0 ? `+${markGained}` : markGained}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-cyan-400 font-bold">
                              {formatMinSec(timeSec)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-400">
                              {visits}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isAttempted && !isCorrect && timeSec > 0 && timeSec < 15 ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-bold">
                                  ⚡ Rushed (&lt;15s)
                                </span>
                              ) : timeSec > 180 ? (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                  ⏳ Time Trap (&gt;3m)
                                </span>
                              ) : isAttempted && isCorrect && timeSec < 90 ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                  🎯 Optimal (&lt;90s)
                                </span>
                              ) : t?.answer_switches ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  🔄 Switched ({t.answer_switches})
                                </span>
                              ) : t?.marked_for_review ? (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                                  🚩 Reviewed
                                </span>
                              ) : isAttempted ? (
                                <span className="text-slate-500 text-[10px]">Standard</span>
                              ) : (
                                <span className="text-slate-600 text-[10px]">Unattempted</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}