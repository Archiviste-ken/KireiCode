"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  Link as LinkIcon,
  Sparkles,
  Timer,
} from "lucide-react";

import { useApi } from "@/hooks/useApi";

export default function DashboardPage() {
  const [url, setUrl] = useState("");
  const router = useRouter();
  const { triggerAnalysis, status, error, lastAnalysis } = useApi();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    const success = await triggerAnalysis(url);
    if (success) {
      router.push("/results");
    }
  };

  const latest = lastAnalysis?.analysis;
  const issues = latest?.issues ?? [];
  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumCount = issues.filter(
    (issue) => issue.severity === "medium",
  ).length;
  const lowCount = issues.filter((issue) => issue.severity === "low").length;

  const risk =
    highCount > 0
      ? "HIGH"
      : mediumCount > 0
        ? "MEDIUM"
        : lowCount > 0
          ? "LOW"
          : "CLEAR";

  return (
    <div className="flex flex-col gap-8 pb-10">
      <section className="rounded-2xl border border-white/10 bg-[linear-gradient(120deg,rgba(16,185,129,0.15),rgba(8,47,73,0.2),rgba(15,23,42,0.9))] p-7 sm:p-9 shadow-[0_24px_90px_rgba(6,95,70,0.2)]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
            <Sparkles size={14} />
            Code Intelligence Engine
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Ship safer backends with one scan
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200/80">
              Connect any repository URL, build a dependency graph, detect risky
              patterns, and ask AI for fixes directly from your latest analysis
              context.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleAnalyze}
          className="mt-7 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <LinkIcon size={16} className="text-emerald-300/70" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full rounded-xl border border-white/15 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={status === "analyzing" || !url}
            className="inline-flex min-w-40 items-center justify-center rounded-xl border border-emerald-300/40 bg-emerald-500 px-7 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "analyzing" ? "Analyzing..." : "Analyze Repository"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Total Issues
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {latest?.issues.length ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Risk Level
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{risk}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <Gauge size={16} />
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Performance Score
            </p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            {latest?.performance?.score ?? "-"}
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <Timer size={16} />
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Scanned Files
            </p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            {latest?.fileCount ?? 0}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Latest Analysis Snapshot
          </h2>
          <button
            onClick={() => router.push("/results")}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            Open detailed results <ArrowRight size={15} />
          </button>
        </div>

        {!lastAnalysis ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-slate-400">
            No analysis yet. Run your first repository scan to unlock results
            and AI chat context.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Repository
              </p>
              <p className="mt-2 break-all text-sm text-white">
                {lastAnalysis.repoUrl}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Last scanned {new Date(lastAnalysis.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Severity Split
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2 text-rose-300">
                  <AlertTriangle size={14} /> High: {highCount}
                </span>
                <span className="text-amber-300">Medium: {mediumCount}</span>
                <span className="text-sky-300">Low: {lowCount}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
