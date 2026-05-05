import zeptomatch from "zeptomatch";

import type { DepInstance, DepType } from "./workspace-deps";

/**
 * Per-rule policy declaration. The string key in
 * {@link BannedDepsConfig} is the dep name or glob; the value is either a
 * plain reason string (concise form) or an object with extra metadata.
 */
export type BannedDepRule = string | { reason: string; replacement?: string };

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

/**
 * Resolve the rule that applies to a given dep name. Exact-match rules
 * always beat glob rules so users can pin a specific dep through a wider
 * blanket ban (e.g. ban `@radix-ui/*` but allow `@radix-ui/themes`).
 */
const findMatchingRule = (depName: string, config: BannedDepsConfig): { pattern: string; rule: BannedDepRule } | undefined => {
    const exact = config[depName];

    if (exact !== undefined) {
        return { pattern: depName, rule: exact };
    }

    for (const [pattern, rule] of Object.entries(config)) {
        if (isGlob(pattern) && zeptomatch(pattern, depName)) {
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

        const match = findMatchingRule(instance.depName, config);

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
