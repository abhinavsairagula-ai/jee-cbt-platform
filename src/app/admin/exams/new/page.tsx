"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function CreateExamPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [totalMarks, setTotalMarks] = useState(300);
  const [positiveMarks, setPositiveMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);
  const [hasNegativeMarking, setHasNegativeMarking] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please enter an exam title.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: Number(durationMinutes),
        total_marks: Number(totalMarks),
        positive_marks: Number(positiveMarks),
        negative_marks: hasNegativeMarking ? Number(negativeMarks) : 0,
        has_negative_marking: hasNegativeMarking,
        is_active: isActive,
      };

      const { data, error } = await supabase
        .from("exams")
        .insert(payload)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (data?.id) {
        // Redirect to question manager for this exam
        router.push(`/admin/exams/${data.id}/questions`);
      } else {
        router.push("/admin");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create exam.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb / Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/admin" className="hover:text-white transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exams Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-slate-200">New Exam Specification</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Create New Mock Exam
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure the examination duration, marking criteria, and paper details.
        </p>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: General Details */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <span>General Paper Details</span>
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Exam Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JEE (Main) 2026 - All India Grand Mock Test 1"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Description / Instructions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Full syllabus mock examination covering Physics, Chemistry, and Mathematics as per the latest NTA exam pattern."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-xs font-semibold text-slate-200">Publication Status</div>
              <div className="text-[11px] text-slate-400">
                Activate to make this exam available to candidates.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer"
            >
              {isActive ? (
                <ToggleRight className="w-7 h-7 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-slate-600" />
              )}
              <span className="text-xs font-medium">{isActive ? "Active" : "Draft"}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Timing & Marks Configuration */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Duration & Marking Scheme</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Exam Duration (Minutes)
              </label>
              <input
                type="number"
                min={1}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <span className="text-[11px] text-slate-500">Standard JEE Main: 180 Minutes (3h)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Total Marks
              </label>
              <input
                type="number"
                min={1}
                required
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <span className="text-[11px] text-slate-500">Standard JEE Main: 300 Marks</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Positive Marks (Per Correct Response)
              </label>
              <input
                type="number"
                min={0}
                required
                value={positiveMarks}
                onChange={(e) => setPositiveMarks(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Negative Marks (Per Incorrect Response)
              </label>
              <input
                type="number"
                min={0}
                disabled={!hasNegativeMarking}
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-xs font-semibold text-slate-200">Enable Negative Marking</div>
              <div className="text-[11px] text-slate-400">
                Deduct marks for incorrect answers according to the negative marks scheme.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHasNegativeMarking(!hasNegativeMarking)}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer"
            >
              {hasNegativeMarking ? (
                <ToggleRight className="w-7 h-7 text-indigo-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-slate-600" />
              )}
              <span className="text-xs font-medium">
                {hasNegativeMarking ? "Enabled" : "Disabled"}
              </span>
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition border border-slate-700"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Exam...</span>
              </>
            ) : (
              <span>Create Exam & Manage Questions →</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
