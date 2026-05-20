import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim } from "@visulima/colorize";
import type { ProjectGraph } from "@visulima/task-runner";
import { projectGraphToDot } from "@visulima/task-runner";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { emitGraphHtml } from "../../report/graph/html";
import { GraphStore } from "../../tui/components/graph/graph-store";
import VisGraphApp from "../../tui/components/graph/vis-graph-app";
import type { GraphOptions } from "./index";

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

const projectGraphToHtml = (projectGraph: ProjectGraph): string => {
    const nodes = Object.values(projectGraph.nodes).map((node) => ({
        name: node.name,
        path: node.data?.root,
        type: node.type,
    }));

    const edges: { source: string; target: string; type: string }[] = [];

    for (const deps of Object.values(projectGraph.dependencies)) {
        for (const dep of deps) {
            edges.push({ source: dep.source, target: dep.target, type: dep.type });
        }
    }

    return emitGraphHtml({
        edges,
        nodes,
        tool: { name: "vis-graph", version: "alpha" },
        workspaceRoot: process.cwd(),
    });
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
