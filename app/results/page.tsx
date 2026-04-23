"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  FolderGit2,
  AlertCircle,
  FileCode2,
  Blocks,
  Share2,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ExecutionFlow } from "@/components/ExecutionFlow";
import { IssueItem } from "@/components/IssueItem";
import { TechStack } from "@/components/TechStack";

const DynamicCodeGraph = dynamic(() => import("@/components/CodeGraph"), {
  ssr: false,
  loading: () => (
    <div className="mt-16 w-full text-center text-xs text-slate-400">
      Loading graph engine...
    </div>
  ),
});

const FLOW_STEPS = [
  "Source Control",
  "Parser",
  "IR Builder",
  "Graph Evaluator",
  "Rule Engine",
];

export default function ResultsPage() {
  const { lastAnalysis, error } = useApi();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-full text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Analysis Error</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!lastAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-[60vh] text-center gap-4">
        <h2 className="text-xl font-bold text-white">No Analysis Available</h2>
        <p className="text-gray-400">
          Please go to the Dashboard to initiate a codebase analysis.
        </p>
      </div>
    );
  }

  const { analysis, repoUrl } = lastAnalysis;
  const repoName = repoUrl.split("/").pop() || repoUrl;
  const graphNodes = analysis.graphData?.nodes ?? [];
  const graphEdges = analysis.graphData?.edges ?? [];
  const hasGraphData = graphNodes.length > 0;

  const performanceIssues = analysis.issues.filter(
    (i) => i.type === "PERFORMANCE",
  );
  const bugRisks = analysis.issues.filter(
    (i) => i.type === "BUG" || i.type === "RISK",
  );

  // Determine top severity to show in header
  const hasHighRisk = analysis.issues.some((i) => i.severity === "high");

  const selectedIssue = analysis.issues.find(
    (i) => `${i.file}-${i.function}-${i.message}` === selectedIssueId,
  );

  return (
    <div className="flex flex-col gap-8 pb-8 lg:pb-12">
      {/* Header */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <FolderGit2 className="text-gray-400" size={24} />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {repoName}
          </h1>
        </div>
        <p
          className={`text-sm font-medium flex items-center gap-2 ${hasHighRisk ? "text-red-400" : "text-yellow-400"}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${hasHighRisk ? "bg-red-400" : "bg-yellow-400"}`}
          ></span>
          {hasHighRisk
            ? "High risks detected"
            : "Analysis complete, minor issues detected"}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3 xl:gap-10">
        <div className="xl:col-span-2 flex flex-col gap-8">
          {/* Architecture Mapping View */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Code Structure Mapping
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-[#11161d] border border-[#ffffff0f] rounded-lg p-5 flex flex-col gap-1">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileCode2 size={14} /> Files
                </span>
                <span className="text-2xl font-bold text-white">
                  {analysis.graphSummary.fileNodes}
                </span>
              </div>
              <div className="bg-[#11161d] border border-[#ffffff0f] rounded-lg p-5 flex flex-col gap-1">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Blocks size={14} /> Functions
                </span>
                <span className="text-2xl font-bold text-white">
                  {analysis.graphSummary.functionNodes}
                </span>
              </div>
              <div className="bg-[#11161d] border border-[#ffffff0f] rounded-lg p-5 flex flex-col gap-1">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Share2 size={14} /> Call Edges
                </span>
                <span className="text-2xl font-bold text-white">
                  {analysis.graphSummary.callEdges}
                </span>
              </div>
              <div className="bg-[#11161d] border border-[#ffffff0f] rounded-lg p-5 flex flex-col gap-1">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle size={14} /> Issues
                </span>
                <span className="text-2xl font-bold text-white">
                  {analysis.issues.length}
                </span>
              </div>
            </div>

            {/* Simulated Node Visual */}
            <div className="relative min-h-[400px] overflow-hidden rounded-xl border border-[#ffffff0f] bg-[#11161d] sm:min-h-[500px]">
              {hasGraphData ? (
                <DynamicCodeGraph nodes={graphNodes} edges={graphEdges} />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
                  No graph data available for this run. Re-analyze the
                  repository to refresh the topology.
                </div>
              )}
              <p className="pointer-events-none absolute bottom-4 right-4 rounded bg-[#0b0f14]/80 px-2 py-1 text-[11px] font-medium tracking-wide text-gray-500">
                Interactive Topology Map
              </p>
            </div>
          </section>

          {/* Tech Stack Infrastructure Panel */}
          <section>
            <TechStack techStack={analysis.techStack} />
          </section>

          {/* Execution Flow */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              Pipeline Execution Trace
            </h2>
            <ExecutionFlow steps={FLOW_STEPS} highlightIndex={4} />
          </section>

          {/* Issue Inspection Panel */}
          {selectedIssue ? (
            <section className="bg-[#11161d] border border-[#ffffff0f] flex flex-col gap-5 p-6 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
              <h2 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>{" "}
                ISSUE INSPECTION: {selectedIssue.type}
              </h2>

              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-semibold text-white mb-2 text-sm tracking-wide">
                    Issue Overview
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Detected an issue with the function `
                    {selectedIssue.function}` inside file `{selectedIssue.file}
                    `.
                    <br />
                    <br />
                    {selectedIssue.message}
                  </p>
                </div>

                {selectedIssue.code && (
                  <div>
                    <h3 className="font-semibold text-white mb-2 text-sm tracking-wide">
                      Code Context
                    </h3>
                    <div className="bg-[#0b0f14] rounded-md border border-[#ffffff0f] font-mono text-xs overflow-x-auto">
                      <pre className="p-4 text-gray-300 leading-relaxed">
                        <code>{selectedIssue.code}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {selectedIssue.rule && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-[#ffffff05] px-3 py-2 rounded">
                    <span>Violated Rule:</span>
                    <span className="text-yellow-400/80">
                      {selectedIssue.rule}
                    </span>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sidebar - Lists */}
        <div className="min-w-0 flex flex-col gap-8">
          <section>
            <div className="flex items-center justify-between mb-2 border-b border-[#ffffff0f] pb-3">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Bugs & Risks
              </h2>
              <span className="text-xs font-bold bg-[#ffffff10] px-2 py-0.5 rounded text-gray-300">
                {bugRisks.length}
              </span>
            </div>
            {bugRisks.length > 0 ? (
              <div className="scrollable-list flex max-h-[42vh] flex-col overflow-y-auto pr-2 xl:max-h-[56vh]">
                {bugRisks.map((issue, idx) => {
                  const id = `${issue.file}-${issue.function}-${issue.message}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedIssueId(id)}
                      className="cursor-pointer group"
                    >
                      <div
                        className={`transition-colors p-4 -mx-4 rounded-lg ${selectedIssueId === id ? "bg-[#ffffff0a]" : "hover:bg-[#ffffff05]"}`}
                      >
                        <IssueItem
                          title={issue.message}
                          severity={
                            issue.severity.toUpperCase() as
                              | "HIGH"
                              | "MEDIUM"
                              | "LOW"
                          }
                          description={`${issue.file} - ${issue.function}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">
                No critical bugs or risks identified.
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2 border-b border-[#ffffff0f] pb-3">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Performance Issues
              </h2>
              <span className="text-xs font-bold bg-[#ffffff10] px-2 py-0.5 rounded text-gray-300">
                {performanceIssues.length}
              </span>
            </div>
            {performanceIssues.length > 0 ? (
              <div className="scrollable-list flex max-h-[42vh] flex-col overflow-y-auto pr-2 xl:max-h-[56vh]">
                {performanceIssues.map((issue, idx) => {
                  const id = `${issue.file}-${issue.function}-${issue.message}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedIssueId(id)}
                      className="cursor-pointer group"
                    >
                      <div
                        className={`transition-colors p-4 -mx-4 rounded-lg ${selectedIssueId === id ? "bg-[#ffffff0a]" : "hover:bg-[#ffffff05]"}`}
                      >
                        <IssueItem
                          title={issue.message}
                          severity={
                            issue.severity.toUpperCase() as
                              | "HIGH"
                              | "MEDIUM"
                              | "LOW"
                          }
                          description={`${issue.file} - ${issue.function}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">
                No performance bottlenecks identified.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
