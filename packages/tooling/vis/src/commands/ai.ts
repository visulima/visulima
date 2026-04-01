import React from "react";
import type { Command } from "@visulima/cerebro";
import { detectAllProviders, runProvider } from "@visulima/find-ai-runner";
import { renderToString, Table } from "@visulima/tui";

import type { AiConfig } from "../ai-analysis";
import { DEFAULT_PRIORITY, resolveProvider } from "../ai-analysis";
import { clearCache, getCacheStats } from "../ai-cache";

const handleCacheStats = (format: string, logger: Console): void => {
    const stats = getCacheStats();

    if (format === "json") {
        process.stdout.write(`${JSON.stringify(stats, undefined, 2)}\n`);

        return;
    }

    logger.info("AI Cache Statistics:");
    logger.info(`  Entries:    ${String(stats.entries)}`);
    logger.info(`  Total size: ${String(Math.round(stats.totalSizeBytes / 1024))} KB`);
    logger.info(`  Oldest:     ${stats.oldestEntry ? new Date(stats.oldestEntry).toISOString() : "N/A"}`);
    logger.info(`  Newest:     ${stats.newestEntry ? new Date(stats.newestEntry).toISOString() : "N/A"}`);
};

const handleTest = async (logger: Console, aiConfig?: AiConfig): Promise<void> => {
    const provider = resolveProvider(aiConfig);

    if (!provider) {
        logger.error("No AI provider available to test.");
        process.exitCode = 1;

        return;
    }

    logger.info(`Testing ${provider.name}...`);

    try {
        const result = await runProvider(provider, "Reply with exactly: OK", { timeoutMs: 30_000 });

        logger.info(`Provider ${provider.name} responded: ${result.stdout.trim().slice(0, 200)}`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        logger.error(`Provider ${provider.name} failed: ${message}`);
        process.exitCode = 1;
    }
};

const handleProviderStatus = (format: string, logger: Console, aiConfig?: AiConfig): void => {
    const allProviders = detectAllProviders();
    const selected = resolveProvider(aiConfig);

    if (format === "json") {
        const output = allProviders.map((p) => {
            return {
                available: p.available,
                method: p.detectionMethod,
                name: p.name,
                path: p.path,
                priority: DEFAULT_PRIORITY[p.name] ?? 0,
                selected: p.name === selected?.name,
                version: p.version,
            };
        });

        process.stdout.write(`${JSON.stringify(output, undefined, 2)}\n`);

        return;
    }

    const tableData = allProviders.map((provider) => ({
        method: provider.detectionMethod ?? "-",
        path: provider.path ?? "-",
        priority: String(DEFAULT_PRIORITY[provider.name] ?? 0),
        provider: provider.name,
        selected: provider.name === selected?.name ? ">>>" : "",
        status: provider.available ? "available" : "not found",
        version: provider.version ?? "-",
    }));

    const columns = process.stdout.columns || 80;
    const output = renderToString(React.createElement(Table, { data: tableData }), { columns });

    logger.info(output);

    if (selected) {
        logger.info(`\nSelected provider: ${selected.name} (priority ${String(DEFAULT_PRIORITY[selected.name] ?? 0)})`);
    } else {
        logger.info("\nNo AI provider available. Install one of the supported AI CLI tools.");
    }
};

const ai: Command = {
    alias: "a",
    description: "Show AI provider status, test connectivity, and manage cache",
    examples: [
        ["vis ai", "Show all AI providers and their status"],
        ["vis ai --test", "Test the best available provider"],
        ["vis ai --cache-stats", "Show AI response cache statistics"],
        ["vis ai --clear-cache", "Clear the AI response cache"],
        ["vis ai --format json", "Output as JSON"],
    ],
    execute: async ({ logger, options, visConfig }) => {
        const format = (options.format as string) ?? "table";

        if (options["cache-stats"]) {
            handleCacheStats(format, logger);

            return;
        }

        if (options["clear-cache"]) {
            const deleted = clearCache();

            logger.info(`Cleared ${String(deleted)} cached AI response${deleted === 1 ? "" : "s"}.`);

            return;
        }

        if (options.test) {
            await handleTest(logger, visConfig?.ai);

            return;
        }

        handleProviderStatus(format, logger, visConfig?.ai);
    },
    name: "ai",
    options: [
        {
            defaultValue: false,
            description: "Test the best available AI provider with a quick prompt",
            name: "test",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Show AI response cache statistics",
            name: "cache-stats",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Clear the AI response cache",
            name: "clear-cache",
            type: Boolean,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

export default ai;
