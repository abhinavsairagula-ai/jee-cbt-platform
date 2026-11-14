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

/**
 * Re-wraps true mathematical and chemical expressions (e.g. R, R/2, x^2, \theta, \frac{a}{b})
 * with $...$ inside a text string that was previously erroneously wrapped as a giant math block.
 */
function rewrapMathTokens(prose: string): string {
  // Matches LaTeX commands (\frac, \theta), variable subscripts/superscripts (x^2, R_1, 10^{-4}),
  // ratios (R/2, \sqrt{2}/2), or simple equations (k = R/\sqrt{2})
  const mathTokenPattern = /(?:(?:[a-zA-Z0-9\(\)]*\s*)?\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^[\]]*\])*(?:[\^_][a-zA-Z0-9{}]+|\/[0-9a-zA-Z]+|\s*[\+\-\=\*\/]\s*[a-zA-Z0-9\\]+)*|[a-zA-Z0-9]+[\^_][a-zA-Z0-9{}]+|[A-Z]\/[0-9]+|[a-zA-Z]\s*=\s*[0-9a-zA-Z\/\+\-\*\^_{}\\]+)/g;

  return prose.replace(mathTokenPattern, (match) => {
    const trimmed = match.trim();
    if (!trimmed) return match;
    // Don't re-wrap if already wrapped in $
    if (trimmed.startsWith("$") && trimmed.endsWith("$")) return trimmed;
    // If it's a plain word (e.g. "and", "the", "Statement"), don't wrap
    if (/^[A-Za-z]{2,}$/.test(trimmed)) return match;
    return `$${trimmed}$`;
  });
}

/**
 * Sanitizes question and explanation text:
 * 1. Cleans up accidental `(a) Image (b) Image`, standalone `(Image)`, `[Image]`, `(Figure)` artifacts into clean spacing or natural text.
 * 2. Unwraps any multi-line math block ($...$, $$...$$, \(...\), \[...\]) containing 4 or more
 *    consecutive English words, re-wrapping only true math tokens (R, R/2, x^2, \theta, etc.) in $ ... $.
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

  // 2. Multi-line pattern matching across $...$, $$...$$, \(...\), and \[...\]
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

    // Check if this block contains 4 or more consecutive English words (excluding words inside \text{...})
    const strippedOfText = raw.replace(/\\text\{[^{}]*\}/g, "");
    const fourWordsRegex = /[A-Za-z]{2,}(?:[\s\-_]+[A-Za-z]{2,}){3,}/;

    if (fourWordsRegex.test(strippedOfText)) {
      // Prose was mistakenly enclosed in math delimiters -> unwrap and re-wrap only true math expressions
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
  if (sanitized.includes("$") && !block) {
    const parts = sanitized.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);
    return (
      <span className={className}>
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
