"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  GitFork,
  Link as LinkIcon,
  Code2,
  LoaderCircle,
} from "lucide-react";

import { useApi } from "@/hooks/useApi";

const QUICK_REPOS = [
  "https://github.com/vercel/next.js",
  "https://github.com/t3-oss/create-t3-app",
  "https://github.com/prisma/prisma",
  "https://github.com/fastify/fastify",
  "https://github.com/nestjs/nest",
];

export default function AnalyzePage() {
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

  const handleQuickRepo = (repoUrl: string) => {
    setUrl(repoUrl);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
      <section className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(13,148,136,0.22),rgba(12,74,110,0.2),rgba(15,23,42,0.9))] p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Analyze Repository
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200/80">
          Paste a repository URL to run the backend pipeline: parsing, graph
          construction, rule checks, and performance scoring.
        </p>

        <form
          onSubmit={handleAnalyze}
          className="mt-6 flex flex-col gap-4 sm:flex-row"
        >
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <LinkIcon size={18} className="text-teal-300/80" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="w-full rounded-xl border border-white/15 bg-slate-950/70 py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-teal-300 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={status === "analyzing" || !url}
            className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-teal-300/40 bg-teal-400 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "analyzing" ? (
              <>
                <LoaderCircle className="animate-spin" size={16} />
                Analyzing...
              </>
            ) : (
              <>Start Analysis</>
            )}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <Activity className="text-teal-300" size={20} />
          <p className="mt-3 text-sm font-semibold text-white">
            Build dependency graph
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Maps relationships between files and calls.
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <Gauge className="text-cyan-300" size={20} />
          <p className="mt-3 text-sm font-semibold text-white">
            Evaluate performance
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Highlights hotspots and inefficient patterns.
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <AlertTriangle className="text-amber-300" size={20} />
          <p className="mt-3 text-sm font-semibold text-white">
            Flag risky code
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Detects N+1s, missing error handling, and more.
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <GitFork className="text-sky-300" size={20} />
          <p className="mt-3 text-sm font-semibold text-white">
            Trace execution flow
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Shows request paths through your architecture.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
          Quick Analyze
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_REPOS.map((repoUrl) => (
            <button
              key={repoUrl}
              onClick={() => handleQuickRepo(repoUrl)}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/65 p-4 text-left transition hover:border-teal-300/40 hover:bg-slate-900"
            >
              <span className="mt-0.5 rounded-lg border border-white/10 bg-slate-900 p-2">
                <Code2 size={14} className="text-teal-300" />
              </span>
              <span className="text-xs leading-relaxed text-slate-200/90">
                {repoUrl}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/45 p-8 text-center">
        {status === "analyzing" ? (
          <div className="flex flex-col items-center gap-5">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <LoaderCircle
                className="absolute animate-spin text-teal-300"
                size={40}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-white">
                Analyzing repository...
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-400">
                <span className="text-teal-300">Parsing files</span>
                <span className="h-1 w-1 rounded-full bg-slate-600"></span>
                <span>Building graph</span>
                <span className="h-1 w-1 rounded-full bg-slate-600"></span>
                <span>Running rules</span>
                <span className="h-1 w-1 rounded-full bg-slate-600"></span>
                <span>Generating insights</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Clock3 className="text-slate-400" size={24} />
            <h3 className="text-md font-semibold text-white">
              Ready to analyze
            </h3>
            <p className="text-sm text-slate-400">
              Enter a repository URL and run the pipeline.
            </p>

            {lastAnalysis ? (
              <p className="mt-2 text-xs text-slate-500">
                Last run at {new Date(lastAnalysis.createdAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
