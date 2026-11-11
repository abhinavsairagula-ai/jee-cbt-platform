"use client";

import { InlineMath, BlockMath } from "react-katex";
import React from "react";

interface MathViewProps {
  math: string;
  block?: boolean;
  className?: string;
}

export default function MathView({ math, block = false, className = "" }: MathViewProps) {
  if (!math) return null;

  // If text contains $...$ or $$...$$, render mixed text and math
  if (math.includes("$") && !block) {
    const parts = math.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);
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
          math={math}
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
      math={math}
      renderError={() => (
        <span className="text-amber-400 font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">
          {math}
        </span>
      )}
    />
  );
}
