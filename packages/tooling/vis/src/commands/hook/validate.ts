import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { cwd } from "node:process";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { HOOKS } from "./constants";
import { PREK_RUNNER_FILENAME } from "./prek-builtins";

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

const runNodeCheck = (scriptPath: string): string | undefined => {
    const result = spawnSync("node", ["--check", scriptPath], { encoding: "utf8" });

    if (result.status === null) {
        return `failed to run "node --check" (${result.error?.message ?? "unknown error"})`;
    }

    if (result.status !== 0) {
        return result.stderr.trim() || `node --check exited with ${result.status}`;
    }

    return undefined;
};

const validateHooks = (root: string, hooksDirectory: string): ValidationResult => {
    const issues: ValidationIssue[] = [];
    const directory = join(root, hooksDirectory);

    // core.hooksPath sanity
    const configResult = spawnSync("git", ["config", "--local", "core.hooksPath"], { cwd: root, encoding: "utf8" });

    if (configResult.status === 0) {
        const current = configResult.stdout.trim();
        const expected = `${hooksDirectory}/_`;

        if (current && current !== expected) {
            issues.push({ kind: "warning", message: `core.hooksPath is "${current}" — expected "${expected}". Re-run \`vis hook install\` to fix.` });
        }
    } else {
        issues.push({ kind: "warning", message: "core.hooksPath is not set — run `vis hook install`." });
    }

    // dispatcher directory
    if (!isAccessibleSync(join(directory, "_"))) {
        issues.push({ kind: "error", message: `Dispatcher directory ${hooksDirectory}/_ is missing. Run \`vis hook install\`.` });
    }

    if (!isAccessibleSync(directory)) {
        issues.push({ kind: "error", message: `Hooks directory ${hooksDirectory}/ is missing.` });

        return { issues, ok: false };
    }

    let referencesRunner = false;

    for (const entry of readdirSync(directory)) {
        if (entry.startsWith(".") || entry === "_") {
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

        const mode = statSync(stagePath).mode & 0o777;

        if ((mode & 0o100) === 0) {
            issues.push({ kind: "warning", message: `Script is not owner-executable (mode ${mode.toString(8)}).`, path: join(hooksDirectory, entry) });
        }

        const syntaxError = runSyntaxCheck(stagePath);

        if (syntaxError) {
            issues.push({ kind: "error", message: `Shell syntax error: ${syntaxError}`, path: join(hooksDirectory, entry) });
        }

        const content: string = readFileSync(stagePath);

        if (content.includes(`/.builtins/${PREK_RUNNER_FILENAME}`)) {
            referencesRunner = true;
        }
    }

    // prek-runner.mjs existence + syntax when referenced
    if (referencesRunner) {
        const runnerPath = join(directory, ".builtins", PREK_RUNNER_FILENAME);

        if (isAccessibleSync(runnerPath)) {
            const runnerError = runNodeCheck(runnerPath);

            if (runnerError) {
                issues.push({ kind: "error", message: `prek-runner.mjs has a syntax error: ${runnerError}`, path: join(hooksDirectory, ".builtins", PREK_RUNNER_FILENAME) });
            }
        } else {
            issues.push({ kind: "error", message: `Hook scripts reference ${hooksDirectory}/.builtins/${PREK_RUNNER_FILENAME} but the file is missing. Re-run \`vis hook migrate\`.` });
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
