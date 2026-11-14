import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300; // 5 minutes timeout for large PDFs

interface ExtractedQuestion {
  subject: "physics" | "chemistry" | "mathematics";
  type: "mcq" | "numerical";
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation?: string | null;
  positive_marks?: number;
  negative_marks?: number;
}

interface GeminiExtractionResponse {
  exam_title?: string;
  questions: ExtractedQuestion[];
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

    // 3. Parse Multipart Form Data
    const formData = await req.formData();
    const questionPaper = formData.get("questionPaper") as File | null;
    const solutionPaper = formData.get("solutionPaper") as File | null;
    const clientApiKey = (formData.get("apiKey") as string | null)?.trim();
    const rawRequestedModel =
      (formData.get("model") as string | null)?.trim() || "gemini-flash-latest";
    const requestedModel = rawRequestedModel.replace(/^models\//, "");

    if (!questionPaper) {
      return NextResponse.json(
        { error: "Question paper PDF file is required." },
        { status: 400 }
      );
    }

    // Verify file size (< 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (questionPaper.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Question paper exceeds the maximum 20MB file size limit." },
        { status: 400 }
      );
    }

    if (solutionPaper && solutionPaper.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Solution paper exceeds the maximum 20MB file size limit." },
        { status: 400 }
      );
    }

    // 4. Resolve Gemini API Key
    const apiKey =
      clientApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API Key is missing. Please provide your API key in the importer UI or set GEMINI_API_KEY in your server .env.local file.",
        },
        { status: 400 }
      );
    }

    // 5. Convert PDFs to Base64
    const qBuffer = Buffer.from(await questionPaper.arrayBuffer());
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
    if (solutionPaper) {
      const sBuffer = Buffer.from(await solutionPaper.arrayBuffer());
      const sBase64 = sBuffer.toString("base64");
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: sBase64,
        },
      });
      solutionNote =
        "DOCUMENT 2 is the OFFICIAL SOLUTION & ANSWER KEY PAPER. Match each question from Document 1 with its corresponding official answer key and step-by-step solution from Document 2.";
    } else {
      solutionNote =
        "No separate solution paper is provided. Solve each question with complete accuracy, determine the correct answer, and provide a clear, step-by-step mathematical/conceptual solution.";
    }

    // 6. Detailed Prompt for Gemini
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

3. KATEX / LATEX FORMATTING (MANDATORY):
   - Every single variable, equation, scientific notation, unit, chemical formula, or mathematical symbol MUST be formatted in standard KaTeX.
   - Use '$...$' for inline math (e.g. '$x^2 + y^2 = r^2$', '$\\frac{hc}{\\lambda}$', '$\\text{KMnO}_4$').
   - Use '$$...$$' for standalone or display equations.
   - In JSON, properly escape backslashes (use '\\\\frac', '\\\\sqrt', '\\\\theta', '\\\\vec{F}', '\\\\int', etc.).
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
   Return valid JSON with NO conversational markdown preamble or postscript:
   {
     "exam_title": "string or exam name found in paper",
     "questions": [
       {
         "subject": "physics" | "chemistry" | "mathematics",
         "type": "mcq" | "numerical",
         "question_text": "string with $KaTeX$",
         "options": ["string", "string", "string", "string"] | null,
         "correct_answer": "A" | "B" | "C" | "D" | "numerical_string",
         "explanation": "string with $KaTeX$"
       }
     ]
   }`;

    parts.push({ text: systemPrompt });

    // 7. Call Gemini REST API with robust endpoint & model fallback
    // Prioritize models that are confirmed active and responsive for the API key
    const fallbackModelList = [
      requestedModel,
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-2.5-flash",
      "gemini-pro-latest",
      "gemini-1.5-flash",
    ];

    const candidateConfigs: Array<{ model: string; apiVersion: "v1beta" | "v1" }> = [];
    for (const m of fallbackModelList) {
      if (!m) continue;
      const cleanM = m.replace(/^models\//, "");
      candidateConfigs.push({ model: cleanM, apiVersion: "v1beta" });
      candidateConfigs.push({ model: cleanM, apiVersion: "v1" });
    }

    // Deduplicate preserving order
    const seen = new Set<string>();
    const uniqueConfigs = candidateConfigs.filter((cfg) => {
      const key = `${cfg.apiVersion}:${cfg.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let geminiResponseText: string | null = null;
    let lastError: string = "Unknown error";

    for (let i = 0; i < uniqueConfigs.length; i++) {
      const { model, apiVersion } = uniqueConfigs[i];
      try {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        
        // Fast payload with zero thinking budget to eliminate reasoning overhead
        const payloadWithZeroThinking: Record<string, unknown> = {
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            // Disable deep reasoning tokens to ensure fast extraction:
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        };

        let res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadWithZeroThinking),
        });

        // If the model does not support thinkingConfig and returns 400, retry once without it
        if (!res.ok && res.status === 400) {
          const errPeek = await res.clone().text();
          if (
            errPeek.toLowerCase().includes("thinking") ||
            errPeek.toLowerCase().includes("unknown field")
          ) {
            const strippedPayload = {
              contents: payloadWithZeroThinking.contents,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            };
            res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(strippedPayload),
            });
          }
        }

        if (!res.ok) {
          const errorBody = await res.text();
          let parsedError = errorBody;
          try {
            const errJson = JSON.parse(errorBody);
            parsedError = errJson.error?.message || errorBody;
          } catch {
            // Keep text
          }

          // If 404 (model unavailable), 400 (bad request), 503 (high demand/overloaded), 429 (rate limit), or 500, fallback to next candidate
          const isFallbackEligible =
            res.status === 404 ||
            res.status === 400 ||
            res.status === 503 ||
            res.status === 429 ||
            res.status === 500;

          if (isFallbackEligible && i < uniqueConfigs.length - 1) {
            console.warn(`[Gemini Fallback] ${apiVersion}/models/${model} returned ${res.status}: ${parsedError}`);
            lastError = `(${apiVersion}/${model}) ${parsedError}`;
            continue;
          }

          throw new Error(`Gemini API Error (${res.status}): ${parsedError}`);
        }

        const data = await res.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawContent) {
          geminiResponseText = rawContent;
          break;
        } else {
          if (i < uniqueConfigs.length - 1) {
            continue;
          }
          throw new Error("Gemini returned an empty candidate response.");
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        if (i === uniqueConfigs.length - 1) {
          throw new Error(lastError);
        }
      }
    }

    if (!geminiResponseText) {
      return NextResponse.json(
        { error: `Failed to extract content: ${lastError}` },
        { status: 500 }
      );
    }

    // 8. Clean and parse JSON
    let cleanedJson = geminiResponseText.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    let parsedResult: GeminiExtractionResponse;
    try {
      parsedResult = JSON.parse(cleanedJson);
    } catch {
      // Fallback: search for first { and last }
      const firstBrace = cleanedJson.indexOf("{");
      const lastBrace = cleanedJson.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          parsedResult = JSON.parse(cleanedJson.substring(firstBrace, lastBrace + 1));
        } catch (jsonErr: unknown) {
          return NextResponse.json(
            {
              error:
                "Failed to parse AI response into valid JSON: " +
                (jsonErr instanceof Error ? jsonErr.message : String(jsonErr)),
              raw: geminiResponseText.slice(0, 1000),
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: "Gemini did not return a valid JSON object structure.",
            raw: geminiResponseText.slice(0, 1000),
          },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(parsedResult.questions)) {
      return NextResponse.json(
        { error: "AI response did not contain a 'questions' array.", raw: parsedResult },
        { status: 500 }
      );
    }

    // 9. Normalize & attach default marks
    const defaultPosMarks = exam.positive_marks ?? 4;
    const defaultNegMarks = exam.negative_marks ?? 1;

    const normalizedQuestions = parsedResult.questions.map((q, index) => {
      const subject = ["physics", "chemistry", "mathematics"].includes(
        q.subject?.toLowerCase()
      )
        ? (q.subject.toLowerCase() as "physics" | "chemistry" | "mathematics")
        : "physics";

      const type = q.type?.toLowerCase() === "numerical" ? "numerical" : "mcq";

      let options: string[] | null = null;
      if (type === "mcq") {
        if (Array.isArray(q.options) && q.options.length >= 4) {
          options = q.options.slice(0, 4).map((opt) => String(opt ?? "").trim());
        } else if (Array.isArray(q.options)) {
          // Pad to 4 if model gave fewer
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
          const map: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
          correctAnswer = map[correctAnswer] || "A";
        } else {
          correctAnswer = "A"; // default fallback
        }
      }

      return {
        id: `temp-${index + 1}`,
        exam_id: examId,
        subject,
        type,
        question_text: q.question_text || `Question ${index + 1}`,
        options,
        correct_answer: correctAnswer,
        explanation: q.explanation || null,
        positive_marks: q.positive_marks ?? defaultPosMarks,
        negative_marks: q.negative_marks ?? defaultNegMarks,
      };
    });

    return NextResponse.json({
      success: true,
      exam_title: parsedResult.exam_title || exam.title,
      total_extracted: normalizedQuestions.length,
      questions: normalizedQuestions,
    });
  } catch (error: unknown) {
    console.error("PDF Parse error:", error);
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
