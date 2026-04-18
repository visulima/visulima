import { readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { buildCodeownersLines, renderCodeowners } from "../codeowners";
import { discoverWorkspace } from "../workspace";

/**
 * `vis sync &lt;kind>` performs workspace-wide synchronisations that
 * cannot be derived from a task graph alone.
 *
 * Currently supported kinds:
 *
 *  - `codeowners`: aggregates `owners` entries from every project's
 *    project.json into a single CODEOWNERS file at the repo root
 *    (or `.github/CODEOWNERS` when the target flag is set).
 *
 * Additional kinds will land alongside their features (for example:
 * `tsconfig-references`, `package-json` sort, `hooks`).
 */
const sync: Command = {
    argument: {
        description: "What to sync: codeowners",
        name: "kind",
        type: String,
    },
    description: "Synchronise derived workspace artefacts (codeowners, tsconfig refs, …)",
    examples: [
        ["vis sync codeowners", "Generate CODEOWNERS at the repository root"],
        ["vis sync codeowners --out=.github/CODEOWNERS", "Write to .github/CODEOWNERS instead"],
        ["vis sync codeowners --check", "Fail if the existing file is stale"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const kind = argument[0];

        if (!kind) {
            throw new Error("Missing sync kind. Usage: vis sync <kind> (known kinds: codeowners)");
        }

        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        if (kind !== "codeowners") {
            throw new Error(`Unknown sync kind: "${kind}". Known kinds: codeowners.`);
        }

        const { workspace } = discoverWorkspace(wsRoot, visConfig);
        const lines = buildCodeownersLines(workspace, visConfig?.codeowners);

        if (lines.length === 0) {
            logger.info("No `owners` entries found in any project. Nothing to sync.");

            return;
        }

        const rendered = renderCodeowners(lines, visConfig?.codeowners?.provider ?? "github");
        const outPath = options.out ? join(wsRoot, String(options.out)) : join(wsRoot, "CODEOWNERS");

        if (options.check) {
            let existing = "";

            try {
                existing = readFileSync(outPath, "utf8");
            } catch (error: unknown) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    existing = "";
                } else {
                    throw error;
                }
            }

            if (existing.trim() !== rendered.trim()) {
                logger.error(`${outPath} is out of date. Run \`vis sync codeowners\` to update it.`);
                process.exitCode = 1;

                return;
            }

            logger.info(`${outPath} is up to date.`);

            return;
        }

        writeFileSync(outPath, rendered);
        logger.info(`Wrote ${lines.length} entries to ${outPath}`);
    },
    group: "Workspace",
    name: "sync",
    options: [
        {
            description: "Output path for the generated file (default: <workspace>/CODEOWNERS)",
            name: "out",
            type: String,
        },
        {
            defaultValue: false,
            description: "Verify the existing file is up to date (exit non-zero if stale)",
            name: "check",
            type: Boolean,
        },
    ],
};

export default sync;
