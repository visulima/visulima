/**
 * Reads Zig's `build.zig.zon` manifest, which is Zig's data syntax (a struct
 * literal with `.field = value` entries). Only the fields vis releases and tasks
 * need are read: `.name`, `.version`, and the `.path` dependencies of
 * `.dependencies`. Every other value is parsed for structure and ignored.
 *
 * The reader is strict where a value could hide a version or a package: a
 * non-literal `.version`, a repeated top-level field, or a `.path` that is not a
 * string throws `ZigManifestError`. Nested fields never match a top-level name.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export class ZigManifestError extends Error {
    public constructor(
        public readonly file: string,
        message: string,
    ) {
        super(message);
        this.name = "ZigManifestError";
    }
}

export interface ZigStringValue {
    end: number;
    line: number;
    start: number;
    value: string;
}

/** One entry of `.dependencies`. A dependency has a `.url` and `.hash`, or a `.path`. */
export interface ZigDependency {
    /** The `.hash` string, as written (a multihash, or the `name-version-hashplus` form). */
    hash: string | undefined;
    line: number;
    /** The field name in `.dependencies`, e.g. `clap` for `.clap = .{ ... }`. */
    name: string;
    /** The `.path` string, as written. */
    path: string | undefined;
    /** The `.url` string, as written. */
    url: string | undefined;
}

export interface ZigManifest {
    /** Every entry of `.dependencies`, in file order. */
    dependencies: ZigDependency[];
    /** The `.name` value, from an enum literal (`.foo`) or a string. */
    name: { line: number; value: string } | undefined;
    /** Relative `.path` values of `.dependencies`, as written in the file. */
    pathDependencies: string[];
    /** The `.version` string literal, with its byte span so a release can rewrite it. */
    version: ZigStringValue | undefined;
}

type Node
    = | { kind: "enum"; line: number; name: string }
        | { kind: "other"; line: number }
        | { end: number; kind: "string"; line: number; start: number; value: string }
        | { fields: Field[]; items: Node[]; kind: "struct"; line: number };

interface Field {
    line: number;
    name: string;
    value: Node;
}

const IDENT = /[A-Z_]\w*/iy;
const IDENT_START = /^[A-Z_]/i;
const OTHER = /[\w.+\-@]+/y;

/** Parse the manifest text. `file` is only used in error messages. */
export const parseZigManifest = (raw: string, file: string): ZigManifest => {
    let pos = 0;

    const fail: (message: string, at?: number) => never = (message, at = pos) => {
        const line = raw.slice(0, at).split("\n").length;

        throw new ZigManifestError(file, `${file} line ${line}: ${message}`);
    };

    const lineAt = (at: number): number => raw.slice(0, at).split("\n").length;

    const skipTrivia = (): void => {
        for (;;) {
            const char = raw[pos];

            if (char === " " || char === "\t" || char === "\r" || char === "\n") {
                pos += 1;
            } else if (char === "/" && raw[pos + 1] === "/") {
                const newline = raw.indexOf("\n", pos);

                pos = newline === -1 ? raw.length : newline;
            } else {
                return;
            }
        }
    };

    const readWith = (pattern: RegExp): string | undefined => {
        pattern.lastIndex = pos;

        const match = pattern.exec(raw);

        if (match === null) {
            return undefined;
        }

        pos = pattern.lastIndex;

        return match[0];
    };

    /** An identifier after `.`: bare (`foo`) or quoted (`@"foo-bar"`). */
    const readName = (): string => {
        if (raw[pos] === "@" && raw[pos + 1] === "\"") {
            pos += 1;

            return parseString().value;
        }

        return readWith(IDENT) ?? fail("expected a field or enum name");
    };

    const parseString = (): Extract<Node, { kind: "string" }> => {
        const start = pos;
        const line = lineAt(pos);

        if (raw[pos] !== "\"") {
            fail("expected a string literal");
        }

        pos += 1;
        let value = "";

        for (;;) {
            const char = raw[pos];

            if (char === undefined || char === "\n") {
                fail("unterminated string literal", start);
            }

            if (char === "\"") {
                pos += 1;

                return { end: pos, kind: "string", line, start, value };
            }

            if (char === "\\") {
                const escape = raw[pos + 1];
                const decoded: Record<string, string> = { "\"": "\"", "'": "'", "\\": "\\", n: "\n", r: "\r", t: "\t" };

                const replacement = escape === undefined ? undefined : decoded[escape];

                if (replacement === undefined) {
                    fail(`unsupported escape \\${escape ?? ""}; vis reads only plain string literals`);
                }

                value += replacement;
                pos += 2;
            } else {
                value += char;
                pos += 1;
            }
        }
    };

    /** A value must end at `,` or `}`; anything else (an operator, a call) could change the value, so it is refused. */
    const expectDelimiter = (): void => {
        skipTrivia();

        if (raw[pos] !== "," && raw[pos] !== "}") {
            fail("expected \",\" or \"}\" after a value; vis reads only plain literals, not expressions");
        }
    };

    const parseStruct = (): Extract<Node, { kind: "struct" }> => {
        const line = lineAt(pos);

        pos += 2; // ".{"
        const fields: Field[] = [];
        const items: Node[] = [];

        for (;;) {
            skipTrivia();

            if (pos >= raw.length) {
                fail("unterminated struct literal", 0);
            }

            if (raw[pos] === "}") {
                pos += 1;

                return { fields, items, kind: "struct", line };
            }

            if (raw[pos] === ",") {
                pos += 1;
                continue;
            }

            const entry = pos;

            if (raw[pos] === "." && (IDENT_START.test(raw.charAt(pos + 1)) || raw[pos + 1] === "@")) {
                pos += 1;
                const name = readName();

                skipTrivia();

                if (raw[pos] === "=") {
                    pos += 1;
                    fields.push({ line: lineAt(entry), name, value: parseValue() });
                    expectDelimiter();
                    continue;
                }

                // A bare `.name` with no `=` is an enum literal item, not a field.
                pos = entry;
            }

            items.push(parseValue());
            expectDelimiter();
        }
    };

    const parseValue = (): Node => {
        skipTrivia();

        const char = raw[pos];
        const line = lineAt(pos);

        if (char === "\"") {
            return parseString();
        }

        if (char === "\\") {
            return fail("multiline string literals are not supported; vis reads only a plain \"…\" literal");
        }

        if (char === "." && raw[pos + 1] === "{") {
            return parseStruct();
        }

        if (char === "." && (IDENT_START.test(raw.charAt(pos + 1)) || raw[pos + 1] === "@")) {
            pos += 1;

            return { kind: "enum", line, name: readName() };
        }

        const other = readWith(OTHER);

        if (other === undefined) {
            return fail("expected a value");
        }

        return { kind: "other", line };
    };

    skipTrivia();

    if (raw[pos] !== "." || raw[pos + 1] !== "{") {
        fail("a build.zig.zon manifest is a struct literal starting with \".{\"");
    }

    const root = parseValue();

    skipTrivia();

    if (pos < raw.length) {
        fail("unexpected text after the manifest struct");
    }

    if (root.kind !== "struct") {
        fail("a build.zig.zon manifest is a struct literal");
    }

    const topLevel = (name: string): Field[] => (root.kind === "struct" ? root.fields.filter((field) => field.name === name) : []);

    const onlyField = (name: string): Field | undefined => {
        const matches = topLevel(name);

        if (matches.length > 1) {
            fail(`declares .${name} ${String(matches.length)} times (lines ${matches.map((field) => String(field.line)).join(", ")})`, 0);
        }

        return matches[0];
    };

    const nameField = onlyField("name");
    let name: ZigManifest["name"];

    if (nameField !== undefined) {
        if (nameField.value.kind === "enum") {
            name = { line: nameField.line, value: nameField.value.name };
        } else if (nameField.value.kind === "string") {
            name = { line: nameField.line, value: nameField.value.value };
        } else {
            throw new ZigManifestError(file, `${file} sets .name on line ${String(nameField.line)} to something other than a literal. vis reads an enum literal (.name = .foo) or a string.`);
        }
    }

    const versionField = onlyField("version");
    let version: ZigStringValue | undefined;

    if (versionField !== undefined) {
        if (versionField.value.kind !== "string") {
            throw new ZigManifestError(file, `${file} sets .version on line ${String(versionField.line)} to something other than a string literal. vis reads only a plain "…" version.`);
        }

        version = { end: versionField.value.end, line: versionField.line, start: versionField.value.start, value: versionField.value.value };
    }

    const pathDependencies: string[] = [];
    const dependencyList: ZigDependency[] = [];
    const dependencies = onlyField("dependencies");

    if (dependencies !== undefined) {
        if (dependencies.value.kind !== "struct") {
            throw new ZigManifestError(file, `${file} sets .dependencies on line ${String(dependencies.line)} to something other than a struct.`);
        }

        for (const dependency of dependencies.value.fields) {
            if (dependency.value.kind !== "struct") {
                throw new ZigManifestError(file, `${file} line ${String(dependency.line)}: dependency .${dependency.name} is not a struct.`);
            }

            const stringField = (fieldName: "hash" | "path" | "url"): string | undefined => {
                const matches = dependency.value.kind === "struct" ? dependency.value.fields.filter((candidate) => candidate.name === fieldName) : [];

                if (matches.length === 0) {
                    return undefined;
                }

                const field = matches[0];

                if (field?.value.kind !== "string") {
                    throw new ZigManifestError(file, `${file} line ${String(field?.line ?? dependency.line)}: dependency .${dependency.name} sets .${fieldName} to something other than a string literal.`);
                }

                return field.value.value;
            };

            const path = stringField("path");

            if (path !== undefined) {
                pathDependencies.push(path);
            }

            dependencyList.push({ hash: stringField("hash"), line: dependency.line, name: dependency.name, path, url: stringField("url") });
        }
    }

    return { dependencies: dependencyList, name, pathDependencies, version };
};

export interface ZigManifestNode {
    /** Absolute directory holding the manifest. */
    dir: string;
    manifest: ZigManifest;
    /** Absolute path of the `build.zig.zon`. */
    path: string;
}

const MANIFEST = "build.zig.zon";

/** True when `target` is `base` or inside it. A sibling such as `base-two` or `..foo` is not inside. */
export const isInsideDirectory = (base: string, target: string): boolean => {
    const rel = relative(base, target);

    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/**
 * Every manifest reachable from `root`'s `.path` dependencies that stays inside
 * `workspaceRoot`, root first. Each directory is read once, so a cycle ends.
 * `read` returns undefined for a missing file.
 */
export const walkZigManifests = (root: string, workspaceRoot: string, read: (path: string) => string | undefined): ZigManifestNode[] => {
    const nodes: ZigManifestNode[] = [];
    const seen = new Set<string>();

    const visit = (dir: string): void => {
        const path = join(dir, MANIFEST);

        if (seen.has(path)) {
            return;
        }

        seen.add(path);

        const raw = read(path);

        if (raw === undefined) {
            return;
        }

        const manifest = parseZigManifest(raw, path);

        nodes.push({ dir, manifest, path });

        for (const dependency of manifest.pathDependencies) {
            const target = resolve(dir, dependency);

            if (isInsideDirectory(workspaceRoot, target)) {
                visit(target);
            }
        }
    };

    visit(root);

    return nodes;
};

/** Reads a file with `node:fs`, or undefined when it does not exist. Used by the release side. */
export const readIfExists = (path: string): string | undefined => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** The `.name` a package directory declares, or undefined when there is no readable manifest. Never throws. */
export const readZigManifestName = (dir: string): string | undefined => {
    try {
        return parseZigManifest(readIfExists(join(dir, MANIFEST)) ?? "", join(dir, MANIFEST)).name?.value;
    } catch {
        return undefined;
    }
};
