/**
 * Sanitizes and repairs JSON strings returned by LLMs (like Gemini) that contain
 * unescaped or poorly escaped LaTeX backslashes (e.g. \frac, \int, \theta, \alpha, \sqrt).
 *
 * In JSON, the only valid escape sequences are:
 *   \"  \\  \/  \b  \f  \n  \r  \t  \uXXXX
 *
 * Single LaTeX backslashes like \int, \sin, \alpha, \theta, \frac, \vec, \sqrt
 * cause "SyntaxError: Bad escaped character in JSON".
 * This helper properly double-escapes invalid backslashes (\\) without corrupting
 * valid JSON escapes.
 */

export function repairJsonString(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // 2. Find boundary of outer JSON structure ({ ... } or [ ... ])
  const firstBrace = cleaned.search(/[\{\[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. State-machine to sanitize backslashes and unescaped control chars inside JSON strings
  let result = "";
  let inString = false;
  let inMath = false;
  let i = 0;
  const len = cleaned.length;

  // LaTeX commands starting with b, f, n, r, or t that collide with standard JSON escapes (\b, \f, \n, \r, \t)
  const latexCommands =
    /^(?:frac|flat|forall|frown|beta|bar|begin|bf|bold|boldsymbol|bullet|binom|bmatrix|Bmatrix|bmod|bot|bowtie|breve|box|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|theta|times|text|textbf|textit|textrm|texttt|tau|tan|tanh|tilde|to|therefore|triangle|top|tag|tiny|tfrac|thickspace|thinspace|twoheadrightarrow|textstyle|rho|right|rm|rangle|rad|rfloor|rceil|rightarrow|rightharpoonup|rightharpoondown|Rightarrow|Re|root|nu|nabla|neq|neg|not|notin|natural|normalsize|ni|nrightarrow|nleftarrow)(?:[^a-zA-Z]|$)/i;

  while (i < len) {
    const ch = cleaned[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        inMath = false;
      }
      result += ch;
      i++;
      continue;
    }

    // Inside string literal
    if (ch === '"') {
      inString = false;
      inMath = false;
      result += ch;
      i++;
      continue;
    }

    // Track KaTeX math environment ($...$ or $$...$$)
    if (ch === "$") {
      inMath = !inMath;
      result += ch;
      i++;
      continue;
    }

    if (ch === "\\") {
      // Check for dangling trailing backslash
      if (i + 1 >= len) {
        result += "\\\\";
        i++;
        continue;
      }

      const nextChar = cleaned[i + 1];

      // 1. Already escaped backslash: \\
      if (nextChar === "\\") {
        result += "\\\\";
        i += 2;
        continue;
      }

      // 2. Escaped quote: \"
      if (nextChar === '"') {
        result += '\\"';
        i += 2;
        continue;
      }

      // 3. Escaped forward slash: \/
      if (nextChar === "/") {
        result += "\\/";
        i += 2;
        continue;
      }

      // 4. Unicode escape: \uXXXX
      if (nextChar === "u") {
        const hex = cleaned.substring(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += "\\u" + hex;
          i += 6;
          continue;
        } else {
          // e.g. \url, \uparrow, \upsilon
          result += "\\\\u";
          i += 2;
          continue;
        }
      }

      // 5. Valid JSON escapes: \b, \f, \n, \r, \t
      if (["b", "f", "n", "r", "t"].includes(nextChar.toLowerCase())) {
        const rest = cleaned.substring(i + 1);
        if (inMath || latexCommands.test(rest)) {
          // Inside math or matches known LaTeX command starting with b, f, n, r, or t
          result += "\\\\" + nextChar;
          i += 2;
          continue;
        } else {
          // Preserve valid standard JSON escape
          result += "\\" + nextChar;
          i += 2;
          continue;
        }
      }

      // 6. ALL other characters following \ are INVALID JSON escapes:
      // (\int, \sin, \alpha, \theta, \frac, \vec, \sqrt, \cos, \pm, \lambda, \{, \}, \%, \_, etc.)
      result += "\\\\" + nextChar;
      i += 2;
      continue;
    }

    // Normalize raw unescaped newlines/tabs inside JSON string literals
    if (ch === "\n") {
      result += "\\n";
      i++;
      continue;
    }
    if (ch === "\r") {
      result += "\\r";
      i++;
      continue;
    }
    if (ch === "\t") {
      result += "\\t";
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  // Remove illegal trailing commas before closing braces/brackets if any
  result = result.replace(/,\s*([\}\]])/g, "$1");

  return result;
}

/**
 * Attempts to close any unclosed brackets/braces if the JSON stream was truncated.
 */
function tryCloseJsonBrackets(jsonStr: string): string {
  let inStr = false;
  const stack: string[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (ch === '"' && (i === 0 || jsonStr[i - 1] !== "\\")) {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  let patched = jsonStr;
  while (stack.length > 0) {
    patched += stack.pop();
  }
  return patched;
}

/**
 * Parses JSON safely with automatic repair of invalid LaTeX backslash escapes.
 */
export function safeParseJson<T = unknown>(raw: string): T {
  const repaired = repairJsonString(raw);

  try {
    return JSON.parse(repaired) as T;
  } catch (initialErr) {
    // Attempt fallback with bracket auto-closing
    try {
      const closed = tryCloseJsonBrackets(repaired);
      return JSON.parse(closed) as T;
    } catch {
      // Re-throw initial error for transparency
      throw initialErr;
    }
  }
}
