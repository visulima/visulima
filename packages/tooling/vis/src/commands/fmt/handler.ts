import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green } from "@visulima/colorize";
import { relative } from "@visulima/path";

import { biomeAdapter } from "../../lint-fmt/adapters/biome";
import { dprintAdapter } from "../../lint-fmt/adapters/dprint";
import { oxfmtAdapter } from "../../lint-fmt/adapters/oxfmt";
import { prettierAdapter } from "../../lint-fmt/adapters/prettier";
import type { AdapterRunOptions, Finding } from "../../lint-fmt/config-types";
import { detectAdapters } from "../../lint-fmt/detect";
import { adaptersByKind, registerAdapters, routeFilesByExtension } from "../../lint-fmt/registry";
import { aggregate, exitCodeFor, groupFindingsByFile } from "../../lint-fmt/results";
import { runAdapter } from "../../lint-fmt/runner";
import type { FmtOptions } from "./index";

const FORMAT_ADAPTERS = [oxfmtAdapter, biomeAdapter, dprintAdapter, prettierAdapter];

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, FmtOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();
    const adapters = registerAdapters(FORMAT_ADAPTERS);
    const detected = detectAdapters(root, adapters);
    const eligible = adaptersByKind(detected, adapters, "fmt");

    if (eligible.length === 0) {
        logger.warn("vis fmt: no formatter detected in this workspace (looked for: oxfmt, biome, dprint, prettier).");

        return;
    }

    const runOptions: AdapterRunOptions = { quiet: options.quiet ?? false };
    const positional = collectPositional(options);
    const mode: "check" | "fix" = options.check ? "check" : "fix";

    const runs: Array<{ adapter: typeof eligible[number]["adapter"]; durationMs: number; exitCode: number | null; findings: Finding[] }> = [];

    if (positional.length === 0) {
        // No explicit file list — each adapter runs against `.` so its own
        // ignore semantics filter the workspace.
        for (const { adapter, presence } of eligible) {
            const raw = runAdapter(adapter, presence, ["."], runOptions, mode);
            const findings = adapter.parse(raw, presence);

            runs.push({ adapter, durationMs: raw.durationMs, exitCode: raw.exitCode, findings });
        }
    } else {
        // Route each explicit file to the adapter that owns its extension.
        const grouped = routeFilesByExtension(positional, eligible);

        for (const { adapter, presence } of eligible) {
            const files = grouped.get(adapter.id);

            if (!files || files.length === 0) {
                continue;
            }

            const raw = runAdapter(adapter, presence, files, runOptions, mode);
            const findings = adapter.parse(raw, presence);

            runs.push({ adapter, durationMs: raw.durationMs, exitCode: raw.exitCode, findings });
        }
    }

    const result = aggregate(
        runs.map((run) => ({
            adapter: run.adapter.id,
            durationMs: run.durationMs,
            exitCode: run.exitCode,
            findingCount: run.findings.length,
            findings: run.findings,
        })),
    );

    const format = options.format ?? "human";

    if (format === "json") {
        process.stdout.write(`${JSON.stringify({ findings: result.findings, mode, runs: result.runs }, null, 2)}\n`);
    } else if (format === "minimal") {
        printMinimal(result.findings, root);
    } else {
        printHuman(result.findings, root, mode, logger);
    }

    // In `fix` mode, "would change" findings shouldn't fail the run — the
    // tool just wrote them. Only escalate when the user asked for `--check`.
    const exitCode = mode === "fix" ? (result.hadProcessFailure ? 1 : 0) : exitCodeFor({ ...result, maxSeverity: result.findings.length > 0 ? "error" : undefined });

    if (exitCode !== 0) {
        process.exitCode = exitCode;
    }
};

const collectPositional = (options: FmtOptions): string[] => {
    const bag = options as unknown as { _?: ReadonlyArray<string>; args?: ReadonlyArray<string> };

    return [...(bag._ ?? bag.args ?? [])];
};

const printHuman = (findings: ReadonlyArray<Finding>, root: string, mode: "check" | "fix", logger: Toolbox["logger"]): void => {
    if (findings.length === 0) {
        logger.info(green(mode === "fix" ? "✓ fmt: nothing to change" : "✓ fmt: all files already formatted"));

        return;
    }

    const grouped = groupFindingsByFile(findings);
    const heading = mode === "fix" ? cyan(bold("Formatted:")) : bold("Would change:");

    logger.info(heading);

    for (const file of grouped.keys()) {
        logger.info(`  ${dim("·")} ${relative(root, file)}`);
    }

    if (mode === "check") {
        logger.info("");
        logger.info(dim(`Run \`vis fmt\` to apply changes (${String(grouped.size)} file${grouped.size === 1 ? "" : "s"}).`));
    }
};

const printMinimal = (findings: ReadonlyArray<Finding>, root: string): void => {
    for (const finding of findings) {
        process.stdout.write(`${finding.adapter}\t${relative(root, finding.file)}\n`);
    }
};

export default execute as CommandExecute<Toolbox>;
