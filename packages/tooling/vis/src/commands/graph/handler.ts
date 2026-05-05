import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim } from "@visulima/colorize";
import type { ProjectGraph } from "@visulima/task-runner";
import { projectGraphToDot } from "@visulima/task-runner";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { GraphStore } from "../../tui/components/graph/GraphStore";
import VisGraphApp from "../../tui/components/graph/VisGraphApp";
import type { GraphOptions } from "./index";

// ── ASCII Graph Renderer ────────────────────────────────────────────

interface NodeInfo {
    deps: { target: string; type: string }[];
    name: string;
    type: string;
}

const printDepsTree = (
    name: string,
    prefix: string,
    isLast: boolean,
    nodes: Map<string, NodeInfo>,
    printed: Set<string>,
    lines: string[],
    maxDepth: number,
    currentDepth: number,
): void => {
    const connector = isLast ? dim("└── ") : dim("├── ");
    const isDuplicate = printed.has(name);
    const suffix = isDuplicate ? dim(" (*)") : "";
    const node = nodes.get(name);
    const isApp = node?.type === "application";
    const displayName = isApp ? bold(name) : name;

    lines.push(`${prefix}${connector}${displayName}${suffix}`);

    if (isDuplicate) {
        return;
    }

    printed.add(name);

    const deps = node?.deps ?? [];
    const childPrefix = isLast ? `${prefix}    ` : `${prefix}${dim("│")}   `;

    if (currentDepth >= maxDepth && deps.length > 0) {
        lines.push(`${childPrefix}${dim(`... ${deps.length} more`)}`);

        return;
    }

    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];

        if (dep) {
            printDepsTree(dep.target, childPrefix, i === deps.length - 1, nodes, printed, lines, maxDepth, currentDepth + 1);
        }
    }
};

/** Render a root project node and its dependency tree. */
const printRootProject = (name: string, nodes: Map<string, NodeInfo>, printed: Set<string>, lines: string[], maxDepth: number, indent: string): void => {
    const node = nodes.get(name);
    const isApp = node?.type === "application";
    const displayName = isApp ? bold(name) : name;

    lines.push(`${indent}${displayName}`);
    printed.add(name);

    const deps = node?.deps ?? [];

    if (deps.length === 0) {
        lines.push(`${indent}  ${dim("(no dependencies)")}`);

        return;
    }

    if (maxDepth <= 0) {
        lines.push(`${indent}  ${dim(`... ${deps.length} dependencies`)}`);

        return;
    }

    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];

        if (dep) {
            printDepsTree(dep.target, indent, i === deps.length - 1, nodes, printed, lines, maxDepth, 1);
        }
    }
};

const projectGraphToAscii = (projectGraph: ProjectGraph, maxDepth: number): string => {
    const nodes = new Map<string, NodeInfo>();

    for (const [name, node] of Object.entries(projectGraph.nodes)) {
        nodes.set(name, {
            deps: (projectGraph.dependencies[name] ?? []).map((d) => {
                return { target: d.target, type: d.type };
            }),
            name,
            type: node.type,
        });
    }

    // Separate apps and libraries
    const apps: string[] = [];
    const libs: string[] = [];

    for (const [name, node] of nodes) {
        if (node.type === "application") {
            apps.push(name);
        } else {
            libs.push(name);
        }
    }

    apps.sort();
    libs.sort();

    const totalPackages = apps.length + libs.length;
    const totalDeps = Object.values(projectGraph.dependencies).reduce((sum, deps) => sum + deps.length, 0);

    const lines: string[] = [bold("Project Dependency Graph"), ""];

    // Applications section
    if (apps.length > 0) {
        lines.push(` ${bold(cyan(`Applications (${apps.length})`))}`, "");

        for (const name of apps) {
            const printed = new Set<string>();

            printRootProject(name, nodes, printed, lines, maxDepth, "  ");
            lines.push("");
        }
    }

    // Libraries section
    if (libs.length > 0) {
        lines.push(` ${bold(cyan(`Libraries (${libs.length})`))}`, "");

        for (const name of libs) {
            const printed = new Set<string>();

            printRootProject(name, nodes, printed, lines, maxDepth, "  ");
            lines.push("");
        }
    }

    // Summary footer
    const width = process.stdout.columns || 80;

    lines.push(dim("─".repeat(Math.min(width, 60))));
    lines.push(
        `${bold(String(totalPackages))} packages ${dim("·")} ${bold(String(totalDeps))} dependencies ${dim("·")} ${bold(String(apps.length))} apps${dim(",")} ${bold(String(libs.length))} libraries`,
    );

    const allPrinted = new Set<string>();
    // Check if any duplicates exist across all trees
    let hasDuplicates = false;

    for (const name of [...apps, ...libs]) {
        const deps = nodes.get(name)?.deps ?? [];

        for (const dep of deps) {
            if (allPrinted.has(dep.target)) {
                hasDuplicates = true;
            }

            allPrinted.add(dep.target);
        }

        allPrinted.add(name);
    }

    if (hasDuplicates) {
        lines.push(dim("(*) = already shown above"));
    }

    return lines.join("\n");
};

// ── JSON Export ──────────────────────────────────────────────────────

const projectGraphToJson = (
    projectGraph: ProjectGraph,
): {
    edges: { source: string; target: string; type: string }[];
    nodes: { name: string; type: string }[];
} => {
    const nodes = Object.values(projectGraph.nodes).map((node) => {
        return {
            name: node.name,
            type: node.type,
        };
    });

    const edges = Object.values(projectGraph.dependencies).flat();

    return { edges, nodes };
};

// ── HTML Visualization ──────────────────────────────────────────────

const projectGraphToHtml = (projectGraph: ProjectGraph): string => {
    const nodes = Object.values(projectGraph.nodes).map((node) => {
        return {
            name: node.name,
            type: node.type,
        };
    });

    const edges: { source: string; target: string; type: string }[] = [];

    for (const deps of Object.values(projectGraph.dependencies)) {
        for (const dep of deps) {
            edges.push({ source: dep.source, target: dep.target, type: dep.type });
        }
    }

    const apps = nodes.filter((n) => n.type === "application");
    const libs = nodes.filter((n) => n.type !== "application");

    const graphData = { apps: apps.length, edges, libs: libs.length, nodes };

    return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Project Dependency Graph</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; overflow: hidden; }
  svg { width: 100vw; height: 100vh; }
  .edge { fill: none; marker-end: url(#arrow); }
  .node rect { rx: 8; ry: 8; cursor: pointer; transition: stroke-width 0.15s; }
  .node text { font-size: 12px; font-weight: 600; pointer-events: none; }
  .node:hover rect { stroke-width: 2.5; stroke: #fff; }
  #info { position: fixed; top: 16px; right: 16px; background: #1e293b; padding: 14px 20px; border-radius: 10px; font-size: 13px; border: 1px solid #334155; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  #info b { font-variant-numeric: tabular-nums; }
  .app-count { color: #fbbf24; }
  .lib-count { color: #38bdf8; }
  .dep-count { color: #a78bfa; }
  #legend { position: fixed; bottom: 16px; left: 16px; background: #1e293b; padding: 12px 16px; border-radius: 10px; font-size: 12px; border: 1px solid #334155; display: flex; gap: 16px; align-items: center; }
  .legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; vertical-align: middle; margin-right: 6px; }
  #tooltip { position: fixed; display: none; background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 12px 16px; font-size: 12px; max-width: 320px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 10; pointer-events: none; }
  #tooltip h3 { font-size: 14px; margin-bottom: 6px; }
  #tooltip .type-badge { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-left: 8px; }
  #tooltip .dep-section { margin-top: 8px; color: #94a3b8; }
  #tooltip ul { list-style: none; padding-left: 0; margin-top: 4px; }
  #tooltip li { padding: 1px 0; color: #cbd5e1; }
  #tooltip li::before { content: "\2192 "; color: #64748b; }
</style>
</head>
<body>
<div id="info">
  <b class="app-count">${graphData.apps}</b> apps &middot;
  <b class="lib-count">${graphData.libs}</b> libraries &middot;
  <b class="dep-count">${graphData.edges.length}</b> dependencies
</div>
<div id="legend">
  <span><span class="legend-dot" style="background:#fbbf24"></span>Application</span>
  <span><span class="legend-dot" style="background:#38bdf8"></span>Library</span>
  <span style="color:#64748b">&mdash; solid = static &nbsp; - - - = implicit</span>
</div>
<div id="tooltip"></div>
<svg id="graph">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
    </marker>
  </defs>
</svg>
<script>
const data = ${JSON.stringify(graphData).replaceAll("</", String.raw`<\/`)};
const svg = document.getElementById('graph');
const tooltip = document.getElementById('tooltip');
const W = window.innerWidth, H = window.innerHeight;

// Build adjacency
const depMap = {}, rdepMap = {};
data.nodes.forEach(n => { depMap[n.name] = []; rdepMap[n.name] = []; });
data.edges.forEach(e => { depMap[e.source]?.push(e.target); rdepMap[e.target]?.push(e.source); });

// Escape text for safe DOM insertion
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.textContent; }

// Force-directed layout
const repulsion = 5000 + data.nodes.length * 150;
const nodes = data.nodes.map(n => ({
  ...n, x: W/2 + (Math.random()-0.5)*Math.min(W*0.6, 600),
  y: H/2 + (Math.random()-0.5)*Math.min(H*0.6, 400), vx: 0, vy: 0
}));
const nodeMap = new Map(nodes.map(n => [n.name, n]));
const edges = data.edges.map(e => ({
  source: nodeMap.get(e.source), target: nodeMap.get(e.target), type: e.type
}));

for (let iter = 0; iter < 400; iter++) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      let d = Math.sqrt(dx*dx + dy*dy) || 1;
      let f = repulsion / (d * d);
      nodes[i].vx -= dx/d * f; nodes[i].vy -= dy/d * f;
      nodes[j].vx += dx/d * f; nodes[j].vy += dy/d * f;
    }
  }
  edges.forEach(e => {
    if (!e.source || !e.target) {
        return;
    }
    let dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
    let d = Math.sqrt(dx*dx + dy*dy) || 1;
    let f = (d - 180) * 0.008;
    e.source.vx += dx/d * f; e.source.vy += dy/d * f;
    e.target.vx -= dx/d * f; e.target.vy -= dy/d * f;
  });
  nodes.forEach(n => {
    n.vx += (W/2 - n.x) * 0.001; n.vy += (H/2 - n.y) * 0.001;
    n.x += n.vx * 0.3; n.y += n.vy * 0.3;
    n.vx *= 0.75; n.vy *= 0.75;
    n.x = Math.max(80, Math.min(W-80, n.x));
    n.y = Math.max(40, Math.min(H-40, n.y));
  });
}

// Measure text widths
const measure = document.createElementNS('http://www.w3.org/2000/svg','text');
measure.setAttribute('font-size','12'); measure.setAttribute('font-weight','600');
measure.setAttribute('font-family','system-ui');
svg.appendChild(measure);
const widths = {};
nodes.forEach(n => { measure.textContent = n.name; widths[n.name] = measure.getComputedTextLength(); });
svg.removeChild(measure);

// Render edges
edges.forEach(e => {
  if (!e.source || !e.target) {
      return;
  }
  const sw = (widths[e.source.name]||80)/2 + 12;
  const tw = (widths[e.target.name]||80)/2 + 12;
  const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
  const d = Math.sqrt(dx*dx+dy*dy)||1;
  const x1 = e.source.x + dx/d*sw, y1 = e.source.y + dy/d*14;
  const x2 = e.target.x - dx/d*tw, y2 = e.target.y - dy/d*14;
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1',x1); line.setAttribute('y1',y1);
  line.setAttribute('x2',x2); line.setAttribute('y2',y2);
  line.setAttribute('class','edge');
  const edgeColors = { implicit: '#475569', devDependency: '#888888', peerDependency: '#CC8800' };
  line.setAttribute('stroke', edgeColors[e.type] || '#64748b');
  line.setAttribute('stroke-width', '1.5');
  if (e.type === 'implicit' || e.type === 'peerDependency') {
      line.setAttribute('stroke-dasharray', '6,4');
  }
  if (e.type === 'devDependency') {
      line.setAttribute('stroke-dasharray', '3,3');
  }
  svg.appendChild(line);
});

// Render nodes
nodes.forEach(n => {
  const w = (widths[n.name]||80) + 24;
  const h = 32;
  const isApp = n.type === 'application';
  const fill = isApp ? '#fbbf24' : '#38bdf8';
  const textFill = '#0f172a';
  const stroke = isApp ? '#f59e0b' : '#0284c7';

  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('class','node');
  g.setAttribute('transform','translate('+(n.x - w/2)+','+(n.y - h/2)+')');
  const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('width', w); rect.setAttribute('height', h);
  rect.setAttribute('fill', fill); rect.setAttribute('stroke', stroke); rect.setAttribute('stroke-width','1.5');
  g.appendChild(rect);
  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.setAttribute('x', w/2); text.setAttribute('y', h/2 + 4.5);
  text.setAttribute('text-anchor','middle'); text.setAttribute('fill', textFill);
  text.textContent = n.name;
  g.appendChild(text);

  g.addEventListener('mouseenter', (ev) => {
    const deps = depMap[n.name] || [];
    const rdeps = rdepMap[n.name] || [];

    // Build tooltip using safe DOM methods
    tooltip.textContent = '';

    const heading = document.createElement('h3');
    heading.textContent = n.name;
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.style.background = fill;
    badge.style.color = '#0f172a';
    badge.textContent = n.type;
    heading.appendChild(badge);
    tooltip.appendChild(heading);

    if (deps.length) {
      const label = document.createElement('div');
      label.className = 'dep-section';
      label.textContent = 'Depends on:';
      tooltip.appendChild(label);
      const ul = document.createElement('ul');
      deps.forEach(d => { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); });
      tooltip.appendChild(ul);
    }
    if (rdeps.length) {
      const label = document.createElement('div');
      label.className = 'dep-section';
      label.textContent = 'Required by:';
      tooltip.appendChild(label);
      const ul = document.createElement('ul');
      rdeps.forEach(d => { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); });
      tooltip.appendChild(ul);
    }
    if (!deps.length && !rdeps.length) {
      const empty = document.createElement('div');
      empty.style.marginTop = '6px';
      empty.style.color = '#64748b';
      empty.textContent = 'No dependencies';
      tooltip.appendChild(empty);
    }

    tooltip.style.display = 'block';
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(ev.clientX + 12, W - rect.width - 12) + 'px';
    tooltip.style.top = Math.min(ev.clientY + 12, H - rect.height - 12) + 'px';
  });
  g.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  svg.appendChild(g);
});
</script>
</body>
</html>`;
};

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, GraphOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const workspaceRoot = wsRoot;
    const { packageJsons, workspace } = discoverWorkspace(workspaceRoot, visConfig);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;
    const format = options.format ?? (isTTY ? "tui" : "ascii");
    const outputFile = options.output;
    const maxDepth = options.depth ?? Infinity;

    let output: string;

    switch (format) {
        case "dot": {
            output = projectGraphToDot(projectGraph);
            break;
        }

        case "html": {
            output = projectGraphToHtml(projectGraph);
            break;
        }

        case "json": {
            output = JSON.stringify(projectGraphToJson(projectGraph), undefined, 2);
            break;
        }

        case "tui": {
            if (!isTTY) {
                // Fall back to ASCII in non-TTY environments
                output = projectGraphToAscii(projectGraph, maxDepth);
                break;
            }

            const autoExitSeconds = visConfig?.tui?.autoExit === true ? 3 : typeof visConfig?.tui?.autoExit === "number" ? visConfig.tui.autoExit : 0;

            // Ensure stdin is in the right state for ink after any prior readline usage
            // (the config-loader prompt may have paused stdin)
            if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
                process.stdin.setRawMode(true);
                process.stdin.ref();
                process.stdin.resume();
            }

            // Keep event loop alive while TUI is active
            const keepAlive = setInterval(() => {}, 1000);

            const store = new GraphStore(projectGraph);
            const instance = render(React.createElement(VisGraphApp, { autoExitSeconds, store }), {
                alternateScreen: true,
                exitOnCtrlC: false,
                interactive: true,
                patchConsole: true,
            });

            await instance.waitUntilExit();
            clearInterval(keepAlive);

            return;
        }

        default: {
            output = projectGraphToAscii(projectGraph, maxDepth);
        }
    }

    if (outputFile) {
        writeFileSync(outputFile, output, "utf8");
        logger.info(`Graph written to ${outputFile}`);
    } else {
        logger.info(output);
    }
};

export default execute as CommandExecute<Toolbox>;
