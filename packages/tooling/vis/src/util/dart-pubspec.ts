/**
 * Reads the parts of a Dart `pubspec.yaml` that vis needs: the package name, the
 * `version` literal, `publish_to`, the pub workspace member list, and the
 * dependency names. Used by the task and release discovery, and by the release plan.
 *
 * The version is read from its source line, not from the parsed value, so the
 * rewrite touches exactly the token the release reads. A top-level `version:` is
 * unique in a valid pubspec (the YAML parser rejects duplicate keys), and nested
 * keys are indented, so the line match cannot pick up a dependency's version.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseDocument } from "@visulima/yaml";

export class DartPubspecError extends Error {}

export const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;

export interface DartPubspecScan {
    /** `dependencies:` keys. Pub workspace members depend on each other by name, so these may name a sibling. */
    dependencyNames: string[];
    name: string | undefined;
    publishTo: string | undefined;
    /** The version literal and its 1-based line, or undefined when the pubspec sets no `version:`. */
    version: { line: number; value: string } | undefined;
    /** Entries of the root `workspace:` list, or undefined without one. */
    workspace: string[] | undefined;
}

/** `version:` at column 0, then a plain or single/double-quoted token. Group 2 is the quote, 3 the token. */
const VERSION_LINE = /^version:([ \t]+)(["']?)([^"'\s#]+)\2[ \t]*(?:#.*)?$/m;

/** Parse one pubspec. Throws `DartPubspecError` for anything vis cannot read as a literal. */
export const scanDartPubspec = (raw: string): DartPubspecScan => {
    const document = parseDocument(raw);

    if (document.errors.length > 0) {
        throw new DartPubspecError(`the YAML does not parse: ${document.errors[0]?.message ?? "unknown error"}`);
    }

    const data = (document.toJS() ?? {}) as Record<string, unknown>;
    const { name } = data;
    const publishTo = data.publish_to;
    const { workspace } = data;
    const { dependencies } = data;

    if (name !== undefined && typeof name !== "string") {
        throw new DartPubspecError("name must be a plain string");
    }

    if (publishTo !== undefined && typeof publishTo !== "string") {
        throw new DartPubspecError("publish_to must be a string");
    }

    if (workspace !== undefined && (!Array.isArray(workspace) || workspace.some((entry) => typeof entry !== "string"))) {
        throw new DartPubspecError("workspace must be a list of directory paths");
    }

    let version: DartPubspecScan["version"];

    if (data.version !== undefined) {
        if (typeof data.version !== "string") {
            throw new DartPubspecError(`version is ${typeof data.version === "number" ? "a number" : "not a string"}; quote it, for example version: "1.0.0"`);
        }

        const match = VERSION_LINE.exec(raw);

        if (match?.[3] !== data.version) {
            throw new DartPubspecError("version must be a plain or quoted literal on its own top-level line, for example version: 1.0.0");
        }

        if (!SEMVER.test(data.version)) {
            throw new DartPubspecError(`version "${data.version}" is not a semantic version`);
        }

        version = { line: raw.slice(0, match.index).split("\n").length, value: data.version };
    }

    const dependencyNames
        = dependencies !== null && typeof dependencies === "object" && !Array.isArray(dependencies) ? Object.keys(dependencies) : [];

    return {
        dependencyNames,
        name,
        publishTo,
        version,
        workspace: workspace as string[] | undefined,
    };
};

/**
 * Replace the version token of a pubspec with `next`, keeping its quotes. `current`
 * must be the literal the scan read; a mismatch means the file changed under the plan.
 */
export const replaceDartVersion = (raw: string, current: string, next: string): string => {
    const match = VERSION_LINE.exec(raw);

    if (match?.[3] !== current) {
        throw new DartPubspecError(`the version literal is no longer "${current}"`);
    }

    const start = match.index + "version:".length + match[1]!.length + match[2]!.length;
    const end = start + match[3].length;

    return `${raw.slice(0, start)}${next}${raw.slice(end)}`;
};

/**
 * Directories a `workspace:` entry names, relative to `root`. Literal paths and
 * single-segment `*` wildcards are supported. A `*` matches only directories that
 * hold a `pubspec.yaml`, as pub does; a literal entry must hold one. Anything else
 * (`**`, partial wildcards, absolute or parent paths) throws, so it is never guessed.
 */
export const expandDartWorkspaceEntry = (root: string, entry: string): string[] => {
    const segments = entry.split("/").filter((part) => part !== "" && part !== ".");

    if (entry.startsWith("/") || segments.includes("..") || entry.includes("\\")) {
        throw new DartPubspecError(`workspace entry "${entry}" must be a relative path inside the workspace`);
    }

    let current = [root];

    for (const segment of segments) {
        if (segment === "**" || (segment.includes("*") && segment !== "*")) {
            throw new DartPubspecError(`workspace entry "${entry}" uses an unsupported pattern; list the package directories explicitly or use "dir/*"`);
        }

        current = current.flatMap((dir) => {
            if (segment !== "*") {
                return [join(dir, segment)];
            }

            let names: string[];

            try {
                names = readdirSync(dir);
            } catch {
                return [];
            }

            return names.map((name) => join(dir, name)).filter((path) => isDirectory(path));
        });
    }

    return current.filter((dir) => isDirectory(dir) && isFile(join(dir, "pubspec.yaml")));
};

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
};

const isFile = (path: string): boolean => {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
};
