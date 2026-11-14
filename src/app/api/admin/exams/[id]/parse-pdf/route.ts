import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

async function fetchPdfBuffer(
  url: string,
  supabaseClient: Awaited<ReturnType<typeof createClient>>
): Promise<Buffer> {
  const res = await fetch(url);
  if (res.ok) {
    return Buffer.from(await res.arrayBuffer());
  }

  // Fallback: If bucket is private or direct fetch fails, download via supabase storage client
  try {
    const parts = url.split("/exam-pdfs/");
    if (parts.length > 1) {
      const storagePath = decodeURIComponent(parts[1].split("?")[0]);
      const { data, error } = await supabaseClient.storage
        .from("exam-pdfs")
        .download(storagePath);
      if (!error && data) {
        return Buffer.from(await data.arrayBuffer());
      }
    }
  } catch (err) {
    console.warn("Storage download fallback failed:", err);
  }

  throw new Error(`Failed to fetch PDF from URL: ${url} (HTTP ${res.status})`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;

    // 1. Authenticate user & verify admin role
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    // 2. Fetch exam info
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // 3. Parse JSON Body
    let body: {
      questionPdfUrl?: string;
      solutionPdfUrl?: string | null;
      apiKey?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON request body. Expected { questionPdfUrl, solutionPdfUrl, apiKey }.",
        },
        { status: 400 }
      );
    }

    const { questionPdfUrl, solutionPdfUrl, apiKey: clientApiKey } = body;

    if (!questionPdfUrl) {
      return NextResponse.json(
        { error: "questionPdfUrl is required." },
        { status: 400 }
      );
    }

    // 4. Resolve Gemini API Key (no prefix rejection on AQ. or AIza)
    const apiKey =
      clientApiKey?.trim() ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API Key is missing. Please provide your API key in the importer UI or set GEMINI_API_KEY in your server environment.",
        },
        { status: 400 }
      );
    }

    // 5. Fetch PDF(s) from Supabase URLs and convert to base64
    const qBuffer = await fetchPdfBuffer(questionPdfUrl, supabase);
    const qBase64 = qBuffer.toString("base64");

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

    let solutionNote = "";
    if (solutionPdfUrl) {
      try {
        const sBuffer = await fetchPdfBuffer(solutionPdfUrl, supabase);
        const sBase64 = sBuffer.toString("base64");
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: sBase64,
          },
        });
        solutionNote =
          "DOCUMENT 2 is the OFFICIAL SOLUTION & ANSWER KEY PAPER. Match each question from Document 1 with its corresponding official answer key and step-by-step solution from Document 2.";
      } catch (sErr) {
        console.warn("Failed to fetch optional solution PDF:", sErr);
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

    // 6. Initialize GoogleGenAI and generateContentStream
    const ai = new GoogleGenAI({ apiKey });

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: parts,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err: unknown) {
          console.error("Gemini stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: unknown) {
    console.error("PDF Parse route error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while parsing the PDF.",
      },
      { status: 500 }
    );
  }
}
