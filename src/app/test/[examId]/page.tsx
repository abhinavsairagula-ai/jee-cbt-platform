"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/types/database";
import {
  GraduationCap,
  ArrowLeft,
  Clock,
  Award,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  BookOpen,
} from "lucide-react";

function ExamInstructionsContent() {
  const params = useParams();
  const examId = params?.examId as string;
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadExam() {
      if (!examId) return;
      try {
        const { data, error } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (!ignore) {
          if (error || !data) {
            setExam(null);
          } else {
            setExam(data);
          }
        }
      } catch (err) {
        console.error("Error loading exam:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadExam();
    return () => {
      ignore = true;
    };
  }, [examId, supabase]);

  const handleProceed = async () => {
    if (!agreed) {
      setErrorMsg("Please read and accept the declaration to proceed.");
      return;
    }

    try {
      setProceeding(true);
      setErrorMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirectTo=/test/${examId}`);
        return;
      }

      // Check if an existing in-progress submission exists
      const { data: existingSub } = await supabase
        .from("submissions")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("exam_id", examId)
        .eq("status", "in_progress")
        .maybeSingle();

      if (existingSub?.id) {
        // Resume existing session
        router.push(`/test/${examId}/session`);
        return;
      }

      // Create new submission
      const { error: insertError } = await supabase.from("submissions").insert({
        user_id: user.id,
        exam_id: examId,
        status: "in_progress",
        start_time: new Date().toISOString(),
        answers: {},
      });

      if (insertError) {
        console.warn("Could not insert submission record:", insertError.message);
        // Even if table insert fails due to DB configuration, proceed to session so candidate can take test
      }

      router.push(`/test/${examId}/session`);
    } catch (err: unknown) {
      console.error("Error initiating session:", err);
      // Fallback: still navigate to session
      router.push(`/test/${examId}/session`);
    } finally {
      setProceeding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading exam instructions...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-red-400 font-bold text-xl">Examination Not Found</div>
        <p className="text-sm text-slate-400 max-w-md">
          The requested examination paper could not be loaded or is currently unavailable.
        </p>
        <Link
          href="/test"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Test Portal</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Official Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                JEE (Main) Computer Based Test (CBT)
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Instructions
                </span>
              </h1>
              <p className="text-xs text-slate-400">National Testing Agency • Examination Instructions</p>
            </div>
          </div>

          <Link
            href="/test"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Instructions Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8 my-4">
        {/* Exam Title & Overview Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Question Paper
              </span>
              <h2 className="text-2xl font-black text-white mt-0.5">{exam.title}</h2>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{exam.duration_minutes} Minutes</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400">
                <Award className="w-4 h-4" />
                <span className="font-semibold">{exam.total_marks} Marks</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 leading-relaxed space-y-1">
            <p>
              <strong>Marking Scheme:</strong> For each correct answer, you will be awarded{" "}
              <span className="text-emerald-400 font-semibold">+{exam.positive_marks} marks</span>.
              For each incorrect response,{" "}
              <span className="text-red-400 font-semibold">
                -{exam.has_negative_marking ? exam.negative_marks : 0} mark
              </span>{" "}
              will be deducted. Unanswered questions will receive 0 marks.
            </p>
          </div>
        </div>

        {/* NTA Standard 5-Color Status Legend */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Question Palette Status Legend (NTA CBT Standard)</span>
          </div>

          <p className="text-xs text-slate-400">
            The question palette on the right side of the screen will show the status of each question
            using one of the following symbols:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
            {/* 1. Not Visited */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="w-8 h-8 rounded-lg bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                01
              </span>
              <span className="text-xs text-slate-300">You have not visited the question yet.</span>
            </div>

            {/* 2. Not Answered */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="w-8 h-8 rounded-lg bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                02
              </span>
              <span className="text-xs text-slate-300">You have not answered the question.</span>
            </div>

            {/* 3. Answered */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                03
              </span>
              <span className="text-xs text-slate-300">You have answered the question.</span>
            </div>

            {/* 4. Marked for Review */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                04
              </span>
              <span className="text-xs text-slate-300">
                You have NOT answered, but marked for review.
              </span>
            </div>

            {/* 5. Answered & Marked for Review */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 sm:col-span-2">
              <span className="relative w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                05
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
              </span>
              <span className="text-xs text-slate-300">
                The question is <strong>Answered & Marked for Review</strong> (will be considered for
                evaluation).
              </span>
            </div>
          </div>
        </div>

        {/* General Test Instructions */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>General Instructions for Candidate</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2.5 pl-1">
              <li>
                The total duration of the examination is{" "}
                <strong className="text-white">{exam.duration_minutes} minutes</strong>. The server
                clock will be displayed at the top right of your screen. When the timer reaches
                zero, the examination will be <strong>auto-submitted</strong>.
              </li>
              <li>
                The paper contains questions divided across three sections:{" "}
                <strong className="text-cyan-400">Physics</strong>,{" "}
                <strong className="text-emerald-400">Chemistry</strong>, and{" "}
                <strong className="text-indigo-400">Mathematics</strong>. You can freely switch
                between sections at any time.
              </li>
              <li>
                <strong>To answer a Multiple Choice Question (MCQ):</strong> Select the radio button
                corresponding to your answer and click <em>Save &amp; Next</em>.
              </li>
              <li>
                <strong>To answer a Numerical Question:</strong> Enter the numerical value in the
                designated box and click <em>Save &amp; Next</em>.
              </li>
              <li>
                To clear your selected response, click <em>Clear Response</em>.
              </li>
              <li>
                To mark a question for review without selecting an answer, click{" "}
                <em>Mark for Review &amp; Next</em>.
              </li>
              <li>
                Questions answered and marked for review will be evaluated.
              </li>
            </ol>
          </div>
        </div>

        {/* Declaration Box */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Candidate Declaration</span>
          </div>

          <label className="flex items-start gap-3 text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setErrorMsg(null);
              }}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 shrink-0"
            />
            <span>
              I have read and understood all the instructions given above. All computer hardware
              and network allotted to me are in proper working condition. I agree that in case of not
              adhering to instructions, I will be debarred from this examination and/or liable to
              disciplinary action.
            </span>
          </label>

          {errorMsg && (
            <div className="text-xs text-red-400 font-medium">{errorMsg}</div>
          )}

          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={handleProceed}
              disabled={!agreed || proceeding}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2.5"
            >
              {proceeding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entering Exam Terminal...</span>
                </>
              ) : (
                <>
                  <span>I am ready to begin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        © 2026 National Testing Agency / JEE (Main). CBT Simulated Terminal.
      </footer>
    </div>
  );
}

export default function ExamInstructionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ExamInstructionsContent />
    </Suspense>
  );
}
