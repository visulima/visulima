import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { detectAllProviders, runProvider } from "@visulima/find-ai-runner";
import { renderToString, Table } from "@visulima/tui";
import React from "react";

import type { AiConfig } from "../../ai-analysis";
import { DEFAULT_PRIORITY, resolveProvider } from "../../ai-analysis";
import { clearCache, getCacheStats } from "../../ai-cache";
import { clearSocketCache } from "../../socket-security";
import type { AiOptions } from "./index";

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

    const tableData = allProviders.map((provider) => {
        return {
            method: provider.detectionMethod ?? "-",
            path: provider.path ?? "-",
            priority: String(DEFAULT_PRIORITY[provider.name] ?? 0),
            provider: provider.name,
            selected: provider.name === selected?.name ? ">>>" : "",
            status: provider.available ? "available" : "not found",
            version: provider.version ?? "-",
        };
    });

    const columns = process.stdout.columns || 80;
    const output = renderToString(React.createElement(Table, { data: tableData }), { columns });

    logger.info(output);

    if (selected) {
        logger.info(`\nSelected provider: ${selected.name} (priority ${String(DEFAULT_PRIORITY[selected.name] ?? 0)})`);
    } else {
        logger.info("\nNo AI provider available. Install one of the supported AI CLI tools.");
    }
};

const execute = async ({ logger, options, visConfig }: Toolbox<Console, AiOptions>): Promise<void> => {
    const format = options.format ?? "table";

    if (options.cacheStats) {
        handleCacheStats(format, logger);

        return;
    }

    if (options.clearCache) {
        const aiDeleted = clearCache();
        const socketDeleted = clearSocketCache();

        logger.info(`Cleared ${String(aiDeleted)} cached AI response${aiDeleted === 1 ? "" : "s"}.`);

        if (socketDeleted > 0) {
            logger.info(`Cleared ${String(socketDeleted)} cached Socket.dev report${socketDeleted === 1 ? "" : "s"}.`);
        }

        return;
    }

    if (options.test) {
        await handleTest(logger, visConfig?.ai);

        return;
    }

    handleProviderStatus(format, logger, visConfig?.ai);
};

export default execute as CommandExecute<Toolbox>;
