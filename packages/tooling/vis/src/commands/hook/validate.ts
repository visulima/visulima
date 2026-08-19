import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { cwd } from "node:process";

import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { HOOK_CONFIG_FILENAME, loadHookConfig } from "./config";
import { HOOKS } from "./constants";
import { dispatcherDirectories } from "./install";

/* eslint-disable no-bitwise -- Unix mode bits need bit-level masking. */
interface ValidationIssue {
    kind: "error" | "warning";
    message: string;
    path?: string;
}

interface ValidationResult {
    issues: ValidationIssue[];
    ok: boolean;
}

const STAGE_SET = new Set<string>(HOOKS);

const runSyntaxCheck = (scriptPath: string): string | undefined => {
    const result = spawnSync("sh", ["-n", scriptPath], { encoding: "utf8" });

    if (result.status === null) {
        return `failed to run "sh -n" (${result.error?.message ?? "unknown error"})`;
    }

    if (result.status !== 0) {
        return result.stderr.trim() || `sh -n exited with ${result.status}`;
    }

    return undefined;
};

const validateHooks = (root: string, hooksDirectory: string): ValidationResult => {
    const issues: ValidationIssue[] = [];
    const directory = join(root, hooksDirectory);

    // core.hooksPath sanity
    const configResult = spawnSync("git", ["config", "--local", "core.hooksPath"], { cwd: root, encoding: "utf8" });
    const expectedSuffix = `${hooksDirectory}/_`;
    const configured = configResult.status === 0 ? configResult.stdout.trim() : "";

    if (!configured) {
        issues.push({ kind: "warning", message: "core.hooksPath is not set — run `vis hook install`." });
    } else if (configured !== expectedSuffix && !configured.endsWith(`/${expectedSuffix}`)) {
        // A leading checkout prefix is expected — `core.hooksPath` is relative
        // to a checkout root, and install anchors it wherever it was run from.
        issues.push({ kind: "warning", message: `core.hooksPath is "${configured}" — expected "${expectedSuffix}". Re-run \`vis hook install\` to fix.` });
    }

    // The dispatcher is generated and gitignored, so every checkout needs its
    // own. A linked worktree without one runs no hooks — silently, exit 0 —
    // and nothing else in the toolchain reports it. Resolved through the same
    // helper install writes with, so the two cannot disagree about the path.
    const target = configured || expectedSuffix;
    const topLevelResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" });
    const topLevel = topLevelResult.status === 0 && topLevelResult.stdout.trim() ? topLevelResult.stdout.trim() : root;
    const currentDispatcher = join(topLevel, target);

    for (const dispatcher of dispatcherDirectories(target, topLevel)) {
        if (isAccessibleSync(dispatcher)) {
            continue;
        }

        if (dispatcher === currentDispatcher) {
            issues.push({ kind: "error", message: `Dispatcher directory ${target} is missing. Run \`vis hook install\`.` });
        } else {
            // Only a warning: transient worktrees are normal, and a repo-wide
            // non-zero exit for one of them would make validate useless as a gate.
            issues.push({ kind: "warning", message: `Worktree ${dispatcher} is missing — git runs no hooks there. Run \`vis hook install\` in that worktree.` });
        }
    }

    if (!isAccessibleSync(directory)) {
        issues.push({ kind: "error", message: `Hooks directory ${hooksDirectory}/ is missing.` });

        return { issues, ok: false };
    }

    let sawStageScript = false;

    for (const entry of readdirSync(directory)) {
        if (entry.startsWith(".") || entry === "_" || entry === HOOK_CONFIG_FILENAME || entry === "README.md") {
            continue;
        }

        if (!STAGE_SET.has(entry)) {
            issues.push({ kind: "warning", message: `Unknown hook "${entry}" — not a standard git hook.`, path: join(hooksDirectory, entry) });
            continue;
        }

        const stagePath = join(directory, entry);

        if (!statSync(stagePath).isFile()) {
            continue;
        }

        sawStageScript = true;
        const mode = statSync(stagePath).mode & 0o777;

        if ((mode & 0o100) === 0) {
            issues.push({ kind: "warning", message: `Script is not owner-executable (mode ${mode.toString(8)}).`, path: join(hooksDirectory, entry) });
        }

        const syntaxError = runSyntaxCheck(stagePath);

        if (syntaxError) {
            issues.push({ kind: "error", message: `Shell syntax error: ${syntaxError}`, path: join(hooksDirectory, entry) });
        }
    }

    // config.json existence + schema sanity when stage scripts are present.
    if (sawStageScript) {
        const configPath = join(directory, HOOK_CONFIG_FILENAME);

        if (isAccessibleSync(configPath)) {
            try {
                loadHookConfig(root, hooksDirectory);
            } catch (error) {
                issues.push({
                    kind: "error",
                    message: `${HOOK_CONFIG_FILENAME} is malformed: ${error instanceof Error ? error.message : String(error)}`,
                    path: join(hooksDirectory, HOOK_CONFIG_FILENAME),
                });
            }
        } else {
            issues.push({
                kind: "error",
                message: `Stage scripts are present but ${hooksDirectory}/${HOOK_CONFIG_FILENAME} is missing. Re-run \`vis hook migrate\`.`,
            });
        }
    }

    return { issues, ok: !issues.some((issue) => issue.kind === "error") };
};

const formatValidationResult = (result: ValidationResult, hooksDirectory: string): string[] => {
    if (result.issues.length === 0) {
        return [`Hook directory ${hooksDirectory}/ looks good.`];
    }

    const lines: string[] = [];

    for (const issue of result.issues) {
        const prefix = issue.kind === "error" ? "ERROR" : "WARN ";
        const pathSuffix = issue.path ? ` (${issue.path})` : "";

        lines.push(`${prefix} ${issue.message}${pathSuffix}`);
    }

    lines.push("", result.ok ? "No errors — warnings only." : `${result.issues.filter((i) => i.kind === "error").length} error(s).`);

    return lines;
};

const runValidate = (hooksDirectory: string, logger: { info: (message: string) => void; warn: (message: string) => void }): void => {
    const result = validateHooks(cwd(), hooksDirectory);
    const lines = formatValidationResult(result, hooksDirectory);

    for (const line of lines) {
        if (line.startsWith("ERROR") || line.startsWith("WARN")) {
            logger.warn(line);
        } else {
            logger.info(line);
        }
    }

    if (!result.ok) {
        throw new Error("Hook validation failed");
    }
};

export type { ValidationIssue, ValidationResult };
export { formatValidationResult, runValidate, validateHooks };
