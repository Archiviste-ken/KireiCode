"use client";

import { ArrowRight } from "lucide-react";

interface ExecutionFlowProps {
  steps: string[];
  highlightIndex: number;
}

export function ExecutionFlow({ steps, highlightIndex }: ExecutionFlowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {steps.map((step, index) => {
        const isHighlighted = index === highlightIndex;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className={`flex items-center justify-center px-4 py-2 rounded-md font-mono text-[11px] tracking-widest uppercase transition-colors ${
                isHighlighted
                  ? "border border-blue-500/30 bg-blue-500/10 text-blue-300"
                  : "border border-[#ffffff1a] bg-[#ffffff05] text-gray-500"
              }`}
            >
              {step}
            </div>

            {!isLast && <ArrowRight className="text-[#ffffff25]" size={14} />}
          </div>
        );
      })}
    </div>
  );
}
