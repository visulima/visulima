/**
 * Composer graph for the BOM, read from `composer.lock` at the workspace root.
 *
 * Each lock entry lists its `require` and `require-dev` maps (target name to constraint).
 * Entries in `packages-dev` are dev packages, so every edge out of them is `dev`. The
 * root `composer.json` names the members: its `require` keys, plus `require-dev` keys
 * when dev edges are included. Platform requirements (`php`, `ext-*`) are not lock
 * entries, so the graph walk drops them.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { composerVersionFromLock, parseComposerJson, requireKeys } from "../util/composer";
import type { LockDep, LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** `pkg:composer/vendor/package@version`, with each name segment percent-encoded. */
export const toComposerPurl = (name: string, version: string): string =>
    `pkg:composer/${name.split("/").map((segment) => encodeURIComponent(segment)).join("/")}@${encodeURIComponent(version)}`;

const normalizeComposerName = (name: string): string => name.toLowerCase();

const lockEntries = (lock: Record<string, unknown>): LockEntry[] => {
    const entries: LockEntry[] = [];

    for (const [key, isDev] of [
        ["packages", false],
        ["packages-dev", true],
    ] as const) {
        const list = lock[key];

        if (!Array.isArray(list)) {
            continue;
        }

        for (const item of list as Record<string, unknown>[]) {
            if (typeof item.name !== "string" || typeof item.version !== "string") {
                continue;
            }

            const deps: LockDep[] = [
                ...requireKeys(item, "require").map((name): LockDep => { return { kind: isDev ? "dev" : "main", name }; }),
                ...requireKeys(item, "require-dev").map((name): LockDep => { return { kind: "dev", name }; }),
            ];

            entries.push({ deps, member: false, name: item.name, version: composerVersionFromLock(item.version) });
        }
    }

    return entries;
};

/**
 * Read `composer.lock` at `workspaceRoot` and return its components and dependency edges,
 * restricted to what the root package reaches. Both are empty without a lockfile or a
 * root `composer.json`, and when `focusNames` leaves out the root package.
 */
export const buildComposerSbomParts = (
    workspaceRoot: string,
    options: { focusNames?: ReadonlyArray<string>; includeDev?: boolean } = {},
): { components: Component[]; dependencies: Dependency[] } => {
    const empty = { components: [], dependencies: [] };
    let lock: Record<string, unknown>;
    let root: Record<string, unknown>;

    try {
        lock = parseComposerJson(readFileSync(join(workspaceRoot, "composer.lock"), "utf8"));
        root = parseComposerJson(readFileSync(join(workspaceRoot, "composer.json"), "utf8"));
    } catch {
        return empty;
    }

    const rootName = typeof root.name === "string" ? normalizeComposerName(root.name) : undefined;

    if (options.focusNames !== undefined && !options.focusNames.some((name) => normalizeComposerName(name) === rootName)) {
        return empty;
    }

    const memberNames = new Set(
        [...requireKeys(root, "require"), ...(options.includeDev ? requireKeys(root, "require-dev") : [])].map((name) => normalizeComposerName(name)),
    );
    const entries = lockEntries(lock).map((entry) => {
        return { ...entry, member: memberNames.has(normalizeComposerName(entry.name)) };
    });

    return buildLockGraph(entries, {
        includeDev: options.includeDev,
        normalize: normalizeComposerName,
        purl: toComposerPurl,
    });
};
