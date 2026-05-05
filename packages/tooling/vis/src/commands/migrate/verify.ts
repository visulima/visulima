import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { MigrateLogger } from "./types";

export interface VerificationIssue {
    detail: string;
    kind: "config" | "script" | "hook" | "devDep";
    location: string;
}

const HOOK_CANDIDATES = [".husky/pre-commit", ".vis-hooks/pre-commit", ".git/hooks/pre-commit"];
const SECRETLINT_CONFIG_FILES = [
    ".secretlintrc",
    ".secretlintrc.json",
    ".secretlintrc.js",
    ".secretlintrc.mjs",
    ".secretlintrc.cjs",
    ".secretlintrc.yml",
    ".secretlintrc.yaml",
];
const SYNCPACK_CONFIG_FILES = [
    ".syncpackrc",
    ".syncpackrc.json",
    ".syncpackrc.yaml",
    ".syncpackrc.yml",
    ".syncpackrc.cjs",
    ".syncpackrc.js",
    ".syncpackrc.mjs",
    ".syncpackrc.ts",
    "syncpack.config.cjs",
    "syncpack.config.js",
    "syncpack.config.mjs",
    "syncpack.config.ts",
];

interface PackageJson {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

const scanPackageJson = (root: string): VerificationIssue[] => {
    const packageJsonPath = join(root, "package.json");

    if (!isAccessibleSync(packageJsonPath)) {
        return [];
    }

    let pkg: PackageJson;

    try {
        pkg = JSON.parse(readFileSync(packageJsonPath)) as PackageJson;
    } catch {
        return [];
    }

    const issues: VerificationIssue[] = [];

    if (pkg.scripts) {
        for (const [name, value] of Object.entries(pkg.scripts)) {
            if (typeof value !== "string") {
                continue;
            }

            if (/\bgitleaks\b/.test(value)) {
                issues.push({ detail: `Script "${name}" still invokes gitleaks: ${value}`, kind: "script", location: "package.json" });
            }

            if (/\bsecretlint\b/.test(value)) {
                issues.push({ detail: `Script "${name}" still invokes secretlint: ${value}`, kind: "script", location: "package.json" });
            }

            if (/\bsyncpack\b/.test(value)) {
                issues.push({ detail: `Script "${name}" still invokes syncpack: ${value}`, kind: "script", location: "package.json" });
            }
        }
    }

    if (pkg.devDependencies) {
        for (const dep of Object.keys(pkg.devDependencies)) {
            if (dep === "gitleaks" || dep === "@gitleaks/cli") {
                issues.push({ detail: `devDependency \`${dep}\` is still installed`, kind: "devDep", location: "package.json" });
            }

            if (dep === "secretlint" || dep.startsWith("@secretlint/")) {
                issues.push({ detail: `devDependency \`${dep}\` is still installed`, kind: "devDep", location: "package.json" });
            }

            if (dep === "syncpack") {
                issues.push({ detail: `devDependency \`${dep}\` is still installed`, kind: "devDep", location: "package.json" });
            }
        }
    }

    return issues;
};

const scanHooks = (root: string): VerificationIssue[] => {
    const issues: VerificationIssue[] = [];

    for (const rel of HOOK_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        const content = readFileSync(abs);

        if (/\bgitleaks\b/.test(content)) {
            issues.push({ detail: "gitleaks invocation still present in hook", kind: "hook", location: rel });
        }

        if (/\bsecretlint\b/.test(content)) {
            issues.push({ detail: "secretlint invocation still present in hook", kind: "hook", location: rel });
        }

        if (/\bsyncpack\b/.test(content)) {
            issues.push({ detail: "syncpack invocation still present in hook", kind: "hook", location: rel });
        }
    }

    return issues;
};

const scanConfigs = (root: string): VerificationIssue[] => {
    const issues: VerificationIssue[] = [];

    for (const name of SECRETLINT_CONFIG_FILES) {
        if (isAccessibleSync(join(root, name))) {
            issues.push({ detail: "secretlint config should be removed after migration", kind: "config", location: name });
        }
    }

    for (const name of SYNCPACK_CONFIG_FILES) {
        if (isAccessibleSync(join(root, name))) {
            issues.push({ detail: "syncpack config should be removed after migration", kind: "config", location: name });
        }
    }

    return issues;
};

/**
 * Check that a prior `vis migrate gitleaks` / `secretlint` / `syncpack` run was
 * complete: no stray scripts, devDependencies, hooks, or configs referencing
 * the old tools. Safe to run repeatedly — purely read-only.
 */
export const verifyMigration = (root: string, logger: MigrateLogger): VerificationIssue[] => {
    const issues = [...scanPackageJson(root), ...scanHooks(root), ...scanConfigs(root)];

    if (issues.length === 0) {
        logger.info("✓ No unmigrated gitleaks/secretlint/syncpack references found.");

        return [];
    }

    logger.warn(`Found ${String(issues.length)} unmigrated reference(s):`);

    for (const issue of issues) {
        logger.warn(`  [${issue.kind}] ${issue.location} — ${issue.detail}`);
    }

    return issues;
};
