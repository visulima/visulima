import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { delimiter } from "node:path";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { pail } from "../io/logger";

/**
 * Builds a child-process env where `node_modules/.bin` (and the per-package
 * `.bin` when running a dep hook) is prepended to PATH. Matches what real
 * package managers do before invoking lifecycle scripts so scripts like
 * `husky install` or `patch-package` can resolve their bins.
 */
const envWithBin = (...binDirs: string[]): NodeJS.ProcessEnv => {
    const env = { ...process.env };
    const existing = env.PATH ?? env.Path ?? "";
    const prefix = binDirs.filter((d) => d.length > 0).join(delimiter);

    env.PATH = prefix.length > 0 ? (existing ? `${prefix}${delimiter}${existing}` : prefix) : existing;

    return env;
};

/**
 * Strips a `@version` suffix from an allowlist key so the runner can
 * resolve the on-disk package directory. `foo@1.2.3` → `foo`,
 * `@scope/foo@1.2.3` → `@scope/foo`, `name@*` → `name`, bare names
 * unchanged. Wildcard patterns (ending in `*` without an explicit
 * version suffix) are passed through untouched for `expandPatterns`.
 */
const stripVersionSuffix = (key: string): string => {
    if (key.endsWith("*")) {
        return key.endsWith("@*") ? key.slice(0, -2) : key;
    }

    const isScoped = key.startsWith("@");
    const atIndex = key.indexOf("@", isScoped ? 1 : 0);

    return atIndex === -1 ? key : key.slice(0, atIndex);
};

/** Expands glob patterns against installed node_modules. */
const expandPatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const nodeModulesPath = join(workspaceRoot, "node_modules");
    const resolved: string[] = [];

    for (const pattern of patterns) {
        if (!pattern.endsWith("*")) {
            resolved.push(stripVersionSuffix(pattern));
            continue;
        }

        const prefix = pattern.slice(0, -1);

        try {
            if (prefix.startsWith("@") && prefix.endsWith("/")) {
                const scopeDir = join(nodeModulesPath, prefix.slice(0, -1));

                for (const entry of readdirSync(scopeDir)) {
                    if (!entry.startsWith(".") && statSync(join(scopeDir, entry)).isDirectory()) {
                        resolved.push(`${prefix.slice(0, -1)}/${entry}`);
                    }
                }
            } else {
                for (const entry of readdirSync(nodeModulesPath)) {
                    if (entry.startsWith(prefix) && statSync(join(nodeModulesPath, entry)).isDirectory()) {
                        resolved.push(entry);
                    }
                }
            }
        } catch {
            /* dir doesn't exist */
        }
    }

    return resolved;
};

/**
 * Runs postinstall scripts for approved packages after --ignore-scripts install.
 */
const runApprovedScripts = (workspaceRoot: string, patterns: string[]): void => {
    if (patterns.length === 0) {
        return;
    }

    const packages = expandPatterns(workspaceRoot, patterns);

    if (packages.length === 0) {
        return;
    }

    const nodeModulesPath = join(workspaceRoot, "node_modules");
    const workspaceBin = join(nodeModulesPath, ".bin");
    let hadFailure = false;

    for (const pkg of packages) {
        if (pkg.includes("..") || pkg.startsWith("/") || pkg.startsWith("\\")) {
            pail.warn(`Skipping invalid package name: ${pkg}`);
            continue;
        }

        const slashCount = (pkg.match(/\//g) ?? []).length;

        if (slashCount > 1 || (slashCount === 1 && !pkg.startsWith("@"))) {
            pail.warn(`Skipping invalid package name: ${pkg}`);
            continue;
        }

        const pkgDir = join(nodeModulesPath, pkg);
        const pkgJsonPath = join(pkgDir, "package.json");

        if (!isAccessibleSync(pkgJsonPath)) {
            continue;
        }

        try {
            const scripts = (readJsonSync(pkgJsonPath) as { scripts?: Record<string, string> }).scripts ?? {};
            const pkgBin = join(pkgDir, "node_modules", ".bin");
            const env = envWithBin(pkgBin, workspaceBin);

            for (const hook of ["preinstall", "install", "postinstall"] as const) {
                if (scripts[hook]) {
                    pail.info(`Running ${hook} for ${pkg}...`);

                    try {
                        const hookScript = scripts[hook];

                        // eslint-disable-next-line sonarjs/os-command -- install hook scripts are arbitrary shell strings authored by the package; the security policy already gates whether we run them
                        execSync(hookScript, { cwd: pkgDir, env, stdio: "inherit" });
                    } catch {
                        pail.error(`${hook} script failed for ${pkg}`);
                        hadFailure = true;
                    }
                }
            }
        } catch {
            /* skip unreadable */
        }
    }

    if (hadFailure) {
        process.exitCode = 1;
    }
};

/**
 * Runs lifecycle hooks declared on the workspace-root `package.json`.
 * LavaMoat's `allow-scripts run` executes the root's `prepublish` and
 * `prepare` after all dependency scripts so root-level build steps that
 * piggy-back on install (e.g. `husky install`, `patch-package`) still fire
 * even when the PM was invoked with `--ignore-scripts`.
 */
const runRootLifecycleScripts = (workspaceRoot: string, hooks: ReadonlyArray<string> = ["prepublish", "prepare"]): void => {
    const pkgJsonPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgJsonPath)) {
        return;
    }

    let scripts: Record<string, string>;

    try {
        scripts = (readJsonSync(pkgJsonPath) as { scripts?: Record<string, string> }).scripts ?? {};
    } catch {
        return;
    }

    let hadFailure = false;
    const env = envWithBin(join(workspaceRoot, "node_modules", ".bin"));

    for (const hook of hooks) {
        const command = scripts[hook];

        if (!command) {
            continue;
        }

        pail.info(`Running root ${hook}...`);

        try {
            // eslint-disable-next-line sonarjs/os-command -- root lifecycle scripts are authored by the workspace owner; running them here matches what `pnpm install` would do without --ignore-scripts
            execSync(command, { cwd: workspaceRoot, env, stdio: "inherit" });
        } catch {
            pail.error(`Root ${hook} script failed.`);
            hadFailure = true;
        }
    }

    if (hadFailure) {
        process.exitCode = 1;
    }
};

export { runApprovedScripts, runRootLifecycleScripts };
