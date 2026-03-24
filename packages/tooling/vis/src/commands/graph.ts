import { writeFileSync } from "node:fs";
import { cwd, stdout } from "node:process";

import { toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot, type GraphFormat } from "@visulima/task-runner";

import { buildProjectGraph, discoverWorkspace, findWorkspaceRoot } from "../workspace";

/**
 * Implements the `vis graph` command.
 */
const graphCommand = async (_positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
    const workspaceRoot = findWorkspaceRoot(cwd());
    const { workspace } = discoverWorkspace(workspaceRoot);
    const projectGraph = buildProjectGraph(workspaceRoot, workspace);

    const format = (typeof flags["format"] === "string" ? flags["format"] : "ascii") as GraphFormat;
    const outputFile = typeof flags["output"] === "string" ? flags["output"] : undefined;

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
        stdout.write(`Graph written to ${outputFile}\n`);
    } else {
        stdout.write(output + "\n");
    }
};

export { graphCommand };
