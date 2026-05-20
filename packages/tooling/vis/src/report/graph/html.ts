/**
 * Self-contained HTML report for `vis graph --format=html`. Single file:
 * stylesheet is a Tailwind entry compiled and inlined at build time by
 * packem (`rollup.css.mode: "inline"`), and the graph runtime (sigma +
 * graphology) is read from node_modules at execution time and inlined.
 * No network requests, no CDN, no analytics.
 *
 * Layout is precomputed server-side with `graphology-layout-forceatlas2`
 * so the page opens with the graph already positioned — the client only
 * renders, hovers, pans and zooms. Theme-aware colors live on the html[data-theme]
 * attribute; `sigma.refresh()` re-reads them after a toggle.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import ANOLILAB_LOGO from "../assets/anolilab-text.svg?raw";
// Compiled to a minified Tailwind CSS string by packem at build time; under
// vitest/tsx the import resolves via Vite's native CSS handling.
import styleCss from "./style.css";

const css = styleCss as unknown as string;

const require_ = createRequire(import.meta.url);

/**
 * Inlined UMD bundles for sigma + graphology. We can't ask Node's resolver
 * for the `dist/*.min.js` paths directly (their `exports` field gates them),
 * so we resolve each package's main entry and target its sibling `dist/` file.
 */
const readUmd = (packageName: string, filename: string): string => {
    const mainPath = require_.resolve(packageName);

    return readFileSync(join(dirname(mainPath), filename), "utf8");
};

const sigmaUmd = readUmd("sigma", "sigma.min.js");
const graphologyUmd = readUmd("graphology", "graphology.umd.min.js");
// Floating UI for tooltip positioning: core has the middleware engine, dom
// has the DOM-platform adapter. Both UMD bundles set globals onto window so
// loading them in sequence gives us window.FloatingUIDOM at runtime.
const floatingUiCoreUmd = readUmd("@floating-ui/core", "floating-ui.core.umd.min.js");
const floatingUiDomUmd = readUmd("@floating-ui/dom", "floating-ui.dom.umd.min.js");

const MOON_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>`;

const escapeHtml = (text: string): string =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");

export interface GraphHtmlNode {
    name: string;
    /** Workspace-relative project root, surfaced in the tooltip. */
    path?: string;
    type: string;
}

export interface GraphHtmlEdge {
    source: string;
    target: string;
    type: string;
}

export interface GraphHtmlEmitOptions {
    edges: GraphHtmlEdge[];
    nodes: GraphHtmlNode[];
    now?: Date;
    tool: { name: string; version: string };
    workspaceRoot: string;
}

/**
 * Precomputed positions live on each node. Sizing here too — apps get a
 * heavier dot, libraries recede; the size contrast IS the hierarchy.
 */
interface PositionedNode {
    name: string;
    path?: string;
    type: string;
    x: number;
    y: number;
    size: number;
}

const APP_SIZE = 9;
const LIB_SIZE = 4;

const computeLayout = (nodes: GraphHtmlNode[], edges: GraphHtmlEdge[]): PositionedNode[] => {
    if (nodes.length === 0) {
        return [];
    }

    const graph = new Graph({ multi: true, type: "directed" });

    for (const node of nodes) {
        // Seed positions on a unit circle so forceAtlas2 has a deterministic
        // starting layout — without this every run yields a different graph.
        const angle = (graph.order / nodes.length) * Math.PI * 2;
        graph.addNode(node.name, {
            type: node.type,
            path: node.path,
            x: Math.cos(angle),
            y: Math.sin(angle),
            size: node.type === "application" ? APP_SIZE : LIB_SIZE,
        });
    }

    for (const edge of edges) {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            graph.addEdge(edge.source, edge.target, { type: edge.type });
        }
    }

    // ForceAtlas2 settings tuned for monorepo dependency graphs: linLog so
    // hub packages spread out, strong gravity so disconnected components
    // don't drift off-screen, scaling tuned so the layout fills the viewport.
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, {
        iterations: 600,
        settings: {
            ...settings,
            adjustSizes: true,
            barnesHutOptimize: graph.order > 100,
            gravity: 1.2,
            linLogMode: true,
            scalingRatio: 8,
            slowDown: 4,
        },
    });

    const positioned: PositionedNode[] = [];

    graph.forEachNode((name, attributes) => {
        positioned.push({
            name,
            path: attributes.path as string | undefined,
            type: attributes.type as string,
            x: attributes.x as number,
            y: attributes.y as number,
            size: attributes.size as number,
        });
    });

    return positioned;
};

export const emitGraphHtml = (options: GraphHtmlEmitOptions): string => {
    const now = options.now ?? new Date();
    const apps = options.nodes.filter((n) => n.type === "application").length;
    const libs = options.nodes.length - apps;

    const positioned = computeLayout(options.nodes, options.edges);

    // Pre-strip edges that reference unknown nodes (already filtered in
    // computeLayout, but the renderer also reads this list).
    const knownNodes = new Set(positioned.map((n) => n.name));
    const filteredEdges = options.edges.filter((e) => knownNodes.has(e.source) && knownNodes.has(e.target));

    const graphData = {
        nodes: positioned,
        edges: filteredEdges,
    };

    const isEmpty = options.nodes.length === 0;

    // Reusable utility-class fragments. Inline-Tailwind is the system of
    // record now; these constants exist only to keep the markup readable.
    const C = {
        chip: "font-mono tracking-[0.08em] text-muted border border-border2 inline-flex h-7 items-center justify-center rounded-[4px] px-3 text-[11px] font-medium uppercase",
        labelMono: "font-mono text-[10px] uppercase tracking-[0.15em] text-faint",
        dvNum: "font-mono text-[22px] font-medium text-fg leading-none",
    };

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.tool.name)} graph · ${escapeHtml(now.toISOString().slice(0, 10))}</title>
<style>${css}</style>
</head>
<body class="bg-bg text-fg">
<div class="min-h-screen flex flex-col">
<header class="flex flex-wrap items-end gap-4 px-8 pt-8 pb-5">
  <div class="font-sans text-[clamp(28px,5vw,52px)] font-semibold text-fg leading-none tracking-tight">${(() => {
        const [head, ...rest] = options.tool.name.split("-");

        return rest.length > 0
            ? `${escapeHtml(head ?? options.tool.name)}<span class="text-accent mx-[0.12em] font-light">/</span>${escapeHtml(rest.join("-"))}`
            : escapeHtml(options.tool.name);
    })()}<span class="font-mono tracking-[0.22em] text-faint mt-3 block text-[10px] font-medium uppercase">dependency graph</span></div>
  <span class="flex-auto"></span>
  <span class="${C.chip}">v${escapeHtml(options.tool.version)}</span>
  <button id="theme" class="tbtn-theme font-mono text-muted border border-border2 inline-flex h-7 w-9 cursor-pointer items-center justify-center rounded-[4px] bg-transparent transition-colors duration-150 hover:text-fg hover:border-fg" type="button" aria-label="Toggle color theme" title="Toggle color theme"><span data-icon="moon" class="items-center justify-center">${MOON_ICON}</span><span data-icon="sun" class="items-center justify-center">${SUN_ICON}</span></button>
</header>
<div class="flex flex-wrap items-end gap-6 px-8 pt-5 pb-5 border-b border-border">
  <div class="flex flex-wrap items-stretch gap-0 [&>*+*]:pl-6 [&>*+*]:ml-6 [&>*+*]:border-l [&>*+*]:border-border">
    <div class="flex items-baseline gap-[0.65rem]"><span class="${C.labelMono}">apps</span><span class="${C.dvNum}">${String(apps)}</span></div>
    <div class="flex items-baseline gap-[0.65rem]"><span class="${C.labelMono}">libraries</span><span class="${C.dvNum}">${String(libs)}</span></div>
    <div class="flex items-baseline gap-[0.65rem]"><span class="${C.labelMono}">dependencies</span><span class="${C.dvNum}">${String(filteredEdges.length)}</span></div>
  </div>
  <span class="flex-auto"></span>
  <div class="relative min-w-[260px] sm:min-w-[320px] ml-auto">
    <label class="flex items-center gap-3 border-b border-border2 transition-colors duration-150 hover:border-fg focus-within:border-fg pb-1.5">
      <span class="${C.labelMono} select-none">find:</span>
      <input id="filter" type="search" class="w-full min-w-0 border-0 bg-transparent py-0.5 text-fg text-[12px] font-mono outline-0 placeholder:text-faint" placeholder="package name…" aria-label="Filter packages" autocomplete="off" spellcheck="false" />
      <span id="filter-count" data-state="" class="font-mono text-faint text-[10px] tracking-[0.05em] shrink-0 select-none data-[state=zero]:text-accent" aria-live="polite"></span>
    </label>
    <div id="filter-results" data-open="false" class="data-[open=false]:hidden absolute z-20 top-full left-0 right-0 mt-2 bg-panel border border-border max-h-72 overflow-y-auto shadow-[0_4px_12px_rgba(0,0,0,0.08)]" role="listbox" aria-label="Matching packages"></div>
  </div>
</div>
<main class="relative flex-1 min-h-[480px]">${
        isEmpty
            ? `<div class="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center"><div class="font-sans text-[72px] font-semibold text-fg leading-none tracking-tight">NONE</div><div class="font-mono text-faint text-[12px] uppercase tracking-[0.15em]">No projects discovered in this workspace.</div></div>`
            : `<div id="graph" class="absolute inset-0"></div>
<div id="tooltip" data-pinned="false" class="fixed z-30 top-0 left-0 hidden bg-panel border border-border2 px-4 py-3 max-w-[380px] pointer-events-none font-sans shadow-[0_8px_24px_rgba(0,0,0,0.12)] data-[pinned=true]:pointer-events-auto data-[pinned=true]:border-accent"></div>
<div id="legend" class="absolute top-4 right-4 bg-panel/95 backdrop-blur-sm border border-border px-4 py-3 min-w-[200px]">
  <div class="${C.labelMono} mb-2">Filter</div>
  <div data-toggle="app" data-state="on" class="group flex items-center gap-3 py-1 cursor-pointer text-[12px] text-fg select-none transition-colors hover:text-accent data-[state=off]:line-through data-[state=off]:text-faint after:content-['ON'] after:font-mono after:text-[9px] after:tracking-[0.1em] after:ml-auto after:text-accent data-[state=off]:after:content-['OFF'] data-[state=off]:after:text-faint" role="switch" aria-checked="true" tabindex="0"><span class="inline-block w-2 h-2 rounded-full bg-node-app shrink-0 group-data-[state=off]:opacity-30"></span>Application</div>
  <div data-toggle="lib" data-state="on" class="group flex items-center gap-3 py-1 cursor-pointer text-[12px] text-fg select-none transition-colors hover:text-accent data-[state=off]:line-through data-[state=off]:text-faint after:content-['ON'] after:font-mono after:text-[9px] after:tracking-[0.1em] after:ml-auto after:text-accent data-[state=off]:after:content-['OFF'] data-[state=off]:after:text-faint" role="switch" aria-checked="true" tabindex="0"><span class="inline-block w-2 h-2 rounded-full bg-node-lib shrink-0 group-data-[state=off]:opacity-30"></span>Library</div>
  <div data-toggle="prod" data-state="on" class="group flex items-center gap-3 py-1 cursor-pointer text-[12px] text-fg select-none transition-colors hover:text-accent data-[state=off]:line-through data-[state=off]:text-faint after:content-['ON'] after:font-mono after:text-[9px] after:tracking-[0.1em] after:ml-auto after:text-accent data-[state=off]:after:content-['OFF'] data-[state=off]:after:text-faint" role="switch" aria-checked="true" tabindex="0"><span class="inline-block w-4 h-px bg-edge shrink-0 group-data-[state=off]:opacity-30"></span>Static dep</div>
  <div data-toggle="dev" data-state="on" class="group flex items-center gap-3 py-1 cursor-pointer text-[12px] text-fg select-none transition-colors hover:text-accent data-[state=off]:line-through data-[state=off]:text-faint after:content-['ON'] after:font-mono after:text-[9px] after:tracking-[0.1em] after:ml-auto after:text-accent data-[state=off]:after:content-['OFF'] data-[state=off]:after:text-faint" role="switch" aria-checked="true" tabindex="0"><span class="inline-block w-4 h-px bg-edge-faint shrink-0 group-data-[state=off]:opacity-30"></span>Dev / implicit</div>
  <div data-toggle="peer" data-state="on" class="group flex items-center gap-3 py-1 cursor-pointer text-[12px] text-fg select-none transition-colors hover:text-accent data-[state=off]:line-through data-[state=off]:text-faint after:content-['ON'] after:font-mono after:text-[9px] after:tracking-[0.1em] after:ml-auto after:text-accent data-[state=off]:after:content-['OFF'] data-[state=off]:after:text-faint" role="switch" aria-checked="true" tabindex="0"><span class="inline-block w-4 h-px bg-accent shrink-0 group-data-[state=off]:opacity-30"></span>Peer</div>
</div>
<div class="absolute bottom-4 left-4 flex flex-wrap items-center gap-x-6 gap-y-2 bg-panel/95 backdrop-blur-sm border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-faint">
  <div class="flex items-center gap-2"><span class="inline-flex h-5 min-w-5 items-center justify-center px-1.5 border border-border2 rounded text-fg bg-panel2 normal-case tracking-normal text-[10px]">/</span><span>Search</span></div>
  <div class="flex items-center gap-2"><span class="inline-flex h-5 min-w-5 items-center justify-center px-1.5 border border-border2 rounded text-fg bg-panel2 normal-case tracking-normal text-[10px]">R</span><span>Fit view</span></div>
  <div class="flex items-center gap-2"><span class="inline-flex h-5 min-w-5 items-center justify-center px-1.5 border border-border2 rounded text-fg bg-panel2 normal-case tracking-normal text-[10px]">Click</span><span>Pin · click empty to unpin</span></div>
</div>`
    }</main>
<footer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-8 py-4 text-[10px] uppercase border-t border-border font-mono text-faint tracking-[0.1em]">
  <span><b class="text-fg font-semibold">${escapeHtml(options.tool.name)}</b> ${escapeHtml(options.tool.version)} · generated ${escapeHtml(now.toISOString())}</span>
  <span class="inline-flex items-center gap-2"><span>built by</span><a class="sig-by-link inline-flex items-center" href="https://anolilab.com" rel="noreferrer noopener" target="_blank" aria-label="Anolilab">${ANOLILAB_LOGO}</a></span>
</footer>
</div>
<script>${graphologyUmd}</script>
<script>${sigmaUmd}</script>
<script>${floatingUiCoreUmd}</script>
<script>${floatingUiDomUmd}</script>
<script>
(() => {
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  try {
    const stored = localStorage.getItem('vis-graph-theme');
    if (stored === 'light' || stored === 'dark') {
      root.dataset.theme = stored;
    }
  } catch {}

  const data = ${JSON.stringify(graphData).replaceAll("</", String.raw`<\/`)};
  if (!data.nodes.length || !window.graphology || !window.Sigma) {
    return;
  }

  // Reusable Tailwind utility-class strings for dynamically-created elements.
  // Inline-everywhere is the system of record; these strings only exist
  // because the JS DOM API can't read Tailwind from the markup.
  const CLS = {
    ttlName: 'font-sans text-fg text-[13px] font-semibold leading-tight mb-1 break-words',
    ttlType: 'font-mono text-faint text-[10px] uppercase tracking-[0.15em]',
    ttlPath: 'font-mono text-muted text-[10px] mt-2 break-all',
    ttlSection: 'font-mono text-faint text-[10px] uppercase tracking-[0.15em] mt-3 mb-1',
    ttlEmpty: 'font-mono text-faint text-[10px] italic mt-2',
    ttlMore: 'font-mono text-faint text-[10px] italic pl-3 mt-1',
    ttlUl: 'mt-1 space-y-0.5',
    ttlLi: "font-mono text-fg text-[11px] leading-snug pl-3 relative before:content-['→'] before:text-faint before:absolute before:left-0",
    matchItem: 'flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-[12px] hover:bg-row-hover aria-selected:bg-row-hover',
    miName: 'font-sans text-fg truncate',
    miMark: 'bg-accent-soft text-accent rounded-sm px-0.5',
    miKind: 'font-mono text-faint text-[10px] uppercase tracking-[0.15em] shrink-0',
    matchEmpty: 'font-mono text-faint text-[10px] uppercase tracking-[0.15em] px-3 py-3',
  };

  // Read live colors from the rendered CSS so theme switches stay in one
  // place: change vars → call sigma.refresh() and node/edge colors update.
  const css = () => {
    const s = getComputedStyle(root);
    return {
      app: s.getPropertyValue('--node-app').trim(),
      lib: s.getPropertyValue('--node-lib').trim(),
      edge: s.getPropertyValue('--edge').trim(),
      edgeFaint: s.getPropertyValue('--edge-faint').trim(),
      accent: s.getPropertyValue('--accent').trim(),
      fg: s.getPropertyValue('--fg').trim(),
      muted: s.getPropertyValue('--muted').trim(),
    };
  };

  let theme = css();

  const Graph = window.graphology.Graph || window.graphology;
  const graph = new Graph({ multi: true, type: 'directed' });

  const colorForNode = (type) => type === 'application' ? theme.app : theme.lib;
  const colorForEdge = (type) => {
    if (type === 'peerDependency') return theme.accent;
    if (type === 'devDependency' || type === 'implicit') return theme.edgeFaint;
    return theme.edge;
  };

  // Attribute is named "kind", not "type": sigma reads node.type as its
  // program-class name and bails when it sees "application" / "library".
  for (const n of data.nodes) {
    graph.addNode(n.name, {
      x: n.x,
      y: n.y,
      size: n.size,
      label: n.name,
      kind: n.type,
      path: n.path,
      color: colorForNode(n.type),
    });
  }

  for (const e of data.edges) {
    graph.addEdge(e.source, e.target, {
      color: colorForEdge(e.type),
      depType: e.type,
      size: 1,
    });
  }

  // Adjacency for tooltip & hover-emphasis.
  const depMap = {}, rdepMap = {};
  for (const n of data.nodes) { depMap[n.name] = []; rdepMap[n.name] = []; }
  for (const e of data.edges) {
    depMap[e.source].push(e.target);
    rdepMap[e.target].push(e.source);
  }

  const container = document.getElementById('graph');
  const tooltip = document.getElementById('tooltip');
  const filterInput = document.getElementById('filter');
  const filterCount = document.getElementById('filter-count');
  const filterResults = document.getElementById('filter-results');

  const renderer = new window.Sigma(graph, container, {
    renderEdgeLabels: false,
    labelColor: { color: theme.fg },
    labelFont: 'system-ui, -apple-system, sans-serif',
    labelSize: 11,
    labelWeight: '500',
    labelDensity: 0.7,
    labelGridCellSize: 80,
    defaultEdgeColor: theme.edge,
    defaultNodeColor: theme.lib,
    defaultEdgeType: 'arrow',
    minCameraRatio: 0.05,
    maxCameraRatio: 8,
    // Suppress sigma's built-in hover label panel. We render our own tooltip,
    // so its empty label box (the small rectangle near the cursor) is noise.
    defaultDrawNodeHover: () => undefined,
  });

  // State: hover follows the mouse, focus is sticky (set by clicking a node
  // or selecting a search result), pin keeps the tooltip locked in place.
  let hoveredNode = null;
  let focusedNode = null;
  let pinned = false;
  let filterTerm = '';
  let matches = [];
  let activeMatchIndex = -1;

  // Legend filter state: each key toggles the visibility of a category.
  // previewCategory is set transiently while hovering a legend row so the
  // user can sneak-peek which lines/nodes belong to that category without
  // committing to a toggle.
  const visible = { app: true, lib: true, prod: true, dev: true, peer: true };
  let previewCategory = null;
  const isNodeCat = (k) => k === 'app' || k === 'lib';
  const isEdgeCat = (k) => k === 'prod' || k === 'dev' || k === 'peer';
  const edgeCategory = (depType) => {
    if (depType === 'peerDependency') return 'peer';
    if (depType === 'devDependency' || depType === 'implicit') return 'dev';
    return 'prod';
  };
  const nodeVisible = (kind) => visible[kind === 'application' ? 'app' : 'lib'];

  const activeNode = () => focusedNode || hoveredNode;

  renderer.setSetting('nodeReducer', (node, attrs) => {
    if (!nodeVisible(attrs.kind)) {
      return { ...attrs, hidden: true, label: '' };
    }
    // Legend-row preview takes precedence over normal focus/hover emphasis:
    // hovering a category gives an unambiguous "show me what's in this set".
    if (previewCategory) {
      const nodeCat = attrs.kind === 'application' ? 'app' : 'lib';
      const inPreview = isNodeCat(previewCategory) ? nodeCat === previewCategory : false;
      return {
        ...attrs,
        color: inPreview ? attrs.color : theme.edgeFaint,
        label: inPreview ? attrs.label : '',
        zIndex: inPreview ? 1 : 0,
      };
    }
    const active = activeNode();
    const matchedFilter = !filterTerm || node.toLowerCase().includes(filterTerm);
    const isActive = active === node;
    const isRelated = active && (depMap[active]?.includes(node) || rdepMap[active]?.includes(node));
    const dim = (filterTerm && !matchedFilter) || (active && !isActive && !isRelated);
    return {
      ...attrs,
      color: isActive ? theme.accent : attrs.color,
      label: dim ? '' : attrs.label,
      zIndex: isActive ? 2 : isRelated ? 1 : 0,
    };
  });

  renderer.setSetting('edgeReducer', (edge, attrs) => {
    if (!visible[edgeCategory(attrs.depType)]) {
      return { ...attrs, hidden: true };
    }
    const ext = graph.extremities(edge);
    if (!nodeVisible(graph.getNodeAttribute(ext[0], 'kind')) || !nodeVisible(graph.getNodeAttribute(ext[1], 'kind'))) {
      return { ...attrs, hidden: true };
    }
    if (previewCategory) {
      if (isEdgeCat(previewCategory)) {
        const inPreview = edgeCategory(attrs.depType) === previewCategory;
        return { ...attrs, color: inPreview ? theme.accent : theme.edgeFaint, size: inPreview ? 1.5 : 0.3, zIndex: inPreview ? 1 : 0 };
      }
      // Previewing a node category dims every edge — the focus is on the dots.
      return { ...attrs, color: theme.edgeFaint, size: 0.3 };
    }
    const active = activeNode();
    const touchesActive = active && (ext[0] === active || ext[1] === active);
    if (active && !touchesActive) {
      return { ...attrs, color: theme.edgeFaint, hidden: false, size: 0.5 };
    }
    if (touchesActive) {
      return { ...attrs, color: theme.accent, size: 1.5, zIndex: 1 };
    }
    return attrs;
  });

  // Tooltip body assembled with safe DOM methods (createElement +
  // textContent) — no innerHTML, no template strings of user data.
  const MAX_TOOLTIP_ITEMS = 8;
  const setTooltipContent = (name) => {
    const node = graph.getNodeAttributes(name);
    const deps = depMap[name] || [];
    const rdeps = rdepMap[name] || [];
    tooltip.textContent = '';

    const nameEl = document.createElement('div');
    nameEl.className = CLS.ttlName;
    nameEl.textContent = name;
    tooltip.appendChild(nameEl);

    const typeEl = document.createElement('div');
    typeEl.className = CLS.ttlType;
    typeEl.textContent = node.kind + (pinned ? ' · pinned' : '');
    tooltip.appendChild(typeEl);

    if (node.path) {
      const pathEl = document.createElement('div');
      pathEl.className = CLS.ttlPath;
      pathEl.textContent = node.path;
      tooltip.appendChild(pathEl);
    }

    const addSection = (label, items) => {
      const heading = document.createElement('div');
      heading.className = CLS.ttlSection;
      heading.textContent = label + ' (' + items.length + ')';
      tooltip.appendChild(heading);
      const ul = document.createElement('ul');
      ul.className = CLS.ttlUl;
      const shown = items.slice(0, MAX_TOOLTIP_ITEMS);
      for (const item of shown) {
        const li = document.createElement('li');
        li.className = CLS.ttlLi;
        li.textContent = item;
        ul.appendChild(li);
      }
      if (items.length > MAX_TOOLTIP_ITEMS) {
        const more = document.createElement('li');
        more.className = CLS.ttlMore;
        more.textContent = (items.length - MAX_TOOLTIP_ITEMS) + ' more';
        ul.appendChild(more);
      }
      tooltip.appendChild(ul);
    };

    if (deps.length) addSection('Depends on', deps);
    if (rdeps.length) addSection('Required by', rdeps);
    if (!deps.length && !rdeps.length) {
      const empty = document.createElement('div');
      empty.className = CLS.ttlEmpty;
      empty.textContent = 'No dependencies';
      tooltip.appendChild(empty);
    }
  };

  // Tooltip placement delegated to Floating UI. We build a virtual reference
  // element that either follows the cursor (hover) or anchors to a node's
  // viewport position (pinned), then run computePosition with flip + shift +
  // size middleware so the tooltip always fits the viewport.
  const FUI = window.FloatingUIDOM;
  let lastMouse = null;
  let anchorMode = 'cursor';  // 'cursor' (follows mouse) or 'node' (sticky to node)
  let anchorNode = null;
  let cleanupAutoUpdate = null;

  const cursorRef = {
    getBoundingClientRect() {
      const x = lastMouse ? lastMouse.clientX : 0;
      const y = lastMouse ? lastMouse.clientY : 0;
      return { width: 0, height: 0, x, y, top: y, left: x, right: x, bottom: y };
    },
  };

  const nodeRef = {
    getBoundingClientRect() {
      if (!anchorNode || !graph.hasNode(anchorNode)) {
        return { width: 0, height: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 };
      }
      const pos = renderer.getNodeDisplayData(anchorNode);
      const vp = renderer.graphToViewport({ x: pos.x, y: pos.y });
      const rect = container.getBoundingClientRect();
      const r = (pos.size || 4) + 4;
      const cx = rect.left + vp.x;
      const cy = rect.top + vp.y;
      return { width: r * 2, height: r * 2, x: cx - r, y: cy - r, top: cy - r, left: cx - r, right: cx + r, bottom: cy + r };
    },
  };

  const updatePosition = async () => {
    if (tooltip.style.display !== 'block') return;
    const ref = anchorMode === 'node' ? nodeRef : cursorRef;
    const { x, y } = await FUI.computePosition(ref, tooltip, {
      placement: 'right-start',
      strategy: 'fixed',
      middleware: [
        FUI.offset(12),
        FUI.flip({ fallbackPlacements: ['left-start', 'right-end', 'left-end', 'top', 'bottom'] }),
        FUI.shift({ padding: 12 }),
        FUI.size({
          padding: 12,
          apply({ availableWidth, availableHeight, elements }) {
            const maxW = Math.min(380, Math.max(220, availableWidth));
            const maxH = Math.max(160, availableHeight);
            Object.assign(elements.floating.style, {
              maxWidth: maxW + 'px',
              maxHeight: maxH + 'px',
              overflowY: 'auto',
            });
          },
        }),
      ],
    });
    Object.assign(tooltip.style, { left: x + 'px', top: y + 'px' });
  };

  const stopAutoUpdate = () => {
    if (cleanupAutoUpdate) { cleanupAutoUpdate(); cleanupAutoUpdate = null; }
  };

  // Auto-update is only used for the node-anchored (pinned) mode, where the
  // reference is stable across events but its viewport position changes when
  // the user pans, zooms, or resizes. In cursor mode we drive recomputation
  // ourselves from the mousemove handler.
  const startAutoUpdate = () => {
    stopAutoUpdate();
    if (anchorMode === 'node') {
      cleanupAutoUpdate = FUI.autoUpdate(nodeRef, tooltip, updatePosition);
    }
  };

  const showTooltipFor = (name, mode = 'cursor') => {
    anchorMode = mode;
    anchorNode = mode === 'node' ? name : null;
    setTooltipContent(name);
    tooltip.style.display = 'block';
    startAutoUpdate();
    updatePosition();
  };

  const hideTooltip = () => {
    stopAutoUpdate();
    tooltip.style.display = 'none';
    tooltip.dataset.pinned = 'false';
    anchorNode = null;
  };

  renderer.on('enterNode', (e) => {
    hoveredNode = e.node;
    if (!pinned) showTooltipFor(e.node, 'cursor');
    renderer.refresh({ skipIndexation: true });
  });

  renderer.on('leaveNode', () => {
    hoveredNode = null;
    if (!pinned) hideTooltip();
    renderer.refresh({ skipIndexation: true });
  });

  // Click a node to pin it; the anchor switches from the cursor to the node
  // so the tooltip stays attached even when the mouse moves away.
  renderer.on('clickNode', (e) => {
    focusedNode = e.node;
    pinned = true;
    tooltip.dataset.pinned = 'true';
    showTooltipFor(e.node, 'node');
    renderer.refresh({ skipIndexation: true });
  });

  renderer.on('clickStage', () => {
    if (pinned || focusedNode) {
      focusedNode = null;
      pinned = false;
      tooltip.dataset.pinned = 'false';
      if (hoveredNode) {
        showTooltipFor(hoveredNode, 'cursor');
      } else {
        hideTooltip();
      }
      renderer.refresh({ skipIndexation: true });
    }
  });

  let posRafQueued = false;
  container.addEventListener('mousemove', (e) => {
    lastMouse = { clientX: e.clientX, clientY: e.clientY };
    if (anchorMode === 'cursor' && tooltip.style.display === 'block' && !posRafQueued) {
      posRafQueued = true;
      requestAnimationFrame(() => {
        posRafQueued = false;
        updatePosition();
      });
    }
  });

  const focusOnNode = (name, { pin = true } = {}) => {
    if (!graph.hasNode(name)) return;
    const pos = renderer.getNodeDisplayData(name);
    if (pos) renderer.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.3 }, { duration: 600 });
    focusedNode = name;
    pinned = pin;
    if (pin) tooltip.dataset.pinned = 'true';
    showTooltipFor(name, pin ? 'node' : 'cursor');
    renderer.refresh({ skipIndexation: true });
  };

  // ── Search results ───────────────────────────────────────────────────
  const totalNodes = data.nodes.length;
  const renderResults = () => {
    filterResults.textContent = '';
    if (!filterTerm) {
      filterResults.dataset.open = 'false';
      filterCount.textContent = '';
      filterCount.dataset.state = '';
      activeMatchIndex = -1;
      return;
    }
    filterCount.textContent = matches.length + ' / ' + totalNodes;
    filterCount.dataset.state = matches.length === 0 ? 'zero' : '';
    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = CLS.matchEmpty;
      const b = document.createElement('b'); b.textContent = 'No matches'; b.className = 'text-fg';
      empty.appendChild(b);
      empty.appendChild(document.createTextNode(' for "' + filterTerm + '"'));
      filterResults.appendChild(empty);
      filterResults.dataset.open = 'true';
      activeMatchIndex = -1;
      return;
    }
    const limit = Math.min(matches.length, 24);
    for (let i = 0; i < limit; i++) {
      const m = matches[i];
      const row = document.createElement('div');
      row.className = CLS.matchItem;
      row.setAttribute('role', 'option');
      row.dataset.index = String(i);
      if (i === activeMatchIndex) row.setAttribute('aria-selected', 'true');

      const nameEl = document.createElement('span');
      nameEl.className = CLS.miName;
      const idx = m.name.toLowerCase().indexOf(filterTerm);
      if (idx >= 0) {
        nameEl.appendChild(document.createTextNode(m.name.slice(0, idx)));
        const mark = document.createElement('mark');
        mark.className = CLS.miMark;
        mark.textContent = m.name.slice(idx, idx + filterTerm.length);
        nameEl.appendChild(mark);
        nameEl.appendChild(document.createTextNode(m.name.slice(idx + filterTerm.length)));
      } else {
        nameEl.textContent = m.name;
      }
      row.appendChild(nameEl);

      const kindEl = document.createElement('span');
      kindEl.className = CLS.miKind;
      kindEl.textContent = m.type === 'application' ? 'app' : 'lib';
      row.appendChild(kindEl);

      row.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        focusOnNode(m.name);
        filterResults.dataset.open = 'false';
      });
      filterResults.appendChild(row);
    }
    if (matches.length > limit) {
      const more = document.createElement('div');
      more.className = CLS.matchEmpty;
      more.textContent = '+ ' + (matches.length - limit) + ' more — refine to see';
      filterResults.appendChild(more);
    }
    filterResults.dataset.open = 'true';
  };

  const recomputeMatches = () => {
    if (!filterTerm) { matches = []; return; }
    matches = [];
    for (const n of data.nodes) {
      if (n.name.toLowerCase().includes(filterTerm)) matches.push(n);
    }
    matches.sort((a, b) => {
      // Apps first, then by closeness of match position, then by name.
      if (a.type !== b.type) return a.type === 'application' ? -1 : 1;
      const ai = a.name.toLowerCase().indexOf(filterTerm);
      const bi = b.name.toLowerCase().indexOf(filterTerm);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  };

  let rafQueued = false;
  filterInput.addEventListener('input', () => {
    filterTerm = filterInput.value.toLowerCase().trim();
    recomputeMatches();
    activeMatchIndex = matches.length ? 0 : -1;
    renderResults();
    if (!rafQueued) {
      rafQueued = true;
      requestAnimationFrame(() => {
        rafQueued = false;
        renderer.refresh({ skipIndexation: true });
      });
    }
  });

  filterInput.addEventListener('focus', () => {
    if (filterTerm) filterResults.dataset.open = 'true';
  });

  document.addEventListener('mousedown', (e) => {
    if (!filterResults.contains(e.target) && e.target !== filterInput) {
      filterResults.dataset.open = 'false';
    }
  });

  filterInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      if (matches.length) {
        e.preventDefault();
        activeMatchIndex = (activeMatchIndex + 1) % matches.length;
        renderResults();
      }
    } else if (e.key === 'ArrowUp') {
      if (matches.length) {
        e.preventDefault();
        activeMatchIndex = (activeMatchIndex - 1 + matches.length) % matches.length;
        renderResults();
      }
    } else if (e.key === 'Enter') {
      if (matches.length && activeMatchIndex >= 0) {
        e.preventDefault();
        focusOnNode(matches[activeMatchIndex].name);
        filterResults.dataset.open = 'false';
      }
    }
  });

  // ── Legend / category filter ─────────────────────────────────────────
  const legend = document.getElementById('legend');
  const toggleCategory = (key) => {
    if (!(key in visible)) return;
    visible[key] = !visible[key];
    const row = legend?.querySelector('[data-toggle="' + key + '"]');
    if (row) {
      row.dataset.state = visible[key] ? 'on' : 'off';
      row.setAttribute('aria-checked', String(visible[key]));
    }
    renderer.refresh({ skipIndexation: true });
  };
  let previewRafQueued = false;
  const queuePreviewRefresh = () => {
    if (previewRafQueued) return;
    previewRafQueued = true;
    requestAnimationFrame(() => {
      previewRafQueued = false;
      renderer.refresh({ skipIndexation: true });
    });
  };
  legend?.querySelectorAll('[data-toggle]').forEach((row) => {
    row.addEventListener('click', () => toggleCategory(row.dataset.toggle));
    row.addEventListener('mouseenter', () => {
      previewCategory = row.dataset.toggle;
      queuePreviewRefresh();
    });
    row.addEventListener('mouseleave', () => {
      previewCategory = null;
      queuePreviewRefresh();
    });
    row.addEventListener('focus', () => {
      previewCategory = row.dataset.toggle;
      queuePreviewRefresh();
    });
    row.addEventListener('blur', () => {
      previewCategory = null;
      queuePreviewRefresh();
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleCategory(row.dataset.toggle);
      }
    });
  });

  // ── Camera controls ──────────────────────────────────────────────────
  const resetView = () => {
    renderer.getCamera().animatedReset({ duration: 600 });
  };

  const applyTheme = () => {
    theme = css();
    graph.forEachNode((node, attrs) => {
      graph.setNodeAttribute(node, 'color', colorForNode(attrs.kind));
    });
    graph.forEachEdge((edge, attrs) => {
      graph.setEdgeAttribute(edge, 'color', colorForEdge(attrs.depType));
    });
    renderer.setSetting('labelColor', { color: theme.fg });
    renderer.setSetting('defaultEdgeColor', theme.edge);
    renderer.setSetting('defaultNodeColor', theme.lib);
    renderer.refresh();
  };

  themeBtn?.addEventListener('click', () => {
    const isDark = root.dataset.theme ? root.dataset.theme === 'dark' : mql.matches;
    const next = isDark ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('vis-graph-theme', next); } catch {}
    applyTheme();
  });

  mql.addEventListener('change', () => {
    if (!root.dataset.theme) applyTheme();
  });

  // Keyboard shortcuts: '/' focuses search, 'R' fits view, Esc clears + unpins.
  window.addEventListener('keydown', (e) => {
    const inField = document.activeElement === filterInput;
    if (e.key === '/' && !inField) {
      e.preventDefault();
      filterInput.focus();
      filterInput.select();
    } else if ((e.key === 'r' || e.key === 'R') && !inField) {
      e.preventDefault();
      resetView();
    } else if (e.key === 'Escape') {
      if (inField) {
        filterInput.value = '';
        filterTerm = '';
        matches = [];
        renderResults();
        renderer.refresh({ skipIndexation: true });
        filterInput.blur();
      } else if (pinned || focusedNode) {
        focusedNode = null;
        pinned = false;
        tooltip.dataset.pinned = 'false';
        if (!hoveredNode) hideTooltip();
        renderer.refresh({ skipIndexation: true });
      }
    }
  });
})();
</script>
</body>
</html>`;
};
