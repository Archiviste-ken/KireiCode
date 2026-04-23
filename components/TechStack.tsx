"use client";

import React from "react";

export type TechStackData = {
  framework?: string;
  language?: string;
  styling?: string;
  database?: string;
  api?: string;
  ai?: string;
  tools?: string[];
};

interface Props {
  techStack?: TechStackData;
}

export function TechStack({ techStack }: Props) {
  if (!techStack || Object.keys(techStack).length === 0) {
    return (
      <div className="py-6 text-sm text-gray-500 italic">
        No tech stack detected
      </div>
    );
  }

  const rows = [
    { label: "Framework", value: techStack.framework },
    { label: "Language", value: techStack.language },
    { label: "Database", value: techStack.database },
    { label: "Styling", value: techStack.styling },
    { label: "API", value: techStack.api },
    { label: "AI", value: techStack.ai },
  ].filter((row) => row.value);

  return (
    <section className="flex flex-col gap-6 py-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-100">Tech Stack</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Detected automatically from codebase
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
        <div className="flex flex-col">
          {rows.slice(0, Math.ceil(rows.length / 2)).map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between py-3 border-b border-gray-700/40 ${
                i === 0 ? "border-t" : ""
              }`}
            >
              <span className="text-sm text-gray-400">{row.label}</span>
              <span className="text-sm font-medium text-gray-100">
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {rows.slice(Math.ceil(rows.length / 2)).map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between py-3 border-b border-gray-700/40 ${
                i === 0 ? "md:border-t" : ""
              }`}
            >
              <span className="text-sm text-gray-400">{row.label}</span>
              <span className="text-sm font-medium text-gray-100">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {techStack.tools && techStack.tools.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <span className="text-sm text-gray-400">Tools</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-gray-100">
            {techStack.tools.join(", ")}
          </div>
        </div>
      )}
    </section>
  );
}
