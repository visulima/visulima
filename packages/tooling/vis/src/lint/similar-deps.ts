import type { DepInstance, DepType } from "../util/workspace-deps";

/**
 * Two related deps are pinned to different versions across the
 * workspace.
 *
 * "Related" = members of the same upstream release train, where the
 * upstream publishes them in lockstep. `react` and `react-dom` ship
 * together; `@babel/core` and `@babel/preset-env` always bump in
 * lockstep; mixing major versions silently breaks runtime invariants.
 *
 * Vis's `workspace-versions` lint already catches drift on a single
 * dep name (every package using `react@^17` vs one stragler on `^18`).
 * This rule is the cross-name complement: every package agrees on
 * `react@^18` and `react-dom@^17`, but those two should match each
 * other.
 *
 * Resolution is intentionally report-only: aligning a family
 * automatically requires picking a single canonical specifier across
 * heterogeneous range syntaxes (`^`, `~`, exact), which is too lossy
 * to do safely without user input. `--fix` is therefore a no-op for
 * this lint; the surfaced report tells the user where to align by hand.
 */
export interface SimilarDepsIssue {
    /** Stable identifier of the family ("react", "next.js", "babel", …). */
    family: string;
    /** Human-readable family label for printing. */
    familyLabel: string;
    /** Distinct (depName → specifier) pairs observed across the workspace. */
    members: { depName: string; depType: DepType; packageDir: string; packageJsonPath: string; packageName: string | undefined; specifier: string }[];
    /** Distinct specifiers seen across the family. ≥2 means drift. */
    specifiers: string[];
}

/**
 * One family of upstream-coupled packages.
 *
 * `members` is an exact-match list. `prefixes` accept any dep whose
 * name starts with the prefix — useful for monorepos that ship many
 * subpackages under one scope (e.g. `@babel/`, `@storybook/`,
 * `@nx/`). A family can use either or both; a dep matching either
 * list belongs to the family.
 */
export interface SimilarDepFamily {
    /** Stable id; used in report output and config overrides. */
    id: string;
    /** Pretty label for the report. Defaults to `id` when omitted. */
    label?: string;
    /** Dep names that belong to this family verbatim. */
    members?: string[];
    /** Dep-name prefixes (literal, no glob). Match if `depName.startsWith(prefix)`. */
    prefixes?: string[];
}

/**
 * Curated family list. Conservative on purpose: every entry here is a
 * package set the upstream author publishes in lockstep. Tools where
 * the user picks a stable subset (`@radix-ui/*` for example) are
 * intentionally omitted — those are bundle-by-bundle, not lockstep.
 *
 * Users can extend via `policy.similarDeps.extraFamilies`.
 */
export const BUILTIN_SIMILAR_FAMILIES: SimilarDepFamily[] = [
    { id: "react", label: "React", members: ["react", "react-dom", "react-test-renderer"] },
    {
        id: "next",
        label: "Next.js",
        members: ["next", "@next/font", "@next/bundle-analyzer", "@next/mdx", "@next/third-parties", "@next/eslint-plugin-next", "eslint-config-next"],
    },
    { id: "babel", label: "Babel", prefixes: ["@babel/"] },
    { id: "storybook", label: "Storybook", members: ["storybook", "sb"], prefixes: ["@storybook/"] },
    { id: "vitest", label: "Vitest", members: ["vitest"], prefixes: ["@vitest/"] },
    { id: "playwright", label: "Playwright", members: ["playwright", "@playwright/test"] },
    { id: "trpc", label: "tRPC", prefixes: ["@trpc/"] },
    { id: "prisma", label: "Prisma", members: ["prisma"], prefixes: ["@prisma/"] },
    { id: "turborepo", label: "Turborepo", members: ["turbo", "turbo-ignore", "@turbo/gen", "eslint-config-turbo", "eslint-plugin-turbo"] },
    { id: "typescript-eslint", label: "typescript-eslint", members: ["typescript-eslint"], prefixes: ["@typescript-eslint/"] },
    { id: "eslint-stylistic", label: "ESLint Stylistic", prefixes: ["@stylistic/"] },
    { id: "lexical", label: "Lexical", members: ["lexical"], prefixes: ["@lexical/"] },
    { id: "nx", label: "Nx", prefixes: ["@nx/", "@nrwl/"] },
];

export interface SimilarDepsLintOptions {
    /** Additional families merged with the built-ins. Same id wins → user override. */
    extraFamilies?: SimilarDepFamily[];
    /** Family ids to skip entirely. */
    ignoreFamilies?: string[];
}

const VERSION_DEP_TYPES = new Set<DepType>(["dependencies", "devDependencies", "peerDependencies"]);

const familyForDep = (families: SimilarDepFamily[], depName: string): SimilarDepFamily | undefined => {
    for (const family of families) {
        if (family.members?.includes(depName)) {
            return family;
        }

        if (family.prefixes?.some((prefix) => depName.startsWith(prefix))) {
            return family;
        }
    }

    return undefined;
};

const isWorkspaceOrCatalogReference = (specifier: string): boolean => specifier.startsWith("workspace:") || specifier.startsWith("catalog:");

/**
 * Group dep instances by family and report families with ≥2 distinct
 * specifiers. Only direct version specifiers count — `workspace:*`,
 * `catalog:*`, and internal references are skipped (those are owned
 * by `workspace-protocol` / catalog tooling).
 */
export const lintSimilarDeps = (instances: DepInstance[], options: SimilarDepsLintOptions = {}): SimilarDepsIssue[] => {
    const ignoreFamilies = new Set(options.ignoreFamilies);

    // Merge by id so a user-provided `react` family fully replaces the
    // built-in one rather than colliding. Preserves built-in order
    // first then extras for any non-overridden family.
    const merged = new Map<string, SimilarDepFamily>();

    for (const family of BUILTIN_SIMILAR_FAMILIES) {
        merged.set(family.id, family);
    }

    for (const family of options.extraFamilies ?? []) {
        merged.set(family.id, family);
    }

    const families = [...merged.values()];

    const buckets = new Map<string, SimilarDepsIssue["members"]>();

    for (const instance of instances) {
        if (instance.isInternal) {
            continue;
        }

        if (!VERSION_DEP_TYPES.has(instance.depType)) {
            continue;
        }

        if (isWorkspaceOrCatalogReference(instance.specifier)) {
            continue;
        }

        const family = familyForDep(families, instance.depName);

        if (!family || ignoreFamilies.has(family.id)) {
            continue;
        }

        const list = buckets.get(family.id);
        const entry = {
            depName: instance.depName,
            depType: instance.depType,
            packageDir: instance.packageDir,
            packageJsonPath: instance.packageJsonPath,
            packageName: instance.packageName,
            specifier: instance.specifier,
        };

        if (list) {
            list.push(entry);
        } else {
            buckets.set(family.id, [entry]);
        }
    }

    const issues: SimilarDepsIssue[] = [];

    for (const [familyId, members] of buckets) {
        const specifiers = [...new Set(members.map((m) => m.specifier))];

        if (specifiers.length < 2) {
            continue;
        }

        const family = merged.get(familyId);

        if (!family) {
            continue;
        }

        issues.push({
            family: familyId,
            familyLabel: family.label ?? familyId,
            members,
            specifiers,
        });
    }

    return issues;
};
