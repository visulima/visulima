import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";

import { biomeAdapter } from "../../lint-fmt/adapters/biome";
import { denoLintAdapter } from "../../lint-fmt/adapters/deno";
import { eslintAdapter } from "../../lint-fmt/adapters/eslint";
import { oxlintAdapter } from "../../lint-fmt/adapters/oxlint";
import { stylelintAdapter } from "../../lint-fmt/adapters/stylelint";
import type { AdapterRunOptions, Finding } from "../../lint-fmt/config-types";
import { detectAdapters } from "../../lint-fmt/detect";
import { adaptersByKind, registerAdapters } from "../../lint-fmt/registry";
import { aggregate, exitCodeFor, groupFindingsByFile } from "../../lint-fmt/results";
import { runAdapter } from "../../lint-fmt/runner";
import type { LintOptions } from "./index";

const SOURCE_ADAPTERS = [oxlintAdapter, biomeAdapter, eslintAdapter, stylelintAdapter, denoLintAdapter];

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, LintOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();
    const adapters = registerAdapters(SOURCE_ADAPTERS);
    const detected = detectAdapters(root, adapters);
    const eligible = adaptersByKind(detected, adapters, "lint");

    if (eligible.length === 0) {
        logger.warn("vis lint: no linter detected in this workspace (looked for: oxlint, biome, eslint, stylelint, deno).");

        return;
    }

    const runOptions: AdapterRunOptions = {
        extraArgs: undefined,
        maxWarnings: typeof options.maxWarnings === "number" ? options.maxWarnings : undefined,
        quiet: options.quiet ?? false,
    };

    const positional = collectPositional(options);
    const files: string[] = positional.length > 0 ? positional : ["."];
    const mode: "check" | "fix" = options.fix ? "fix" : "check";

    const runs: { adapter: typeof eligible[number]["adapter"]; durationMs: number; exitCode: number | null; findings: Finding[] }[] = [];

    for (const { adapter, presence } of eligible) {
        const raw = runAdapter(adapter, presence, files, runOptions, mode);
        const findings = adapter.parse(raw, presence);

        runs.push({ adapter, durationMs: raw.durationMs, exitCode: raw.exitCode, findings });
    }

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

    if (format === "json") {
        process.stdout.write(`${JSON.stringify({ findings: result.findings, runs: result.runs }, null, 2)}\n`);
    } else if (format === "minimal") {
        printMinimal(result.findings, root);
    } else {
        printHuman(result.findings, root, logger);
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
