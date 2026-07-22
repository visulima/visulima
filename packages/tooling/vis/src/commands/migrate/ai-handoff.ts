import { stdin, stdout } from "node:process";

import { runInteractiveHandoff } from "../../ai/ai-runner";
import { resolveProvider } from "../../ai/provider-resolver";
import { confirm } from "./prompt";
import type { MigrationReport } from "./types";

interface HandoffLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface HandoffOptions {
    /** When false (via `--no-ai`), the handoff is never offered. Defaults to true. */
    ai?: boolean;
    /** Never touch anything in a dry-run. */
    dryRun?: boolean;
}

/**
 * Build the instruction prompt for the AI CLI. It lists every remaining manual
 * step and the migration warnings (which carry translated config blocks the AI
 * can apply), and tells the CLI to make the smallest safe change per step.
 */
export const buildMigrationHandoffPrompt = (report: MigrationReport, root: string): string => {
    const steps = report.manualSteps.map((step, index) => `${String(index + 1)}. ${step}`).join("\n");
    const warnings = report.warnings.map((warning) => `- ${warning}`).join("\n");

    return [
        `You are finishing a migration to the \`vis\` workflow CLI (@visulima/vis) in the repository at ${root}.`,
        "An automated `vis migrate` run just completed but left some steps that could not be done statically.",
        "Complete the remaining steps below by editing the repository files directly. Be conservative: make the",
        "smallest change that satisfies each step, preserve existing formatting, and do not touch anything",
        "unrelated to the migration. If a step is ambiguous or looks unsafe, skip it and say why.",
        "",
        "Remaining manual steps:",
        steps || "(none)",
        warnings ? `\nMigration warnings (context — some contain translated config blocks to apply):\n${warnings}` : "",
        "",
        "When you are done, briefly summarise what you changed and anything you deliberately skipped.",
    ]
        .filter(Boolean)
        .join("\n");
};

/**
 * After a migration, offer to hand the remaining manual steps to a detected AI
 * CLI (claude, gemini, codex, cursor, …) so it can finish them by editing
 * files — the way `react-doctor` hands off to an agent.
 *
 * Guardrails: only when there is leftover work, never in dry-run, never when
 * suppressed with `--no-ai`, and — importantly — never automatically in a
 * non-TTY context (CI). In a TTY the user is always asked before any files are
 * touched; declining prints the ready-to-paste prompt instead.
 * @param root Absolute workspace root (the CLI's working directory for edits).
 * @param report The completed migration report (manual steps + warnings).
 * @param options Handoff gating flags.
 * @param logger Logger for user feedback.
 */
export const maybeOfferAiHandoff = async (root: string, report: MigrationReport, options: HandoffOptions, logger: HandoffLogger): Promise<void> => {
    if (options.dryRun || options.ai === false) {
        return;
    }

    if (report.manualSteps.length === 0 && report.warnings.length === 0) {
        return;
    }

    // Never auto-run an AI CLI in CI / piped contexts — it would hang or make
    // unattended edits the user never saw coming.
    if (!stdin.isTTY) {
        return;
    }

    const provider = resolveProvider();

    if (!provider) {
        logger.info("");
        logger.info("Tip: install a supported AI CLI (claude, gemini, codex, cursor, …) and re-run — vis can then finish the remaining manual steps for you.");

        return;
    }

    const prompt = buildMigrationHandoffPrompt(report, root);
    const stepCount = report.manualSteps.length;

    logger.info("");

    const proceed = await confirm(`Found ${provider.name}. Hand off ${String(stepCount)} remaining step(s) so it finishes the migration? It will edit files in ${root}.`);

    if (!proceed) {
        logger.info("");
        logger.info(`Skipped AI handoff. To finish these steps yourself, paste the following into ${provider.name} (or any AI CLI):`);
        logger.info("");
        logger.info(prompt);

        return;
    }

    logger.info("");
    logger.info(`Handing off to ${provider.name} — it will edit files to finish the migration...`);
    logger.info("");

    try {
        await runInteractiveHandoff(provider, prompt, {
            cwd: root,
            onStdout: (chunk) => {
                stdout.write(chunk);
            },
        });

        logger.info("");
        logger.info(`${provider.name} finished. Review the changes (and any .bak files) before committing.`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn("");
        logger.warn(`AI handoff failed (${message}). You can finish manually — here is the prompt:`);
        logger.warn("");
        logger.warn(prompt);
    }
};
