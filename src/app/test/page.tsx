"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/types/database";
import {
  GraduationCap,
  Clock,
  Award,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Home,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Eye,
  FileEdit,
  RotateCcw,
} from "lucide-react";

interface UserSessionInfo {
  status: "in_progress" | "submitted";
  time_remaining_seconds: number;
}

export default function CandidateTestPortalPage() {
  const [supabase] = useState(() => createClient());
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [adminShowDrafts, setAdminShowDrafts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userSessions, setUserSessions] = useState<Record<string, UserSessionInfo>>({});

  const loadExams = useCallback(
    async (showDrafts = false, isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let currentRole = "candidate";
        if (user) {
          setUserEmail(user.email ?? "Candidate");
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          currentRole = profile?.role ?? "candidate";
          setUserRole(currentRole);

          // Fetch active / submitted sessions for this candidate
          const sessionsMap: Record<string, UserSessionInfo> = {};

          try {
            const { data: sessData, error: sessErr } = await supabase
              .from("test_sessions")
              .select("exam_id, status, time_remaining_seconds")
              .eq("user_id", user.id);

            if (!sessErr && sessData) {
              sessData.forEach((s) => {
                sessionsMap[s.exam_id] = {
                  status: s.status as "in_progress" | "submitted",
                  time_remaining_seconds: s.time_remaining_seconds ?? 0,
                };
              });
            }
          } catch (e) {
            console.warn("Could not load user test_sessions:", e);
          }

          // Fallback: check public.submissions
          try {
            const { data: subData } = await supabase
              .from("submissions")
              .select("exam_id, status")
              .eq("user_id", user.id);

            if (subData) {
              subData.forEach((sub) => {
                if (!sessionsMap[sub.exam_id]) {
                  sessionsMap[sub.exam_id] = {
                    status: sub.status === "in_progress" ? "in_progress" : "submitted",
                    time_remaining_seconds: 0,
                  };
                }
              });
            }
          } catch (e) {
            console.warn("Submissions check notice:", e);
          }

          // Fallback: check localStorage for any local active session
          if (typeof window !== "undefined") {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith("cbt_session_") && key.endsWith(`_${user.id}`)) {
                  const parts = key.split("_");
                  const eId = parts[2];
                  if (eId && !sessionsMap[eId]) {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      if (parsed?.status === "in_progress") {
                        sessionsMap[eId] = {
                          status: "in_progress",
                          time_remaining_seconds: parsed.time_remaining_seconds ?? 0,
                        };
                      }
                    }
                  }
                }
              }
            } catch (_) {}
          }

          setUserSessions(sessionsMap);
        }

        // Build query: If admin and adminShowDrafts is active, fetch all exams; otherwise fetch is_active = true
        let query = supabase.from("exams").select("*");
        if (!(currentRole === "admin" && showDrafts)) {
          query = query.eq("is_active", true);
        }
        query = query.order("created_at", { ascending: false });

        const { data: examsData, error: examsError } = await query;

        if (examsError) {
          console.error("Supabase exams query error:", examsError);
          const isRlsError =
            examsError.code === "42501" ||
            examsError.message.toLowerCase().includes("permission") ||
            examsError.message.toLowerCase().includes("policy") ||
            examsError.message.toLowerCase().includes("row-level security");

          setErrorMessage(
            isRlsError
              ? `Supabase Row Level Security (RLS) Block: ${examsError.message} (Code: ${examsError.code}). Run the SQL script in 'supabase/exams_rls.sql' via Supabase SQL Editor to grant candidates SELECT access to published exams.`
              : `Unable to load mock examinations: ${examsError.message} (Code: ${examsError.code || "UNKNOWN"}).`
          );
          setExams([]);
          return;
        }

        if (examsData) {
          // Fetch questions count for each exam safely
          const examsWithCounts = await Promise.all(
            examsData.map(async (exam) => {
              try {
                const { count, error: qErr } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("exam_id", exam.id);
                if (qErr) {
                  console.warn(`Questions count notice for exam ${exam.id}:`, qErr.message);
                }
                return { ...exam, questions_count: count ?? 0 };
              } catch {
                return { ...exam, questions_count: 0 };
              }
            })
          );
          setExams(examsWithCounts);
        } else {
          setExams([]);
        }
      } catch (err: unknown) {
        console.error("Error fetching exams:", err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected network or authentication error occurred while fetching examinations."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    loadExams(adminShowDrafts);
  }, [loadExams, adminShowDrafts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                JEE (Main) Computer Based Test (CBT)
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Candidate Portal
                </span>
                {userRole === "admin" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    Admin Preview
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">
                National Testing Agency • Candidate Roll: {userEmail ?? "Authenticated"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadExams(adminShowDrafts, true)}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-50 cursor-pointer"
              title="Refresh examinations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {userRole === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/60"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Console</span>
              </Link>
            )}

            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Portal Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6 my-2">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              Published CBT Test Papers
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Official All India JEE (Main) Mock Examinations
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Select an examination below to view the official NTA CBT instructions, test guidelines,
              and proceed to your simulated examination terminal.
            </p>
          </div>

          {userRole === "admin" && (
            <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3 shrink-0 flex flex-col gap-2 text-xs">
              <div className="text-purple-300 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Filter Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdminShowDrafts(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    !adminShowDrafts
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  Published Only (Candidate View)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminShowDrafts(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    adminShowDrafts
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  Include Drafts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Supabase / RLS Error Notice */}
        {errorMessage && (
          <div className="p-5 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-200 text-sm flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div className="font-bold text-red-300">Database Query Notice</div>
              <p className="text-xs leading-relaxed text-red-200/90">{errorMessage}</p>
              <div className="text-[11px] text-red-300/80 bg-red-900/30 border border-red-800/50 p-2.5 rounded-xl font-mono">
                Tip: Run <span className="text-white font-bold">supabase/exams_rls.sql</span> in your Supabase SQL Editor to grant candidates SELECT access to published exams.
              </div>
            </div>
          </div>
        )}

        {/* Exams Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading active examination papers...</span>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">No Active Examinations Scheduled</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              No test papers are currently published. If you are an administrator, you can create and
              publish exams from the Admin Portal.
            </p>
            {userRole === "admin" && (
              <Link
                href="/admin/exams/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
              >
                <span>Go to Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => {
              const session = userSessions[exam.id];
              const isInProgress = session?.status === "in_progress";
              const isCompleted = session?.status === "submitted";

              return (
                <div
                  key={exam.id}
                  className={`rounded-2xl bg-slate-900 border transition p-6 flex flex-col justify-between space-y-5 shadow-lg group ${
                    isInProgress
                      ? "border-amber-500/50 shadow-amber-500/10 ring-1 ring-amber-500/30"
                      : "border-slate-800 hover:border-blue-500/40"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      {isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>In Progress</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          <CheckCircle className="w-3 h-3 text-blue-400" />
                          <span>Submitted</span>
                        </span>
                      ) : exam.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span>Ready for Testing</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <FileEdit className="w-3 h-3 text-amber-400" />
                          <span>Draft (Admin Preview)</span>
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        {exam.questions_count ?? 0} Questions
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition leading-snug">
                      {exam.title}
                    </h3>

                    {exam.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{exam.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{exam.duration_minutes} Mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>{exam.total_marks} Marks</span>
                      </div>
                      <div className="col-span-2 text-[11px] text-slate-500">
                        Marking: +{exam.positive_marks} / -{exam.negative_marks}{" "}
                        {exam.has_negative_marking ? "(Negative Marking)" : "(No Negative Marking)"}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    {isInProgress ? (
                      <Link
                        href={`/test/${exam.id}/session`}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition shadow-lg shadow-amber-500/25 active:scale-[0.99] cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Resume Test</span>
                        {session.time_remaining_seconds > 0 && (
                          <span className="ml-1 opacity-90 font-mono text-[11px]">
                            ({Math.ceil(session.time_remaining_seconds / 60)}m left)
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </Link>
                    ) : isCompleted ? (
                      <Link
                        href={`/test/${exam.id}/result`}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition shadow-sm active:scale-[0.99] cursor-pointer"
                      >
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>View Results &amp; Scorecard</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link
                        href={`/test/${exam.id}`}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99] cursor-pointer"
                      >
                        <span>Instructions &amp; Start Test</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        © 2026 National Testing Agency / JEE (Main). CBT Simulated Engine.
      </footer>
    </div>
  );
}
