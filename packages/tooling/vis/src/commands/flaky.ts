import type { Command } from "@visulima/cerebro";

import { analyzeFlakiness, formatFlakinessTable } from "../flakiness";

/**
 * `vis flaky` — displays an aggregated flakiness report from past
 * run summaries. Requires `--summarize` to have been used on prior
 * `vis run` invocations so `.task-runner/runs/*.json` files exist.
 */
const flaky: Command = {
    group: "Security & Health",
    description: "Show flaky tasks based on historical run summaries",
    examples: [
        ["vis flaky", "Show all flaky tasks (min 2 runs)"],
        ["vis flaky --min-runs=5", "Only show tasks with at least 5 recorded runs"],
        ["vis flaky --since=2026-01-01", "Only consider runs since a date"],
        ["vis flaky --json", "Machine-readable output"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root.");
        }

        const stats = analyzeFlakiness(wsRoot, {
            minRuns: options.minRuns as number | undefined,
            since: options.since as string | undefined,
        });

        if (options.json) {
            logger.info(JSON.stringify(stats, null, 2));

            return;
        }

        const lines = formatFlakinessTable(stats);

        for (const line of lines) {
            logger.info(line);
        }

        if (stats.length > 0) {
            logger.info("");
            logger.info(`${String(stats.length)} flaky task(s) detected across ${String(stats.reduce((sum, s) => sum + s.totalRuns, 0))} run(s).`);
            logger.info("Tip: use retryCount in project.json options to auto-retry flaky tasks.");
        }
    },
    name: "flaky",
    options: [
        {
            defaultValue: 2,
            description: "Minimum number of recorded runs before a task is considered",
            name: "min-runs",
            type: Number,
        },
        {
            description: "Only consider runs after this ISO 8601 date (e.g. 2026-01-01)",
            name: "since",
            type: String,
        },
        {
            defaultValue: false,
            description: "Emit JSON instead of a table",
            name: "json",
            type: Boolean,
        },
    ],
};

export default flaky;
