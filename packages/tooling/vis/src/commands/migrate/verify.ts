import { readdirSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import type { MigrateLogger } from "./types";

export interface VerificationIssue {
    detail: string;
    kind: "catalog" | "ci" | "config" | "script" | "hook" | "devDep";
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

const CI_PATH_CANDIDATES = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml", ".woodpecker.yml", ".drone.yml"];

const scanCi = (root: string): VerificationIssue[] => {
    const issues: VerificationIssue[] = [];

    const scanFile = (rel: string): void => {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            return;
        }

        if (/\bsyncpack\b/.test(readFileSync(abs))) {
            issues.push({ detail: "syncpack invocation still present in CI", kind: "ci", location: rel });
        }
    };

    for (const rel of CI_PATH_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        if (rel === ".github/workflows") {
            try {
                for (const entry of readdirSync(abs)) {
                    if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
                        scanFile(`.github/workflows/${entry}`);
                    }
                }
            } catch {
                // Unreadable directory — skip.
            }

            continue;
        }

        scanFile(rel);
    }

    return issues;
};

/**
 * Looks for `syncpack` entries surviving in catalog protocol locations
 * (`pnpm-workspace.yaml#catalog`, `package.json#workspaces.catalog`,
 * top-level `package.json#catalog` for bun, and any named catalog
 * bucket under `catalogs.&lt;name>`).
 */
const scanCatalogs = (root: string): VerificationIssue[] => {
    const issues: VerificationIssue[] = [];

    const yamlPath = join(root, "pnpm-workspace.yaml");

    if (isAccessibleSync(yamlPath)) {
        let parsed: Record<string, unknown> | undefined;

        try {
            parsed = readYamlSync(yamlPath);
        } catch {
            parsed = undefined;
        }

        if (parsed && typeof parsed === "object") {
            const catalog = parsed["catalog"] as Record<string, string> | undefined;

            if (catalog && typeof catalog["syncpack"] === "string") {
                issues.push({ detail: "`syncpack` still listed in pnpm-workspace.yaml#catalog", kind: "catalog", location: "pnpm-workspace.yaml" });
            }

            const catalogs = parsed["catalogs"] as Record<string, Record<string, string>> | undefined;

            if (catalogs && typeof catalogs === "object") {
                for (const [name, entries] of Object.entries(catalogs)) {
                    if (entries && typeof entries["syncpack"] === "string") {
                        issues.push({ detail: `\`syncpack\` still listed in pnpm-workspace.yaml#catalogs.${name}`, kind: "catalog", location: "pnpm-workspace.yaml" });
                    }
                }
            }
        }
    }

    const packageJsonPath = join(root, "package.json");

    if (isAccessibleSync(packageJsonPath)) {
        let pkg: Record<string, unknown>;

        try {
            pkg = JSON.parse(readFileSync(packageJsonPath)) as Record<string, unknown>;
        } catch {
            return issues;
        }

        const workspaces = pkg["workspaces"] as Record<string, unknown> | undefined;

        if (workspaces && typeof workspaces === "object" && !Array.isArray(workspaces)) {
            const catalog = workspaces["catalog"] as Record<string, string> | undefined;

            if (catalog && typeof catalog["syncpack"] === "string") {
                issues.push({ detail: "`syncpack` still listed in package.json#workspaces.catalog", kind: "catalog", location: "package.json" });
            }

            const catalogs = workspaces["catalogs"] as Record<string, Record<string, string>> | undefined;

            if (catalogs && typeof catalogs === "object") {
                for (const [name, entries] of Object.entries(catalogs)) {
                    if (entries && typeof entries["syncpack"] === "string") {
                        issues.push({ detail: `\`syncpack\` still listed in package.json#workspaces.catalogs.${name}`, kind: "catalog", location: "package.json" });
                    }
                }
            }
        }

        const topLevelCatalog = pkg["catalog"] as Record<string, string> | undefined;

        if (topLevelCatalog && typeof topLevelCatalog["syncpack"] === "string") {
            issues.push({ detail: "`syncpack` still listed in package.json#catalog", kind: "catalog", location: "package.json" });
        }
    }

    return issues;
};

/**
 * Pure scan with no logging — exposed so callers like `vis doctor` can
 * surface leftover migration references without going through the
 * verify command's logger.
 */
export const scanMigrationLeftovers = (root: string): VerificationIssue[] =>
    [...scanPackageJson(root), ...scanHooks(root), ...scanConfigs(root), ...scanCi(root), ...scanCatalogs(root)];

/**
 * Check that a prior `vis migrate gitleaks` / `secretlint` / `syncpack` run was
 * complete: no stray scripts, devDependencies, hooks, or configs referencing
 * the old tools. Safe to run repeatedly — purely read-only.
 */
export const verifyMigration = (root: string, logger: MigrateLogger): VerificationIssue[] => {
    const issues = scanMigrationLeftovers(root);

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
