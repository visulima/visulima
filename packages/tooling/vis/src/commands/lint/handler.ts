import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";

import { resolveSharedCacheDirectory } from "../../cache/cache-directory";
import { biomeAdapter } from "../../lint-fmt/adapters/biome";
import { denoLintAdapter } from "../../lint-fmt/adapters/deno";
import { eslintAdapter } from "../../lint-fmt/adapters/eslint";
import { oxlintAdapter } from "../../lint-fmt/adapters/oxlint";
import { stylelintAdapter } from "../../lint-fmt/adapters/stylelint";
import type { AdapterRunOptions, Finding } from "../../lint-fmt/config-types";
import { detectAdapters } from "../../lint-fmt/detect";
import { changedFilesSince, filterByExtensions, stagedFiles } from "../../lint-fmt/diff";
import { adaptersByKind, registerAdapters } from "../../lint-fmt/registry";
import { emitJUnit } from "../../lint-fmt/reporters/junit";
import { emitSarif } from "../../lint-fmt/reporters/sarif";
import { aggregate, exitCodeFor, groupFindingsByFile } from "../../lint-fmt/results";
import type { AdapterJob } from "../../lint-fmt/runner";
import { runAdaptersParallel } from "../../lint-fmt/runner";
import type { LintOptions } from "./index";

const SOURCE_ADAPTERS = [oxlintAdapter, biomeAdapter, eslintAdapter, stylelintAdapter, denoLintAdapter];

const execute = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, LintOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();
    const lintConfig = visConfig?.lint;
    const adapters = registerAdapters(SOURCE_ADAPTERS, lintConfig?.order);
    const detected = detectAdapters(root, adapters);
    const allEligible = adaptersByKind(detected, adapters, "lint");
    const eligible = allEligible.filter(({ adapter }) => lintConfig?.adapters?.[adapter.id]?.enabled !== false);

    if (eligible.length === 0) {
        logger.warn("vis lint: no linter detected in this workspace (looked for: oxlint, biome, eslint, stylelint, deno).");

        return;
    }

    const baseExtraArgs = (adapterId: AdapterJob["adapter"]["id"]): string[] | undefined => {
        const extra = lintConfig?.adapters?.[adapterId]?.extraArgs;

        return extra && extra.length > 0 ? [...extra] : undefined;
    };

    const runOptions: AdapterRunOptions = {
        extraArgs: undefined,
        maxWarnings: typeof options.maxWarnings === "number" ? options.maxWarnings : undefined,
        quiet: options.quiet ?? false,
    };

    const positional = collectPositional(options);
    const mode: "check" | "fix" = options.fix ? "fix" : "check";

    let sinceFiles: string[] | undefined;

    if (options.staged) {
        sinceFiles = stagedFiles(root);

        if (sinceFiles === undefined) {
            logger.warn("vis lint: could not resolve --staged (not a git repo or git unavailable). Falling back to a workspace-wide run.");
        } else if (sinceFiles.length === 0) {
            logger.info(green("✓ lint: no staged files"));

            return;
        }
    } else if (typeof options.since === "string" && options.since.length > 0) {
        sinceFiles = changedFilesSince(root, options.since);

        if (sinceFiles === undefined) {
            logger.warn(`vis lint: could not resolve --since ${options.since} (not a git repo or unknown ref). Falling back to a workspace-wide run.`);
        } else if (sinceFiles.length === 0) {
            logger.info(green(`✓ lint: no files changed since ${options.since}`));

            return;
        }
    }

    const positionalFiles: string[] | undefined = positional.length > 0 ? positional : undefined;
    const filterChangedToAdapter = sinceFiles !== undefined && sinceFiles.length > 0 && positionalFiles === undefined;

    const jobs: AdapterJob[] = [];

    for (const { adapter, presence } of eligible) {
        let files: string[];

        if (filterChangedToAdapter) {
            files = filterByExtensions(sinceFiles!, adapter.extensions);

            if (files.length === 0) {
                continue;
            }
        } else {
            files = positionalFiles ?? ["."];
        }

        const extra = baseExtraArgs(adapter.id);
        const job: AdapterJob = { adapter, files, presence };

        if (extra) {
            job.options = { ...runOptions, extraArgs: extra };
        }

        jobs.push(job);
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
            process.stdout.write(`${JSON.stringify({ findings: result.findings, runs: result.runs }, null, 2)}\n`);

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
            printHuman(result.findings, root, logger);
        }
    }

    const exitCode = exitCodeFor(result);

    if (exitCode !== 0) {
        process.exitCode = exitCode;
    }
};

const collectPositional = (options: LintOptions): string[] => {
    // cerebro stuffs positional args under the `_` key on the parsed options
    // bag. Keep this defensive — older cerebro versions sometimes emit `args`.
    const bag = options as unknown as { _?: ReadonlyArray<string>; args?: ReadonlyArray<string> };

    return [...(bag._ ?? bag.args ?? [])];
};

const printHuman = (findings: ReadonlyArray<Finding>, root: string, logger: Toolbox["logger"]): void => {
    if (findings.length === 0) {
        logger.info(green("✓ lint: no findings"));

        return;
    }

    const grouped = groupFindingsByFile(findings);

    for (const [file, fileFindings] of grouped) {
        logger.info(bold(relative(root, file)));

        for (const finding of fileFindings) {
            const location = formatLocation(finding);
            const severityChip = severityChipFor(finding.severity);
            const rule = finding.ruleId ? dim(`  ${finding.ruleId}`) : "";

            logger.info(`  ${dim(location)} ${severityChip} ${finding.message}${rule}`);
        }
    }

    const errorCount = findings.filter((f) => f.severity === "error").length;
    const warningCount = findings.filter((f) => f.severity === "warning").length;

    logger.info("");
    logger.info(`${red(`${String(errorCount)} error${errorCount === 1 ? "" : "s"}`)}, ${yellow(`${String(warningCount)} warning${warningCount === 1 ? "" : "s"}`)}`);
};

const printMinimal = (findings: ReadonlyArray<Finding>, root: string): void => {
    for (const finding of findings) {
        const file = relative(root, finding.file);
        const line = finding.line ?? "";
        const col = finding.column ?? "";

        process.stdout.write(`${finding.adapter}\t${file}\t${String(line)}\t${String(col)}\t${finding.severity}\t${finding.ruleId ?? ""}\t${finding.message}\n`);
    }
};

const formatLocation = (finding: Finding): string => {
    if (finding.line === undefined) {
        return "";
    }

    if (finding.column === undefined) {
        return String(finding.line);
    }

    return `${String(finding.line)}:${String(finding.column)}`;
};

const severityChipFor = (severity: Finding["severity"]): string => {
    if (severity === "error") {
        return red("error");
    }

    if (severity === "warning") {
        return yellow("warn ");
    }

    return cyan("info ");
};

export default execute as CommandExecute<Toolbox>;
