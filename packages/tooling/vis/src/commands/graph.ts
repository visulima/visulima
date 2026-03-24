import { writeFileSync } from "node:fs";
import { cwd } from "node:process";

import type { Command } from "@visulima/cerebro";
import { toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot, type GraphFormat } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

const graphCommand: Command = {
    name: "graph",
    description: "Visualize the project dependency graph",
    options: [
        {
            name: "format",
            alias: "f",
            type: String,
            defaultValue: "ascii",
            description: "Output format: ascii, dot, json, html",
        },
        {
            name: "output",
            alias: "o",
            type: String,
            description: "Write output to file instead of stdout",
        },
    ],
    examples: [
        ["vis graph", "Show ASCII dependency graph"],
        ["vis graph --format=dot", "Output in Graphviz DOT format"],
        ["vis graph --format=json --output=graph.json", "Save JSON graph to file"],
    ],
    execute: async ({ logger, options }) => {
        const workspaceRoot = findWorkspaceRoot(cwd());
        const { workspace } = discoverWorkspace(workspaceRoot);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace);

        const format = (options.format as string ?? "ascii") as GraphFormat;
        const outputFile = options.output as string | undefined;

        let output: string;

        switch (format) {
            case "ascii": {
                output = toGraphAscii(projectGraph);
                break;
            }

            case "dot": {
                output = toGraphvizDot(projectGraph);
                break;
            }

            case "json": {
                output = JSON.stringify(toGraphJson(projectGraph), null, 2);
                break;
            }

            case "html": {
                output = toGraphHtml(projectGraph);
                break;
            }

            default: {
                output = toGraphAscii(projectGraph);
            }
        }

        if (outputFile) {
            writeFileSync(outputFile, output, "utf8");
            logger.info(`Graph written to ${outputFile}`);
        } else {
            logger.info(output);
        }
    },
};

export { graphCommand };
