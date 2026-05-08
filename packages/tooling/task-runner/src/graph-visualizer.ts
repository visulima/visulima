import type { ProjectGraph, Task, TaskGraph } from "./types";

/**
 * Graph visualization output formats.
 */
type GraphFormat = "dot" | "json" | "html" | "ascii";

/**
 * Options for graph visualization.
 */
interface GraphVisualizerOptions {
    /** Show only affected/filtered tasks (highlight subset) */
    focusedTasks?: string[];
    /** Group tasks by project (default: true) */
    groupByProject?: boolean;
    /** Show task status colors (requires results) */
    taskStatuses?: Map<string, "success" | "failure" | "skipped" | "local-cache" | "local-cache-kept-existing" | "remote-cache" | "running" | "pending">;
}

// ─── Helper functions (defined before usage) ───────────────────────

const getNodeColor = (taskId: string, focused: Set<string> | undefined, statuses?: Map<string, string>): string => {
    if (focused && !focused.has(taskId)) {
        return "#eeeeee";
    }

    const status = statuses?.get(taskId);

    switch (status) {
        case "failure": {
            return "#FFB6C1";
        }
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return "#87CEEB";
        }
        case "running": {
            return "#FFD700";
        }
        case "skipped": {
            return "#D3D3D3";
        }
        case "success": {
            return "#90EE90";
        }
        default: {
            return "#FFFFFF";
        }
    }
};

const getStatusIcon = (status?: string): string => {
    switch (status) {
        case "failure": {
            return "[FAIL] ";
        }
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return "[cache] ";
        }
        case "running": {
            return "[...] ";
        }
        case "skipped": {
            return "[skip] ";
        }
        case "success": {
            return "[ok] ";
        }
        default: {
            return "";
        }
    }
};

const formatTaskLine = (taskId: string, statuses?: Map<string, string>): string => {
    const icon = getStatusIcon(statuses?.get(taskId));

    return `${icon}${taskId}`;
};

const printTree = (
    taskId: string,
    prefix: string,
    isLast: boolean,
    taskGraph: TaskGraph,
    printed: Set<string>,
    lines: string[],
    statuses?: Map<string, string>,
): void => {
    let connector: string;

    if (prefix === "") {
        connector = "";
    } else if (isLast) {
        connector = "└── ";
    } else {
        connector = "├── ";
    }

    const isDuplicate = printed.has(taskId);
    const suffix = isDuplicate ? " (*)" : "";
    const statusIcon = getStatusIcon(statuses?.get(taskId));

    lines.push(`${prefix}${connector}${statusIcon}${taskId}${suffix}`);

    if (isDuplicate) {
        return;
    }

    printed.add(taskId);

    const deps = taskGraph.dependencies[taskId] ?? [];

    let childPrefix: string;

    if (prefix === "") {
        childPrefix = "";
    } else if (isLast) {
        childPrefix = `${prefix}    `;
    } else {
        childPrefix = `${prefix}│   `;
    }

    for (let i = 0; i < deps.length; i += 1) {
        const isChildLast = i === deps.length - 1;
        const dependency = deps[i];

        if (dependency) {
            printTree(dependency, childPrefix, isChildLast, taskGraph, printed, lines, statuses);
        }
    }
};

// ─── DOT Format (Graphviz) ─────────────────────────────────────────

/**
 * Exports a task graph in DOT format for Graphviz rendering.
 * @example
 * ```ts
 * const dot = toGraphvizDot(taskGraph);
 * // Render: dot -Tsvg -o graph.svg <<< "$dot"
 * ```
 */

const toGraphvizDot = (taskGraph: TaskGraph, options: GraphVisualizerOptions = {}): string => {
    const { focusedTasks, groupByProject = true, taskStatuses } = options;
    const focused = focusedTasks ? new Set(focusedTasks) : undefined;

    const lines: string[] = ["digraph TaskGraph {", "  rankdir=LR;", '  node [shape=box, style=filled, fontname="monospace"];'];

    // Group nodes by project
    if (groupByProject) {
        const projectTasks = new Map<string, Task[]>();

        for (const task of Object.values(taskGraph.tasks)) {
            const { project } = task.target;
            const list = projectTasks.get(project) ?? [];

            list.push(task);
            projectTasks.set(project, list);
        }

        for (const [project, tasks] of projectTasks) {
            lines.push(`  subgraph "cluster_${project}" {`, `    label="${project}";`, "    style=dashed;", '    color="#888888";');

            for (const task of tasks) {
                const color = getNodeColor(task.id, focused, taskStatuses);

                lines.push(`    "${task.id}" [label="${task.target.target}", fillcolor="${color}"];`);
            }

            lines.push("  }");
        }
    } else {
        for (const task of Object.values(taskGraph.tasks)) {
            const color = getNodeColor(task.id, focused, taskStatuses);

            lines.push(`  "${task.id}" [fillcolor="${color}"];`);
        }
    }

    // Edges
    for (const [taskId, deps] of Object.entries(taskGraph.dependencies)) {
        for (const dep of deps) {
            const edgeColor = focused && !focused.has(taskId) ? "#cccccc" : "#333333";

            lines.push(`  "${taskId}" -> "${dep}" [color="${edgeColor}"];`);
        }
    }

    lines.push("}");

    return lines.join("\n");
};

// ─── JSON Export ────────────────────────────────────────────────────

/**
 * Exports the task graph as a JSON object suitable for visualization tools.
 */
interface GraphJson {
    edges: {
        source: string;
        target: string;
    }[];
    nodes: {
        configuration?: string;
        id: string;
        project: string;
        status?: string;
        target: string;
    }[];
    roots: string[];
}

const toGraphJson = (taskGraph: TaskGraph, taskStatuses?: Map<string, string>): { edges: GraphJson["edges"]; nodes: GraphJson["nodes"]; roots: string[] } => {
    const nodes = Object.values(taskGraph.tasks).map((task) => {
        return {
            configuration: task.target.configuration,
            id: task.id,
            project: task.target.project,
            status: taskStatuses?.get(task.id),
            target: task.target.target,
        };
    });

    const edges: GraphJson["edges"] = [];

    for (const [source, deps] of Object.entries(taskGraph.dependencies)) {
        for (const target of deps) {
            edges.push({ source, target });
        }
    }

    return { edges, nodes, roots: taskGraph.roots };
};

// ─── HTML Visualization (Self-Contained) ───────────────────────────

/**
 * Generates a self-contained HTML file with an interactive task graph visualization.
 * Uses a simple force-directed layout with SVG rendering (no external dependencies).
 */
const toGraphHtml = (taskGraph: TaskGraph, options: GraphVisualizerOptions = {}): string => {
    const graphData = toGraphJson(taskGraph, options.taskStatuses);

    // Apply focusedTasks filtering if specified
    if (options.focusedTasks && options.focusedTasks.length > 0) {
        const focused = new Set(options.focusedTasks);

        graphData.nodes = graphData.nodes.filter((n) => focused.has(n.id));
        graphData.edges = graphData.edges.filter((e) => focused.has(e.source) && focused.has(e.target));
        graphData.roots = graphData.roots.filter((r) => focused.has(r));
    }

    return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Task Graph</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #1a1a2e; color: #eee; }
  svg { width: 100vw; height: 100vh; }
  .node rect { rx: 6; ry: 6; stroke: #555; stroke-width: 1.5; cursor: pointer; }
  .node text { font-size: 11px; fill: #1a1a2e; font-weight: 600; pointer-events: none; }
  .node:hover rect { stroke: #fff; stroke-width: 2; }
  .edge { stroke: #444; stroke-width: 1.5; fill: none; marker-end: url(#arrow); }
  .label { font-size: 10px; fill: #888; }
  #info { position: fixed; top: 12px; right: 12px; background: #16213e; padding: 12px 16px; border-radius: 8px; font-size: 13px; }
  #info b { color: #e94560; }
</style>
</head>
<body>
<div id="info">
  <b>${graphData.nodes.length}</b> tasks &middot; <b>${graphData.edges.length}</b> dependencies &middot; <b>${graphData.roots.length}</b> roots
</div>
<svg id="graph">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/>
    </marker>
  </defs>
</svg>
<script>
const data = ${JSON.stringify(graphData).replaceAll("</", String.raw`<\/`)};
const svg = document.getElementById('graph');
const W = window.innerWidth, H = window.innerHeight;
const statusColors = {
  success: '#2ecc71', 'local-cache': '#3498db', 'remote-cache': '#9b59b6',
  failure: '#e74c3c', running: '#f39c12', skipped: '#95a5a6', pending: '#ecf0f1'
};
const projectColors = {};
const palette = ['#e94560','#0f3460','#533483','#16c79a','#f39c12','#2ecc71','#3498db','#e67e22','#9b59b6','#1abc9c'];
let ci = 0;
data.nodes.forEach(n => {
  if (!projectColors[n.project]) {
      projectColors[n.project] = palette[ci++ % palette.length];
  }
});

// Simple force-directed layout
const nodes = data.nodes.map((n, i) => ({
  ...n, x: W/2 + (Math.random()-0.5)*400, y: H/2 + (Math.random()-0.5)*300, vx: 0, vy: 0
}));
const nodeMap = new Map(nodes.map(n => [n.id, n]));
const edges = data.edges.map(e => ({ source: nodeMap.get(e.source), target: nodeMap.get(e.target) }));

function simulate() {
  for (let iter = 0; iter < 300; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
        let d = Math.sqrt(dx*dx + dy*dy) || 1;
        let f = 8000 / (d * d);
        nodes[i].vx -= dx/d * f; nodes[i].vy -= dy/d * f;
        nodes[j].vx += dx/d * f; nodes[j].vy += dy/d * f;
      }
    }
    // Attraction (edges)
    edges.forEach(e => {
      if (!e.source || !e.target) {
          return;
      }
      let dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      let d = Math.sqrt(dx*dx + dy*dy) || 1;
      let f = (d - 150) * 0.01;
      e.source.vx += dx/d * f; e.source.vy += dy/d * f;
      e.target.vx -= dx/d * f; e.target.vy -= dy/d * f;
    });
    // Gravity
    nodes.forEach(n => {
      n.vx += (W/2 - n.x) * 0.001;
      n.vy += (H/2 - n.y) * 0.001;
      n.x += n.vx * 0.3; n.y += n.vy * 0.3;
      n.vx *= 0.8; n.vy *= 0.8;
      n.x = Math.max(60, Math.min(W-60, n.x));
      n.y = Math.max(30, Math.min(H-30, n.y));
    });
  }
}
simulate();

// Render
edges.forEach(e => {
  if (!e.source || !e.target) {
      return;
  }
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', e.source.x); line.setAttribute('y1', e.source.y);
  line.setAttribute('x2', e.target.x); line.setAttribute('y2', e.target.y);
  line.setAttribute('class','edge');
  svg.appendChild(line);
});
nodes.forEach(n => {
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('class','node');
  g.setAttribute('transform','translate('+(n.x-50)+','+(n.y-14)+')');
  const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('width','100'); rect.setAttribute('height','28');
  rect.setAttribute('fill', n.status ? (statusColors[n.status]||'#ecf0f1') : projectColors[n.project]);
  g.appendChild(rect);
  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.setAttribute('x','50'); text.setAttribute('y','18'); text.setAttribute('text-anchor','middle');
  text.textContent = n.id.length > 14 ? n.target : n.id;
  g.appendChild(text);
  g.addEventListener('click', () => {
    const deps = data.edges.filter(e => e.source === n.id).map(e => e.target);
    const rdeps = data.edges.filter(e => e.target === n.id).map(e => e.source);
    alert(n.id + '\n\nDepends on: ' + (deps.join(', ')||'none') + '\nRequired by: ' + (rdeps.join(', ')||'none'));
  });
  svg.appendChild(g);
});
</script>
</body>
</html>`;
};

// ─── Terminal ASCII Rendering ──────────────────────────────────────

/**
 * Renders the task graph as ASCII art for terminal display.
 * @example
 * ```
 * Task Graph (6 tasks, 5 dependencies)
 *
 * app:build
 * ├── lib-a:build
 * │   └── lib-core:build
 * └── lib-b:build
 *     └── lib-core:build (*)
 *
 * (*) = already shown above
 * ```
 */
const toGraphAscii = (taskGraph: TaskGraph, options: GraphVisualizerOptions = {}): string => {
    const { taskStatuses } = options;
    const lines: string[] = [];
    const taskCount = Object.keys(taskGraph.tasks).length;
    const edgeCount = Object.values(taskGraph.dependencies).reduce((s, d) => s + d.length, 0);

    lines.push(`Task Graph (${taskCount} tasks, ${edgeCount} dependencies)`, "");

    // Find root tasks (those not depended on by any other)
    const allDeps = new Set<string>();

    for (const deps of Object.values(taskGraph.dependencies)) {
        for (const dep of deps) {
            allDeps.add(dep);
        }
    }

    const roots = Object.keys(taskGraph.tasks).filter((id) => !allDeps.has(id));

    if (roots.length === 0) {
        // All tasks are in cycles; just list them
        for (const taskId of Object.keys(taskGraph.tasks)) {
            lines.push(formatTaskLine(taskId, taskStatuses));
        }

        return lines.join("\n");
    }

    const printed = new Set<string>();

    for (const root of roots) {
        printTree(root, "", true, taskGraph, printed, lines, taskStatuses);
    }

    if (printed.size < taskCount) {
        lines.push("", "(*) = already shown above");
    }

    return lines.join("\n");
};

// ─── Project Graph Visualization ───────────────────────────────────

/**
 * Exports a project graph in DOT format.
 */
const projectGraphToDot = (projectGraph: ProjectGraph): string => {
    const lines: string[] = ["digraph ProjectGraph {", "  rankdir=LR;", '  node [shape=box, style=filled, fillcolor="#87CEEB", fontname="monospace"];'];

    for (const node of Object.values(projectGraph.nodes)) {
        // application = gold, service = light green, tool = orange, library/default = blue
        const color = node.type === "application" ? "#FFD700" : node.type === "service" ? "#90EE90" : node.type === "tool" ? "#FFB347" : "#87CEEB";

        lines.push(`  "${node.name}" [fillcolor="${color}"];`);
    }

    for (const [project, deps] of Object.entries(projectGraph.dependencies)) {
        for (const dep of deps) {
            const attributes: string[] = [];

            switch (dep.type) {
                case "devDependency": {
                    attributes.push("style=dotted", 'color="#888888"');

                    break;
                }
                case "implicit": {
                    attributes.push("style=dashed");

                    break;
                }
                case "peerDependency": {
                    attributes.push("style=dashed", 'color="#CC8800"');

                    break;
                }
                default: {
                    attributes.push("style=solid");
                }
            }

            lines.push(`  "${project}" -> "${dep.target}" [${attributes.join(", ")}];`);
        }
    }

    lines.push("}");

    return lines.join("\n");
};

export type { GraphFormat, GraphJson, GraphVisualizerOptions };
export { projectGraphToDot, toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot };
