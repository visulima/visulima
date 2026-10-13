/**
 * Built-in version manifests for non-JS files (`Cargo.toml`, `tauri.conf.json`).
 *
 * `versionFiles` on a per-package config lists manifests (package-dir-relative)
 * whose version field should follow the release. Unlike `extraFiles` these
 * need no regex: the handler for each basename knows where the version lives.
 *
 * Edits are targeted rather than parse-and-stringify round-trips, so comments,
 * key order, quoting style, indentation and line endings survive untouched.
 *
 * Unknown basenames are a `CONFIG_INVALID` error, not a silent skip — a
 * configured file that is never bumped is exactly the drift this exists to stop.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { VisReleaseError } from "../errors";

export interface VersionFileWrite {
    /** Absolute path the new content should be written to. */
    content: string;
    path: string;
}

export interface VersionFileResult {
    writes: VersionFileWrite[];
}

type VersionFileKind = "cargo" | "tauri";

const KIND_BY_BASENAME: Record<string, VersionFileKind> = {
    "Cargo.toml": "cargo",
    "tauri.conf.json": "tauri",
};

/** Basenames `versionFiles` understands. Used in error hints and docs. */
export const SUPPORTED_VERSION_FILES: ReadonlyArray<string> = Object.keys(KIND_BY_BASENAME);

const basenameOf = (path: string): string => path.replaceAll("\\", "/").split("/").pop() ?? path;

/** Resolve the handler kind for a manifest path, or `undefined` when unsupported. */
export const resolveVersionFileKind = (path: string): VersionFileKind | undefined => KIND_BY_BASENAME[basenameOf(path)];

// ── Cargo.toml ───────────────────────────────────────────────────────

/** `[package]` and `[workspace.package]` are the only tables that own a literal version. */
const CARGO_VERSION_TABLES = new Set(["package", "workspace.package"]);

const CARGO_TABLE_HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/;

// `version = "1.2.3"` — the value must be a literal. `version.workspace = true`
// and `version = { workspace = true }` do not match, so inherited versions are left alone.
const CARGO_VERSION_LINE = /^(\s*version\s*=\s*)(["'])[^"']*\2/;

/**
 * Rewrite every literal `version` under `[package]` / `[workspace.package]`
 * (or only the tables passed in). Dependency tables are never touched:
 * `serde = { version = "1" }` is a requirement on another crate, not this
 * crate's version.
 */
export const rewriteCargoVersion = (
    raw: string,
    newVersion: string,
    tables: ReadonlySet<string> = CARGO_VERSION_TABLES,
): { content?: string; found: boolean } => {
    const lines = raw.split("\n");
    let table = "";
    let found = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const header = CARGO_TABLE_HEADER.exec(line);

        if (header) {
            table = header[1]!.replaceAll(/\s+/g, "");

            continue;
        }

        if (!tables.has(table)) {
            continue;
        }

        const match = CARGO_VERSION_LINE.exec(line);

        if (!match) {
            continue;
        }

        found = true;
        lines[i] = `${match[1]}${match[2]}${newVersion}${match[2]}${line.slice(match[0].length)}`;
    }

    return found ? { content: lines.join("\n"), found } : { found };
};

// ── tauri.conf.json ──────────────────────────────────────────────────

interface JsonStringSpan {
    end: number;
    start: number;
    value: string;
}

/**
 * Locate the string literal at `path` (object keys only) in JSON source.
 * A small tokenizer, not a full parser: it tracks container nesting and
 * the key each string sits under, and skips string contents so braces and
 * colons inside values cannot confuse it. Input is assumed to be valid JSON
 * (the caller has already run `JSON.parse`).
 */
const findJsonStringAt = (raw: string, path: string[]): JsonStringSpan | undefined => {
    const stack: { isObject: boolean; key?: string }[] = [];
    let pendingKey: string | undefined;
    let i = 0;

    while (i < raw.length) {
        const ch = raw[i]!;

        if (ch === "{" || ch === "[") {
            stack.push({ isObject: ch === "{", key: pendingKey });
            pendingKey = undefined;
            i++;

            continue;
        }

        if (ch === "}" || ch === "]") {
            stack.pop();
            pendingKey = undefined;
            i++;

            continue;
        }

        if (ch === ",") {
            pendingKey = undefined;
            i++;

            continue;
        }

        if (ch !== "\"") {
            i++;

            continue;
        }

        const start = i;

        i++;

        while (i < raw.length && raw[i] !== "\"") {
            i += raw[i] === "\\" ? 2 : 1;
        }

        i++;

        const token = raw.slice(start, i);
        let next = i;

        while (next < raw.length && /\s/.test(raw[next]!)) {
            next++;
        }

        if (raw[next] === ":") {
            pendingKey = JSON.parse(token) as string;
            i = next + 1;

            continue;
        }

        const innermost = stack[stack.length - 1];

        if (pendingKey !== undefined && innermost?.isObject) {
            const valuePath = [...stack.slice(1).map((entry) => entry.key ?? ""), pendingKey];

            if (valuePath.length === path.length && valuePath.every((segment, index) => segment === path[index])) {
                return { end: i, start, value: JSON.parse(token) as string };
            }
        }
    }

    return undefined;
};

/**
 * Tauri v2 keeps `version` at the top level; v1 nests it under `package`.
 * Returns the key path of whichever one the file declares.
 */
const tauriVersionPath = (parsed: unknown): string[] | undefined => {
    if (typeof parsed !== "object" || parsed === null) {
        return undefined;
    }

    const root = parsed as { package?: { version?: unknown }; version?: unknown };

    if (typeof root.version === "string") {
        return ["version"];
    }

    if (typeof root.package?.version === "string") {
        return ["package", "version"];
    }

    return undefined;
};

/**
 * Rewrite the Tauri version string. A value that is a path (Tauri accepts
 * `"../package.json"`) already follows `package.json`, so it is left alone.
 */
export const rewriteTauriVersion = (raw: string, newVersion: string): { content?: string; delegated: boolean; found: boolean } => {
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        return { delegated: false, found: false };
    }

    const path = tauriVersionPath(parsed);

    if (!path) {
        return { delegated: false, found: false };
    }

    const span = findJsonStringAt(raw, path);

    if (!span) {
        return { delegated: false, found: false };
    }

    if (span.value.startsWith(".") || span.value.startsWith("/")) {
        return { delegated: true, found: true };
    }

    return {
        content: `${raw.slice(0, span.start)}${JSON.stringify(newVersion)}${raw.slice(span.end)}`,
        delegated: false,
        found: true,
    };
};

// ── Reading ──────────────────────────────────────────────────────────

/**
 * Read the version a manifest declares, for doctor's drift check.
 * `delegated` means the Tauri value is a path that follows another file.
 */
export const readManifestVersion = async (
    path: string,
    raw: string,
): Promise<{ delegated?: true; version?: string } | undefined> => {
    const kind = resolveVersionFileKind(path);

    if (kind === "cargo") {
        const { parse } = await import("smol-toml");
        const doc = parse(raw) as { package?: { version?: unknown }; workspace?: { package?: { version?: unknown } } };
        // `version.workspace = true` makes [package].version an object, so only a
        // string counts as a literal here. Otherwise the version is inherited from
        // [workspace.package], which is the table the writer bumps.
        const packageVersion = doc.package?.version;
        const version = typeof packageVersion === "string" ? packageVersion : doc.workspace?.package?.version;

        return typeof version === "string" ? { version } : undefined;
    }

    if (kind === "tauri") {
        let parsed: unknown;

        try {
            parsed = JSON.parse(raw);
        } catch {
            return undefined;
        }

        const keyPath = tauriVersionPath(parsed);

        if (!keyPath) {
            return undefined;
        }

        const span = findJsonStringAt(raw, keyPath);

        if (!span) {
            return undefined;
        }

        return span.value.startsWith(".") || span.value.startsWith("/") ? { delegated: true } : { version: span.value };
    }

    return undefined;
};

// ── Orchestration ────────────────────────────────────────────────────

/**
 * Fail on an unsupported `versionFiles` basename. Called from `buildContext`
 * so a config error stops the release before anything is planned or written.
 */
export const assertSupportedVersionFiles = (packageName: string, versionFiles: ReadonlyArray<string>): void => {
    for (const entry of versionFiles) {
        if (!resolveVersionFileKind(entry)) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                hint: `Supported basenames: ${SUPPORTED_VERSION_FILES.join(", ")}. Use extraFiles for other manifests.`,
                message: `versionFiles entry "${entry}" for ${packageName} is not a supported version manifest.`,
            });
        }
    }
};

/**
 * Apply `versionFiles` for one package. A missing or unreadable file, a manifest
 * with no version field, and an unsupported basename all throw `CONFIG_INVALID`
 * naming the file. Continuing would leave the manifest at its old version while
 * the lockfile moved on, so the release stops before anything is written.
 * @param packageDir package directory — entries resolve relative to it
 * @param versionFiles the `versionFiles` entries from the per-package config
 * @param newVersion the package's new version
 * @param packageName used in warning messages
 * @param pending content already queued for a path by `extraFiles`. The
 * version rewrite is applied on top of it, so neither edit overwrites the other.
 */
export const applyVersionFilesForRelease = async (
    packageDir: string,
    versionFiles: ReadonlyArray<string>,
    newVersion: string,
    packageName: string,
    pending: ReadonlyMap<string, string> = new Map(),
): Promise<VersionFileResult> => {
    assertSupportedVersionFiles(packageName, versionFiles);

    const writes: VersionFileWrite[] = [];

    for (const entry of versionFiles) {
        const kind = resolveVersionFileKind(entry)!;
        const absolutePath = isAbsolute(entry) ? entry : join(packageDir, entry);
        let raw = pending.get(absolutePath);

        if (raw === undefined) {
            try {
                raw = await readFile(absolutePath, "utf8");
            } catch (error) {
                const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "does not exist" : `could not be read (${(error as Error).message})`;

                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    file: absolutePath,
                    message: `versionFiles: ${packageName} → ${absolutePath} ${reason}.`,
                });
            }
        }

        const result = kind === "cargo" ? rewriteCargoVersion(raw, newVersion) : rewriteTauriVersion(raw, newVersion);

        if (!result.found) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                file: absolutePath,
                message: `versionFiles: ${packageName} → no version field found in ${absolutePath}.`,
            });
        }

        if (result.content !== undefined && result.content !== raw) {
            writes.push({ content: result.content, path: absolutePath });
        }
    }

    return { writes };
};

// ── Doctor ───────────────────────────────────────────────────────────

export interface VersionFileCheck {
    message: string;
    name: string;
    severity: "info" | "warn";
    status: "pass" | "fail";
}

/**
 * Compare one `versionFiles` entry against its package's `package.json` version.
 * Pure apart from the file read, and never throws: unreadable or malformed
 * manifests become failed checks so one bad file cannot stop the doctor run.
 */
export const checkVersionFile = async (options: {
    entry: string;
    packageDir: string;
    packageName: string;
    packageVersion: string;
}): Promise<VersionFileCheck> => {
    const { entry, packageDir, packageName, packageVersion } = options;
    const name = `version-files/${packageName}/${entry}`;
    const absolutePath = isAbsolute(entry) ? entry : join(packageDir, entry);

    if (!resolveVersionFileKind(entry)) {
        return {
            message: `${packageName}: versionFiles entry "${entry}" is not a supported manifest. Supported basenames: ${SUPPORTED_VERSION_FILES.join(", ")}.`,
            name,
            severity: "warn",
            status: "fail",
        };
    }

    let raw: string;

    try {
        raw = await readFile(absolutePath, "utf8");
    } catch {
        return {
            message: `${packageName}: versionFiles entry "${entry}" doesn't exist (expected ${absolutePath}).`,
            name,
            severity: "warn",
            status: "fail",
        };
    }

    let declared: Awaited<ReturnType<typeof readManifestVersion>>;

    try {
        declared = await readManifestVersion(entry, raw);
    } catch (error) {
        return {
            message: `${packageName}: could not parse ${absolutePath}: ${(error as Error).message}`,
            name,
            severity: "warn",
            status: "fail",
        };
    }

    if (declared?.delegated) {
        return { message: `${entry} of ${packageName} delegates its version to another file.`, name, severity: "info", status: "pass" };
    }

    if (declared?.version === undefined) {
        return {
            message: `${packageName}: no version field found in ${absolutePath}.`,
            name,
            severity: "warn",
            status: "fail",
        };
    }

    if (declared.version === packageVersion) {
        return { message: `${entry} of ${packageName} matches package.json (${packageVersion}).`, name, severity: "info", status: "pass" };
    }

    return {
        message: `${packageName}: ${entry} declares ${declared.version} but package.json declares ${packageVersion}. Set the two to the same version by hand; the next release only rewrites them when it bumps the package.`,
        name,
        severity: "warn",
        status: "fail",
    };
};
