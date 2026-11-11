"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam, Question, Subject, QuestionType } from "@/types/database";
import MathView from "@/components/MathView";
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Atom,
  FlaskConical,
  Calculator,
  HelpCircle,
  Eye,
} from "lucide-react";

const SUBJECT_CONFIG: Record<
  Subject,
  { label: string; icon: typeof Atom; color: string; badge: string }
> = {
  physics: {
    label: "Physics",
    icon: Atom,
    color: "text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  chemistry: {
    label: "Chemistry",
    icon: FlaskConical,
    color: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  mathematics: {
    label: "Mathematics",
    icon: Calculator,
    color: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
};

function ExamQuestionsContent() {
  const params = useParams();
  const examId = params?.id as string;

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state: 'all' | Subject
  const [activeTab, setActiveTab] = useState<"all" | Subject>("all");

  // Add question form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [subject, setSubject] = useState<Subject>("physics");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState<"A" | "B" | "C" | "D">("A");
  const [numericalAnswer, setNumericalAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [positiveMarks, setPositiveMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!examId) return;
      try {
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (!ignore) {
          if (examError || !examData) {
            setExam(null);
          } else {
            setExam(examData);
            setPositiveMarks(examData.positive_marks ?? 4);
            setNegativeMarks(examData.has_negative_marking ? examData.negative_marks ?? 1 : 0);
          }
        }

        const { data: qData, error: qError } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", examId)
          .order("created_at", { ascending: true });

        if (!ignore) {
          if (qError) {
            setQuestions([]);
          } else {
            setQuestions(qData || []);
          }
        }
      } catch (err) {
        console.error("Error loading exam:", err);
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
  }, [examId, supabase]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setFormError("Question statement is required.");
      return;
    }

    if (questionType === "mcq") {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        setFormError("All 4 MCQ options (A, B, C, D) are required.");
        return;
      }
    } else {
      if (!numericalAnswer.trim()) {
        setFormError("Numerical correct answer is required.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setFormError(null);
      setSuccessNotice(null);

      const optionsArray =
        questionType === "mcq"
          ? [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()]
          : null;

      const correctAnswerValue =
        questionType === "mcq" ? correctOption : numericalAnswer.trim();

      const newQuestionPayload = {
        exam_id: examId,
        subject,
        type: questionType,
        question_text: questionText.trim(),
        options: optionsArray,
        correct_answer: correctAnswerValue,
        explanation: explanation.trim() || null,
        positive_marks: Number(positiveMarks),
        negative_marks: Number(negativeMarks),
      };

      const { data, error } = await supabase
        .from("questions")
        .insert(newQuestionPayload)
        .select()
        .single();

      if (error) {
        setFormError(error.message);
        setSubmitting(false);
        return;
      }

      // Append new question to state
      if (data) {
        setQuestions((prev) => [...prev, data]);
      }

      // Reset form
      setQuestionText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setNumericalAnswer("");
      setExplanation("");
      setSuccessNotice("Question added successfully!");
      setShowAddForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to add question.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase.from("questions").delete().eq("id", qId);
      if (error) {
        alert(`Failed to delete question: ${error.message}`);
      } else {
        setQuestions((prev) => prev.filter((q) => q.id !== qId));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting question.");
    }
  };

  const physicsCount = questions.filter((q) => q.subject === "physics").length;
  const chemCount = questions.filter((q) => q.subject === "chemistry").length;
  const mathCount = questions.filter((q) => q.subject === "mathematics").length;

  const filteredQuestions =
    activeTab === "all"
      ? questions
      : questions.filter((q) => q.subject === activeTab);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading exam & questions...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-red-400 font-semibold text-lg">Exam Not Found</div>
        <p className="text-sm text-slate-400">
          The requested exam does not exist or has been deleted.
        </p>
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
    <div className="space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-white transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exams</span>
            </Link>
            <span>/</span>
            <span className="text-slate-200">Question Manager</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {exam.title}
          </h1>
          <p className="text-xs text-slate-400">
            Duration: {exam.duration_minutes} Mins • Total Marks: {exam.total_marks} • Marking: +
            {exam.positive_marks} / -{exam.negative_marks}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/exams/${examId}/import`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-purple-500/25 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>AI PDF Importer</span>
          </Link>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-sm transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span>{showAddForm ? "Hide Form" : "Add Manually"}</span>
          </button>
        </div>
      </div>

      {/* Subject Section Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Questions
          </div>
          <div className="text-2xl font-black text-white mt-1">{questions.length}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <Atom className="w-3.5 h-3.5" />
            <span>Physics</span>
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-1">{physicsCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Chemistry</span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{chemCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" />
            <span>Mathematics</span>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-1">{mathCount}</div>
        </div>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add Question Collapsible Form */}
      {showAddForm && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-blue-500/30 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Add Question to Mock Exam</h2>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAddQuestion} className="space-y-6">
            {/* Subject and Type Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Section / Subject</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["physics", "chemistry", "mathematics"] as Subject[]).map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setSubject(subj)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        subject === subj
                          ? `${SUBJECT_CONFIG[subj].badge} border-blue-500/40 ring-1 ring-blue-500/40`
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      <span>{SUBJECT_CONFIG[subj].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Question Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionType("mcq")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      questionType === "mcq"
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/40 ring-1 ring-blue-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    MCQ (Single Correct)
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionType("numerical")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      questionType === "numerical"
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/40 ring-1 ring-blue-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Numerical Value
                  </button>
                </div>
              </div>
            </div>

            {/* Question Text with Live KaTeX Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Question Statement (Supports LaTeX with $...$ or $$...$$)
                </label>
                <span className="text-[11px] text-slate-500">
                  {"Example: If $f(x) = \\int_0^x \\frac{dt}{1+t^3}$, find $f'(1)$"}
                </span>
              </div>
              <textarea
                rows={4}
                required
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter the problem statement here. Use $x^2$ for inline math or $$E=mc^2$$ for block math."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 transition font-mono"
              />

              {/* Live KaTeX Preview Card */}
              {questionText.trim() && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Math Preview</span>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed pt-1">
                    <MathView math={questionText} />
                  </div>
                </div>
              )}
            </div>

            {/* MCQ Options vs Numerical Answer */}
            {questionType === "mcq" ? (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-300">
                  Multiple Choice Options & Correct Answer Selection:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "A", val: optionA, set: setOptionA },
                    { key: "B", val: optionB, set: setOptionB },
                    { key: "C", val: optionC, set: setOptionC },
                    { key: "D", val: optionD, set: setOptionD },
                  ].map(({ key, val, set }) => (
                    <div
                      key={key}
                      className={`p-3.5 rounded-xl border transition ${
                        correctOption === key
                          ? "bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/40"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-300">Option {key}</span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="radio"
                            name="correctOption"
                            checked={correctOption === key}
                            onChange={() => setCorrectOption(key as "A" | "B" | "C" | "D")}
                            className="text-emerald-500 focus:ring-emerald-500"
                          />
                          <span
                            className={correctOption === key ? "text-emerald-400 font-semibold" : ""}
                          >
                            Correct
                          </span>
                        </label>
                      </div>

                      <input
                        type="text"
                        required
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder={`Option ${key} text or formula (e.g. $\\sqrt{2}/2$)`}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500 transition"
                      />

                      {/* Live Option Preview if contains math */}
                      {val.trim() && val.includes("$") && (
                        <div className="mt-1.5 text-xs text-slate-300">
                          <MathView math={val} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Numerical Answer Input */
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-sm">
                <label className="text-xs font-semibold text-slate-300">
                  Correct Numerical Value (Integer or Decimal)
                </label>
                <input
                  type="text"
                  required
                  value={numericalAnswer}
                  onChange={(e) => setNumericalAnswer(e.target.value)}
                  placeholder="e.g. 24 or 3.14"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition font-mono"
                />
              </div>
            )}

            {/* Explanation / Solution */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Solution / Detailed Explanation (Optional)
              </label>
              <textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Provide a step-by-step mathematical explanation. LaTeX math supported."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-blue-500 transition"
              />

              {explanation.trim() && (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">
                    Solution Preview
                  </div>
                  <MathView math={explanation} />
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Question...</span>
                  </>
                ) : (
                  <span>Save Question to Paper</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions Filter & Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "all"
                ? "bg-slate-800 text-white border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Questions ({questions.length})
          </button>

          {(["physics", "chemistry", "mathematics"] as Subject[]).map((subj) => (
            <button
              key={subj}
              onClick={() => setActiveTab(subj)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === subj
                  ? `${SUBJECT_CONFIG[subj].badge} border`
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{SUBJECT_CONFIG[subj].label}</span>
              <span className="opacity-70">
                ({questions.filter((q) => q.subject === subj).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-white">No questions in this section yet</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &quot;Add New Question&quot; to author problems with math equations, MCQ choices,
            and numerical answers.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href={`/admin/exams/${examId}/import`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-500/25 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Import from PDF (AI)</span>
            </Link>

            <button
              onClick={() => {
                setShowAddForm(true);
                if (activeTab !== "all") setSubject(activeTab);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, index) => {
            const subjMeta = SUBJECT_CONFIG[q.subject];
            const SubjIcon = subjMeta.icon;

            return (
              <div
                key={q.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700/80 transition shadow-sm"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-xs text-white">
                      {index + 1}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${subjMeta.badge}`}
                    >
                      <SubjIcon className="w-3 h-3" />
                      <span>{subjMeta.label}</span>
                    </span>

                    <span className="text-[11px] font-medium uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {q.type === "mcq" ? "MCQ" : "Numerical"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-mono">
                      +{q.positive_marks} / -{q.negative_marks}
                    </span>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Statement with KaTeX */}
                <div className="text-sm text-slate-100 leading-relaxed font-normal">
                  <MathView math={q.question_text} />
                </div>

                {/* MCQ Options Display */}
                {q.type === "mcq" && q.options && q.options.length === 4 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {(["A", "B", "C", "D"] as const).map((optKey, optIdx) => {
                      const isCorrect = q.correct_answer === optKey;
                      const optText = q.options![optIdx];

                      return (
                        <div
                          key={optKey}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                            isCorrect
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                              : "bg-slate-950 border-slate-800/80 text-slate-300"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              isCorrect
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-slate-900 text-slate-400 border border-slate-800"
                            }`}
                          >
                            {optKey}
                          </span>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <MathView math={optText} />
                          </div>
                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numerical Answer Display */}
                {q.type === "numerical" && (
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Correct Value:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      {q.correct_answer}
                    </span>
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="pt-2 text-xs text-slate-400 border-t border-slate-800/60 space-y-1">
                    <span className="font-semibold text-slate-300">Explanation:</span>
                    <div className="text-slate-400 leading-relaxed">
                      <MathView math={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExamQuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ExamQuestionsContent />
    </Suspense>
  );
}
