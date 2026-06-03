/**
 * Line-precise autofixers for `vis docker lint --fix`.
 *
 * hadolint is detection-only — it cannot rewrite a Dockerfile. For the
 * subset of rules whose fix is a purely mechanical, single-line edit we
 * apply the change ourselves, anchored to the line number hadolint
 * reports. Anything requiring judgement (which version to pin, how to
 * merge RUN layers, where to insert a SHELL directive) is intentionally
 * NOT auto-fixed and stays a reported finding.
 *
 * A fixer receives the offending line and returns the rewritten line, or
 * `undefined` when it does not apply (so the finding stays reported).
 */

import type { HadolintFinding } from "./index";

type LineFixer = (line: string) => string | undefined;

/** Insert `flag` immediately after the `apt-get install` token on a line. */
const addAptGetInstallFlag = (line: string, flag: string, present: RegExp): string | undefined => {
    if (!/\bapt-get\b/u.test(line) || !/\binstall\b/u.test(line) || present.test(line)) {
        return undefined;
    }

    return line.replace(/\binstall\b/u, `install ${flag}`);
};

/**
 * Registry of safe, mechanical fixers keyed by hadolint pattern id. Order
 * within a line is registry-insertion order, so multiple findings on the
 * same line compose (e.g. DL3014 + DL3015 on one `apt-get install`).
 */
const FIXERS: Record<string, LineFixer> = {
    // Pin `-y` so installs are non-interactive.
    DL3014: (line) => addAptGetInstallFlag(line, "-y", /(?:^|\s)(?:-y|--yes|--assume-yes|-qq?)\b/u),

    // Avoid recommended-but-unneeded packages.
    DL3015: (line) => addAptGetInstallFlag(line, "--no-install-recommends", /--no-install-recommends\b/u),

    // Prefer COPY over ADD for plain files/dirs (hadolint already ruled out URLs/archives).
    DL3020: (line) => (/^\s*ADD\b/u.test(line) ? line.replace(/^(\s*)ADD\b/u, "$1COPY") : undefined),

    // Use `apt-get` (stable CLI) instead of `apt` (interactive-oriented).
    DL3027: (line) => (/(?:^|\s)apt\s/u.test(line) && !/\bapt-get\b/u.test(line) ? line.replace(/(^|\s)apt(\s)/u, "$1apt-get$2") : undefined),
};

/** The set of pattern ids this module can auto-fix. */
export const AUTOFIXABLE_CODES: ReadonlySet<string> = new Set(Object.keys(FIXERS));

export interface ApplyFixersResult {
    /** Rewritten file content (unchanged when nothing applied). */
    content: string;
    /** Pattern ids that were applied at least once. */
    fixedCodes: string[];
    /** Number of individual findings resolved. */
    fixedCount: number;
}

/**
 * Applies the safe fixers to `content` for the given findings.
 * @param content Original Dockerfile text.
 * @param findings hadolint findings for that one file.
 * @returns The rewritten content plus a summary of what was fixed.
 */
export const applyFixers = (content: string, findings: HadolintFinding[]): ApplyFixersResult => {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(/\r?\n/u);

    const fixedCodes = new Set<string>();
    let fixedCount = 0;

    // Group fixable findings by 1-based line so same-line fixers compose.
    const byLine = new Map<number, HadolintFinding[]>();

    for (const finding of findings) {
        if (!FIXERS[finding.code]) {
            continue;
        }

        const bucket = byLine.get(finding.line) ?? [];

        bucket.push(finding);
        byLine.set(finding.line, bucket);
    }

    for (const [lineNumber, lineFindings] of byLine) {
        const index = lineNumber - 1;

        if (index < 0 || index >= lines.length) {
            continue;
        }

        for (const finding of lineFindings) {
            const fixer = FIXERS[finding.code];
            const next = fixer?.(lines[index] ?? "");

            if (next !== undefined && next !== lines[index]) {
                lines[index] = next;
                fixedCodes.add(finding.code);
                fixedCount += 1;
            }
        }
    }

    return {
        content: fixedCount > 0 ? lines.join(eol) : content,
        fixedCodes: [...fixedCodes],
        fixedCount,
    };
};
