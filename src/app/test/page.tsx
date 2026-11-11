"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

export default function CandidateTestPortalPage() {
  const [supabase] = useState(() => createClient());
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && !ignore) {
          setUserEmail(user.email ?? "Candidate");
        }

        const { data: examsData } = await supabase
          .from("exams")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!ignore && examsData) {
          // Fetch questions count for each exam
          const examsWithCounts = await Promise.all(
            examsData.map(async (exam) => {
              const { count } = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("exam_id", exam.id);
              return { ...exam, questions_count: count ?? 0 };
            })
          );
          setExams(examsWithCounts);
        }
      } catch (err) {
        console.error("Error fetching exams:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [supabase]);

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
              </h1>
              <p className="text-xs text-slate-400">
                National Testing Agency • Candidate Roll: {userEmail ?? "Authenticated"}
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Portal Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-8 my-4">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Active Test Papers
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Official All India JEE (Main) Mock Examinations
          </h2>
          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            Select an examination below to view the official NTA CBT instructions, test guidelines,
            and proceed to your simulated examination terminal.
          </p>
        </div>

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
            <Link
              href="/admin/exams/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
            >
              <span>Go to Admin Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition p-6 flex flex-col justify-between space-y-5 shadow-lg group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      <span>Ready for Testing</span>
                    </span>
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
                  <Link
                    href={`/test/${exam.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99]"
                  >
                    <span>Instructions & Start Test</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
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
