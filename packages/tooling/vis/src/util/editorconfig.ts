/**
 * Shared helpers for reading `.editorconfig` defaults so file-transformation
 * commands (sort-package-json, migrate/*, hook/*, pm/overrides, etc.) all
 * pick up the project's configured indent style instead of each rolling
 * their own detection.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";

import { resolveEditorconfigDefaults as resolveEditorconfigDefaultsNative } from "#native";

export interface EditorConfigDefaults {
    indent?: string;
    lineEnding?: "crlf" | "lf";
}

export interface ResolveIndentOptions {
    /** Indent to use when neither `.editorconfig` nor `contents` yield one. Defaults to two spaces. */
    defaultIndent?: string;
    /** Whether to consult `.editorconfig` for indent. Set to `false` to skip the lookup. Defaults to `true`. */
    useEditorconfig?: boolean;
}

const INDENT_RE = /\n([ \t]+)/;

/**
 * Reads `.editorconfig` for the given file path and maps the relevant
 * properties onto `{ indent, lineEnding }`. The native binding wraps `ec4rs`,
 * which already collapses parse / IO failures to empty defaults — callers
 * can rely on the result without try/catch noise.
 */
export const resolveEditorConfigDefaults = (filePath: string): EditorConfigDefaults => {
    const { indent, lineEnding } = resolveEditorconfigDefaultsNative(filePath);

    const defaults: EditorConfigDefaults = {};

    if (indent !== undefined) {
        defaults.indent = indent;
    }

    if (lineEnding === "lf" || lineEnding === "crlf") {
        defaults.lineEnding = lineEnding;
    }

    return defaults;
};

/**
 * Resolves the indent string for `filePath`.
 *
 * Priority order:
 * 1. `.editorconfig` (when `useEditorconfig` is true).
 * 2. Sniff from `contents` (first indented line).
 * 3. `defaultIndent` (defaults to two spaces).
 */
export const resolveIndentForFile = (filePath: string, contents?: string, options: ResolveIndentOptions = {}): string => {
    const { defaultIndent = "  ", useEditorconfig = true } = options;

    if (useEditorconfig) {
        const { indent } = resolveEditorConfigDefaults(filePath);

        if (indent !== undefined) {
            return indent;
        }
    }

    if (contents !== undefined) {
        const match = INDENT_RE.exec(contents);

        if (match?.[1] !== undefined) {
            return match[1];
        }
    }

    return defaultIndent;
};

/**
 * Convenience wrapper around `resolveIndentForFile` that reads the file
 * itself when it exists. Use at write sites that don't already have
 * the file contents in hand (e.g. `writeJsonSync` callers).
 */
export const resolveIndentForExistingFile = (filePath: string, options: ResolveIndentOptions = {}): string => {
    const contents = isAccessibleSync(filePath) ? readFileSync(filePath) : undefined;

    return resolveIndentForFile(filePath, contents, options);
};
