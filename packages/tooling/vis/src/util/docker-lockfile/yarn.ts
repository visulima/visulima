import { parseSyml, stringifySyml } from "@yarnpkg/parsers";

import type { PruneInput, PruneResult } from "./types";
import { LockfilePruneError } from "./types";

// Yarn berry's lockfile uses `__metadata` as the canonical key for the
// version/cache descriptor block. We can't rename it — it's a wire format
// constant — so a single named alias keeps the dangling-underscore lint
// rule from firing on every access.
const METADATA_KEY = "__metadata" as const;

interface YarnEntry {
    [key: string]: unknown;
    dependencies?: Record<string, string>;
    languageName?: string;
    linkType?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    resolution?: string;
    version?: string;
}

/**
 * Yarn lockfile keys are comma-separated specifier sets:
 *   `"foo@npm:^1.0, foo@npm:^1.1"` (berry)
 *   `"foo@^1.0, foo@^1.1"`         (classic)
 *
 * Each comma-separated piece is `name@spec`. Scoped packages contain
 * `@` in their name, so we have to find the LAST `@` after the first
 * non-`@` char.
 */
const splitSpecifier = (raw: string): { name: string; spec: string } | undefined => {
    const trimmed = raw.trim();

    if (trimmed === "") {
        return undefined;
    }

    // Skip leading `@` so we don't misparse `@scope/pkg@^1`.
    const offset = trimmed.startsWith("@") ? 1 : 0;
    const at = trimmed.indexOf("@", offset);

    if (at === -1) {
        return undefined;
    }

    return { name: trimmed.slice(0, at), spec: trimmed.slice(at + 1) };
};

const parseKeySpecifiers = (key: string): { name: string; spec: string }[] =>
    key
        .split(",")
        .map((piece) => splitSpecifier(piece))
        .filter((piece): piece is { name: string; spec: string } => piece !== undefined);

/**
 * Build a name → list-of-(spec, originalKey) index over all lockfile
 * entries so we can resolve `name + range` lookups during the BFS.
 */
const buildNameIndex = (entries: Record<string, YarnEntry>): Map<string, { key: string; specs: string[] }[]> => {
    const index = new Map<string, { key: string; specs: string[] }[]>();

    for (const key of Object.keys(entries)) {
        if (key === "__metadata") {
            continue;
        }

        const specifiers = parseKeySpecifiers(key);
        const byName = new Map<string, string[]>();

        for (const { name, spec } of specifiers) {
            const list = byName.get(name);

            if (list) {
                list.push(spec);
            } else {
                byName.set(name, [spec]);
            }
        }

        for (const [name, specs] of byName) {
            const list = index.get(name);

            if (list) {
                list.push({ key, specs });
            } else {
                index.set(name, [{ key, specs }]);
            }
        }
    }

    return index;
};

/**
 * Find every lockfile key that satisfies the `name + spec` pair the
 * caller is looking for. We don't run real semver matching here — yarn
 * already canonicalised specs at install time, so an exact spec-string
 * match is enough. Multiple keys can match if the same spec was hoisted
 * from several callers; all are kept.
 *
 * Berry inserts an implicit `npm:` protocol when none is given in
 * package.json, so a request for `^4.0.0` must also match a lockfile
 * spec of `npm:^4.0.0`. Classic uses bare specs both sides.
 */
const findKeysFor = (nameIndex: Map<string, { key: string; specs: string[] }[]>, name: string, spec: string): string[] => {
    const candidates = nameIndex.get(name);

    if (!candidates) {
        return [];
    }

    const acceptableSpecs = new Set<string>([spec]);

    if (!spec.includes(":")) {
        acceptableSpecs.add(`npm:${spec}`);
    } else if (spec.startsWith("npm:")) {
        acceptableSpecs.add(spec.slice(4));
    }

    const matches = candidates.filter((entry) => entry.specs.some((s) => acceptableSpecs.has(s)));

    return matches.map((m) => m.key);
};

/**
 * Workspace projects appear in berry lockfiles as `&lt;name>@workspace:&lt;path>`
 * resolutions. We map each closure project to the matching keys so the
 * BFS can include them and walk their deps. Classic lockfiles don't
 * record workspaces, so this returns an empty list there — closure deps
 * still pull in their installed packages directly.
 */
const collectWorkspaceKeys = (entries: Record<string, YarnEntry>, closure: PruneInput["closure"]): Set<string> => {
    const keys = new Set<string>();
    const closurePaths = new Set(closure.map((p) => p.relativeRoot).filter((p) => p !== ""));

    for (const [key, entry] of Object.entries(entries)) {
        if (key === "__metadata") {
            continue;
        }

        const { resolution } = entry;

        if (typeof resolution !== "string" || !resolution.includes("@workspace:")) {
            continue;
        }

        const workspacePath = resolution.split("@workspace:")[1];

        if (workspacePath !== undefined && (workspacePath === "." || closurePaths.has(workspacePath))) {
            keys.add(key);
        }
    }

    return keys;
};

const collectDeps = (entry: YarnEntry): { name: string; spec: string }[] => {
    const result: { name: string; spec: string }[] = [];

    for (const map of [entry.dependencies, entry.optionalDependencies]) {
        if (!map) {
            continue;
        }

        for (const [name, spec] of Object.entries(map)) {
            if (typeof spec === "string") {
                result.push({ name, spec });
            }
        }
    }

    return result;
};

export const pruneYarnLockfile = (input: PruneInput): PruneResult => {
    const text = typeof input.lockfileContent === "string" ? input.lockfileContent : input.lockfileContent.toString("utf8");

    let parsed: Record<string, YarnEntry>;

    try {
        parsed = parseSyml(text);
    } catch (error) {
        throw new LockfilePruneError(`yarn.lock: parse failed — ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== "object") {
        throw new LockfilePruneError("yarn.lock: top-level value is not an object");
    }

    const nameIndex = buildNameIndex(parsed);
    const keptKeys = new Set<string>();

    // 1. Keep the metadata block verbatim (berry only — classic lacks it).
    if (parsed[METADATA_KEY] !== undefined) {
        keptKeys.add(METADATA_KEY);
    }

    // 2. Seed with workspace entries (berry) — closure projects already
    //    appear in the lockfile as @workspace: resolutions.
    const workspaceKeys = collectWorkspaceKeys(parsed, input.closure);

    for (const key of workspaceKeys) {
        keptKeys.add(key);
    }

    // 3. Classic lockfiles have no workspace entries. Seed the BFS
    //    directly from each closure project's package.json dep specs.
    //    Berry also benefits — peerDependencies on workspace entries
    //    sometimes get hoisted in ways the workspace resolution doesn't
    //    capture.
    for (const project of input.closure) {
        if (!project.deps) {
            continue;
        }

        for (const [name, spec] of Object.entries(project.deps)) {
            if (typeof spec !== "string" || spec.startsWith("workspace:") || spec.startsWith("link:") || spec.startsWith("portal:")) {
                continue;
            }

            const matches = findKeysFor(nameIndex, name, spec);

            for (const matchKey of matches) {
                keptKeys.add(matchKey);
            }
        }
    }

    const queue: string[] = [...keptKeys];

    while (queue.length > 0) {
        const key = queue.shift()!;

        if (key === "__metadata") {
            continue;
        }

        const entry = parsed[key];

        if (!entry) {
            continue;
        }

        for (const { name, spec } of collectDeps(entry)) {
            // Skip workspace links — they're either already included
            // via collectWorkspaceKeys or out of closure.
            if (spec.startsWith("workspace:") || spec.startsWith("link:") || spec.startsWith("portal:")) {
                continue;
            }

            const matches = findKeysFor(nameIndex, name, spec);

            for (const matchKey of matches) {
                if (!keptKeys.has(matchKey)) {
                    keptKeys.add(matchKey);
                    queue.push(matchKey);
                }
            }
        }
    }

    const result: Record<string, YarnEntry> = {};

    for (const key of Object.keys(parsed)) {
        if (keptKeys.has(key)) {
            result[key] = parsed[key]!;
        }
    }

    const totalEntries = Object.keys(parsed).length - (parsed[METADATA_KEY] === undefined ? 0 : 1);
    const keptEntries = keptKeys.size - (keptKeys.has(METADATA_KEY) ? 1 : 0);
    const dropped = totalEntries - keptEntries;
    const isBerry = parsed[METADATA_KEY] !== undefined;

    return {
        content: stringifySyml(result),
        message: `yarn.lock (${isBerry ? "berry" : "classic"}): kept ${keptEntries}/${totalEntries} entries (dropped ${dropped})`,
        status: "pruned",
    };
};
