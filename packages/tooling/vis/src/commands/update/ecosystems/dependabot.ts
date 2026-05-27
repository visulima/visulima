import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { parse as parseYaml } from "yaml";

import type { EcosystemId } from "./types";

/**
 * Per-ecosystem ignore rules distilled from `.github/dependabot.yml` and/or
 * `renovate.json` (renovate-config.json, .renovaterc, .renovaterc.json).
 *
 * Rules are intentionally name-only matchers — we do not implement the full
 * Renovate `packageRules` language (regex, depTypes, datasource …) because
 * the use-case here is "respect what the user already declared as out of
 * scope for autoupdates", not "ship a third autoupdater".
 */
export interface DependabotIgnoreRules {
    readonly actions: Set<string>;
    readonly docker: Set<string>;
    readonly gitlab: Set<string>;
}

/**
 * Strip a trailing version specifier from a renovate/dependabot matcher.
 * `actions/checkout@v3` → `actions/checkout`. Bare names pass through.
 */
const stripVersionSpec = (raw: string): string => {
    const at = raw.indexOf("@");

    // Keep `@scoped/name` intact (leading `@`).
    if (at <= 0) {
        return raw;
    }

    return raw.slice(0, at);
};

interface DependabotUpdateBlock {
    "package-ecosystem"?: string;
    ignore?: { "dependency-name"?: string }[];
}

interface DependabotYaml {
    updates?: DependabotUpdateBlock[];
}

/**
 * Maps a dependabot `package-ecosystem` string to a vis ecosystem id.
 * Returns `undefined` for npm/pip/cargo/… which we don't gate here (npm
 * has its own catalog path with full ignore support).
 */
const mapDependabotEcosystem = (value: string | undefined): EcosystemId | undefined => {
    switch (value) {
        case "github-actions": {
            return "actions";
        }
        case "docker":
        case "docker-compose": {
            return "docker";
        }
        case "gitlab-ci": {
            return "gitlab";
        }
        default: {
            return undefined;
        }
    }
};

const loadDependabot = (workspaceRoot: string, rules: DependabotIgnoreRules): void => {
    const candidates = [".github/dependabot.yml", ".github/dependabot.yaml"];

    for (const relative of candidates) {
        const path = join(workspaceRoot, relative);

        if (!isAccessibleSync(path)) {
            continue;
        }

        let parsed: DependabotYaml | undefined;

        try {
            parsed = parseYaml(readFileSync(path)) as DependabotYaml | undefined;
        } catch {
            // A malformed dependabot config shouldn't crash the update run;
            // skip this file and try the next candidate (some repos keep
            // a placeholder `.yml` next to the real `.yaml`).
            continue;
        }

        if (!parsed?.updates) {
            continue;
        }

        for (const block of parsed.updates) {
            const target = mapDependabotEcosystem(block["package-ecosystem"]);

            if (!target || !Array.isArray(block.ignore)) {
                continue;
            }

            for (const ignore of block.ignore) {
                const name = ignore["dependency-name"];

                if (typeof name === "string" && name.length > 0) {
                    rules[target].add(stripVersionSpec(name));
                }
            }
        }

        // First file with `updates` wins; later candidates are ignored.
        return;
    }
};

interface RenovatePackageRule {
    enabled?: boolean;
    matchPackageNames?: string[];
    matchDepNames?: string[];
    matchPackagePatterns?: string[];
    matchManagers?: string[];
    matchDatasources?: string[];
}

interface RenovateConfig {
    ignoreDeps?: string[];
    packageRules?: RenovatePackageRule[];
    "github-actions"?: { ignoreDeps?: string[] };
    "docker-compose"?: { ignoreDeps?: string[] };
    dockerfile?: { ignoreDeps?: string[] };
    "gitlabci"?: { ignoreDeps?: string[] };
    "gitlabci-include"?: { ignoreDeps?: string[] };
}

const RENOVATE_MANAGER_TO_ECOSYSTEM: Readonly<Record<string, EcosystemId>> = Object.freeze({
    "docker-compose": "docker",
    "dockerfile": "docker",
    "github-actions": "actions",
    "gitlabci": "gitlab",
    "gitlabci-include": "gitlab",
});

const RENOVATE_DATASOURCE_TO_ECOSYSTEM: Readonly<Record<string, EcosystemId>> = Object.freeze({
    "docker": "docker",
    "github-tags": "actions",
});

const addAll = (target: Set<string>, values: string[] | undefined): void => {
    if (!values) {
        return;
    }

    for (const value of values) {
        if (typeof value === "string" && value.length > 0) {
            target.add(stripVersionSpec(value));
        }
    }
};

/**
 * Strips `//` line comments, `/* … *\/` block comments, and trailing
 * commas from JSON5 text **without** touching content inside string
 * literals. A naive `/\/\/.*$/g` would happily chew through
 * `"url": "https://example.com"` — corrupting any renovate config that
 * references a URL.
 *
 * The state machine tracks whether we're inside a string and skips
 * escapes (`\"`, `\\`) so quoted forward-slash sequences are preserved.
 * Trailing commas before `}` and `]` are dropped because they're the
 * most common JSON5 feature found in hand-edited renovate configs and
 * strict `JSON.parse` rejects them.
 */
const stripJsonComments = (source: string): string => {
    let out = "";
    let index = 0;
    const length = source.length;
    let inString = false;
    let stringQuote = "";

    while (index < length) {
        const char = source[index] ?? "";

        if (inString) {
            out += char;

            if (char === "\\" && index + 1 < length) {
                out += source[index + 1] ?? "";
                index += 2;
                continue;
            }

            if (char === stringQuote) {
                inString = false;
            }

            index += 1;
            continue;
        }

        if (char === "\"" || char === "'") {
            inString = true;
            stringQuote = char;
            out += char;
            index += 1;
            continue;
        }

        if (char === "/" && source[index + 1] === "/") {
            while (index < length && source[index] !== "\n") {
                index += 1;
            }

            continue;
        }

        if (char === "/" && source[index + 1] === "*") {
            index += 2;

            while (index < length && !(source[index] === "*" && source[index + 1] === "/")) {
                index += 1;
            }

            index += 2;
            continue;
        }

        // Trailing-comma elision: a `,` immediately followed (after
        // any whitespace) by `}` or `]` would crash `JSON.parse`.
        // Skip it. We only look ahead — string-mode is already handled
        // above so we never touch a comma inside a quoted value.
        if (char === ",") {
            let lookahead = index + 1;

            while (lookahead < length && /\s/.test(source[lookahead] ?? "")) {
                lookahead += 1;
            }

            const next = source[lookahead];

            if (next === "}" || next === "]") {
                index += 1;
                continue;
            }
        }

        out += char;
        index += 1;
    }

    return out;
};

const loadRenovate = (workspaceRoot: string, rules: DependabotIgnoreRules): void => {
    const candidates = ["renovate.json", "renovate.json5", ".renovaterc", ".renovaterc.json"];

    for (const relative of candidates) {
        const path = join(workspaceRoot, relative);

        if (!isAccessibleSync(path)) {
            continue;
        }

        let parsed: RenovateConfig | undefined;

        try {
            // JSON5 / .renovaterc are JSON-with-comments in practice. We
            // strip comments with a string-aware walker so `//` inside a
            // URL value (`"https://..."`) is preserved.
            const raw = readFileSync(path);

            parsed = JSON.parse(stripJsonComments(raw)) as RenovateConfig;
        } catch {
            // Try the next candidate — some repos ship a placeholder
            // `renovate.json` alongside the real `renovate.json5`.
            continue;
        }

        if (!parsed) {
            continue;
        }

        // Top-level ignoreDeps applies to every ecosystem.
        if (Array.isArray(parsed.ignoreDeps)) {
            for (const id of ["actions", "docker", "gitlab"] as const) {
                addAll(rules[id], parsed.ignoreDeps);
            }
        }

        // Manager-scoped ignoreDeps blocks.
        const scopedMap: [keyof RenovateConfig, EcosystemId][] = [
            ["github-actions", "actions"],
            ["dockerfile", "docker"],
            ["docker-compose", "docker"],
            ["gitlabci", "gitlab"],
            ["gitlabci-include", "gitlab"],
        ];

        for (const [key, id] of scopedMap) {
            const block = parsed[key] as { ignoreDeps?: string[] } | undefined;

            addAll(rules[id], block?.ignoreDeps);
        }

        if (!Array.isArray(parsed.packageRules)) {
            return;
        }

        for (const rule of parsed.packageRules) {
            if (rule.enabled !== false) {
                continue;
            }

            const matchedEcosystems = new Set<EcosystemId>();

            for (const manager of rule.matchManagers ?? []) {
                const id = RENOVATE_MANAGER_TO_ECOSYSTEM[manager];

                if (id) {
                    matchedEcosystems.add(id);
                }
            }

            for (const datasource of rule.matchDatasources ?? []) {
                const id = RENOVATE_DATASOURCE_TO_ECOSYSTEM[datasource];

                if (id) {
                    matchedEcosystems.add(id);
                }
            }

            // Without a manager scope, fall back to all three so the rule is
            // at least as restrictive as the user expected.
            if (matchedEcosystems.size === 0) {
                matchedEcosystems.add("actions");
                matchedEcosystems.add("docker");
                matchedEcosystems.add("gitlab");
            }

            const names = [...(rule.matchPackageNames ?? []), ...(rule.matchDepNames ?? []), ...(rule.matchPackagePatterns ?? [])];

            for (const id of matchedEcosystems) {
                addAll(rules[id], names);
            }
        }

        return;
    }
};

/**
 * Reads `.github/dependabot.yml` and/or `renovate.json` from the workspace
 * root and converts the user's ignore declarations into a per-ecosystem
 * matcher set. Both files are optional; an absent file just contributes
 * nothing. When both are present, rules are unioned.
 *
 * Matching is name-only (regex patterns from Renovate are preserved as
 * literal strings — they still work as substring matches in the applier).
 * The applier uses `Set.has` for exact hits plus a regex fallback for
 * pattern strings.
 */
export const loadIgnoreRules = (workspaceRoot: string): DependabotIgnoreRules => {
    const rules: DependabotIgnoreRules = {
        actions: new Set<string>(),
        docker: new Set<string>(),
        gitlab: new Set<string>(),
    };

    loadDependabot(workspaceRoot, rules);
    loadRenovate(workspaceRoot, rules);

    return rules;
};

/**
 * Returns `true` when `name` is ignored under the supplied rules for the
 * given ecosystem. Honours exact matches and regex-style patterns (so
 * `actions/.*` from a Renovate config still filters every action).
 *
 * Empty rule sets short-circuit to `false` to keep the hot path cheap.
 */
export const isIgnored = (name: string, ecosystem: EcosystemId, rules: DependabotIgnoreRules): boolean => {
    const bucket = rules[ecosystem];

    if (bucket.size === 0) {
        return false;
    }

    if (bucket.has(name)) {
        return true;
    }

    for (const pattern of bucket) {
        if (!/[*?[\]/.+]/.test(pattern)) {
            continue;
        }

        try {
            // Treat glob-ish strings as case-sensitive regex by mapping
            // `*` to `.*` and `?` to `.`. Anchored to avoid partial hits
            // (`actions/x` shouldn't accidentally match `actions/xyz`).
            const regexSource = pattern
                .replace(/[.+^${}()|]/g, "\\$&")
                .replace(/\*/g, ".*")
                .replace(/\?/g, ".");

            if (new RegExp(`^${regexSource}$`).test(name)) {
                return true;
            }
        } catch {
            // Malformed pattern — ignore silently rather than crashing the
            // whole update flow over a hand-edited config typo.
        }
    }

    return false;
};
