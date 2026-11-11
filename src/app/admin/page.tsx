"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/types/database";
import {
  PlusCircle,
  FileText,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Settings2,
  Trash2,
  AlertCircle,
  HelpCircle,
  Search,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [supabase] = useState(() => createClient());
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExams = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        setErrorMessage(null);

        // Fetch exams ordered by created_at desc
        const { data: examsData, error: examsError } = await supabase
          .from("exams")
          .select("*")
          .order("created_at", { ascending: false });

        if (examsError) {
          console.warn("Exams query:", examsError.message);
          setExams([]);
        } else {
          // For each exam, query the questions count
          const examsWithCounts = await Promise.all(
            (examsData || []).map(async (exam) => {
              const { count } = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("exam_id", exam.id);
              return {
                ...exam,
                questions_count: count ?? 0,
              };
            })
          );
          setExams(examsWithCounts);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load mock exams.");
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const { data: examsData, error: examsError } = await supabase
          .from("exams")
          .select("*")
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (examsError) {
            setExams([]);
          } else {
            const examsWithCounts = await Promise.all(
              (examsData || []).map(async (exam) => {
                const { count } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("exam_id", exam.id);
                return {
                  ...exam,
                  questions_count: count ?? 0,
                };
              })
            );
            setExams(examsWithCounts);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load mock exams.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [supabase]);

  const handleDeleteExam = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the exam "${title}"? All associated questions will be removed.`)) {
      return;
    }

    try {
      setDeletingId(id);
      // Delete questions first then exam, or cascade if configured
      await supabase.from("questions").delete().eq("exam_id", id);
      const { error } = await supabase.from("exams").delete().eq("id", id);

      if (error) {
        alert(`Error deleting exam: ${error.message}`);
      } else {
        setExams((prev) => prev.filter((exam) => exam.id !== id));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete exam.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (exam: Exam) => {
    try {
      const nextStatus = !exam.is_active;
      const { error } = await supabase
        .from("exams")
        .update({ is_active: nextStatus })
        .eq("id", exam.id);

      if (error) {
        alert(`Failed to update status: ${error.message}`);
      } else {
        setExams((prev) =>
          prev.map((e) => (e.id === exam.id ? { ...e, is_active: nextStatus } : e))
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update exam status.");
    }
  };

  const filteredExams = exams.filter((exam) =>
    exam.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExams = exams.length;
  const activeExams = exams.filter((e) => e.is_active).length;
  const totalQuestions = exams.reduce((acc, curr) => acc + (curr.questions_count ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Exam Management Console
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, configure, and monitor computer-based tests and question papers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchExams(true)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
            title="Refresh exams list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/admin/exams/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.99]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Mock Exam</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Mock Tests</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white">{totalExams}</div>
          <div className="text-xs text-slate-500">Configured in system</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Live / Active CBT</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{activeExams}</div>
          <div className="text-xs text-slate-500">Available to candidates</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Questions</span>
            <HelpCircle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400">{totalQuestions}</div>
          <div className="text-xs text-slate-500">Across Physics, Chem, Math</div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mock exams by title..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Exam List */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading mock exams...</span>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">No Mock Exams Found</h3>
            <p className="text-sm text-slate-400">
              {searchQuery
                ? `No results matching "${searchQuery}".`
                : "Get started by creating your first JEE (Main) mock test."}
            </p>
          </div>
          {!searchQuery && (
            <Link
              href="/admin/exams/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Mock Exam</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition p-6 flex flex-col justify-between space-y-5 shadow-lg group"
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(exam)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      exam.is_active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                    }`}
                    title="Click to toggle active state"
                  >
                    {exam.is_active ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-slate-400" />
                        <span>Draft</span>
                      </>
                    )}
                  </button>

                  <span className="text-xs text-slate-500 font-mono">
                    {exam.questions_count ?? 0} Questions
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition leading-snug">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {exam.description}
                    </p>
                  )}
                </div>

                {/* Specifications Grid */}
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
                    Scheme: +{exam.positive_marks} / -{exam.negative_marks}{" "}
                    {exam.has_negative_marking ? "(Neg. Applied)" : "(No Neg.)"}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <Link
                  href={`/admin/exams/${exam.id}/questions`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-semibold transition"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Manage Questions</span>
                </Link>

                <button
                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                  disabled={deletingId === exam.id}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition disabled:opacity-50 cursor-pointer"
                  title="Delete Exam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
