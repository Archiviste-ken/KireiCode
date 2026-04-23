"use client";

import { AlertTriangle, Info, AlertOctagon } from "lucide-react";

interface IssueItemProps {
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export function IssueItem({ title, severity, description }: IssueItemProps) {
  const getSeverityStyle = () => {
    switch (severity) {
      case "HIGH":
        return "text-red-400 border-red-400/20 bg-red-400/10";
      case "MEDIUM":
        return "text-yellow-400 border-yellow-400/20 bg-yellow-400/10";
      case "LOW":
        return "text-blue-400 border-blue-400/20 bg-blue-400/10";
    }
  };

  const Icon =
    severity === "HIGH"
      ? AlertOctagon
      : severity === "MEDIUM"
        ? AlertTriangle
        : Info;

  return (
    <div className="py-4 border-b border-[#ffffff0f] last:border-0 flex gap-4 items-start">
      <div className="mt-1">
        <Icon
          className={
            severity === "HIGH"
              ? "text-red-400"
              : severity === "MEDIUM"
                ? "text-yellow-400"
                : "text-blue-400"
          }
          size={20}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="font-semibold text-white">{title}</h4>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getSeverityStyle()}`}
          >
            {severity}
          </span>
        </div>
        <p className="text-sm text-gray-400 wrap-break-word line-clamp-4">
          {description}
        </p>
      </div>
    </div>
  );
}
