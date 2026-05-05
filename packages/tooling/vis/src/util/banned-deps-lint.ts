import zeptomatch from "zeptomatch";

import type { DepInstance, DepType } from "./workspace-deps";

/**
 * Per-rule policy declaration. The string key in
 * {@link BannedDepsConfig} is the dep name or glob; the value is either a
 * plain reason string (concise form) or an object with extra metadata.
 *
 * Scope fields narrow where the rule applies. When both `packages` and
 * `paths` are set, either match is enough (OR). When neither is set, the
 * rule applies everywhere — this is the default and preserves the
 * pre-scope behaviour.
 */
export type BannedDepRule =
    | string
    | {
          /** Glob list over the declaring package's `name` (e.g. `@app/*`). */
          packages?: string[];
          /** Glob list over `packageDir` (workspace-relative, e.g. `apps/*`). */
          paths?: string[];
          reason: string;
          replacement?: string;
      };

/**
 * Workspace-level banned-deps policy block. Parsed from
 * `vis.config.ts#policy.bannedDeps` or supplied verbatim by tests.
 *
 * Keys may be exact names (`request`) or globs (`@radix-ui/*`). The first
 * matching rule wins per dep — exact matches are preferred over globs.
 */
export type BannedDepsConfig = Record<string, BannedDepRule>;

export interface BannedDepIssue {
    depName: string;
    depType: DepType;
    matchedPattern: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
    reason: string;
    replacement?: string;
    specifier: string;
}

const isGlob = (pattern: string): boolean => /[*?[\]{}!]/.test(pattern);

const ruleReason = (rule: BannedDepRule): string => (typeof rule === "string" ? rule : rule.reason);

const ruleReplacement = (rule: BannedDepRule): string | undefined => (typeof rule === "string" ? undefined : rule.replacement);

const matchesAnyGlob = (globs: string[], value: string): boolean => globs.some((pattern) => zeptomatch(pattern, value));

/**
 * True when the rule's optional `packages` / `paths` scope matches the
 * declaring instance. Rules with no scope fields apply everywhere; when
 * both fields are set, either match is enough (OR).
 */
const ruleAppliesToInstance = (rule: BannedDepRule, instance: { packageDir: string; packageName: string | undefined }): boolean => {
    if (typeof rule === "string") {
        return true;
    }

    const hasPackagesScope = Array.isArray(rule.packages) && rule.packages.length > 0;
    const hasPathsScope = Array.isArray(rule.paths) && rule.paths.length > 0;

    if (!hasPackagesScope && !hasPathsScope) {
        return true;
    }

    if (hasPackagesScope && instance.packageName !== undefined && matchesAnyGlob(rule.packages as string[], instance.packageName)) {
        return true;
    }

    if (hasPathsScope && matchesAnyGlob(rule.paths as string[], instance.packageDir)) {
        return true;
    }

    return false;
};

/**
 * Resolve the rule that applies to a given dep instance. Scope-mismatched
 * rules are skipped, then exact-match rules beat glob rules so users can
 * pin a specific dep through a wider blanket ban (e.g. ban `@radix-ui/*`
 * but allow `@radix-ui/themes`).
 */
const findMatchingRule = (
    instance: { depName: string; packageDir: string; packageName: string | undefined },
    config: BannedDepsConfig,
): { pattern: string; rule: BannedDepRule } | undefined => {
    const exact = config[instance.depName];

    if (exact !== undefined && ruleAppliesToInstance(exact, instance)) {
        return { pattern: instance.depName, rule: exact };
    }

    for (const [pattern, rule] of Object.entries(config)) {
        if (isGlob(pattern) && zeptomatch(pattern, instance.depName) && ruleAppliesToInstance(rule, instance)) {
            return { pattern, rule };
        }
    }

    return undefined;
};

/**
 * Find every dep that matches a banned-pattern entry.
 *
 * Internal/workspace deps are excluded — those are owned by the user
 * and the workspace-protocol lint already covers their rewriting.
 */
export const lintBannedDeps = (instances: DepInstance[], config: BannedDepsConfig): BannedDepIssue[] => {
    if (Object.keys(config).length === 0) {
        return [];
    }

    const issues: BannedDepIssue[] = [];

    for (const instance of instances) {
        if (instance.isInternal) {
            continue;
        }

        const match = findMatchingRule(instance, config);

        if (!match) {
            continue;
        }

        issues.push({
            depName: instance.depName,
            depType: instance.depType,
            matchedPattern: match.pattern,
            packageDir: instance.packageDir,
            packageJsonPath: instance.packageJsonPath,
            packageName: instance.packageName,
            reason: ruleReason(match.rule),
            replacement: ruleReplacement(match.rule),
            specifier: instance.specifier,
        });
    }

    return issues;
};
