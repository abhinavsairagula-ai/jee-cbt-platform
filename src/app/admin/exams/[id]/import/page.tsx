"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeParseJson } from "@/lib/json-repair";
import { GoogleGenAI } from "@google/genai";
import type { Exam, Subject, QuestionType } from "@/types/database";
import MathView from "@/components/MathView";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  Trash2,
  Plus,
  Save,
  Atom,
  FlaskConical,
  Calculator,
  Key,
  Cpu,
  ChevronDown,
} from "lucide-react";

interface EditableQuestion {
  id: string;
  exam_id: string;
  subject: Subject;
  type: QuestionType;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  positive_marks: number;
  negative_marks: number;
  isPreviewMode?: boolean;
}

const SUBJECT_CONFIG: Record<
  Subject,
  { label: string; icon: typeof Atom; color: string; badge: string; bg: string }
> = {
  physics: {
    label: "Physics",
    icon: Atom,
    color: "text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    bg: "border-cyan-500/30 hover:border-cyan-500/60",
  },
  chemistry: {
    label: "Chemistry",
    icon: FlaskConical,
    color: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    bg: "border-emerald-500/30 hover:border-emerald-500/60",
  },
  mathematics: {
    label: "Mathematics",
    icon: Calculator,
    color: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    bg: "border-indigo-500/30 hover:border-indigo-500/60",
  },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function formatGeminiErrorMessage(err: unknown): string {
  if (!err) return "Unknown error occurred.";
  if (typeof err === "string") return err;

  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    const rawMsg = err.message || "";

    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed.error?.message) {
        let innerMsg = parsed.error.message;
        try {
          const innerParsed = JSON.parse(innerMsg);
          if (innerParsed.error?.message) {
            innerMsg = innerParsed.error.message;
          }
        } catch {}
        const code = parsed.error.code || status || "";
        const codePrefix = code ? `[HTTP ${code}] ` : "";
        return `${codePrefix}${innerMsg}`;
      }
      if (parsed.message) {
        const codePrefix = status ? `[HTTP ${status}] ` : "";
        return `${codePrefix}${parsed.message}`;
      }
    } catch {}

    const codePrefix = status ? `[HTTP ${status}] ` : "";
    return `${codePrefix}${rawMsg}`;
  }

  return String(err);
}

function PdfImportContent() {
  const params = useParams();
  const examId = params?.id as string;
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  // Files
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [solutionPdf, setSolutionPdf] = useState<File | null>(null);
  const qInputRef = useRef<HTMLInputElement | null>(null);
  const sInputRef = useRef<HTMLInputElement | null>(null);

  // Gemini Configuration (reads localStorage or NEXT_PUBLIC_GEMINI_API_KEY fallback)
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return (
          localStorage.getItem("jee_gemini_api_key") ||
          process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
          ""
        );
      } catch {
        return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      }
    }
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  });
  const [model, setModel] = useState("gemini-3.8-flash");

  // Drag states
  const [isQDragOver, setIsQDragOver] = useState(false);
  const [isSDragOver, setIsSDragOver] = useState(false);

  // Parsing & Progress State
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string>("");
  const [parseProgress, setParseProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Extracted Questions Review
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<
    "all" | Subject
  >("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    "all" | QuestionType
  >("all");

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Load Exam Details
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
            setErrorMessage("Failed to load exam details.");
          } else {
            setExam(data);
          }
        }
      } catch (err) {
        console.error("Exam load error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadExam();
    return () => {
      ignore = true;
    };
  }, [examId, supabase]);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    try {
      if (val.trim()) {
        localStorage.setItem("jee_gemini_api_key", val.trim());
      } else {
        localStorage.removeItem("jee_gemini_api_key");
      }
    } catch {
      // Ignore
    }
  };

  // Cancel in-flight parsing
  const handleCancelParse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsParsing(false);
    setParseStatus("Extraction cancelled by user.");
    setErrorMessage("Parsing was cancelled.");
  };

  // Start AI Parsing: Runs 100% Client-Side to avoid Vercel 60s Serverless Timeout
  const handleParsePdf = async () => {
    if (!questionPdf) {
      setErrorMessage("Please select a Question Paper PDF file.");
      return;
    }

    // Resolve API Key: User input > NEXT_PUBLIC_GEMINI_API_KEY
    const effectiveApiKey = (
      apiKey.trim() ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      ""
    ).trim();

    if (!effectiveApiKey) {
      setErrorMessage(
        "Gemini API Key is missing. Please enter your Gemini API key in the settings input box or set NEXT_PUBLIC_GEMINI_API_KEY in your Vercel project environment variables."
      );
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsParsing(true);
    setParseProgress(5);
    setElapsedSeconds(0);
    setParseStatus("Reading PDF documents into base64...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let seconds = 0;
    const timerInterval = setInterval(() => {
      seconds += 1;
      setElapsedSeconds(seconds);

      // Smooth progressive updates
      if (seconds < 5) {
        setParseProgress((p) => Math.max(p, Math.min(30, 10 + seconds * 4)));
      } else if (seconds < 12) {
        setParseProgress((p) => Math.max(p, Math.min(55, 30 + (seconds - 5) * 3)));
      } else if (seconds < 25) {
        setParseProgress((p) => Math.max(p, Math.min(75, 55 + (seconds - 12) * 2)));
      } else if (seconds < 45) {
        setParseProgress((p) => Math.max(p, Math.min(90, 75 + (seconds - 25) * 1)));
      } else {
        setParseProgress((p) => Math.max(p, Math.min(96, 90 + Math.floor((seconds - 45) / 4))));
      }
    }, 1000);

    try {
      // 1. Convert Question Paper PDF to base64
      setParseStatus("Reading Question Paper PDF into memory...");
      setParseProgress(10);
      const qBase64 = await fileToBase64(questionPdf);

      // Non-blocking background backup to Supabase Storage
      supabase.storage
        .from("exam-pdfs")
        .upload(`${examId}/question_${Date.now()}.pdf`, questionPdf, {
          cacheControl: "3600",
          upsert: true,
        })
        .catch((storageErr) => {
          console.warn("Supabase storage backup notice:", storageErr?.message);
        });

      // 2. Convert Solution Paper if provided
      let solutionNote = "";
      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: qBase64,
          },
        },
      ];

      if (solutionPdf) {
        setParseStatus("Reading Solution Paper PDF into memory...");
        setParseProgress(20);
        try {
          const sBase64 = await fileToBase64(solutionPdf);
          parts.push({
            inlineData: {
              mimeType: "application/pdf",
              data: sBase64,
            },
          });
          solutionNote =
            "DOCUMENT 2 is the OFFICIAL SOLUTION & ANSWER KEY PAPER. Match each question from Document 1 with its corresponding official answer key and step-by-step solution from Document 2.";

          supabase.storage
            .from("exam-pdfs")
            .upload(`${examId}/solution_${Date.now()}.pdf`, solutionPdf, {
              cacheControl: "3600",
              upsert: true,
            })
            .catch((storageErr) => {
              console.warn("Supabase solution storage backup notice:", storageErr?.message);
            });
        } catch (sErr) {
          console.warn("Failed to encode solution paper:", sErr);
        }
      }

      if (!solutionNote) {
        solutionNote =
          "No separate solution paper is provided. Solve each question with complete accuracy, determine the correct answer, and provide a clear, step-by-step mathematical/conceptual solution.";
      }

      const systemPrompt = `You are an expert NTA JEE (Main) Question Paper Digitizer, LaTeX/KaTeX formatter, and academic examiner.
Your task is to parse and extract ALL questions from the attached Question Paper PDF (Document 1).
${solutionNote}

STRICT EXTRACTION AND FORMATTING INSTRUCTIONS:
1. SUBJECT IDENTIFICATION:
   - Assign each question to its exact subject: "physics", "chemistry", or "mathematics".
   - Maintain the standard order of the JEE examination (Section A: Physics, Section B: Chemistry, Section C: Mathematics).

2. QUESTION TYPE:
   - "mcq": Questions with 4 options.
   - "numerical": Questions requiring an integer or decimal numerical answer without options.

3. KATEX / LATEX FORMATTING & BACKSLASH ESCAPING (CRITICAL):
   - Escape all LaTeX backslashes as double backslashes (e.g. \\frac, \\int, \\theta) so the output is 100% valid JSON.
   - Every single variable, equation, scientific notation, unit, chemical formula, or mathematical symbol MUST be formatted in standard KaTeX.
   - Use '$...$' for inline math (e.g. '$x^2 + y^2 = r^2$', '$\\frac{hc}{\\lambda}$', '$\\text{KMnO}_4$').
   - Use '$$...$$' for standalone or display equations.
   - In JSON, ALWAYS write double backslashes for all LaTeX commands: use '\\\\frac', '\\\\int', '\\\\theta', '\\\\alpha', '\\\\sin', '\\\\vec', '\\\\sqrt', '\\\\cos', '\\\\text', '\\\\sum', etc. Never write a single backslash.
   - Format chemical species and reactions properly (e.g., '$\\text{H}_2\\text{SO}_4$', '$\\text{Zn} + 2\\text{HCl} \\rightarrow \\text{ZnCl}_2 + \\text{H}_2$').

4. MCQ OPTIONS & ANSWER:
   - For 'mcq', 'options' MUST be an array of EXACTLY 4 strings: [Option A text, Option B text, Option C text, Option D text].
   - Strip leading labels like "(A)", "(1)", "A.", "1.", "Option A:" from the option text. Retain only the option content/formula.
   - 'correct_answer' MUST be one of: "A", "B", "C", or "D". If the paper uses numbers 1, 2, 3, 4, map 1->A, 2->B, 3->C, 4->D.

5. NUMERICAL QUESTIONS:
   - For 'numerical', 'options' MUST be null.
   - 'correct_answer' MUST be the final numerical value string (e.g. "25", "3.5", "-4").

6. EXPLANATION:
   - Provide a concise 2-4 line derivation/rationale for 'explanation' highlighting the key formula and final numerical steps in KaTeX. Keep explanations focused to ensure fast processing.

7. OUTPUT SCHEMA:
   Return valid JSON with NO conversational markdown preamble or postscript.
   CRITICAL: Escape all LaTeX backslashes as double backslashes (e.g. \\frac, \\int, \\theta) so the output is 100% valid JSON:
   {
     "exam_title": "string or exam name found in paper",
     "questions": [
       {
         "subject": "physics" | "chemistry" | "mathematics",
         "type": "mcq" | "numerical",
         "question_text": "string with $KaTeX$ (all LaTeX backslashes double-escaped as \\\\)",
         "options": ["string", "string", "string", "string"] | null,
         "correct_answer": "A" | "B" | "C" | "D" | "numerical_string",
         "explanation": "string with $KaTeX$ (all LaTeX backslashes double-escaped as \\\\)"
       }
     ]
   }`;

      parts.push({ text: systemPrompt });

      // 3. Initialize GoogleGenAI client directly in browser
      const chosenModel = (model || "gemini-3.8-flash").replace(/^models\//, "");
      setParseStatus(`Connecting directly to Gemini API (${chosenModel})...`);
      setParseProgress(30);

      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

      const responseStream = await ai.models.generateContentStream({
        model: chosenModel,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 0,
          },
          abortSignal: controller.signal,
        },
      });

      // 4. Stream chunks directly into browser
      setParseStatus("Streaming question extraction directly from Gemini AI...");
      let fullText = "";
      let receivedBytes = 0;

      for await (const chunk of responseStream) {
        if (controller.signal.aborted) {
          throw new DOMException("Extraction was cancelled.", "AbortError");
        }
        const text = chunk.text;
        if (text) {
          fullText += text;
          receivedBytes += text.length;
          setParseStatus(
            `Streaming questions directly from Gemini (${(receivedBytes / 1024).toFixed(1)} KB received)...`
          );
        }
      }

      clearInterval(timerInterval);
      setParseProgress(98);
      setParseStatus("Sanitizing LaTeX backslashes & validating JSON schema...");

      let parsedResult: { exam_title?: string; questions?: unknown[] } | unknown[];
      try {
        parsedResult = safeParseJson<{ exam_title?: string; questions?: unknown[] } | unknown[]>(fullText);
      } catch (parseErr) {
        console.error("JSON parse/repair failed:", parseErr, fullText.slice(0, 500));
        throw new Error(
          `Failed to parse AI response into valid JSON: ${
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          }`
        );
      }

      const rawQuestions = Array.isArray(parsedResult)
        ? parsedResult
        : Array.isArray(parsedResult.questions)
        ? parsedResult.questions
        : [];

      if (rawQuestions.length === 0) {
        throw new Error("No questions were found in the AI response.");
      }

      setParseProgress(100);
      setParseStatus("Extraction complete!");

      const defaultPosMarks = exam?.positive_marks ?? 4;
      const defaultNegMarks = exam?.negative_marks ?? 1;

      interface RawParsedQ {
        subject?: string;
        type?: string;
        question_text?: string;
        options?: string[] | null;
        correct_answer?: string;
        explanation?: string | null;
        positive_marks?: number;
        negative_marks?: number;
      }

      const extractedList: EditableQuestion[] = rawQuestions.map(
        (item: unknown, idx: number) => {
          const q = (item || {}) as RawParsedQ;
          const subject: Subject = ["physics", "chemistry", "mathematics"].includes(
            q.subject?.toLowerCase() || ""
          )
            ? (q.subject!.toLowerCase() as Subject)
            : "physics";

          const type: QuestionType =
            q.type?.toLowerCase() === "numerical" ? "numerical" : "mcq";

          let options: string[] | null = null;
          if (type === "mcq") {
            if (Array.isArray(q.options) && q.options.length >= 4) {
              options = q.options.slice(0, 4).map((opt) => String(opt ?? "").trim());
            } else if (Array.isArray(q.options)) {
              options = [
                ...q.options.map((opt) => String(opt ?? "").trim()),
                ...Array(Math.max(0, 4 - q.options.length)).fill(""),
              ].slice(0, 4);
            } else {
              options = ["Option A", "Option B", "Option C", "Option D"];
            }
          }

          let correctAnswer = String(q.correct_answer ?? "").trim();
          if (type === "mcq") {
            const upper = correctAnswer.toUpperCase();
            if (["A", "B", "C", "D"].includes(upper)) {
              correctAnswer = upper;
            } else if (["1", "2", "3", "4"].includes(correctAnswer)) {
              const map: Record<string, string> = {
                "1": "A",
                "2": "B",
                "3": "C",
                "4": "D",
              };
              correctAnswer = map[correctAnswer] || "A";
            } else {
              correctAnswer = "A";
            }
          }

          return {
            id: `q-ext-${Date.now()}-${idx}`,
            exam_id: examId,
            subject,
            type,
            question_text: q.question_text || `Question ${idx + 1}`,
            options,
            correct_answer: correctAnswer,
            explanation: q.explanation || "",
            positive_marks: q.positive_marks ?? defaultPosMarks,
            negative_marks: q.negative_marks ?? defaultNegMarks,
            isPreviewMode: true,
          };
        }
      );

      setQuestions(extractedList);
      setSuccessMessage(
        `Successfully extracted ${extractedList.length} questions in ${seconds}s with KaTeX math formatting!`
      );
    } catch (err: unknown) {
      clearInterval(timerInterval);
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        setErrorMessage("Extraction was cancelled.");
      } else {
        console.error("Client AI Parse failed:", err);
        const detailedError = formatGeminiErrorMessage(err);
        setErrorMessage(detailedError);
      }
    } finally {
      clearInterval(timerInterval);
      setIsParsing(false);
      abortControllerRef.current = null;
    }
  };

  // Field updater
  const updateQuestionField = (
    id: string,
    field: keyof EditableQuestion,
    value: unknown
  ) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOptionText = (qId: string, optIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const newOpts = [...(q.options || ["", "", "", ""])];
        newOpts[optIndex] = text;
        return { ...q, options: newOpts };
      })
    );
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddNewQuestion = () => {
    const newQ: EditableQuestion = {
      id: `q-ext-manual-${Date.now()}`,
      exam_id: examId,
      subject: "physics",
      type: "mcq",
      question_text: "New Question Statement ($KaTeX$ supported)",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_answer: "A",
      explanation: "",
      positive_marks: exam?.positive_marks ?? 4,
      negative_marks: exam?.negative_marks ?? 1,
      isPreviewMode: false,
    };
    setQuestions((prev) => [newQ, ...prev]);
  };

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSub =
        selectedSubjectFilter === "all" || q.subject === selectedSubjectFilter;
      const matchType =
        selectedTypeFilter === "all" || q.type === selectedTypeFilter;
      return matchSub && matchType;
    });
  }, [questions, selectedSubjectFilter, selectedTypeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const physics = questions.filter((q) => q.subject === "physics").length;
    const chemistry = questions.filter((q) => q.subject === "chemistry").length;
    const mathematics = questions.filter((q) => q.subject === "mathematics").length;
    const mcq = questions.filter((q) => q.type === "mcq").length;
    const numerical = questions.filter((q) => q.type === "numerical").length;
    return {
      total: questions.length,
      physics,
      chemistry,
      mathematics,
      mcq,
      numerical,
    };
  }, [questions]);

  // Save all questions to Supabase in a batch insert
  const handleSaveAllToExam = async () => {
    if (questions.length === 0) {
      setErrorMessage("No questions available to save.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload = questions.map((q, idx) => ({
        exam_id: examId,
        subject: q.subject,
        type: q.type,
        question_text: q.question_text.trim(),
        options: q.type === "mcq" ? q.options : null,
        correct_answer: q.correct_answer.trim(),
        explanation: q.explanation?.trim() || null,
        positive_marks: q.positive_marks,
        negative_marks: q.negative_marks,
        order_index: idx + 1,
      }));

      const { error: insertError } = await supabase
        .from("questions")
        .insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccessMessage(
        `Successfully imported ${payload.length} questions into "${exam?.title || "Exam"}"!`
      );

      // Redirect back to question manager after 1.2s
      setTimeout(() => {
        router.push(`/admin/exams/${examId}/questions`);
      }, 1200);
    } catch (err: unknown) {
      console.error("Batch save error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to batch save questions to database."
      );
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-xs">Loading Exam & Importer Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href={`/admin/exams/${examId}/questions`}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Question Manager</span>
            </Link>
            <span className="text-slate-700">•</span>
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Gemini AI PDF Importer
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>AI Question Paper & Solution Importer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Target Exam:{" "}
            <span className="text-slate-200 font-semibold">{exam?.title}</span>{" "}
            ({exam?.duration_minutes} Mins • +{exam?.positive_marks} / -
            {exam?.negative_marks})
          </p>
        </div>

        {/* Action button if questions are ready */}
        {questions.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddNewQuestion}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Manual Question</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllToExam}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving {questions.length} Questions...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save All ({questions.length}) to Exam</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Notices */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section 1: Upload & Configuration Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Dual Dropzones (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Question Paper Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsQDragOver(true);
              }}
              onDragLeave={() => setIsQDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsQDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type === "application/pdf") {
                  setQuestionPdf(file);
                } else {
                  setErrorMessage("Please drop a valid PDF file.");
                }
              }}
              className={`p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center text-center relative ${
                isQDragOver
                  ? "border-purple-500 bg-purple-500/10"
                  : questionPdf
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              <input
                ref={qInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setQuestionPdf(file);
                }}
              />

              {questionPdf ? (
                <div className="space-y-2 w-full">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white truncate max-w-[220px] mx-auto">
                      {questionPdf.name}
                    </div>
                    <div className="text-[11px] text-emerald-400/80 mt-0.5">
                      {(questionPdf.size / (1024 * 1024)).toFixed(2)} MB • Ready
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestionPdf(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove File</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => qInputRef.current?.click()}
                  className="space-y-2.5 cursor-pointer w-full py-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-white block">
                      1. Question Paper PDF
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Drag & drop or{" "}
                      <span className="text-purple-400 underline">browse</span>
                    </span>
                  </div>
                  <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Mandatory
                  </span>
                </div>
              )}
            </div>

            {/* Solution Paper Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsSDragOver(true);
              }}
              onDragLeave={() => setIsSDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsSDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type === "application/pdf") {
                  setSolutionPdf(file);
                } else {
                  setErrorMessage("Please drop a valid PDF file.");
                }
              }}
              className={`p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center text-center relative ${
                isSDragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : solutionPdf
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              <input
                ref={sInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSolutionPdf(file);
                }}
              />

              {solutionPdf ? (
                <div className="space-y-2 w-full">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white truncate max-w-[220px] mx-auto">
                      {solutionPdf.name}
                    </div>
                    <div className="text-[11px] text-emerald-400/80 mt-0.5">
                      {(solutionPdf.size / (1024 * 1024)).toFixed(2)} MB • Ready
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSolutionPdf(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove File</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => sInputRef.current?.click()}
                  className="space-y-2.5 cursor-pointer w-full py-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-white block">
                      2. Solution / Answer Key PDF
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Drag & drop or{" "}
                      <span className="text-blue-400 underline">browse</span>
                    </span>
                  </div>
                  <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Optional
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Model & API Configuration */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Gemini Engine Settings</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Gemini API Key</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {process.env.NEXT_PUBLIC_GEMINI_API_KEY
                    ? "NEXT_PUBLIC_GEMINI_API_KEY active as default"
                    : "Enter key or set NEXT_PUBLIC_GEMINI_API_KEY"}
                </span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={
                    process.env.NEXT_PUBLIC_GEMINI_API_KEY
                      ? "Using NEXT_PUBLIC_GEMINI_API_KEY (or override here)"
                      : "AIzaSy... or AQ... (leave blank if set in env)"
                  }
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition"
                />
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Extraction Model
              </label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500 appearance-none cursor-pointer transition"
                >
                  <option value="gemini-3.8-flash">
                    gemini-3.8-flash (Recommended • Streaming Fast)
                  </option>
                  <option value="gemini-flash-latest">
                    gemini-flash-latest (General Fast)
                  </option>
                  <option value="gemini-3.1-flash-lite">
                    gemini-3.1-flash-lite (Ultra Fast • Low Latency)
                  </option>
                  <option value="gemini-3.5-flash">
                    gemini-3.5-flash (Gemini 3.5 Flash)
                  </option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleParsePdf}
              disabled={isParsing || !questionPdf}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-[0.99] disabled:opacity-40 transition cursor-pointer"
            >
              {isParsing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Paper...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Parse Question Paper with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Parsing Progress Banner */}
      {isParsing && (
        <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-800/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-purple-200 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
              <span className="leading-snug">{parseStatus}</span>
            </span>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <span className="text-[11px] font-mono text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800/60">
                Elapsed: {elapsedSeconds}s
              </span>
              <span className="font-mono text-purple-300 font-bold">
                {parseProgress}%
              </span>
              <button
                type="button"
                onClick={handleCancelParse}
                className="px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 text-[11px] font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-purple-900/50">
            <div
              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${parseProgress}%` }}
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Document:{" "}
              <strong className="text-slate-300">{questionPdf?.name}</strong>{" "}
              ({questionPdf ? (questionPdf.size / (1024 * 1024)).toFixed(2) : 0} MB)
            </span>
            <span className="text-cyan-400/80 font-medium">
              Client-Side Direct Gemini Streaming • Zero Vercel Timeout
            </span>
          </div>
        </div>
      )}

      {/* Section 2: Review Table & Filter Bar */}
      {questions.length > 0 && (
        <div className="space-y-4 pt-4">
          {/* Stats & Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            {/* Stat Counters */}
            <div className="flex items-center gap-2 sm:gap-4 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 mr-1.5">Total Extracted:</span>
                <span className="font-bold text-white font-mono">
                  {stats.total}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-300">
                <span className="text-slate-400 mr-1.5">Physics:</span>
                <span className="font-bold font-mono">{stats.physics}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                <span className="text-slate-400 mr-1.5">Chemistry:</span>
                <span className="font-bold font-mono">{stats.chemistry}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300">
                <span className="text-slate-400 mr-1.5">Mathematics:</span>
                <span className="font-bold font-mono">{stats.mathematics}</span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Subject filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(["all", "physics", "chemistry", "mathematics"] as const).map(
                  (sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubjectFilter(sub)}
                      className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                        selectedSubjectFilter === sub
                          ? "bg-purple-600 text-white font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {sub}
                    </button>
                  )
                )}
              </div>

              {/* Type filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(["all", "mcq", "numerical"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg font-medium uppercase text-[11px] transition cursor-pointer ${
                      selectedTypeFilter === t
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Questions Review List */}
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => {
              const SubIcon = SUBJECT_CONFIG[q.subject]?.icon || Atom;

              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl bg-slate-900/50 border ${
                    SUBJECT_CONFIG[q.subject]?.bg || "border-slate-800"
                  } transition space-y-4 relative`}
                >
                  {/* Top Bar for Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 font-mono text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>

                      {/* Subject Selector */}
                      <div className="relative">
                        <select
                          value={q.subject}
                          onChange={(e) =>
                            updateQuestionField(
                              q.id,
                              "subject",
                              e.target.value as Subject
                            )
                          }
                          className="pl-2 pr-6 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold capitalize appearance-none cursor-pointer focus:outline-none focus:border-purple-500 text-slate-200"
                        >
                          <option value="physics">Physics</option>
                          <option value="chemistry">Chemistry</option>
                          <option value="mathematics">Mathematics</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Question Type Selector */}
                      <div className="relative">
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            updateQuestionField(q.id, "type", newType);
                            if (newType === "mcq" && !q.options) {
                              updateQuestionField(q.id, "options", [
                                "Option A",
                                "Option B",
                                "Option C",
                                "Option D",
                              ]);
                              updateQuestionField(q.id, "correct_answer", "A");
                            }
                          }}
                          className="pl-2 pr-6 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold uppercase text-[11px] appearance-none cursor-pointer focus:outline-none focus:border-blue-500 text-slate-200"
                        >
                          <option value="mcq">MCQ (Single)</option>
                          <option value="numerical">Numerical</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                          SUBJECT_CONFIG[q.subject]?.badge
                        }`}
                      >
                        <SubIcon className="w-3 h-3 inline mr-1" />
                        {SUBJECT_CONFIG[q.subject]?.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle Preview / Edit Mode */}
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestionField(
                            q.id,
                            "isPreviewMode",
                            !q.isPreviewMode
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        {q.isPreviewMode ? (
                          <>
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>Edit Raw LaTeX</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-cyan-400" />
                            <span>Preview KaTeX</span>
                          </>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800/60 transition cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Statement Area */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Question Statement:
                    </label>

                    {q.isPreviewMode ? (
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-100 text-xs leading-relaxed overflow-x-auto min-h-[48px]">
                        <MathView math={q.question_text} />
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={q.question_text}
                        onChange={(e) =>
                          updateQuestionField(
                            q.id,
                            "question_text",
                            e.target.value
                          )
                        }
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500 transition resize-y"
                      />
                    )}
                  </div>

                  {/* Options (for MCQ) or Numerical Input */}
                  {q.type === "mcq" ? (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Options & Correct Key:
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {["A", "B", "C", "D"].map((optLabel, optIdx) => {
                          const isCorrect =
                            q.correct_answer.toUpperCase() === optLabel;
                          const optText = q.options?.[optIdx] ?? "";

                          return (
                            <div
                              key={optLabel}
                              className={`p-3 rounded-xl border transition flex items-start gap-2.5 ${
                                isCorrect
                                  ? "bg-emerald-950/20 border-emerald-500/40"
                                  : "bg-slate-950 border-slate-800"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestionField(
                                    q.id,
                                    "correct_answer",
                                    optLabel
                                  )
                                }
                                className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer mt-0.5 ${
                                  isCorrect
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                }`}
                                title="Click to designate as correct answer"
                              >
                                {optLabel}
                              </button>

                              <div className="flex-1 min-w-0">
                                {q.isPreviewMode ? (
                                  <div className="text-xs text-slate-200 leading-snug py-1">
                                    <MathView math={optText} />
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={optText}
                                    onChange={(e) =>
                                      updateOptionText(
                                        q.id,
                                        optIdx,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500 transition"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Correct Numerical Value:
                      </span>
                      <div className="max-w-xs">
                        <input
                          type="text"
                          value={q.correct_answer}
                          onChange={(e) =>
                            updateQuestionField(
                              q.id,
                              "correct_answer",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 24 or 3.14"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>
                  )}

                  {/* Explanation Area */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Step-by-Step Explanation / Solution:
                    </label>

                    {q.isPreviewMode ? (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300 text-xs leading-relaxed overflow-x-auto min-h-[38px]">
                        {q.explanation ? (
                          <MathView math={q.explanation} />
                        ) : (
                          <span className="text-slate-600 italic">
                            No explanation provided.
                          </span>
                        )}
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        value={q.explanation}
                        onChange={(e) =>
                          updateQuestionField(
                            q.id,
                            "explanation",
                            e.target.value
                          )
                        }
                        placeholder="Derivation and steps in $KaTeX$..."
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500 transition resize-y"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Floating Save Bar */}
          <div className="sticky bottom-4 z-30 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl flex items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Ready to save{" "}
              <span className="text-white font-bold font-mono">
                {questions.length}
              </span>{" "}
              questions to{" "}
              <span className="text-purple-300 font-semibold">
                {exam?.title}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveAllToExam}
              disabled={isSaving || questions.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Batch Inserting to Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Batch Insert {questions.length} Questions</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamPdfImportPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-xs">Loading PDF Importer...</span>
        </div>
      }
    >
      <PdfImportContent />
    </Suspense>
  );
}
