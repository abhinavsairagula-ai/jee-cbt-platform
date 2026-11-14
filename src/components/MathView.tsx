"use client";

import { InlineMath, BlockMath } from "react-katex";
import React from "react";

interface MathViewProps {
  math: string;
  block?: boolean;
  className?: string;
  disableTable?: boolean;
}

export interface ContentSegment {
  type: "text" | "table";
  content?: string;
  headers?: string[];
  rows?: string[][];
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^[\s|:\-]+$/.test(trimmed);
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const parts = splitTableRow(trimmed);
  return parts.length >= 2;
}

/**
 * Parses markdown pipe tables out of text, preserving preceding intro sentences
 * and subsequent outro sentences as separate segments.
 */
export function parseMarkdownTables(text: string): ContentSegment[] {
  const normalized = text.replace(/\\n(?=\s*\|)/g, "\n").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const segments: ContentSegment[] = [];
  let currentTextLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRow(line)) {
      let j = i;
      while (j < lines.length && (isTableRow(lines[j]) || isSeparatorRow(lines[j]))) {
        j++;
      }

      // Valid table block requires at least 2 lines
      if (j - i >= 2) {
        if (currentTextLines.length > 0) {
          const textBlock = currentTextLines.join("\n").trim();
          if (textBlock) {
            segments.push({ type: "text", content: textBlock });
          }
          currentTextLines = [];
        }

        const tableLines = lines.slice(i, j).filter((l) => l.trim().length > 0);
        let headers: string[] = [];
        let rows: string[][] = [];

        if (tableLines.length >= 2 && isSeparatorRow(tableLines[1])) {
          headers = splitTableRow(tableLines[0]);
          rows = tableLines.slice(2).map(splitTableRow);
        } else {
          headers = splitTableRow(tableLines[0]);
          rows = tableLines.slice(1).map(splitTableRow);
        }

        segments.push({ type: "table", headers, rows });
        i = j;
        continue;
      }
    }

    currentTextLines.push(line);
    i++;
  }

  if (currentTextLines.length > 0) {
    const textBlock = currentTextLines.join("\n").trim();
    if (textBlock) {
      segments.push({ type: "text", content: textBlock });
    }
  }

  return segments;
}

function isCommonEnglishWord(word: string): boolean {
  const common = new Set([
    "a", "an", "the", "in", "on", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "shall", "will", "should", "would",
    "may", "might", "must", "can", "could", "and", "but", "or", "nor", "so",
    "yet", "either", "neither", "both", "not", "only", "where", "which", "when",
    "what", "that", "this", "these", "those", "then", "than", "there", "here",
    "all", "any", "some", "none", "one", "two", "each", "every", "other", "such",
    "if", "as", "of", "off", "out", "over", "under", "again", "further", "once",
    "statement", "statements", "assertion", "reason", "option", "options",
    "process", "expansion", "compression", "work", "heat", "done", "given",
    "below", "above", "correct", "incorrect", "true", "false", "value", "order",
    "size", "ions", "mass", "gas", "moles", "ideal", "constant", "describes",
    "which", "match", "list", "following", "column", "type", "condition", "reaction",
    "product", "reactants", "equilibrium", "temperature", "pressure", "volume",
    "increases", "decreases", "remains", "same", "zero", "positive", "negative",
    "hybridisation", "geometry", "structure", "structures", "diagram", "figure"
  ]);
  return common.has(word.toLowerCase().replace(/[.,:;?!()]/g, ""));
}

function isMathPiece(str: string): boolean {
  if (!str) return false;
  // Has LaTeX command like \Delta, \frac, \ln, \alpha, \sqrt
  if (/\\[a-zA-Z]+/.test(str)) return true;
  // Has sub/superscript like x^2, P^{3-}, H_2O, R_1, Cr_2O_7^{2-}
  if (/[\^_]/.test(str)) return true;
  // Fraction like R/2, 1/2, a/b, 3/4
  if (/^[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(str)) return true;
  // Math operators: =, >, <, +, -, *, /, \le, \ge, \pm, \approx
  if (/^[=><\+\-\*\/]+$/.test(str)) return true;
  // Numbers / scientific notation (e.g. 10, 3.14, -5)
  if (/^[+\-]?[0-9]+(?:\.[0-9]+)?$/.test(str)) return true;
  // Single-letter math variables: x, y, z, w, k, R, T, V, P, U, q, n (excluding English "a", "i")
  if (/^[a-zA-Z]$/.test(str) && !["a", "i", "A", "I"].includes(str)) return true;
  // Chemical formulas or short compound variables like nRT, hc, Cl-, Na+
  if (/^[+\-]?[a-zA-Z0-9]{1,4}[+\-]?$/.test(str) && !isCommonEnglishWord(str)) return true;

  return false;
}

/**
 * Re-wraps true mathematical and chemical expressions (e.g. R, R/2, x^2, \theta, \frac{a}{b}, P^{3-})
 * with $...$ inside a text string that was previously erroneously wrapped as a giant math block.
 */
function rewrapMathTokens(prose: string): string {
  // Normalize \text{} and similar commands
  const normalized = prose.replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^{}]*)\}/g, "$1");
  const tokens = normalized.split(/(\s+)/);
  const result: string[] = [];
  let currentMathGroup: string[] = [];

  const flushMathGroup = () => {
    if (currentMathGroup.length === 0) return;

    const text = currentMathGroup.join("");
    const leadingWsMatch = text.match(/^\s+/);
    const trailingWsMatch = text.match(/\s+$/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : "";
    const trailingWs = trailingWsMatch ? trailingWsMatch[0] : "";
    const trimmed = text.trim();

    // Only re-wrap if the group contains genuine math features
    const hasRealMath =
      /\\[a-zA-Z]+/.test(trimmed) ||
      /[\^_]/.test(trimmed) ||
      /[A-Za-z0-9]+\/[A-Za-z0-9]+/.test(trimmed) ||
      /[=><]/.test(trimmed) ||
      /[+\-][0-9]/.test(trimmed) ||
      (/^[a-zA-Z]$/.test(trimmed) && !["a", "i", "A", "I"].includes(trimmed)) ||
      (trimmed.length <= 4 && !isCommonEnglishWord(trimmed) && /[A-Z0-9]/.test(trimmed));

    if (hasRealMath) {
      result.push(`${leadingWs}$${trimmed}$${trailingWs}`);
    } else {
      result.push(text);
    }
    currentMathGroup = [];
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\s+$/.test(token)) {
      if (currentMathGroup.length > 0) {
        currentMathGroup.push(token);
      } else {
        result.push(token);
      }
      continue;
    }

    const stripped = token.replace(/[.,:;?!]$/, "");
    const trailingPunct = token.slice(stripped.length);

    if (isMathPiece(stripped)) {
      currentMathGroup.push(stripped);
      if (trailingPunct) {
        flushMathGroup();
        result.push(trailingPunct);
      }
    } else {
      flushMathGroup();
      result.push(token);
    }
  }

  flushMathGroup();
  return result.join("");
}

/**
 * Removes unclosed, trailing, or accidental stray dollar signs from text.
 */
function cleanStrayDollars(text: string): string {
  let str = text;
  const dollarMatches = str.match(/(?<!\\)\$/g);
  let count = dollarMatches ? dollarMatches.length : 0;

  if (count % 2 !== 0) {
    if (str.startsWith("$") && !str.startsWith("$$")) {
      const rest = str.slice(1);
      const strippedRest = rest
        .replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^{}]*)\}/g, "$1")
        .replace(/\\[a-zA-Z]+/g, " ");
      const words = strippedRest.match(/[A-Za-z]{3,}/g) || [];
      if (words.length >= 2) {
        str = rest;
        count--;
      }
    }
  }

  if (count % 2 !== 0) {
    if (str.endsWith("$") && !str.endsWith("$$")) {
      const rest = str.slice(0, -1);
      const strippedRest = rest
        .replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^{}]*)\}/g, "$1")
        .replace(/\\[a-zA-Z]+/g, " ");
      const words = strippedRest.match(/[A-Za-z]{3,}/g) || [];
      if (words.length >= 2) {
        str = rest;
        count--;
      }
    }
  }

  if (count % 2 !== 0) {
    str = str.replace(/(?<!\\)\$(?=[A-Za-z])/g, "").replace(/(?<=[A-Za-z])(?<!\\)\$/g, "");
  }

  return str;
}

/**
 * Checks if a string without dollar delimiters is a pure LaTeX formula (e.g. \frac{1}{2}, x^2 + y^2 = r^2)
 * rather than regular English sentences or options.
 */
function isPureLatexFormula(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  const stripped = trimmed
    .replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^[\]]*\])*/g, " ");
  const words = stripped.match(/[A-Za-z]{3,}/g) || [];
  if (words.length >= 2) return false;
  if (words.length >= 1 && trimmed.includes(" ")) {
    const commonWords = trimmed.toLowerCase().split(/\s+/).filter((w) => isCommonEnglishWord(w));
    if (commonWords.length > 0) return false;
  }
  const hasLatexIndicator =
    trimmed.startsWith("\\") ||
    /[\^_]/.test(trimmed) ||
    /^[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(trimmed) ||
    /[=><]/.test(trimmed);

  return Boolean(hasLatexIndicator);
}

/**
 * Sanitizes question and explanation text:
 * 1. Cleans up accidental `(a) Image (b) Image`, standalone `(Image)`, `[Image]`, `(Figure)` artifacts into clean spacing or natural text.
 * 2. Cleans unclosed or stray dollar signs.
 * 3. Unwraps any multi-line math block ($...$, $$...$$, \(...\), \[...\]) containing 2 or more
 *    English words, re-wrapping only true math tokens (R, R/2, x^2, \theta, etc.) in $ ... $.
 */
export function sanitizeMathProse(input: string): string {
  if (!input || typeof input !== "string") return "";

  // 1. Clean up accidental raw image/figure placeholders and artifacts
  let text = input
    .replace(/\([a-zA-Z0-9]\)\s*Image\s*\([a-zA-Z0-9]\)\s*Image/gi, "(a) and (b)")
    .replace(/\[\s*(?:Image|Figure|Fig\.?)\s*\]/gi, "")
    .replace(/\(\s*(?:Image|Figure|Fig\.?)\s*\)/gi, "")
    .replace(/\(\s*([a-zA-Z0-9]+)\s*\)\s*(?:Image|Figure)/gi, "($1)")
    .replace(/\b(?:Image|Figure)\s*\(\s*([a-zA-Z0-9]+)\s*\)/gi, "($1)")
    .replace(/\b(?:Image|Figure)\s*:\s*/gi, "")
    .replace(/\[\s*(?:Image|Figure|Fig\.?)\s*:\s*[^\]]*\]/gi, "")
    .replace(/\s+([,:;.])/g, "$1");

  // 2. Clean stray / unclosed dollar signs if odd count
  text = cleanStrayDollars(text);

  // 3. Multi-line pattern matching across $...$, $$...$$, \(...\), and \[...\]
  const mathBlockRegex = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

  text = text.replace(mathBlockRegex, (match) => {
    let raw = match;
    let isBlock = false;

    if (raw.startsWith("$$") && raw.endsWith("$$") && raw.length >= 4) {
      raw = raw.slice(2, -2).trim();
      isBlock = true;
    } else if (raw.startsWith("$") && raw.endsWith("$") && raw.length >= 2) {
      raw = raw.slice(1, -1).trim();
    } else if (raw.startsWith("\\[") && raw.endsWith("\\]") && raw.length >= 4) {
      raw = raw.slice(2, -2).trim();
      isBlock = true;
    } else if (raw.startsWith("\\(") && raw.endsWith("\\)") && raw.length >= 4) {
      raw = raw.slice(2, -2).trim();
    }

    // Unwrap \text{}, \mathrm{}, etc., before counting words
    const textContent = raw.replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^{}]*)\}/g, "$1");
    // Strip known LaTeX commands (\frac, \Delta, \alpha, \sqrt, etc.) to count genuine prose words
    const strippedCommands = textContent.replace(/\\[a-zA-Z]+/g, " ");
    const words = strippedCommands.match(/[A-Za-z]{3,}/g) || [];

    // If the block contains 2 or more English words (e.g. "$The incorrect statement is$", "$Isothermal process$", "$Given below are two statements$")
    if (words.length >= 2) {
      // Accidental math-wrapped prose -> strip outer delimiters and re-wrap only genuine math tokens
      return rewrapMathTokens(raw);
    }

    // Normal math formula
    return isBlock ? `$$${raw}$$` : `$${raw}$`;
  });

  return text;
}

export default function MathView({
  math,
  block = false,
  className = "",
  disableTable = false,
}: MathViewProps) {
  if (!math) return null;

  const sanitized = sanitizeMathProse(math);

  // If table rendering is enabled and sanitized text contains pipe table characters
  if (!disableTable && sanitized.includes("|")) {
    const segments = parseMarkdownTables(sanitized);
    const hasTable = segments.some((s) => s.type === "table");

    if (hasTable) {
      return (
        <div className={`space-y-3 ${className}`}>
          {segments.map((seg, idx) => {
            if (seg.type === "table" && seg.headers && seg.rows) {
              return (
                <div
                  key={idx}
                  className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/70 shadow-sm"
                >
                  <table className="w-full text-left text-xs border-collapse">
                    {seg.headers.length > 0 && (
                      <thead className="bg-slate-900/90 border-b border-slate-700/80 text-slate-200">
                        <tr>
                          {seg.headers.map((h, hIdx) => (
                            <th
                              key={hIdx}
                              className="px-4 py-2.5 font-bold tracking-wide border-r last:border-r-0 border-slate-800"
                            >
                              <MathView math={h} disableTable />
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {seg.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-slate-900/40 transition-colors"
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-4 py-2 border-r last:border-r-0 border-slate-800/80 align-top"
                            >
                              <MathView math={cell} disableTable />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (seg.content) {
              return (
                <div key={idx}>
                  <MathView math={seg.content} disableTable />
                </div>
              );
            }

            return null;
          })}
        </div>
      );
    }
  }

  // If text contains $...$ or $$...$$, render mixed text and math
  if (sanitized.includes("$")) {
    const parts = sanitized.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);
    return (
      <span className={`whitespace-pre-wrap ${className}`.trim()}>
        {parts.map((part, index) => {
          if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
            const formula = part.slice(2, -2).trim();
            return (
              <span key={index} className="my-2 block text-center">
                <BlockMath
                  math={formula}
                  renderError={() => (
                    <span className="text-amber-400 font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">
                      {part}
                    </span>
                  )}
                />
              </span>
            );
          } else if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
            const formula = part.slice(1, -1).trim();
            return (
              <InlineMath
                key={index}
                math={formula}
                renderError={() => (
                  <span className="text-amber-400 font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">
                    {part}
                  </span>
                )}
              />
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>
    );
  }

  // If sanitized text does NOT contain $, determine if it is a pure LaTeX formula or English prose
  if (isPureLatexFormula(sanitized)) {
    if (block) {
      return (
        <div className={`overflow-x-auto ${className}`}>
          <BlockMath
            math={sanitized}
            renderError={(error) => (
              <div className="text-amber-400 font-mono text-xs p-2 bg-amber-500/10 rounded">
                Syntax error: {error.message}
              </div>
            )}
          />
        </div>
      );
    }

    return (
      <InlineMath
        math={sanitized}
        renderError={() => (
          <span className="text-amber-400 font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">
            {sanitized}
          </span>
        )}
      />
    );
  }

  // Plain English prose fallback: NEVER pass to KaTeX (prevents cursive squishing)
  return (
    <span className={`whitespace-pre-wrap ${className}`.trim()}>
      {sanitized}
    </span>
  );
}
