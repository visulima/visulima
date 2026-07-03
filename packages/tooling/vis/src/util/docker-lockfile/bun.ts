import type { PruneInput, PruneResult } from "./types";
import { LockfilePruneError } from "./types";

/**
 * Bun stores its lockfile as JSONC (JSON with `//` and `/* *\/` comments
 * allowed). Bun itself round-trips comments because they're often header
 * banners or "do not edit" markers. We don't want to ship `jsonc-parser`
 * as a dep just for this — comments only ever appear at the top level
 * (per bun's format), so a regex-based stripper is enough. Falls back to
 * plain JSON.parse on the cleaned text.
 */
const stripJsonComments = (input: string): string => {
    let result = "";
    let inString = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let index = 0; index < input.length; index += 1) {
        const ch = input[index]!;
        const next = input[index + 1];

        if (inLineComment) {
            if (ch === "\n") {
                inLineComment = false;
                result += ch;
            }

            continue;
        }

        if (inBlockComment) {
            if (ch === "*" && next === "/") {
                inBlockComment = false;
                index += 1;
            }

            continue;
        }

        if (inString) {
            if (ch === "\\") {
                result += ch;

                if (next !== undefined) {
                    result += next;
                    index += 1;
                }

                continue;
            }

            if (ch === "\"") {
                inString = false;
            }

            result += ch;
            continue;
        }

        if (ch === "\"") {
            inString = true;
            result += ch;
            continue;
        }

        if (ch === "/" && next === "/") {
            inLineComment = true;
            index += 1;
            continue;
        }

        if (ch === "/" && next === "*") {
            inBlockComment = true;
            index += 1;
            continue;
        }

        result += ch;
    }

    return result;
};

interface BunWorkspace {
    [key: string]: unknown;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

/**
 * Each entry in bun.lock's `packages` map is a tuple. The exact shape
 * has shifted across bun versions but always starts with the `name@version`
 * spec. We treat the rest opaquely — we only need the tuple's index 2
 * (dependency metadata object) when present to walk the graph.
 */
type BunPackageEntry = (Record<string, unknown> | string)[];

interface BunLockfile {
    [key: string]: unknown;
    lockfileVersion?: number;
    packages?: Record<string, BunPackageEntry>;
    workspaces?: Record<string, BunWorkspace>;
}

const collectWorkspaceDeps = (workspace: BunWorkspace): { name: string; spec: string }[] => {
    const result: { name: string; spec: string }[] = [];

    for (const map of [workspace.dependencies, workspace.devDependencies, workspace.optionalDependencies, workspace.peerDependencies]) {
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

/**
 * Pull the metadata object out of a bun packages-map entry. The known
 * shape is `[&lt;name@spec>, &lt;registry>?, &lt;metadata>?, &lt;integrity>?]`
 * with the metadata being a plain object containing `dependencies`,
 * `optionalDependencies`, etc. We probe each tuple slot to find an
 * object that looks like dep metadata.
 */
const extractMetadata = (entry: BunPackageEntry): Record<string, unknown> | undefined => {
    for (const slot of entry) {
        if (typeof slot === "object" && !Array.isArray(slot)) {
            return slot;
        }
    }

    return undefined;
};

const collectMetadataDeps = (metadata: Record<string, unknown> | undefined): string[] => {
    if (!metadata) {
        return [];
    }

    const names: string[] = [];

    for (const key of ["dependencies", "optionalDependencies", "peerDependencies"]) {
        const value = metadata[key];

        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            names.push(...Object.keys(value));
        }
    }

    return names;
};

export const pruneBunLockfile = (input: PruneInput): PruneResult => {
    if (Buffer.isBuffer(input.lockfileContent)) {
        return {
            message: "bun.lockb is binary; run `bun install --save-text-lockfile` to regenerate as bun.lock, then rerun `vis docker scaffold`.",
            status: "skipped",
        };
    }

    const cleaned = stripJsonComments(input.lockfileContent);

    let parsed: BunLockfile;

    try {
        parsed = JSON.parse(cleaned) as BunLockfile;
    } catch (error) {
        throw new LockfilePruneError(`bun.lock: parse failed — ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== "object") {
        throw new LockfilePruneError("bun.lock: top-level value is not an object");
    }

    const workspaces = parsed.workspaces ?? {};
    const packages = parsed.packages ?? {};

    const closurePaths = new Set<string>([""]);

    for (const project of input.closure) {
        closurePaths.add(project.relativeRoot === "" ? "" : project.relativeRoot);
    }

    const keptWorkspaces: Record<string, BunWorkspace> = {};
    const seedDeps: { name: string; spec: string }[] = [];

    for (const [path, workspace] of Object.entries(workspaces)) {
        if (closurePaths.has(path)) {
            keptWorkspaces[path] = workspace;
            seedDeps.push(...collectWorkspaceDeps(workspace));
        }
    }

    // bun.lock packages are keyed by package name (not name@version).
    // Variations across peer-dep permutations end up as nested keys
    // like `foo/bar` (bar is a transitive of foo). We treat the key
    // namespace conservatively: keep any key whose first path segment
    // matches a needed name, then walk metadata deps for further names.
    const neededNames = new Set<string>();

    for (const { name } of seedDeps) {
        neededNames.add(name);
    }

    const queue = [...neededNames];

    while (queue.length > 0) {
        const name = queue.shift()!;

        for (const key of Object.keys(packages)) {
            const firstSegment = key.split("/")[0];

            if (firstSegment !== name && key !== name) {
                continue;
            }

            const metadata = extractMetadata(packages[key]!);

            for (const depName of collectMetadataDeps(metadata)) {
                if (!neededNames.has(depName)) {
                    neededNames.add(depName);
                    queue.push(depName);
                }
            }
        }
    }

    const keptPackages: Record<string, BunPackageEntry> = {};

    for (const [key, entry] of Object.entries(packages)) {
        const firstSegment = key.split("/")[0]!;

        if (neededNames.has(firstSegment) || neededNames.has(key)) {
            keptPackages[key] = entry;
        }
    }

    const result: BunLockfile = {
        ...parsed,
        packages: keptPackages,
        workspaces: keptWorkspaces,
    };

    const totalPackages = Object.keys(packages).length;
    const keptCount = Object.keys(keptPackages).length;
    const dropped = totalPackages - keptCount;

    return {
        content: `${JSON.stringify(result, null, 2)}\n`,
        message: `bun.lock: kept ${keptCount}/${totalPackages} packages (dropped ${dropped})`,
        status: "pruned",
    };
};
