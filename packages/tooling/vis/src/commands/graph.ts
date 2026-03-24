import { writeFileSync } from "node:fs";
import { cwd } from "node:process";

import type { Command } from "@visulima/cerebro";
import { projectGraphToDot } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

const projectGraphToAscii = (projectGraph: {
    dependencies: Record<string, { target: string }[]>;
    nodes: Record<string, { name: string; type: string }>;
}): string => {
    const lines: string[] = ["Project Dependency Graph", "=======================", ""];

    for (const [name, node] of Object.entries(projectGraph.nodes)) {
        const deps = projectGraph.dependencies[name] ?? [];
        const typeLabel = node.type === "application" ? " (app)" : "";

        if (deps.length === 0) {
            lines.push(`  ${name}${typeLabel}`);
        } else {
            lines.push(`  ${name}${typeLabel}`);

            for (const dep of deps) {
                lines.push(`    └── ${dep.target}`);
            }
        }

        lines.push("");
    }

    return lines.join("\n");
};

const projectGraphToJson = (projectGraph: {
    dependencies: Record<string, { source: string; target: string; type: string }[]>;
    nodes: Record<string, { name: string; type: string }>;
}): {
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

const graph: Command = {
    description: "Visualize the project dependency graph",
    examples: [
        ["vis graph", "Show ASCII dependency graph"],
        ["vis graph --format=dot", "Output in Graphviz DOT format"],
        ["vis graph --format=json --output=graph.json", "Save JSON graph to file"],
    ],
    execute: async ({ logger, options }) => {
        const workspaceRoot = findWorkspaceRoot(cwd());
        const { workspace } = discoverWorkspace(workspaceRoot);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        const format = (options.format as string | undefined) ?? "ascii";
        const outputFile = options.output as string | undefined;

        let output: string;

        switch (format) {
            case "dot": {
                output = projectGraphToDot(projectGraph);
                break;
            }

            case "json": {
                output = JSON.stringify(projectGraphToJson(projectGraph), undefined, 2);
                break;
            }

            default: {
                output = projectGraphToAscii(projectGraph);
            }
        }

        if (outputFile) {
            writeFileSync(outputFile, output, "utf8");
            logger.info(`Graph written to ${outputFile}`);
        } else {
            logger.info(output);
        }
    },
    name: "graph",
    options: [
        {
            alias: "f",
            defaultValue: "ascii",
            description: "Output format: ascii, dot, json",
            name: "format",
            type: String,
        },
        {
            alias: "o",
            description: "Write output to file instead of stdout",
            name: "output",
            type: String,
        },
    ],
};

export default graph;
