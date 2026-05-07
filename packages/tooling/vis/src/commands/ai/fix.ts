import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { relative } from "@visulima/path";

import type { AiConfig } from "../../ai/ai-analysis";
import { aggregateFailureContext } from "../../ai/ai-failure-context";
import type { FixProposal, PatchResult } from "../../ai/ai-fix";
import { applyFixProposal, resolvePatchPath, runFixAnalysis } from "../../ai/ai-fix";
import { pail } from "../../io/logger";
import { listFailureLogs } from "../../report/failure-log";
import type { AiFixOptions } from "./index";

const PATCH_STATUS_LABEL: Record<PatchResult["status"], string> = {
    "ambiguous-match": "ambiguous match",
    applied: "applied",
    error: "error",
    "missing-file": "missing file",
    "no-match": "no match",
    "outside-workspace": "outside workspace",
};

const formatDisplayPath = (workspaceRoot: string, cwd: string | undefined, file: string): string => {
    const absolute = resolvePatchPath(workspaceRoot, cwd, file);
    const rel = relative(workspaceRoot, absolute);

    return rel === "" || rel.startsWith("..") ? absolute : rel;
};

const formatProposalText = (proposal: FixProposal, workspaceRoot: string, cwd: string | undefined): string => {
    const lines: string[] = [
        bold(`Fix proposal (${proposal.provider}, confidence: ${proposal.confidence})`),
        "",
        proposal.explanation || dim("<no explanation>"),
    ];

    if (proposal.cannotFix) {
        lines.push("");
        lines.push(yellow(`Cannot fix automatically: ${proposal.cannotFix}`));

        return lines.join("\n");
    }

    if (proposal.patches.length === 0) {
        lines.push("");
        lines.push(yellow("No patches were proposed."));

        return lines.join("\n");
    }

    lines.push("");
    lines.push(bold(`Patches (${String(proposal.patches.length)}):`));

    for (const [index, patch] of proposal.patches.entries()) {
        const displayPath = formatDisplayPath(workspaceRoot, cwd, patch.file);

        lines.push("");
        lines.push(cyan(`[${String(index + 1)}] ${displayPath}`));

        if (patch.reason) {
            lines.push(dim(`    reason: ${patch.reason}`));
        }

        for (const line of patch.oldString.split("\n")) {
            lines.push(red(`  - ${line}`));
        }

        for (const line of patch.newString.split("\n")) {
            lines.push(green(`  + ${line}`));
        }
    }

    return lines.join("\n");
};

const formatPatchResultsText = (results: PatchResult[], workspaceRoot: string, cwd: string | undefined): string => {
    const lines: string[] = [];

    for (const result of results) {
        const displayPath = result.absolutePath
            ? relative(workspaceRoot, result.absolutePath) || result.absolutePath
            : formatDisplayPath(workspaceRoot, cwd, result.patch.file);
        const label = PATCH_STATUS_LABEL[result.status];

        if (result.status === "applied") {
            lines.push(green(`  ✓ ${displayPath}: ${label}`));
        } else {
            lines.push(red(`  ✗ ${displayPath}: ${label}${result.error ? ` (${result.error})` : ""}`));
        }
    }

    return lines.join("\n");
};

const summarizePatchResults = (results: PatchResult[]): { applied: number; failed: number } => {
    let applied = 0;
    let failed = 0;

    for (const result of results) {
        if (result.status === "applied") {
            applied += 1;
        } else {
            failed += 1;
        }
    }

    return { applied, failed };
};

const confirmPrompt = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr });

        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            resolve(trimmed === "y" || trimmed === "yes");
        });
    });

const resolveWorkspaceRoot = (workspaceRoot: string | undefined): string => workspaceRoot ?? process.cwd();

export const aiFix: CommandExecute<Toolbox<Console, AiFixOptions>> = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
    const taskId = argument[0];

    const workspaceRoot = resolveWorkspaceRoot(wsRoot);
    const format = options.format ?? "text";
    const isJson = format === "json";

    if (!taskId) {
        if (isJson) {
            const available = listFailureLogs(workspaceRoot);

            process.stdout.write(`${JSON.stringify({ availableTasks: available, error: "No task ID specified" }, undefined, 2)}\n`);
        } else {
            pail.error("No task ID specified. Usage: vis ai fix <project>:<target>");

            const available = listFailureLogs(workspaceRoot);

            if (available.length > 0) {
                pail.info("Tasks with captured failure logs:");

                for (const id of available) {
                    pail.info(`  - ${id}`);
                }
            } else {
                pail.notice("No failure logs found. Re-run a failing task with `vis run` to capture logs.");
            }
        }

        process.exitCode = 1;

        return;
    }

    const failureContext = await aggregateFailureContext(workspaceRoot, taskId, { runId: options.run });

    if (!failureContext) {
        if (isJson) {
            process.stdout.write(`${JSON.stringify({ error: "No failure log or run summary found", taskId }, undefined, 2)}\n`);
        } else {
            pail.error(`No failure log or run summary found for task "${taskId}".`);
            pail.notice("Re-run the task with `vis run` so its terminal output and run metadata are captured.");
        }

        process.exitCode = 1;

        return;
    }

    if (!failureContext.terminalOutputCaptured) {
        pail.warn(`No captured terminal output for "${taskId}". Re-run with \`vis run\` for a better fix proposal.`);
    }

    const aiConfig: AiConfig | undefined = visConfig?.ai;
    const proposal = await runFixAnalysis(failureContext, logger, {
        cache: (options as Record<string, unknown>).cache !== false,
        config: aiConfig,
    });

    if (!proposal) {
        if (isJson) {
            process.stdout.write(`${JSON.stringify({ error: "AI fix proposal failed or no provider available", taskId }, undefined, 2)}\n`);
        }

        process.exitCode = 1;

        return;
    }

    const apply = options.apply === true;

    if (isJson) {
        const dryRunResults = apply ? undefined : await applyFixProposal(workspaceRoot, failureContext.cwd, proposal, { dryRun: true });
        const appliedResults = apply ? await applyFixProposal(workspaceRoot, failureContext.cwd, proposal) : undefined;

        process.stdout.write(
            `${JSON.stringify(
                {
                    appliedResults,
                    dryRunResults,
                    failureContext: {
                        cwd: failureContext.cwd,
                        hash: failureContext.hash,
                        runId: failureContext.runId,
                        taskId: failureContext.taskId,
                        terminalOutputCaptured: failureContext.terminalOutputCaptured,
                    },
                    proposal,
                },
                undefined,
                2,
            )}\n`,
        );

        if (apply && appliedResults) {
            const { failed } = summarizePatchResults(appliedResults);

            if (failed > 0) {
                process.exitCode = 1;
            }
        }

        return;
    }

    logger.info(formatProposalText(proposal, workspaceRoot, failureContext.cwd));

    if (proposal.cannotFix || proposal.patches.length === 0) {
        return;
    }

    const dryRunResults = await applyFixProposal(workspaceRoot, failureContext.cwd, proposal, { dryRun: true });
    const dryRunSummary = summarizePatchResults(dryRunResults);

    logger.info("");
    logger.info(bold("Patch validation:"));
    logger.info(formatPatchResultsText(dryRunResults, workspaceRoot, failureContext.cwd));

    if (!apply) {
        logger.info("");
        pail.info("Re-run with --apply to write these patches to disk.");

        return;
    }

    if (dryRunSummary.applied === 0) {
        pail.error("No patches can be applied (every patch failed validation).");
        process.exitCode = 1;

        return;
    }

    if (options.yes !== true) {
        logger.info("");

        const confirmed = await confirmPrompt(`Apply ${String(dryRunSummary.applied)} patch${dryRunSummary.applied === 1 ? "" : "es"} to disk?`);

        if (!confirmed) {
            pail.notice("Aborted. Nothing written.");

            return;
        }
    }

    const applyResults = await applyFixProposal(workspaceRoot, failureContext.cwd, proposal);
    const applySummary = summarizePatchResults(applyResults);

    logger.info("");
    logger.info(bold("Apply results:"));
    logger.info(formatPatchResultsText(applyResults, workspaceRoot, failureContext.cwd));
    logger.info("");

    if (applySummary.failed === 0) {
        pail.success(`Applied ${String(applySummary.applied)} patch${applySummary.applied === 1 ? "" : "es"}.`);
    } else {
        pail.warn(`${String(applySummary.applied)} applied, ${String(applySummary.failed)} failed.`);
        process.exitCode = 1;
    }
};

export default aiFix;
