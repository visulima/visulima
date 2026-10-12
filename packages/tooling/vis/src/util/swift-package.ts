/**
 * Reads the parts of a SwiftPM manifest (`Package.swift`) that vis needs: the
 * package name, the local `.package(path:)` dependencies, and the directories
 * that hold a manifest.
 *
 * A manifest is Swift code, so this is a reader, not a parser. It reports a name
 * or path that is not a plain string literal instead of guessing one. Comments are
 * masked with the Gradle reader's rules, which also match Swift's line and block comments.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { maskGradleComments } from "./gradle-build";

export const SWIFT_MANIFEST = "Package.swift";

const SKIPPED_DIRECTORIES = new Set(["node_modules"]);

/** Absolute directories under `root` (inclusive) that hold a `Package.swift`. Dot-directories, `.build` and `node_modules` are not walked. */
export const findSwiftPackageDirectories = (root: string): string[] => {
    const found: string[] = [];

    const visit = (dir: string): void => {
        if (existsSync(join(dir, SWIFT_MANIFEST))) {
            found.push(dir);
        }

        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            // Symlinked directories are not followed (isDirectory is false for them), so a loop cannot form.
            if (entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_DIRECTORIES.has(entry.name)) {
                visit(join(dir, entry.name));
            }
        }
    };

    visit(root);

    return found;
};

/**
 * The top-level arguments of the call whose `(` is at `open` in `masked`, or
 * undefined when the call never closes. Nested brackets and string literals are skipped.
 */
const callArguments = (masked: string, open: number): string[] | undefined => {
    const args: string[] = [];
    let depth = 0;
    let quote: string | undefined;
    let start = open + 1;

    for (let index = open; index < masked.length; index += 1) {
        const char = masked[index]!;

        if (quote === undefined) {
            switch (char) {
                case "\"": {
                    quote = char;

                    break;
                }
                case "(":
                case "[":
                case "{": {
                    depth += 1;

                    break;
                }
                case ")":
                case "]":
                case "}": {
                    depth -= 1;

                    if (depth === 0) {
                        args.push(masked.slice(start, index));

                        return args;
                    }

                    break;
                }
                default: { if (char === "," && depth === 1) {
                    args.push(masked.slice(start, index));
                    start = index + 1;
                }
                }
            }
        } else if (char === "\\") {
            index += 1;
        } else if (char === quote) {
            quote = undefined;
        }
    }

    return undefined;
};

type LabelValue = { kind: "dynamic" } | { kind: "literal"; value: string };

/** The value of a `label: value` argument: a plain string literal, or `dynamic` for anything else. Undefined when the label is absent. */
const labelledArgument = (args: string[], label: string): LabelValue | undefined => {
    const match = args.map((arg) => arg.trim()).find((arg) => new RegExp(String.raw`^${label}\s*:`).test(arg));

    if (match === undefined) {
        return undefined;
    }

    const literal = /^"([^"\\\n]*)"$/.exec(match.slice(match.indexOf(":") + 1).trim());

    return literal ? { kind: "literal", value: literal[1]! } : { kind: "dynamic" };
};

export type SwiftPackageName = { kind: "dynamic" } | { kind: "literal"; name: string } | { kind: "missing" };

/** The name passed to the `Package(name: …)` call. */
export const readSwiftPackageName = (text: string): SwiftPackageName => {
    const masked = maskGradleComments(text);
    const call = /(?<![\w.])Package\s*\(/.exec(masked);
    const args = call === null ? undefined : callArguments(masked, call.index + call[0].length - 1);
    const name = args === undefined ? undefined : labelledArgument(args, "name");

    if (name === undefined) {
        return { kind: "missing" };
    }

    return name.kind === "dynamic" ? { kind: "dynamic" } : { kind: "literal", name: name.value };
};

/** The `path:` of every `.package(path: …)` dependency. `dynamic` is set when one of them is not a string literal. */
export const readSwiftPathDependencies = (text: string): { dynamic: boolean; paths: string[] } => {
    const masked = maskGradleComments(text);
    const paths: string[] = [];
    let dynamic = false;

    for (const call of masked.matchAll(/\.package\s*\(/g)) {
        const args = callArguments(masked, call.index + call[0].length - 1);
        const path = args === undefined ? undefined : labelledArgument(args, "path");

        if (path?.kind === "dynamic") {
            dynamic = true;
        } else if (path?.kind === "literal") {
            paths.push(path.value);
        }
    }

    return { dynamic, paths };
};
