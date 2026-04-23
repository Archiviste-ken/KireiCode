"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

type SystemTier = "frontend" | "api" | "backend" | "database";

interface CodeGraphProps {
  nodes: Array<{
    id: string;
    label?: string;
    filePath?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type?: string;
  }>;
}

interface GraphViewNode {
  id: string;
  name: string;
  group: SystemTier | "stage";
  level: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  width: number;
  height: number;
  isStage?: boolean;
}

interface GraphViewLink {
  source: string;
  target: string;
  category: "stage" | "membership" | "dependency";
  curved?: boolean;
}

interface ForceGraphLinkForce {
  distance: (value: number) => ForceGraphLinkForce;
  strength: (value: number) => ForceGraphLinkForce;
}

interface ForceGraphChargeForce {
  strength: (value: number) => ForceGraphChargeForce;
}

interface ForceGraphHandle {
  d3Force(name: "link"): ForceGraphLinkForce | undefined;
  d3Force(name: "charge"): ForceGraphChargeForce | undefined;
  d3Force(
    name: string,
  ): ForceGraphLinkForce | ForceGraphChargeForce | undefined;
  zoomToFit(durationMs?: number, paddingPx?: number): void;
}

const TIER_ORDER: SystemTier[] = ["frontend", "api", "backend", "database"];
const STAGE_NODE_IDS: Record<SystemTier, string> = {
  frontend: "stage:frontend",
  api: "stage:api",
  backend: "stage:backend",
  database: "stage:database",
};

const TIER_TITLE: Record<SystemTier, string> = {
  frontend: "Frontend",
  api: "API",
  backend: "Backend",
  database: "Database",
};

const TIER_COLOR: Record<
  GraphViewNode["group"],
  { fill: string; border: string; text: string }
> = {
  stage: {
    fill: "rgba(15, 23, 42, 0.95)",
    border: "rgba(148, 163, 184, 0.65)",
    text: "#e2e8f0",
  },
  frontend: {
    fill: "rgba(12, 74, 110, 0.55)",
    border: "rgba(56, 189, 248, 0.8)",
    text: "#bae6fd",
  },
  api: {
    fill: "rgba(15, 118, 110, 0.5)",
    border: "rgba(45, 212, 191, 0.8)",
    text: "#ccfbf1",
  },
  backend: {
    fill: "rgba(30, 64, 175, 0.45)",
    border: "rgba(96, 165, 250, 0.8)",
    text: "#dbeafe",
  },
  database: {
    fill: "rgba(6, 95, 70, 0.5)",
    border: "rgba(74, 222, 128, 0.8)",
    text: "#dcfce7",
  },
};

const MAX_RENDERED_NODES = 180;
const DAG_LEVEL_DISTANCE = 190;
const NODE_SPACING = 210;
const MEMBER_Y_OFFSET = 52;

function toNodeId(value: unknown): string {
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value ?? "");
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, Math.max(0, maxLength - 1))}...`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function classifyTier(node: CodeGraphProps["nodes"][number]): SystemTier {
  const signature = [
    node.filePath ?? "",
    node.label ?? "",
    node.type ?? "",
    JSON.stringify(node.metadata ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  const isFrontend =
    signature.includes("component") ||
    signature.includes("frontend") ||
    signature.includes("client") ||
    signature.includes("/app/") ||
    signature.includes("/pages/") ||
    signature.includes("jsx") ||
    signature.includes("tsx") ||
    signature.includes("react");

  const isApi =
    signature.includes("api") ||
    signature.includes("route") ||
    signature.includes("endpoint") ||
    signature.includes("controller") ||
    signature.includes("handler") ||
    signature.includes("graphql") ||
    signature.includes("rest");

  const isDatabase =
    signature.includes("database") ||
    signature.includes("db") ||
    signature.includes("prisma") ||
    signature.includes("mongo") ||
    signature.includes("sql") ||
    signature.includes("schema") ||
    signature.includes("repository") ||
    signature.includes("model") ||
    signature.includes("collection");

  if (isDatabase) {
    return "database";
  }

  if (isFrontend) {
    return "frontend";
  }

  if (isApi) {
    return "api";
  }

  return "backend";
}

export default function CodeGraph({ nodes, edges }: CodeGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 420 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) {
      return;
    }

    const updateDimensions = () => {
      if (target.clientWidth > 0 && target.clientHeight > 0) {
        setDimensions({
          width: target.clientWidth,
          height: target.clientHeight,
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(() => updateDimensions());
    observer.observe(target);

    window.addEventListener("resize", updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  const graphData = useMemo(() => {
    const visibleNodes = nodes.slice(0, MAX_RENDERED_NODES);
    const grouped = new Map<SystemTier, CodeGraphProps["nodes"]>([
      ["frontend", []],
      ["api", []],
      ["backend", []],
      ["database", []],
    ]);

    visibleNodes.forEach((node) => {
      const tier = classifyTier(node);
      grouped.get(tier)?.push(node);
    });

    const viewNodes: GraphViewNode[] = [];
    const viewLinks: GraphViewLink[] = [];
    const renderedNodeIds = new Set<string>();

    const MAX_COLS = 6;
    const NODE_SPACING_X = 180;
    const NODE_SPACING_Y = 60;
    const STAGE_MARGIN_BOTTOM = 80;
    const TIER_MARGIN_BOTTOM = 140;

    let totalHeight = 0;
    TIER_ORDER.forEach((tier) => {
      const members = grouped.get(tier) ?? [];
      const rows = Math.ceil(members.length / MAX_COLS) || 1;
      totalHeight += STAGE_MARGIN_BOTTOM + (rows - 1) * NODE_SPACING_Y + TIER_MARGIN_BOTTOM;
    });

    let currentY = -totalHeight / 2;

    TIER_ORDER.forEach((tier, tierIndex) => {
      const stageNodeId = STAGE_NODE_IDS[tier];

      viewNodes.push({
        id: stageNodeId,
        name: TIER_TITLE[tier],
        group: "stage",
        level: tierIndex,
        fx: 0,
        fy: currentY,
        width: 188,
        height: 34,
        isStage: true,
      });
      renderedNodeIds.add(stageNodeId);

      if (tierIndex < TIER_ORDER.length - 1) {
        viewLinks.push({
          source: stageNodeId,
          target: STAGE_NODE_IDS[TIER_ORDER[tierIndex + 1] as SystemTier],
          category: "stage",
        });
      }

      const members = grouped.get(tier) ?? [];
      const rows = Math.ceil(members.length / MAX_COLS) || 1;

      members.forEach((member, memberIndex) => {
        const row = Math.floor(memberIndex / MAX_COLS);
        const col = memberIndex % MAX_COLS;
        const membersInThisRow = row === rows - 1 ? members.length - row * MAX_COLS : MAX_COLS;
        const rowWidth = Math.max(0, membersInThisRow - 1) * NODE_SPACING_X;
        const x = col * NODE_SPACING_X - rowWidth / 2;

        const fallbackLabel = member.label ?? member.filePath ?? member.id;

        viewNodes.push({
          id: member.id,
          name: fallbackLabel.split(/[\\/]/).pop() || fallbackLabel,
          group: tier,
          level: tierIndex,
          fx: x,
          fy: currentY + STAGE_MARGIN_BOTTOM + row * NODE_SPACING_Y,
          width: 158,
          height: 42,
        });
        renderedNodeIds.add(member.id);

        viewLinks.push({
          source: stageNodeId,
          target: member.id,
          category: "membership",
        });
      });

      currentY += STAGE_MARGIN_BOTTOM + (rows - 1) * NODE_SPACING_Y + TIER_MARGIN_BOTTOM;
    });

    const dedupe = new Set<string>();
    edges.forEach((edge) => {
      if (!renderedNodeIds.has(edge.from) || !renderedNodeIds.has(edge.to)) {
        return;
      }
      if (edge.from === edge.to) {
        return;
      }
      const key = `${edge.from}::${edge.to}`;
      if (dedupe.has(key)) {
        return;
      }
      dedupe.add(key);

      viewLinks.push({
        source: edge.from,
        target: edge.to,
        category: "dependency",
        curved: true,
      });
    });

    const validNodeIds = new Set(viewNodes.map((n) => n.id));
    const safeLinks = viewLinks.filter(
      (l) => validNodeIds.has(l.source) && validNodeIds.has(l.target)
    );

    return {
      nodes: viewNodes,
      links: safeLinks,
      hasTruncatedNodes: nodes.length > MAX_RENDERED_NODES,
    };
  }, [edges, nodes]);

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) {
      return new Set<string>();
    }

    const set = new Set<string>([hoveredNodeId]);
    graphData.links.forEach((link) => {
      const source = toNodeId(link.source);
      const target = toNodeId(link.target);
      if (source === hoveredNodeId) {
        set.add(target);
      }
      if (target === hoveredNodeId) {
        set.add(source);
      }
    });

    return set;
  }, [graphData.links, hoveredNodeId]);

  useEffect(() => {
    if (fgRef.current) {
      setTimeout(() => fgRef.current?.zoomToFit(450, 80), 140);
    }
  }, [graphData]);

  const renderNode = (
    node: GraphViewNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    const width = node.width;
    const height = node.height;
    const x = (node.x ?? node.fx ?? 0) - width / 2;
    const y = (node.y ?? node.fy ?? 0) - height / 2;

    const isHovered = node.id === hoveredNodeId;
    const isConnected = connectedNodeIds.has(node.id);
    const palette = TIER_COLOR[node.group];

    ctx.save();

    drawRoundedRect(ctx, x, y, width, height, 8 / Math.max(globalScale, 1));
    ctx.fillStyle = palette.fill;
    ctx.fill();

    ctx.lineWidth = (isHovered ? 2.4 : isConnected ? 1.9 : 1.3) / globalScale;
    ctx.strokeStyle = isHovered
      ? "rgba(248, 250, 252, 0.95)"
      : isConnected
        ? "rgba(224, 242, 254, 0.8)"
        : palette.border;
    ctx.stroke();

    ctx.font = `${node.isStage ? 700 : 600} ${11 / globalScale}px var(--font-sans)`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.fillText(
      truncateLabel(node.name, node.isStage ? 20 : 24),
      node.x ?? node.fx ?? 0,
      node.y ?? node.fy ?? 0,
    );

    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-80 cursor-move"
    >
      <ForceGraph2D
        ref={fgRef}
        nodeId="id"
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        warmupTicks={0}
        cooldownTicks={0}
        enableNodeDrag={false}
        minZoom={0.35}
        maxZoom={3}
        nodeRelSize={3}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkCurvature={(link: GraphViewLink) =>
          link.category === "dependency" && link.curved ? 0.06 : 0
        }
        nodeCanvasObject={renderNode}
        nodePointerAreaPaint={(node: GraphViewNode, color, ctx) => {
          ctx.fillStyle = color;
          drawRoundedRect(
            ctx,
            (node.x ?? node.fx ?? 0) - node.width / 2,
            (node.y ?? node.fy ?? 0) - node.height / 2,
            node.width,
            node.height,
            8,
          );
          ctx.fill();
        }}
        onNodeHover={(node: GraphViewNode | null) =>
          setHoveredNodeId(node?.id ?? null)
        }
        linkColor={(link: GraphViewLink) => {
          const source = toNodeId(link.source);
          const target = toNodeId(link.target);
          const isHovered = hoveredNodeId
            ? source === hoveredNodeId || target === hoveredNodeId
            : false;

          if (isHovered) {
            return "rgba(226, 232, 240, 0.95)";
          }

          if (link.category === "stage") {
            return "rgba(148, 163, 184, 0.7)";
          }

          if (link.category === "membership") {
            return "rgba(148, 163, 184, 0.38)";
          }

          return "rgba(125, 211, 252, 0.36)";
        }}
        linkLineDash={(link: GraphViewLink) =>
          link.category === "membership" ? [5, 4] : null
        }
        linkWidth={(link: GraphViewLink) => {
          const source = toNodeId(link.source);
          const target = toNodeId(link.target);
          const isHovered = hoveredNodeId
            ? source === hoveredNodeId || target === hoveredNodeId
            : false;

          if (isHovered) {
            return 2.2;
          }

          return link.category === "stage" ? 1.9 : 1.2;
        }}
        onEngineStop={() => fgRef.current?.zoomToFit(450, 80)}
        backgroundColor="#0b0f14"
      />

      {graphData.hasTruncatedNodes ? (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-900/85 px-2.5 py-1 text-[11px] text-slate-300">
          Showing first {MAX_RENDERED_NODES} nodes for clarity and performance.
        </p>
      ) : null}
    </div>
  );
}
