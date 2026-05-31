import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green } from "@visulima/colorize";
import { relative } from "@visulima/path";

import { resolveSharedCacheDirectory } from "../../cache/cache-directory";
import { biomeAdapter } from "../../lint-fmt/adapters/biome";
import { denoFmtAdapter } from "../../lint-fmt/adapters/deno";
import { dprintAdapter } from "../../lint-fmt/adapters/dprint";
import { oxfmtAdapter } from "../../lint-fmt/adapters/oxfmt";
import { prettierAdapter } from "../../lint-fmt/adapters/prettier";
import type { AdapterRunOptions, Finding } from "../../lint-fmt/config-types";
import { detectAdapters } from "../../lint-fmt/detect";
import { changedFilesSince } from "../../lint-fmt/diff";
import { adaptersByKind, registerAdapters, routeFilesByExtension } from "../../lint-fmt/registry";
import { emitJUnit } from "../../lint-fmt/reporters/junit";
import { emitSarif } from "../../lint-fmt/reporters/sarif";
import { aggregate, exitCodeFor, groupFindingsByFile } from "../../lint-fmt/results";
import type { AdapterJob } from "../../lint-fmt/runner";
import { runAdaptersParallel } from "../../lint-fmt/runner";
import type { FmtOptions } from "./index";

const FORMAT_ADAPTERS = [oxfmtAdapter, biomeAdapter, dprintAdapter, prettierAdapter, denoFmtAdapter];

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, FmtOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();
    const adapters = registerAdapters(FORMAT_ADAPTERS);
    const detected = detectAdapters(root, adapters);
    const eligible = adaptersByKind(detected, adapters, "fmt");

    if (eligible.length === 0) {
        logger.warn("vis fmt: no formatter detected in this workspace (looked for: oxfmt, biome, dprint, prettier, deno).");

        return;
    }

    const runOptions: AdapterRunOptions = { quiet: options.quiet ?? false };
    const positional = collectPositional(options);
    const mode: "check" | "fix" = options.check ? "check" : "fix";

    let sinceFiles: string[] | undefined;

    if (typeof options.since === "string" && options.since.length > 0) {
        sinceFiles = changedFilesSince(root, options.since);

        if (sinceFiles === undefined) {
            logger.warn(`vis fmt: could not resolve --since ${options.since} (not a git repo or unknown ref). Falling back to a workspace-wide run.`);
        } else if (sinceFiles.length === 0) {
            logger.info(green(`✓ fmt: no files changed since ${options.since}`));

            return;
        }
    }

    // Resolution precedence: explicit positional > --since > workspace-wide.
    const explicit = positional.length > 0 ? positional : sinceFiles;
    const jobs: AdapterJob[] = [];

    if (explicit) {
        // Route each explicit file to the adapter that owns its extension.
        const grouped = routeFilesByExtension(explicit, eligible);

        for (const { adapter, presence } of eligible) {
            const files = grouped.get(adapter.id);

            if (!files || files.length === 0) {
                continue;
            }

            jobs.push({ adapter, files, presence });
        }
    } else {
        // No explicit file list — each adapter runs against `.` so its own
        // ignore semantics filter the workspace.
        for (const { adapter, presence } of eligible) {
            jobs.push({ adapter, files: ["."], presence });
        }
    }

    const cacheRoot = resolveSharedCacheDirectory(root, undefined, undefined, true);
    const rawResults = await runAdaptersParallel(jobs, runOptions, mode, { cacheRoot });
    const runs = jobs.map((job, index) => {
        const raw = rawResults[index]!;
        const findings = job.adapter.parse(raw, job.presence);

        return { adapter: job.adapter, durationMs: raw.durationMs, exitCode: raw.exitCode, findings };
    });

    const result = aggregate(
        runs.map((run) => {
            return {
                adapter: run.adapter.id,
                durationMs: run.durationMs,
                exitCode: run.exitCode,
                findingCount: run.findings.length,
                findings: run.findings,
            };
        }),
    );

    const format = options.format ?? "human";

    switch (format) {
        case "json": {
            process.stdout.write(`${JSON.stringify({ findings: result.findings, mode, runs: result.runs }, null, 2)}\n`);

            break;
        }
        case "junit": {
            process.stdout.write(emitJUnit({
                runs: runs.map((run) => {
                    return { adapter: run.adapter.id, durationMs: run.durationMs, findings: run.findings };
                }),
                workspaceRoot: root,
            }));

            break;
        }
        case "minimal": {
            printMinimal(result.findings, root);

            break;
        }
        case "sarif": {
            process.stdout.write(emitSarif({
                runs: runs.map((run) => {
                    return {
                        adapter: run.adapter.id,
                        findings: run.findings,
                        presence: jobs.find((job) => job.adapter.id === run.adapter.id)?.presence,
                    };
                }),
                workspaceRoot: root,
            }));

            break;
        }
        default: {
            printHuman(result.findings, root, mode, logger);
        }
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
