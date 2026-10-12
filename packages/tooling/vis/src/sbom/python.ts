/**
 * uv.lock → CycloneDX components. Like Cargo.lock, a uv workspace records its graph in
 * its own lockfile, so it is read separately and appended to the BOM.
 *
 * Each `[[package]]` becomes a `pkg:pypi` component. Its edges come from three places:
 * the `dependencies` array (main), `[package.optional-dependencies]` (extras), and
 * `[package.dev-dependencies]` (dependency groups). Groups are followed only with
 * `includeDev`, as the npm path does with devDependencies.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { LockDep, LockEntry } from "./lockgraph";
import { buildLockGraph } from "./lockgraph";
import type { Component, Dependency } from "./types";

/** PEP 503 name normalization, the form PyPI and purl consumers expect. */
export const normalizePythonName = (name: string): string => name.toLowerCase().replaceAll(/[-_.]+/g, "-");

/** `pkg:pypi/&lt;normalized name>@&lt;version>`. */
export const toPypiPurl = (name: string, version: string): string =>
    `pkg:pypi/${encodeURIComponent(normalizePythonName(name))}@${encodeURIComponent(version)}`;

/** Sources that mark a workspace member (uv records its own project as one of these). */
const MEMBER_SOURCE = /^source\s*=\s*\{\s*(?:editable|virtual|directory)\s*=/;

const DEP_LINE = /\{\s*name\s*=\s*"([^"]+)"([^}]*)\}/;

const parseUvLock = (content: string): LockEntry[] => {
    const entries: LockEntry[] = [];
    let current: { deps: LockDep[]; member: boolean; name?: string; source?: string; version?: string } | undefined;
    let mode: "dev" | "main" | "none" | "optional" = "none";
    let inArray = false;

    const flush = (): void => {
        if (current?.name !== undefined && current.version !== undefined) {
            entries.push({ deps: current.deps, member: current.member, name: current.name, source: current.source, version: current.version });
        }
    };

    for (const raw of content.split("\n")) {
        const line = raw.trim();

        if (line === "[[package]]") {
            flush();
            current = { deps: [], member: false };
            mode = "none";
            inArray = false;

            continue;
        }

        if (current === undefined) {
            continue;
        }

        if (line.startsWith("[")) {
            // `[package.optional-dependencies]` and `[package.dev-dependencies]` hold edges;
            // every other table (including `[package.metadata…]`) does not.
            mode = line === "[package.optional-dependencies]" ? "optional" : line === "[package.dev-dependencies]" ? "dev" : "none";
            inArray = false;

            continue;
        }

        if (inArray) {
            if (line === "]" || line === "],") {
                inArray = false;
                mode = mode === "main" ? "none" : mode;

                continue;
            }

            const dep = DEP_LINE.exec(line);

            if (dep && mode !== "none") {
                const version = /version\s*=\s*"([^"]*)"/.exec(dep[2] ?? "")?.[1];

                current.deps.push({ kind: mode, name: dep[1]!, version });
            }

            continue;
        }

        if (line === "dependencies = [") {
            mode = "main";
            inArray = true;

            continue;
        }

        if ((mode === "optional" || mode === "dev") && /^[\w.-]+\s*=\s*\[$/.test(line)) {
            inArray = true;

            continue;
        }

        if (MEMBER_SOURCE.test(line)) {
            current.member = true;

            continue;
        }

        // `source = { registry = "…" }` tells two same-version entries from different indexes apart.
        const sourceMatch = /^source\s*=\s*\{\s*(\w+)\s*=\s*"([^"]*)"/.exec(line);

        if (sourceMatch && mode === "none") {
            current.source = `${sourceMatch[1]}:${sourceMatch[2]}`;

            continue;
        }

        const field = /^(name|version|source)\s*=\s*"?([^"}]*)"?$/.exec(line);

        if (field && mode === "none") {
            const [, key = "", value = ""] = field;

            if (key === "name") {
                current.name = value;
            } else if (key === "version") {
                current.version = value;
            }
        }
    }

    flush();

    return entries;
};

/**
 * Read `uv.lock` at `workspaceRoot` and return its components and dependency edges,
 * restricted to what the workspace reaches. Both are empty without a lockfile, so a
 * repo without Python gets the same BOM as before.
 */
export const buildPythonSbomParts = (
    workspaceRoot: string,
    options: { focusNames?: ReadonlyArray<string>; includeDev?: boolean } = {},
): { components: Component[]; dependencies: Dependency[] } => {
    let content: string;

    try {
        content = readFileSync(join(workspaceRoot, "uv.lock"), "utf8");
    } catch {
        return { components: [], dependencies: [] };
    }

    return buildLockGraph(parseUvLock(content), {
        focusNames: options.focusNames,
        includeDev: options.includeDev,
        normalize: normalizePythonName,
        purl: toPypiPurl,
    });
};
