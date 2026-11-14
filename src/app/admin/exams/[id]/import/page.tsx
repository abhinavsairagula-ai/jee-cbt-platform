"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeParseJson } from "@/lib/json-repair";
import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist";
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
  Image as ImageIcon,
  ImagePlus,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

// Configure pdfjs worker for client-side rendering
if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

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
  image_url?: string | null;
  has_diagram?: boolean;
  diagram_bbox?: [number, number, number, number] | null;
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

// Crop bounding box from high-res canvas with padding
async function cropDiagramToBlob(
  canvas: HTMLCanvasElement,
  bbox: [number, number, number, number]
): Promise<Blob | null> {
  try {
    const [ymin, xmin, ymax, xmax] = bbox;
    if (ymin >= ymax || xmin >= xmax) return null;

    const cW = canvas.width;
    const cH = canvas.height;

    // Convert normalized 0-1000 coordinates to canvas pixels
    let x1 = (xmin / 1000) * cW;
    let y1 = (ymin / 1000) * cH;
    let x2 = (xmax / 1000) * cW;
    let y2 = (ymax / 1000) * cH;

    // Add 16px padding
    const pad = 16;
    x1 = Math.max(0, Math.floor(x1 - pad));
    y1 = Math.max(0, Math.floor(y1 - pad));
    x2 = Math.min(cW, Math.ceil(x2 + pad));
    y2 = Math.min(cH, Math.ceil(y2 + pad));

    const width = x2 - x1;
    const height = y2 - y1;
    if (width < 25 || height < 25) return null;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = width;
    cropCanvas.height = height;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(canvas, x1, y1, width, height, 0, 0, width, height);

    return new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch (err) {
    console.warn("Diagram cropping error:", err);
    return null;
  }
}

// Upload cropped diagram blob to Supabase Storage with bucket fallback
async function uploadDiagramBlob(
  supabase: ReturnType<typeof createClient>,
  examId: string,
  qIdx: number,
  blob: Blob
): Promise<string | null> {
  const filename = `${Date.now()}-q${qIdx}.png`;

  // 1. Try 'question-images' bucket
  try {
    const path = `${examId}/${filename}`;
    const { error } = await supabase.storage
      .from("question-images")
      .upload(path, blob, { contentType: "image/png", upsert: true });

    if (!error) {
      const { data } = supabase.storage.from("question-images").getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch {}

  // 2. Fallback to 'exam-pdfs' bucket
  try {
    const fbPath = `diagrams/${examId}/${filename}`;
    const { error: fbErr } = await supabase.storage
      .from("exam-pdfs")
      .upload(fbPath, blob, { contentType: "image/png", upsert: true });

    if (!fbErr) {
      const { data } = supabase.storage.from("exam-pdfs").getPublicUrl(fbPath);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (err) {
    console.warn("Storage upload error for diagram:", err);
  }

  return null;
}

// Execute Gemini call per batch with strict 45-second timeout and 1 retry
async function callGeminiBatchWithTimeoutAndRetry(
  ai: GoogleGenAI,
  modelName: string,
  parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }>,
  batchLabel: string,
  parentSignal: AbortSignal
): Promise<string> {
  const MAX_RETRIES = 1;
  let attempt = 0;
  let currentModel = modelName;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();

    const onParentAbort = () => controller.abort();
    parentSignal.addEventListener("abort", onParentAbort);

    // 45s strict timeout per batch
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      const responseStream = await ai.models.generateContentStream({
        model: currentModel,
        contents: parts as any,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 0,
          },
          abortSignal: controller.signal,
        },
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        if (parentSignal.aborted) {
          throw new DOMException("Extraction was cancelled by user.", "AbortError");
        }
        if (chunk.text) {
          fullText += chunk.text;
        }
      }

      clearTimeout(timeoutId);
      parentSignal.removeEventListener("abort", onParentAbort);
      return fullText;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      parentSignal.removeEventListener("abort", onParentAbort);

      if (parentSignal.aborted) {
        throw new DOMException("Extraction was cancelled by user.", "AbortError");
      }

      console.warn(`[Batch ${batchLabel}] Attempt ${attempt} failed:`, err);

      // If model not found (404), fall back to gemini-2.5-flash
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("404") || errMsg.includes("not found")) {
        currentModel = "gemini-2.5-flash";
      }

      if (attempt > MAX_RETRIES) {
        throw err;
      }

      // Small backoff before retry
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw new Error(`Failed to extract batch ${batchLabel} after retry.`);
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

  // Diagram Manual Upload
  const [activeDiagramQId, setActiveDiagramQId] = useState<string | null>(null);
  const diagramFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Trigger manual diagram file selection
  const triggerAddDiagram = (qId: string) => {
    setActiveDiagramQId(qId);
    diagramFileInputRef.current?.click();
  };

  const triggerReplaceDiagram = (qId: string) => {
    setActiveDiagramQId(qId);
    diagramFileInputRef.current?.click();
  };

  const handleDiagramFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeDiagramQId) return;

    try {
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      let publicUrl: string | null = null;

      // Try question-images
      try {
        const path = `${examId}/${filename}`;
        const { error } = await supabase.storage
          .from("question-images")
          .upload(path, file, { contentType: file.type, upsert: true });

        if (!error) {
          publicUrl = supabase.storage.from("question-images").getPublicUrl(path).data.publicUrl;
        }
      } catch {}

      // Fallback to exam-pdfs/diagrams/
      if (!publicUrl) {
        try {
          const fbPath = `diagrams/${examId}/${filename}`;
          const { error: fbErr } = await supabase.storage
            .from("exam-pdfs")
            .upload(fbPath, file, { contentType: file.type, upsert: true });

          if (!fbErr) {
            publicUrl = supabase.storage.from("exam-pdfs").getPublicUrl(fbPath).data.publicUrl;
          }
        } catch {}
      }

      if (publicUrl) {
        updateQuestionField(activeDiagramQId, "image_url", publicUrl);
        updateQuestionField(activeDiagramQId, "has_diagram", true);
      } else {
        setErrorMessage("Failed to upload image to storage.");
      }
    } catch (err) {
      console.error("Diagram upload error:", err);
      setErrorMessage("Failed to upload image file.");
    } finally {
      setActiveDiagramQId(null);
      if (diagramFileInputRef.current) diagramFileInputRef.current.value = "";
    }
  };

  // Client-Side PDF-to-Image Rendering and Batched Extraction
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
    setParseProgress(2);
    setElapsedSeconds(0);
    setParseStatus("Initializing PDF renderer...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let seconds = 0;
    const timerInterval = setInterval(() => {
      seconds += 1;
      setElapsedSeconds(seconds);
    }, 1000);

    try {
      // 1. Background backup of uploaded PDFs to Supabase Storage
      supabase.storage
        .from("exam-pdfs")
        .upload(`${examId}/question_${Date.now()}.pdf`, questionPdf, {
          cacheControl: "3600",
          upsert: true,
        })
        .catch(() => {});

      if (solutionPdf) {
        supabase.storage
          .from("exam-pdfs")
          .upload(`${examId}/solution_${Date.now()}.pdf`, solutionPdf, {
            cacheControl: "3600",
            upsert: true,
          })
          .catch(() => {});
      }

      // 2. Load PDF into memory with pdfjs-dist
      setParseStatus("Loading Question Paper PDF into memory...");
      const qArrayBuffer = await questionPdf.arrayBuffer();
      if (controller.signal.aborted) throw new DOMException("Extraction cancelled", "AbortError");

      const pdfDoc = await pdfjsLib.getDocument({ data: qArrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      // 3. Render all pages locally onto high-resolution HTML5 canvas at 2.0x scale
      setParseStatus(`Rendering ${numPages} PDF pages onto high-resolution canvas (2.0x scale)...`);
      const pageCanvases: HTMLCanvasElement[] = [];
      const pageJpegs: string[] = [];

      for (let p = 1; p <= numPages; p++) {
        if (controller.signal.aborted) throw new DOMException("Extraction cancelled", "AbortError");
        setParseStatus(`Rendering page ${p} of ${numPages} to high-res canvas...`);
        setParseProgress(Math.min(25, 3 + Math.floor((p / numPages) * 22)));

        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not acquire 2D canvas rendering context");

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        pageCanvases.push(canvas);

        // Convert to compressed JPEG (0.85 quality)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        pageJpegs.push(base64);
      }

      // 4. Initialize Gemini AI Client directly in browser
      const chosenModel = (model || "gemini-3.8-flash").replace(/^models\//, "");
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

      // 5. Batch processing loop (2 pages per batch for 5-10s turnaround)
      const BATCH_SIZE = 2;
      const totalBatches = Math.ceil(numPages / BATCH_SIZE);
      const allExtracted: EditableQuestion[] = [];
      let totalQuestionsFound = 0;

      const solutionNote = solutionPdf
        ? "If a question corresponds to standard JEE syllabus questions, solve it with complete accuracy, determine the correct answer, and provide a clear, step-by-step mathematical/conceptual solution."
        : "Solve each question with complete accuracy, determine the correct answer, and provide a clear, step-by-step mathematical/conceptual solution.";

      const batchPromptTemplate = `You are an expert NTA JEE (Main) Question Paper Digitizer, KaTeX formatter, and diagram extractor.
${solutionNote}

EXTRACT ALL QUESTIONS FULLY FROM THE PROVIDED PAGE IMAGES. DO NOT SKIP ANY QUESTION.

CRITICAL INSTRUCTIONS:
1. SUBJECT IDENTIFICATION:
   - "physics", "chemistry", or "mathematics".

2. QUESTION TYPE:
   - "mcq" (4 options) or "numerical" (integer or decimal answer).

3. DIAGRAM / FIGURE DETECTION (VERY IMPORTANT):
   - Check if the question includes an accompanying diagram, circuit, graph, chemical structure, geometry figure, apparatus, or illustration.
   - If YES:
     - Set "has_diagram": true
     - Set "diagram_page": 1 if the diagram is on the 1st image in this batch, 2 if on the 2nd image.
     - Set "diagram_bbox": [ymin, xmin, ymax, xmax] as normalized integer coordinates from 0 to 1000 tightly enclosing ONLY the diagram/figure/graph. DO NOT include question statement text or options in the bounding box.
   - If NO diagram:
     - Set "has_diagram": false
     - Set "diagram_page": null
     - Set "diagram_bbox": null

4. LATEX & ESCAPING (CRITICAL):
   - Escape all LaTeX backslashes as double backslashes (e.g. \\frac, \\int, \\theta, \\sqrt, \\alpha) so the output is 100% valid JSON.
   - Wrap inline math in '$...$' and display math in '$$...$$'.

5. MCQ OPTIONS & CORRECT ANSWER:
   - For 'mcq', 'options' MUST be an array of EXACTLY 4 strings: [Option A, Option B, Option C, Option D] without leading labels like "(A)".
   - 'correct_answer': "A", "B", "C", or "D".
   - For 'numerical', 'options' is null, and 'correct_answer' is the numerical value string.

6. EXPLANATION:
   - Brief 2-3 line step-by-step mathematical/conceptual solution in $KaTeX$.

JSON SCHEMA TO RETURN:
{
  "questions": [
    {
      "subject": "physics" | "chemistry" | "mathematics",
      "type": "mcq" | "numerical",
      "question_text": "string with $KaTeX$",
      "options": ["string", "string", "string", "string"] | null,
      "correct_answer": "A" | "B" | "C" | "D" | "numerical_string",
      "explanation": "string with $KaTeX$",
      "has_diagram": true | false,
      "diagram_page": 1 | 2 | null,
      "diagram_bbox": [ymin, xmin, ymax, xmax] | null
    }
  ]
}`;

      for (let b = 0; b < totalBatches; b++) {
        if (controller.signal.aborted) throw new DOMException("Extraction cancelled", "AbortError");

        const startPage = b * BATCH_SIZE + 1;
        const endPage = Math.min(numPages, (b + 1) * BATCH_SIZE);
        const batchPages: number[] = [];
        for (let pg = startPage; pg <= endPage; pg++) batchPages.push(pg);

        setParseStatus(
          `Extracting questions from pages ${startPage}–${endPage} of ${numPages} (Batch ${b + 1}/${totalBatches})...`
        );
        setParseProgress(25 + Math.floor((b / totalBatches) * 70));

        // Prepare image parts for this batch
        const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
        for (let i = 0; i < batchPages.length; i++) {
          const pgNum = batchPages[i];
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: pageJpegs[pgNum - 1],
            },
          });
        }

        parts.push({
          text: `You are processing Page ${startPage} to Page ${endPage} of the exam paper (Image 1 is Page ${startPage}${
            batchPages.length > 1 ? `, Image 2 is Page ${endPage}` : ""
          }).
${batchPromptTemplate}`,
        });

        // Call Gemini with 45s timeout and 1 automatic retry
        const batchJsonText = await callGeminiBatchWithTimeoutAndRetry(
          ai,
          chosenModel,
          parts,
          `${startPage}-${endPage}`,
          controller.signal
        );

        // Parse with safeParseJson to repair LaTeX escapes
        let parsedBatch: any;
        try {
          parsedBatch = safeParseJson(batchJsonText);
        } catch (parseErr) {
          console.warn(`JSON repair parse failed on batch ${b + 1}:`, parseErr);
          continue;
        }

        const rawQuestions = Array.isArray(parsedBatch)
          ? parsedBatch
          : Array.isArray(parsedBatch?.questions)
          ? parsedBatch.questions
          : [];

        // Process questions in this batch
        for (let qIdx = 0; qIdx < rawQuestions.length; qIdx++) {
          const rawQ = rawQuestions[qIdx];
          totalQuestionsFound++;

          let diagramUrl: string | null = null;

          // If question has a diagram, crop from corresponding canvas and upload
          if (
            rawQ.has_diagram &&
            Array.isArray(rawQ.diagram_bbox) &&
            rawQ.diagram_bbox.length === 4
          ) {
            setParseStatus(
              `Cropping and uploading diagram for Question ${totalQuestionsFound}...`
            );

            let targetCanvas: HTMLCanvasElement | null = null;
            if (typeof rawQ.diagram_page === "number") {
              if (rawQ.diagram_page >= 1 && rawQ.diagram_page <= batchPages.length) {
                const pgNum = batchPages[rawQ.diagram_page - 1];
                targetCanvas = pageCanvases[pgNum - 1] || null;
              } else if (pageCanvases[rawQ.diagram_page - 1]) {
                targetCanvas = pageCanvases[rawQ.diagram_page - 1];
              }
            }
            if (!targetCanvas && pageCanvases[batchPages[0] - 1]) {
              targetCanvas = pageCanvases[batchPages[0] - 1];
            }

            if (targetCanvas) {
              const blob = await cropDiagramToBlob(
                targetCanvas,
                rawQ.diagram_bbox as [number, number, number, number]
              );
              if (blob) {
                diagramUrl = await uploadDiagramBlob(
                  supabase,
                  examId,
                  totalQuestionsFound,
                  blob
                );
              }
            }
          }

          // Normalize subject
          const subject: Subject = ["physics", "chemistry", "mathematics"].includes(
            rawQ.subject?.toLowerCase() || ""
          )
            ? (rawQ.subject.toLowerCase() as Subject)
            : "physics";

          // Normalize type
          const type: QuestionType =
            rawQ.type?.toLowerCase() === "numerical" ? "numerical" : "mcq";

          // Normalize options
          let options: string[] | null = null;
          if (type === "mcq") {
            if (Array.isArray(rawQ.options) && rawQ.options.length >= 4) {
              options = rawQ.options.slice(0, 4).map((opt: unknown) => String(opt ?? "").trim());
            } else if (Array.isArray(rawQ.options)) {
              options = [
                ...rawQ.options.map((opt: unknown) => String(opt ?? "").trim()),
                ...Array(Math.max(0, 4 - rawQ.options.length)).fill(""),
              ].slice(0, 4);
            } else {
              options = ["Option A", "Option B", "Option C", "Option D"];
            }
          }

          // Normalize answer
          let correctAnswer = String(rawQ.correct_answer ?? "").trim();
          if (type === "mcq") {
            const upper = correctAnswer.toUpperCase();
            if (["A", "B", "C", "D"].includes(upper)) {
              correctAnswer = upper;
            } else if (["1", "2", "3", "4"].includes(correctAnswer)) {
              const map: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
              correctAnswer = map[correctAnswer] || "A";
            } else {
              correctAnswer = "A";
            }
          }

          const newQ: EditableQuestion = {
            id: `q-ext-${Date.now()}-${totalQuestionsFound}`,
            exam_id: examId,
            subject,
            type,
            question_text: rawQ.question_text || `Question ${totalQuestionsFound}`,
            options,
            correct_answer: correctAnswer,
            explanation: rawQ.explanation || "",
            positive_marks: rawQ.positive_marks ?? (exam?.positive_marks ?? 4),
            negative_marks: rawQ.negative_marks ?? (exam?.negative_marks ?? 1),
            image_url: diagramUrl,
            has_diagram: !!diagramUrl || rawQ.has_diagram,
            diagram_bbox: rawQ.diagram_bbox || null,
            isPreviewMode: true,
          };

          allExtracted.push(newQ);
          // Incrementally update UI so admin sees questions populating live!
          setQuestions([...allExtracted]);
        }
      }

      clearInterval(timerInterval);
      setParseProgress(100);
      setParseStatus("Extraction complete!");

      if (allExtracted.length === 0) {
        throw new Error("No questions were identified in the PDF pages.");
      }

      const diagramsExtracted = allExtracted.filter((q) => !!q.image_url).length;
      setSuccessMessage(
        `Successfully extracted ${allExtracted.length} questions (${diagramsExtracted} with cropped diagrams) in ${seconds}s!`
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
      image_url: null,
      has_diagram: false,
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
    const withDiagrams = questions.filter((q) => !!q.image_url).length;
    return {
      total: questions.length,
      physics,
      chemistry,
      mathematics,
      mcq,
      numerical,
      withDiagrams,
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
        image_url: q.image_url || null,
      }));

      let { error: insertError } = await supabase
        .from("questions")
        .insert(payload);

      // Fallback if the remote questions table doesn't have image_url column yet
      if (insertError && insertError.message.includes("image_url")) {
        console.warn(
          "Column 'image_url' not found in questions table. Falling back to insert without image_url."
        );
        const strippedPayload = payload.map(({ image_url, ...rest }) => rest);
        const res = await supabase.from("questions").insert(strippedPayload);
        insertError = res.error;
      }

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
      {/* Hidden file input for manual diagram attachment/replacement */}
      <input
        ref={diagramFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDiagramFileSelected}
      />

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
              Gemini Vision & Diagram Importer
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>AI Question Paper & Diagram Importer</span>
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
                      {(questionPdf.size / (1024 * 1024)).toFixed(2)} MB • Ready for High-Res Vision
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestionPdf(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition cursor-pointer"
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
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition cursor-pointer"
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
            <span>Gemini Vision Settings</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Gemini API Key</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {process.env.NEXT_PUBLIC_GEMINI_API_KEY
                    ? "NEXT_PUBLIC_GEMINI_API_KEY active"
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
                    gemini-3.8-flash (Recommended • Vision + Auto-Cropping)
                  </option>
                  <option value="gemini-2.5-flash">
                    gemini-2.5-flash (Reliable Fallback)
                  </option>
                  <option value="gemini-flash-latest">
                    gemini-flash-latest (General Fast)
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
                  <span>Parse Question Paper & Diagrams</span>
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
              High-Res Page Vision (2.0x) • Auto Diagram Cropping • Batched Streaming
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
              <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300">
                <span className="text-slate-400 mr-1.5">Diagrams:</span>
                <span className="font-bold font-mono">{stats.withDiagrams}</span>
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

                  {/* Diagram / Image Section */}
                  <div className="pt-2 border-t border-slate-800/60">
                    {q.image_url ? (
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={q.image_url}
                              alt="Question Diagram"
                              className="w-full h-full object-contain p-1"
                            />
                            <a
                              href={q.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-semibold gap-1"
                              title="Open full diagram in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Full</span>
                            </a>
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              <ImageIcon className="w-3 h-3" />
                              Diagram Extracted
                            </span>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-sm truncate font-mono">
                              {q.image_url.split("/").pop()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => triggerReplaceDiagram(q.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                            title="Replace diagram with another file"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateQuestionField(q.id, "image_url", null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                            title="Remove diagram from question"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-[11px] text-slate-500">No diagram attached</span>
                        <button
                          type="button"
                          onClick={() => triggerAddDiagram(q.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition cursor-pointer"
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>+ Add Diagram / Image</span>
                        </button>
                      </div>
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
              questions ({stats.withDiagrams} diagrams) to{" "}
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
