/**
 * `vis docker lint` — Dockerfile linting via hadolint.
 *
 * Detection is delegated to the hadolint binary (downloaded on demand,
 * see {@link "../../util/hadolint"}). `--fix` additionally applies the
 * safe line-precise autofixers in {@link "../../util/hadolint/fixers"}
 * and re-runs hadolint to report what remains.
 */

import type { CerebroFs } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { isAccessibleSync } from "@visulima/fs";
import { isAbsolute, join } from "@visulima/path";

import type { HadolintFinding } from "../../util/hadolint";
import { ensureHadolint, runHadolint } from "../../util/hadolint";
import { applyFixers, AUTOFIXABLE_CODES } from "../../util/hadolint/fixers";

const LEVEL_RANK: Record<HadolintFinding["level"], number> = { error: 0, info: 2, style: 3, warning: 1 };

const colorForLevel = (level: HadolintFinding["level"], text: string): string => {
    switch (level) {
        case "error": {
            return red(text);
        }
        case "info": {
            return cyan(text);
        }
        case "warning": {
            return yellow(text);
        }
        default: {
            return dim(text);
        }
    }
};

export interface DockerLintInput {
    /** Skip the install prompt and download hadolint if missing. */
    autoInstall: boolean;
    /** Optional explicit `.hadolint.yaml` path. */
    configPath?: string;
    /** Directory used to resolve a relative Dockerfile and default lookups. */
    cwd: string;
    /** Explicit Dockerfile path(s); empty → default `Dockerfile` in cwd. */
    files: string[];
    /** Apply safe autofixers, then re-lint. */
    fix: boolean;
    /** Filesystem adapter from the command toolbox. */
    fs: CerebroFs;
    /** Emit JSON instead of human output. */
    json: boolean;
    logger: Pick<Console, "error" | "info">;
}

/**
 * Resolves the Dockerfiles to lint. Explicit paths win; otherwise we look
 * for a `Dockerfile` in {@link DockerLintInput.cwd}.
 */
const resolveFiles = (files: string[], cwd: string): string[] => {
    const candidates = files.length > 0 ? files : ["Dockerfile"];

    return candidates.map((file) => (isAbsolute(file) ? file : join(cwd, file))).filter((file) => isAccessibleSync(file));
};

const renderFindings = (findings: HadolintFinding[], logger: Pick<Console, "error" | "info">): void => {
    const sorted = [...findings].sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || LEVEL_RANK[a.level] - LEVEL_RANK[b.level],
    );

    let currentFile = "";

    for (const finding of sorted) {
        if (finding.file !== currentFile) {
            currentFile = finding.file;
            logger.info(`\n${bold(currentFile)}`);
        }

        const location = dim(`${String(finding.line)}:${String(finding.column)}`);
        const level = colorForLevel(finding.level, finding.level.padEnd(7));
        const fixable = AUTOFIXABLE_CODES.has(finding.code) ? dim(" (fixable)") : "";

        logger.info(`  ${location}  ${level}  ${cyan(finding.code)}  ${finding.message}${fixable}`);
    }
};

const summarize = (findings: HadolintFinding[]): Record<HadolintFinding["level"], number> => {
    const counts: Record<HadolintFinding["level"], number> = { error: 0, info: 0, style: 0, warning: 0 };

    for (const finding of findings) {
        counts[finding.level] += 1;
    }

    return counts;
};

/**
 * Runs the lint flow. Returns the process exit code the caller should set
 * (1 when error-level findings remain, else 0).
 * @param input Lint configuration.
 */
export const runDockerLint = async (input: DockerLintInput): Promise<number> => {
    const { autoInstall, configPath, cwd, files, fix, fs, json, logger } = input;

    const targets = resolveFiles(files, cwd);

    if (targets.length === 0) {
        logger.error(`No Dockerfile found${files.length > 0 ? ` at: ${files.join(", ")}` : ` in ${cwd}`}. Pass a path: vis docker lint <path>`);

        return 1;
    }

    const binary = await ensureHadolint({
        autoInstall,
        log: (message) => {
            logger.info(message);
        },
    });

    if (binary === undefined) {
        // hadolint unavailable and the user declined — not a hard failure.
        return 0;
    }

    let findings = await runHadolint(binary, targets, configPath);

    let fixedCount = 0;

    if (fix && findings.length > 0) {
        for (const file of targets) {
            const fileFindings = findings.filter((finding) => finding.file === file);
            const original = await fs.readFile(file, "utf8");
            const result = applyFixers(original, fileFindings);

            if (result.fixedCount > 0) {
                await fs.writeFile(file, result.content);
                fixedCount += result.fixedCount;
            }
        }

        if (fixedCount > 0) {
            // Re-lint so reported findings reflect the rewritten files.
            findings = await runHadolint(binary, targets, configPath);
        }
    }

    if (json) {
        process.stdout.write(`${JSON.stringify({ findings, fixed: fixedCount }, null, 2)}\n`);

        return findings.some((finding) => finding.level === "error") ? 1 : 0;
    }

    if (fix && fixedCount > 0) {
        logger.info(green(`✔ Auto-fixed ${String(fixedCount)} issue${fixedCount === 1 ? "" : "s"}.`));
    }

    if (findings.length === 0) {
        logger.info(green("✔ No Dockerfile issues found."));

        return 0;
    }

    renderFindings(findings, logger);

    const counts = summarize(findings);
    const remainingFixable = findings.filter((finding) => AUTOFIXABLE_CODES.has(finding.code)).length;

    logger.info(
        `\n${bold(String(findings.length))} issue${findings.length === 1 ? "" : "s"}: ${red(`${String(counts.error)} error`)}, ${yellow(`${String(counts.warning)} warning`)}, ${cyan(`${String(counts.info)} info`)}, ${dim(`${String(counts.style)} style`)}`,
    );

    if (!fix && remainingFixable > 0) {
        logger.info(dim(`Run 'vis docker lint --fix' to auto-fix ${String(remainingFixable)} of them.`));
    }

    return counts.error > 0 ? 1 : 0;
};
