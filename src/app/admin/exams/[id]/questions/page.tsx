"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Exam, Question, Subject, QuestionType } from "@/types/database";
import MathView, { sanitizeMathProse } from "@/components/MathView";
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
  Image as ImageIcon,
  ImagePlus,
  UploadCloud,
  X,
  Check,
  Clipboard,
  ExternalLink,
  FileEdit,
} from "lucide-react";

async function uploadQuestionImageBlob(
  supabase: ReturnType<typeof createClient>,
  examId: string,
  filename: string,
  blob: Blob
): Promise<string | null> {
  const cleanFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  // 1. Try 'question-images' bucket
  try {
    const path = `${examId}/${cleanFilename}`;
    const { error } = await supabase.storage
      .from("question-images")
      .upload(path, blob, { contentType: blob.type || "image/png", upsert: true });

    if (!error) {
      const { data } = supabase.storage.from("question-images").getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (err) {
    console.warn("Storage upload to question-images notice:", err);
  }

  // 2. Fallback to 'exam-pdfs' bucket under diagrams/{examId}/
  try {
    const fbPath = `diagrams/${examId}/${cleanFilename}`;
    const { error: fbErr } = await supabase.storage
      .from("exam-pdfs")
      .upload(fbPath, blob, { contentType: blob.type || "image/png", upsert: true });

    if (!fbErr) {
      const { data } = supabase.storage.from("exam-pdfs").getPublicUrl(fbPath);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (fbErr) {
    console.warn("Storage upload to exam-pdfs fallback notice:", fbErr);
  }

  return null;
}

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
  const [togglingPublish, setTogglingPublish] = useState(false);

  const handleTogglePublish = async () => {
    if (!exam) return;
    const nextStatus = !exam.is_active;
    try {
      setTogglingPublish(true);
      const { error } = await supabase
        .from("exams")
        .update({ is_active: nextStatus })
        .eq("id", exam.id);

      if (error) {
        alert(`Failed to update publication status: ${error.message}`);
      } else {
        setExam((prev) => (prev ? { ...prev, is_active: nextStatus } : prev));
        setSuccessNotice(
          nextStatus
            ? "Exam successfully published! It is now live and available to candidates."
            : "Exam moved to Draft. It is now hidden from candidates."
        );
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle status.");
    } finally {
      setTogglingPublish(false);
    }
  };

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
          ? [
              sanitizeMathProse(optionA.trim()),
              sanitizeMathProse(optionB.trim()),
              sanitizeMathProse(optionC.trim()),
              sanitizeMathProse(optionD.trim()),
            ]
          : null;

      const correctAnswerValue =
        questionType === "mcq" ? correctOption : numericalAnswer.trim();

      const newQuestionPayload = {
        exam_id: examId,
        subject,
        type: questionType,
        question_text: sanitizeMathProse(questionText.trim()),
        options: optionsArray,
        correct_answer: correctAnswerValue,
        explanation: explanation.trim()
          ? sanitizeMathProse(explanation.trim())
          : null,
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

  // Replace / Add Diagram Image Modal State
  interface ImageModalState {
    isOpen: boolean;
    question: Question | null;
    newBlob: Blob | null;
    newPreviewUrl: string | null;
    isUploading: boolean;
    isRemoving: boolean;
    error: string | null;
  }

  const [imageModal, setImageModal] = useState<ImageModalState>({
    isOpen: false,
    question: null,
    newBlob: null,
    newPreviewUrl: null,
    isUploading: false,
    isRemoving: false,
    error: null,
  });

  const openImageModal = (q: Question) => {
    setImageModal({
      isOpen: true,
      question: q,
      newBlob: null,
      newPreviewUrl: null,
      isUploading: false,
      isRemoving: false,
      error: null,
    });
  };

  const closeImageModal = () => {
    if (imageModal.newPreviewUrl) {
      URL.revokeObjectURL(imageModal.newPreviewUrl);
    }
    setImageModal({
      isOpen: false,
      question: null,
      newBlob: null,
      newPreviewUrl: null,
      isUploading: false,
      isRemoving: false,
      error: null,
    });
  };

  const handleSelectImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageModal((prev) => ({
        ...prev,
        error: "Please select a valid image file (PNG, JPG, WebP, SVG).",
      }));
      return;
    }
    const preview = URL.createObjectURL(file);
    setImageModal((prev) => ({
      ...prev,
      newBlob: file,
      newPreviewUrl: preview,
      error: null,
    }));
  };

  // Listen for Ctrl+V paste while modal is open
  useEffect(() => {
    if (!imageModal.isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const preview = URL.createObjectURL(file);
            setImageModal((prev) => ({
              ...prev,
              newBlob: file,
              newPreviewUrl: preview,
              error: null,
            }));
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [imageModal.isOpen]);

  const handleUploadAndSaveImage = async () => {
    if (!imageModal.question || !imageModal.newBlob) return;
    const qId = imageModal.question.id;

    setImageModal((prev) => ({ ...prev, isUploading: true, error: null }));
    try {
      const filename =
        imageModal.newBlob instanceof File && imageModal.newBlob.name
          ? imageModal.newBlob.name
          : "diagram.png";

      const publicUrl = await uploadQuestionImageBlob(
        supabase,
        examId,
        filename,
        imageModal.newBlob
      );

      if (!publicUrl) {
        throw new Error("Failed to upload image to Supabase Storage.");
      }

      // Update question record in Supabase
      const { error: dbError } = await supabase
        .from("questions")
        .update({ image_url: publicUrl })
        .eq("id", qId);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Update local state
      setQuestions((prev) =>
        prev.map((item) => (item.id === qId ? { ...item, image_url: publicUrl } : item))
      );

      setSuccessNotice(`Question diagram updated successfully!`);
      closeImageModal();
    } catch (err: unknown) {
      console.error("Image upload/save error:", err);
      setImageModal((prev) => ({
        ...prev,
        isUploading: false,
        error: err instanceof Error ? err.message : "Failed to update question image.",
      }));
    }
  };

  const handleRemoveExistingImage = async () => {
    if (!imageModal.question) return;
    const qId = imageModal.question.id;

    if (!confirm("Remove this diagram from the question?")) return;

    setImageModal((prev) => ({ ...prev, isRemoving: true, error: null }));
    try {
      const { error: dbError } = await supabase
        .from("questions")
        .update({ image_url: null })
        .eq("id", qId);

      if (dbError) {
        throw new Error(dbError.message);
      }

      setQuestions((prev) =>
        prev.map((item) => (item.id === qId ? { ...item, image_url: null } : item))
      );

      setSuccessNotice("Diagram removed from question.");
      closeImageModal();
    } catch (err: unknown) {
      console.error("Remove image error:", err);
      setImageModal((prev) => ({
        ...prev,
        isRemoving: false,
        error: err instanceof Error ? err.message : "Failed to remove diagram.",
      }));
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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {exam.title}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                exam.is_active
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {exam.is_active ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Published (Live)</span>
                </>
              ) : (
                <>
                  <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                  <span>Draft (Hidden)</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Duration: {exam.duration_minutes} Mins • Total Marks: {exam.total_marks} • Marking: +
            {exam.positive_marks} / -{exam.negative_marks}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Publish / Move to Draft One-Click Toggle */}
          <button
            type="button"
            onClick={handleTogglePublish}
            disabled={togglingPublish}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm cursor-pointer disabled:opacity-50 ${
              exam.is_active
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25"
            }`}
            title={
              exam.is_active
                ? "Unpublish exam to Draft (hide from candidates)"
                : "Publish exam live for candidates"
            }
          >
            {togglingPublish ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : exam.is_active ? (
              <FileEdit className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-white" />
            )}
            <span>{exam.is_active ? "Unpublish to Draft" : "Publish Exam"}</span>
          </button>

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

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-mono mr-1">
                      +{q.positive_marks} / -{q.negative_marks}
                    </span>

                    <button
                      type="button"
                      onClick={() => openImageModal(q)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                        q.image_url
                          ? "bg-purple-950/40 hover:bg-purple-900/60 border-purple-700/50 text-purple-300"
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                      }`}
                      title={q.image_url ? "Replace or remove diagram" : "Add diagram / image to question"}
                    >
                      {q.image_url ? (
                        <>
                          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                          <span>Replace Image</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-3.5 h-3.5 text-blue-400" />
                          <span>Add Image</span>
                        </>
                      )}
                    </button>

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
                <div className="text-sm text-slate-100 leading-relaxed font-normal space-y-2">
                  <MathView math={q.question_text} />
                  {q.image_url && (
                    <div className="pt-2 flex items-start gap-3">
                      <div className="relative group max-w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.image_url}
                          alt="Question Diagram"
                          className="max-h-56 max-w-full rounded-xl border border-slate-800 bg-white/5 object-contain"
                        />
                        <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openImageModal(q)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md transition cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <a
                            href={q.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                            title="Open diagram in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
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

      {/* Replace / Add Diagram Image Modal */}
      {imageModal.isOpen && imageModal.question && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      {imageModal.question.image_url
                        ? "Replace Question Diagram"
                        : "Add Question Diagram"}
                    </span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      (Question {questions.findIndex((q) => q.id === imageModal.question?.id) + 1})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Paste a screenshot (<kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Ctrl+V</kbd>) anywhere or choose an image file from your computer
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeImageModal}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {imageModal.error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{imageModal.error}</span>
                </div>
              )}

              {/* Paste or Drop Zone */}
              <label
                htmlFor="diagram-file-picker"
                className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition cursor-pointer ${
                  imageModal.newPreviewUrl
                    ? "border-emerald-500/50 bg-emerald-950/10"
                    : "border-purple-500/40 hover:border-purple-400 bg-slate-950/60 hover:bg-purple-950/10"
                }`}
              >
                <input
                  id="diagram-file-picker"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectImageFile(f);
                  }}
                />

                {imageModal.newPreviewUrl ? (
                  <div className="space-y-3 text-center w-full">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>New Screenshot / Image Ready</span>
                    </div>

                    <div className="max-h-60 overflow-hidden flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageModal.newPreviewUrl}
                        alt="New diagram preview"
                        className="max-h-56 max-w-full object-contain rounded-lg"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Click to choose a different file or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">Ctrl+V</kbd> to paste another screenshot
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-center py-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-1">
                      <Clipboard className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">
                      Press <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300 font-mono text-xs">Ctrl + V</kbd> to paste screenshot
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm">
                      or click here to browse and select an image file from your computer (PNG, JPG, WebP)
                    </p>
                  </div>
                )}
              </label>

              {/* Current Question Diagram (if already exists and user hasn't selected new yet) */}
              {!imageModal.newPreviewUrl && imageModal.question.image_url && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-400 block">
                    Current Question Diagram:
                  </span>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 max-h-44 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageModal.question.image_url}
                      alt="Current Diagram"
                      className="max-h-40 max-w-full object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
              {imageModal.question.image_url ? (
                <button
                  type="button"
                  onClick={handleRemoveExistingImage}
                  disabled={imageModal.isRemoving || imageModal.isUploading}
                  className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-red-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{imageModal.isRemoving ? "Removing..." : "Remove Diagram"}</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={closeImageModal}
                  disabled={imageModal.isUploading}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUploadAndSaveImage}
                  disabled={!imageModal.newBlob || imageModal.isUploading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 active:scale-[0.99] disabled:opacity-40 transition cursor-pointer"
                >
                  {imageModal.isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Uploading to Storage...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Upload & Save Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
