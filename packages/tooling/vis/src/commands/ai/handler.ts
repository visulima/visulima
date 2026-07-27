// fallow-ignore-file circular-dependencies -- handler and index reference each other only through lazy dynamic `import()` (command registration / lazy execute), so there is no runtime initialization cycle.
import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { detectAllProviders, runProvider } from "@visulima/find-ai-runner";
import { renderToString } from "@visulima/tui";
import { Table } from "@visulima/tui-kit/table";
import React from "react";

import type { AiConfig } from "../../ai/ai-analysis";
import { DEFAULT_PRIORITY, resolveProvider } from "../../ai/ai-analysis";
import { renderDiscoveryJson, renderDiscoveryText } from "./discovery";
import type { AiDiscoverHelpOptions, AiFixOptions, AiProvidersOptions, AiRootOptions, AiTestOptions } from "./index";

const loadDiscoverableSubcommands = async () => {
    const { default: aiCommands } = await import("./index");

    return aiCommands.filter((cmd) => cmd.name !== "ai");
};

export const aiRootExecute: CommandExecute<Toolbox<Console, AiRootOptions>> = async () => {
    const subcommands = await loadDiscoverableSubcommands();

    process.stderr.write(renderDiscoveryText(subcommands));
};

export const aiDiscoverHelpExecute: CommandExecute<Toolbox<Console, AiDiscoverHelpOptions>> = async () => {
    const subcommands = await loadDiscoverableSubcommands();

    process.stdout.write(renderDiscoveryJson(subcommands));
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export const aiTestExecute: CommandExecute<Toolbox<Console, AiTestOptions>> = async ({ logger, visConfig }) => {
    const aiConfig: AiConfig | undefined = visConfig?.ai;
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

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export const aiProvidersExecute: CommandExecute<Toolbox<Console, AiProvidersOptions>> = ({ logger, options, visConfig }) => {
    const format = options.format ?? "table";
    const aiConfig: AiConfig | undefined = visConfig?.ai;
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

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export const aiFixExecute: CommandExecute<Toolbox<Console, AiFixOptions>> = async (toolbox) => {
    const { aiFix } = await import("./fix");

    await aiFix(toolbox);
};
