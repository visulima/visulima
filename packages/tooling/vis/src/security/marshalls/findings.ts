/**
 * Shared finding shape + aggregator for every marshall vis ships.
 *
 * Each per-marshall module (author, signatures, …) emits its own typed
 * finding shape, but every shape is mapped to {@link MarshallFinding}
 * before the `add` / `install` / `update` / `inspect` pipeline presents
 * them to the user. Two-layer design:
 *
 * 1. **Per-marshall finding** — typed, marshall-specific (`AuthorFinding`,
 *    `SignatureFinding`, etc.). Lives next to the marshall.
 * 2. **`MarshallFinding`** — the lossy, display-ready shape. Loses some
 *    structure but lets the command handlers and `decision-prompt.ts`
 *    treat all findings uniformly.
 *
 * The conversion lives at the call site (each marshall integration call
 * wraps its raw findings into `MarshallFinding`s). Keeping it there
 * — and not in this file — avoids an explosion of converter functions
 * here, and lets each marshall craft a tailored `message` string.
 */

import { red, yellow } from "@visulima/colorize";

import type { MarshallName } from "./registry";

export interface MarshallFinding {
    /** The marshall that produced the finding. Used for grouping + the disable-hint. */
    marshall: MarshallName;

    /**
     * Human-readable explanation, one line. Convention: include the failing
     * value where it helps (`"published 3 days ago (threshold: 7)"`) so the
     * line reads on its own without table context.
     */
    message: string;
    /** Package the finding applies to. `name` only — version (if relevant) goes in the message. */
    packageName: string;
    severity: "error" | "warning";

    /**
     * Optional one-liner with the next step the user can take to resolve
     * the finding — e.g. `"Add 'demo' to security.author.allowlist."`. Shown
     * indented under the finding in table output.
     */
    suggestedAction?: string;
}

/**
 * Mutable accumulator threaded through marshall calls in a single command.
 * Use the static helpers — instances aren't passed around as values.
 */
export class MarshallFindings {
    private readonly entries: MarshallFinding[] = [];

    add(finding: MarshallFinding): void {
        this.entries.push(finding);
    }

    addMany(findings: Iterable<MarshallFinding>): void {
        for (const finding of findings) {
            this.entries.push(finding);
        }
    }

    /** Read-only snapshot — callers must not mutate the array. */
    all(): ReadonlyArray<MarshallFinding> {
        return this.entries;
    }

    errors(): MarshallFinding[] {
        return this.entries.filter((entry) => entry.severity === "error");
    }

    warnings(): MarshallFinding[] {
        return this.entries.filter((entry) => entry.severity === "warning");
    }

    hasErrors(): boolean {
        return this.entries.some((entry) => entry.severity === "error");
    }

    hasWarnings(): boolean {
        return this.entries.some((entry) => entry.severity === "warning");
    }

    isEmpty(): boolean {
        return this.entries.length === 0;
    }

    size(): number {
        return this.entries.length;
    }
}

/**
 * Render findings as a compact, color-tinted plain-text table. One line per
 * finding, grouped by severity (errors first). Suggested actions show as an
 * indented continuation line under the parent finding.
 *
 * Lines are returned individually so callers can decide where to send them
 * (`pail.warn`, `pail.error`, file output, …). Lines do NOT include trailing
 * newlines.
 */
export const formatMarshallFindingsAsTable = (findings: ReadonlyArray<MarshallFinding>): string[] => {
    if (findings.length === 0) {
        return [];
    }

    const lines: string[] = [];
    const errors = findings.filter((finding) => finding.severity === "error");
    const warnings = findings.filter((finding) => finding.severity === "warning");

    if (errors.length > 0) {
        lines.push(red(`${String(errors.length)} error${errors.length === 1 ? "" : "s"}:`));

        for (const finding of errors) {
            lines.push(`  ${red("✗")} [${finding.marshall}] ${finding.packageName}: ${finding.message}`);

            if (finding.suggestedAction !== undefined) {
                lines.push(`     ${yellow("→")} ${finding.suggestedAction}`);
            }
        }
    }

    if (warnings.length > 0) {
        if (errors.length > 0) {
            lines.push("");
        }

        lines.push(yellow(`${String(warnings.length)} warning${warnings.length === 1 ? "" : "s"}:`));

        for (const finding of warnings) {
            lines.push(`  ${yellow("⚠")} [${finding.marshall}] ${finding.packageName}: ${finding.message}`);

            if (finding.suggestedAction !== undefined) {
                lines.push(`     ${yellow("→")} ${finding.suggestedAction}`);
            }
        }
    }

    return lines;
};

/**
 * Stable JSON representation for `vis inspect --json` and machine consumers.
 * Returns a plain object (not the formatted string) so callers can decide
 * indentation / streaming themselves.
 */
export const formatMarshallFindingsAsJson = (
    findings: ReadonlyArray<MarshallFinding>,
): { errors: MarshallFinding[]; findings: MarshallFinding[]; summary: { errorCount: number; warningCount: number }; warnings: MarshallFinding[] } => {
    return {
        errors: findings.filter((finding) => finding.severity === "error"),
        findings: [...findings],
        summary: {
            errorCount: findings.filter((finding) => finding.severity === "error").length,
            warningCount: findings.filter((finding) => finding.severity === "warning").length,
        },
        warnings: findings.filter((finding) => finding.severity === "warning"),
    };
};
