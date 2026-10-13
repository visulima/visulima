/**
 * Reads a RubyGems `*.gemspec` as text. vis never runs Ruby: it takes the name,
 * the version and the runtime dependency names from plain lines, and refuses
 * anything else with an error that names the line.
 *
 * The version is either a string literal in the gemspec (`spec.version = "1.0.0"`)
 * or `Name::VERSION`, where `lib/&lt;name>/version.rb` holds `VERSION = "1.0.0"`.
 * Any other form is an error, because a silent skip would hide the version.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIRECTORIES = new Set([".bundle", "node_modules", "vendor"]);

/** A string literal on one line. Double or single quotes, no interpolation, no escapes. */
const STRING_LITERAL = /^(?:"([^"\\#]*)"|'([^'\\]*)')$/;

/** `Name::VERSION` or `Outer::Name::VERSION`. */
const VERSION_CONSTANT = /^[A-Z]\w*(?:::[A-Z]\w*)*::VERSION$/;

/** `spec.version = …`, `s.name = …`: a receiver, an attribute and the right-hand side. */
const ASSIGNMENT = /^\s*(\w+)\.(name|version)\s*=\s*(.*?)\s*$/;

const DEPENDENCY = /^\s*\w+\.add_(?:runtime_)?dependency\s*\(?\s*["']([^"']+)["']/;

/** The block parameter of `Gem::Specification.new do |s|` or `Gem::Specification.new { |s| … }`. */
const BLOCK_PARAM = /Gem::Specification\.new\s*(?:do|\{)\s*\|\s*(\w+)\s*\|/;

export interface GemspecError {
    file: string;
    message: string;
}

export class GemspecReadError extends Error {
    public readonly file: string;

    public constructor(file: string, message: string) {
        super(message);
        this.name = "GemspecReadError";
        this.file = file;
    }
}

/** A value from a gemspec or version file, with the 1-based line it is on. */
export interface GemField {
    line: number;
    value: string;
}

export type GemVersion
    = | { constant: string; kind: "constant"; line: number }
        | { kind: "literal"; line: number; value: string };

export interface GemspecInfo {
    /** Runtime dependency names (`add_dependency` / `add_runtime_dependency` with a literal name). */
    dependencies: string[];
    /** `spec.name = "…"`, or undefined when the gemspec never sets it. */
    name: GemField | undefined;
    /** `spec.version`, or undefined for an aggregate with no version. */
    version: GemVersion | undefined;
}

const stringValue = (rhs: string): string | undefined => {
    const match = STRING_LITERAL.exec(rhs);

    return match === null ? undefined : (match[1] ?? match[2]);
};

/**
 * Parse a gemspec. Throws `GemspecReadError` when the name or the version is set
 * to something other than a string literal (or, for the version, `Name::VERSION`),
 * or when either is set twice.
 */
export const parseGemspec = (raw: string, file: string): GemspecInfo => {
    const lines = raw.split(/\r?\n/);
    const block = BLOCK_PARAM.exec(raw)?.[1] ?? "spec";
    const dependencies: string[] = [];
    let name: GemField | undefined;
    let version: GemVersion | undefined;

    const fail = (line: number, message: string): never => {
        throw new GemspecReadError(file, `${file} line ${String(line)}: ${message}`);
    };

    // Constructor arguments are not read. Refuse them rather than read a missing version as an aggregate.
    if (/Gem::Specification\.new\s*\(/.test(raw)) {
        throw new GemspecReadError(file, `${file} passes arguments to Gem::Specification.new. vis reads the version only from spec.version = "…" inside the block.`);
    }

    for (const [index, text] of lines.entries()) {
        const line = index + 1;
        const dependency = DEPENDENCY.exec(text);

        if (dependency?.[1] !== undefined) {
            dependencies.push(dependency[1]);

            continue;
        }

        const assignment = ASSIGNMENT.exec(text);

        if (assignment?.[1] !== block) {
            continue;
        }

        const attribute = assignment[2];
        const rhs = (assignment[3] ?? "").replace(/\s+#.*$/, "");

        if (attribute === "name") {
            if (name !== undefined) {
                fail(line, `spec.name is set twice (lines ${String(name.line)} and ${String(line)}). vis cannot tell which one applies.`);
            }

            const value = stringValue(rhs);

            if (value === undefined) {
                fail(line, `spec.name is not a plain string literal. vis reads only spec.name = "my-gem".`);
            }

            name = { line, value: value! };

            continue;
        }

        if (version !== undefined) {
            fail(line, `spec.version is set twice (lines ${String(version.line)} and ${String(line)}). vis cannot tell which one applies.`);
        }

        const value = stringValue(rhs);

        if (value !== undefined) {
            version = { kind: "literal", line, value };
        } else if (VERSION_CONSTANT.test(rhs)) {
            version = { constant: rhs, kind: "constant", line };
        } else {
            fail(line, `spec.version is not a string literal or Name::VERSION. vis reads only spec.version = "1.0.0" or a VERSION constant in lib/<name>/version.rb.`);
        }
    }

    // A version assignment vis could not read (a one-line block, another receiver) must not pass as an aggregate.
    if (version === undefined && /\.version\s*=/.test(raw)) {
        throw new GemspecReadError(file, `${file} assigns a version that vis cannot read. Put spec.version = "1.0.0" on its own line inside the Gem::Specification block.`);
    }

    return { dependencies, name, version };
};

/**
 * The version file a `Name::VERSION` gemspec reads: `lib/&lt;name>/version.rb`, with
 * the gem name's dashes turned into directories (`foo-bar` → `lib/foo/bar/version.rb`).
 */
export const gemVersionFile = (dir: string, name: string): string => join(dir, "lib", ...name.split("-"), "version.rb");

/**
 * The single `VERSION = "…"` string literal in a version file. Any other form, or a
 * second `VERSION =` assignment, is an error.
 */
export const readGemVersionConstant = (raw: string, file: string): GemField => {
    const found: GemField[] = [];

    for (const [index, text] of raw.split(/\r?\n/).entries()) {
        const match = /^\s*VERSION\s*=\s*(.*?)\s*$/.exec(text);

        if (match === null) {
            continue;
        }

        const value = stringValue((match[1] ?? "").replace(/\s+#.*$/, ""));

        if (value === undefined) {
            throw new GemspecReadError(file, `${file} line ${String(index + 1)}: VERSION is not a plain string literal. vis reads only VERSION = "1.0.0".`);
        }

        found.push({ line: index + 1, value });
    }

    if (found.length !== 1) {
        throw new GemspecReadError(file, `${file} declares VERSION ${String(found.length)} times. vis needs exactly one VERSION = "…" literal.`);
    }

    return found[0]!;
};

/** Rewrite the quoted literal on `line` (1-based) to `value`, keeping its quote style. */
export const replaceGemLiteral = (raw: string, line: number, value: string): string => {
    const lines = raw.split("\n");
    const index = line - 1;
    const text = lines[index];

    if (text === undefined || !/=\s*(["'])[^"'\\]*\1/.test(text)) {
        throw new GemspecReadError("", `line ${String(line)} has no string literal to rewrite`);
    }

    lines[index] = text.replace(/=(\s*)(["'])[^"'\\]*\2/, (_match, space: string, quote: string) => `=${space}${quote}${value}${quote}`);

    return lines.join("\n");
};

/**
 * Every `*.gemspec` under `root`, sorted. `vendor`, `node_modules` and `.bundle` are
 * not searched. Each gemspec's path is absolute when `root` is.
 */
export const findGemspecs = (root: string): string[] => {
    const found: string[] = [];

    const visit = (dir: string): void => {
        for (const entry of readdirSync(dir).sort()) {
            const path = join(dir, entry);

            if (entry.endsWith(".gemspec")) {
                if (statSync(path).isFile()) {
                    found.push(path);
                }

                continue;
            }

            if (!SKIP_DIRECTORIES.has(entry) && statSync(path).isDirectory()) {
                visit(path);
            }
        }
    };

    if (existsSync(root)) {
        visit(root);
    }

    return found;
};
