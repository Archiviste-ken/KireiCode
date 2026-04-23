"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react"; // for mobile toggle later if needed
import { useApi } from "@/hooks/useApi";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { lastAnalysis } = useApi();
  let title = "Dashboard";
  if (pathname.includes("analyze")) title = "Analyze";
  if (pathname.includes("results")) title = "Analysis Results";
  if (pathname.includes("chat")) title = "AI Chat";

  const hasAnalysis = Boolean(lastAnalysis?.analysis);

  return (
    <header className="h-15 shrink-0 border-b border-white/10 bg-slate-950/75 backdrop-blur flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="md:hidden text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-md"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-sm font-medium sm:flex">
          <span className="text-slate-400">Context:</span>
          {hasAnalysis ? (
            <span className="flex items-center gap-2 text-teal-300">
              <span className="w-2 h-2 rounded-full bg-teal-300"></span>{" "}
              Analysis ready
            </span>
          ) : (
            <span className="flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>{" "}
              Awaiting scan
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-xs font-bold text-slate-950 shadow-sm">
          AI
        </div>
      </div>
    </header>
  );
}
