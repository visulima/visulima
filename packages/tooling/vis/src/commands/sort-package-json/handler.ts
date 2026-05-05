import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { basename, join, relative, resolve } from "@visulima/path";
import { render } from "@visulima/tui";
import { parseSync as parseEditorConfigSync } from "editorconfig";
import isInCi from "is-in-ci";
import React from "react";
import zeptomatch from "zeptomatch";

import { sortPackageJsonStringWithOptions } from "#native";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../../config/workspace";
import { pail } from "../../io/logger";
import type { SortError, SortFileEntry, SortKeyDiff } from "../../tui/components/sort-package-json/SortPackageJsonStore";
import { SortPackageJsonStore } from "../../tui/components/sort-package-json/SortPackageJsonStore";
import VisSortPackageJsonApp from "../../tui/components/sort-package-json/VisSortPackageJsonApp";
import type { FormatPackageJsonOptions } from "../../util/format-package-json-fields";
import { formatPackageJsonFields } from "../../util/format-package-json-fields";
import { errorMessage } from "../../util/utils";
import type { SortPackageJsonOptions } from "./index";

type LineEnding = "auto" | "crlf" | "lf";

interface SortPackageJsonConfig {
    editorconfig?: boolean;
    finalNewline?: boolean;
    formatBugs?: boolean;
    formatRepository?: boolean;
    ignore?: string[];
    indent?: string;
    lineEnding?: LineEnding;
    sortExports?: boolean;
    sortOrder?: string[];
    sortScripts?: boolean;
    unsorted?: string[];
}

interface NormalizedConfig {
    editorconfig: boolean;
    finalNewline: boolean;
    formatBugs: boolean;
    formatRepository: boolean;
    ignore: string[];
    /** Explicit indent override (CLI/config). When undefined the per-file pipeline tries .editorconfig, then file detection. */
    indent: string | undefined;
    lineEnding: LineEnding;
    sortExports: boolean;
    sortOrder: string[];
    sortScripts: boolean;
    unsorted: string[];
}

interface EditorConfigDefaults {
    indent?: string;
    lineEnding?: "crlf" | "lf";
}

const PARSE_POSITION_REGEX = /at position (\d+)/;
const PARSE_LINE_COLUMN_REGEX = /\(?line (\d+) column (\d+)\)?/;

const findPackageJsonFiles = (root: string): string[] => {
    const seen = new Set<string>();
    const results: string[] = [];

    const addFile = (filePath: string): void => {
        const resolved = resolve(filePath);

        if (!seen.has(resolved) && isAccessibleSync(resolved)) {
            seen.add(resolved);
            results.push(resolved);
        }
    };

    addFile(join(root, "package.json"));

    const pnpmPatterns = readPnpmWorkspacePatterns(root);

    if (pnpmPatterns) {
        const projectDirectories = resolveWorkspacePatterns(root, pnpmPatterns);

        for (const dir of projectDirectories) {
            addFile(join(root, dir, "package.json"));
        }
    } else {
        const rootPkgPath = join(root, "package.json");

        if (isAccessibleSync(rootPkgPath)) {
            const rootPkg = JSON.parse(readFileSync(rootPkgPath)) as {
                workspaces?: string[] | { packages?: string[] };
            };
            const patterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces?.packages;

            if (patterns) {
                const projectDirectories = resolveWorkspacePatterns(root, patterns);

                for (const dir of projectDirectories) {
                    addFile(join(root, dir, "package.json"));
                }
            }
        }
    }

    return results;
};

const detectIndent = (contents: string): string => {
    const match = /\n([ \t]+)/.exec(contents);

    return match?.[1] ?? "  ";
};

const resolveIndentOverride = (raw: string | undefined): string | undefined => {
    if (raw === undefined || raw === "") {
        return undefined;
    }

    if (raw === "tab" || raw === String.raw`\t`) {
        return "\t";
    }

    if (/^\d+$/.test(raw)) {
        return " ".repeat(Number.parseInt(raw, 10));
    }

    return raw;
};

const splitList = (raw: string | string[] | undefined): string[] => {
    if (raw === undefined) {
        return [];
    }

    const items = Array.isArray(raw) ? raw : [raw];

    return items
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

const detectLineEnding = (contents: string): "crlf" | "lf" => (contents.includes("\r\n") ? "crlf" : "lf");

const resolveEditorConfigDefaults = (filePath: string): EditorConfigDefaults => {
    let props: Record<string, unknown>;

    try {
        props = parseEditorConfigSync(filePath);
    } catch {
        return {};
    }

    const defaults: EditorConfigDefaults = {};
    const indentStyle = props["indent_style"];
    const indentSize = props["indent_size"];

    if (indentStyle === "tab") {
        defaults.indent = "\t";
    } else if (typeof indentSize === "number" && Number.isInteger(indentSize) && indentSize > 0) {
        defaults.indent = " ".repeat(indentSize);
    }

    const endOfLine = props["end_of_line"];

    if (endOfLine === "lf" || endOfLine === "crlf") {
        defaults.lineEnding = endOfLine;
    }

    return defaults;
};

const ALLOWED_LINE_ENDINGS = new Set<LineEnding>(["auto", "crlf", "lf"]);

// eslint-disable-next-line consistent-return
const validateLineEnding = (raw: string | undefined): LineEnding => {
    if (raw === undefined || raw === "") {
        return "auto";
    }

    if (ALLOWED_LINE_ENDINGS.has(raw as LineEnding)) {
        return raw as LineEnding;
    }

    pail.error(`--line-ending must be one of: auto, lf, crlf (got "${raw}")`);
    process.exit(2);
};

const filterByIgnore = (files: string[], patterns: string[], cwd: string): string[] => {
    if (patterns.length === 0) {
        return files;
    }

    return files.filter((absolute) => {
        const relPath = relative(cwd, absolute);
        const base = basename(absolute);

        return !patterns.some((pattern) => {
            const target = pattern.includes("/") ? relPath : base;

            return zeptomatch(pattern, target);
        });
    });
};

const applySortOrder = (object: Record<string, unknown>, sortOrder: string[]): Record<string, unknown> => {
    if (sortOrder.length === 0) {
        return object;
    }

    const result: Record<string, unknown> = {};
    const consumed = new Set<string>();

    for (const key of sortOrder) {
        if (Object.hasOwn(object, key)) {
            result[key] = object[key];
            consumed.add(key);
        }
    }

    for (const key of Object.keys(object)) {
        if (!consumed.has(key)) {
            result[key] = object[key];
        }
    }

    return result;
};

const restoreUnsortedSections = (sorted: Record<string, unknown>, original: Record<string, unknown>, unsorted: string[]): Record<string, unknown> => {
    if (unsorted.length === 0) {
        return sorted;
    }

    const result: Record<string, unknown> = { ...sorted };

    for (const key of unsorted) {
        if (Object.hasOwn(original, key)) {
            result[key] = original[key];
        }
    }

    return result;
};

const computeLineColumn = (source: string, position: number): { column: number; line: number } => {
    let line = 1;
    let column = 1;
    const limit = Math.min(position, source.length);

    for (let index = 0; index < limit; index++) {
        if (source.codePointAt(index) === 10) {
            line++;
            column = 1;
        } else {
            column++;
        }
    }

    return { column, line };
};

const buildSnippet = (source: string, errorLine: number, contextLines = 2): { content: string; isErrorLine: boolean; lineNumber: number }[] => {
    const lines = source.split("\n");

    if (errorLine < 1 || errorLine > lines.length) {
        return [];
    }

    const start = Math.max(0, errorLine - 1 - contextLines);
    const end = Math.min(lines.length, errorLine + contextLines);
    const rows: { content: string; isErrorLine: boolean; lineNumber: number }[] = [];

    for (let index = start; index < end; index++) {
        rows.push({
            content: lines[index] ?? "",
            isErrorLine: index + 1 === errorLine,
            lineNumber: index + 1,
        });
    }

    return rows;
};

const extractParseErrorContext = (
    error: unknown,
    source: string,
): { column: number; line: number; snippet: { content: string; isErrorLine: boolean; lineNumber: number }[] } | undefined => {
    if (!(error instanceof Error)) {
        return undefined;
    }

    const positionMatch = PARSE_POSITION_REGEX.exec(error.message);

    if (positionMatch) {
        const { column, line } = computeLineColumn(source, Number.parseInt(positionMatch[1] ?? "0", 10));

        return { column, line, snippet: buildSnippet(source, line) };
    }

    const lineColumnMatch = PARSE_LINE_COLUMN_REGEX.exec(error.message);

    if (lineColumnMatch) {
        const line = Number.parseInt(lineColumnMatch[1] ?? "1", 10);
        const column = Number.parseInt(lineColumnMatch[2] ?? "1", 10);

        return { column, line, snippet: buildSnippet(source, line) };
    }

    return undefined;
};

const computeKeyDiff = (originalJson: string, sortedJson: string): SortKeyDiff[] => {
    const before = Object.keys(JSON.parse(originalJson) as Record<string, unknown>);
    const after = Object.keys(JSON.parse(sortedJson) as Record<string, unknown>);
    const beforeIndex = new Map(before.map((key, index) => [key, index]));
    const diff: SortKeyDiff[] = [];

    for (const [toIndex, key] of after.entries()) {
        const fromIndex = beforeIndex.get(key);

        if (fromIndex !== undefined && fromIndex !== toIndex) {
            diff.push({ fromIndex, key, toIndex });
        }
    }

    return diff;
};

const sortContents = (contents: string, config: NormalizedConfig, editorDefaults: EditorConfigDefaults): string => {
    const indent = config.indent ?? editorDefaults.indent ?? detectIndent(contents);
    const resolvedLineEnding: "crlf" | "lf" = config.lineEnding === "auto" ? (editorDefaults.lineEnding ?? detectLineEnding(contents)) : config.lineEnding;

    const compact = sortPackageJsonStringWithOptions(contents, {
        pretty: false,
        sortScripts: config.sortScripts,
    });

    let parsed = JSON.parse(compact) as Record<string, unknown>;

    if (config.unsorted.length > 0) {
        const original = JSON.parse(contents) as Record<string, unknown>;

        parsed = restoreUnsortedSections(parsed, original, config.unsorted);
    }

    parsed = applySortOrder(parsed, config.sortOrder);

    const formatOptions: FormatPackageJsonOptions = {
        formatBugs: config.formatBugs,
        formatRepository: config.formatRepository,
        sortExports: config.sortExports,
    };
    const formatted = formatPackageJsonFields(parsed, formatOptions);

    let output = JSON.stringify(formatted.pkg, null, indent);

    if (config.finalNewline) {
        output += "\n";
    }

    if (resolvedLineEnding === "crlf") {
        output = output.replaceAll("\n", "\r\n");
    }

    return output;
};

interface ProcessFileOptions {
    checkMode: boolean;
    cwd: string;
    normalized: NormalizedConfig;
}

/**
 * Runs the full pipeline against a single file and returns a typed
 * outcome instead of throwing. Each error path (read / native sort /
 * JSON parse / write) is tagged so the report can show *where* the
 * pipeline broke, not just that it broke.
 */
const processFile = (filePath: string, { checkMode, cwd, normalized }: ProcessFileOptions): SortFileEntry => {
    const relativePath = relative(cwd, filePath) || filePath;
    let contents: string;

    try {
        contents = readFileSync(filePath);
    } catch (error: unknown) {
        return {
            diff: [],
            error: { message: errorMessage(error), step: "read" },
            filePath,
            relativePath,
            status: "error",
        };
    }

    let compact: string;

    try {
        compact = sortPackageJsonStringWithOptions(contents, {
            pretty: false,
            sortScripts: normalized.sortScripts,
        });
    } catch (error: unknown) {
        const sortError: SortError = { message: errorMessage(error), step: "native-sort" };
        const context = extractParseErrorContext(error, contents);

        if (context) {
            sortError.context = context;
        }

        return { diff: [], error: sortError, filePath, relativePath, status: "error" };
    }

    const editorDefaults: EditorConfigDefaults = normalized.editorconfig ? resolveEditorConfigDefaults(filePath) : {};

    let sorted: string;

    try {
        sorted = sortContents(contents, normalized, editorDefaults);
    } catch (error: unknown) {
        const sortError: SortError = { message: errorMessage(error), step: "json-parse" };
        const context = extractParseErrorContext(error, contents);

        if (context) {
            sortError.context = context;
        }

        return { diff: [], error: sortError, filePath, relativePath, status: "error" };
    }

    if (contents === sorted) {
        return { diff: [], filePath, relativePath, status: "unchanged" };
    }

    let diff: SortKeyDiff[];

    try {
        diff = computeKeyDiff(contents, compact);
    } catch {
        diff = [];
    }

    if (checkMode) {
        return { diff, filePath, relativePath, status: "would-rewrite" };
    }

    try {
        writeFileSync(filePath, sorted, "utf8");
    } catch (error: unknown) {
        return {
            diff,
            error: { message: errorMessage(error), step: "write" },
            filePath,
            relativePath,
            status: "error",
        };
    }

    return { diff, filePath, relativePath, status: "rewritten" };
};

/**
 * Renders the static error block for non-TTY output. Layers step tag,
 * source position, and a short snippet on top of the basic message so
 * users who can't enter the TUI still see the *why*.
 */
const printStaticError = (entry: SortFileEntry): void => {
    if (!entry.error) {
        return;
    }

    pail.error(`${entry.filePath}: ${entry.error.message}`);
    pail.info(`  step: ${entry.error.step}`);

    if (entry.error.context) {
        pail.info(`  at line ${String(entry.error.context.line)}, column ${String(entry.error.context.column)}`);

        for (const row of entry.error.context.snippet) {
            const marker = row.isErrorLine ? ">" : " ";

            pail.info(`  ${marker} ${String(row.lineNumber).padStart(4)} | ${row.content}`);
        }
    }
};

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SortPackageJsonOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const config = (visConfig as Record<string, unknown> | undefined)?.["sortPackageJson"] as SortPackageJsonConfig | undefined;
    const checkMode = options.check || false;

    const editorconfigEnabled = options.editorconfig === false ? false : (config?.editorconfig ?? true);

    const normalized: NormalizedConfig = {
        editorconfig: editorconfigEnabled,
        finalNewline: options.finalNewline ?? config?.finalNewline ?? true,
        formatBugs: options.formatBugs === false ? false : (config?.formatBugs ?? true),
        formatRepository: options.formatRepository === false ? false : (config?.formatRepository ?? true),
        ignore: [...splitList(options.ignore), ...(config?.ignore ?? [])],
        indent: resolveIndentOverride(options.indent ?? config?.indent),
        lineEnding: validateLineEnding(options.lineEnding ?? config?.lineEnding),
        sortExports: options.sortExports === false ? false : (config?.sortExports ?? true),
        sortOrder: [...splitList(options.sortOrder), ...(config?.sortOrder ?? [])],
        sortScripts: options.sortScripts || config?.sortScripts || false,
        unsorted: [...splitList(options.unsorted), ...(config?.unsorted ?? [])],
    };

    const allFiles = findPackageJsonFiles(cwd);
    const files = filterByIgnore(allFiles, normalized.ignore, cwd);

    if (files.length === 0) {
        pail.info(allFiles.length === 0 ? "No package.json files found." : "All package.json files were excluded by --ignore.");

        return;
    }

    const entries: SortFileEntry[] = [];

    for (const filePath of files) {
        entries.push(processFile(filePath, { checkMode, cwd, normalized }));
    }

    let unsortedCount = 0;
    let sortedCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
        if (entry.status === "error") {
            errorCount++;
        } else if (entry.status === "rewritten" || entry.status === "would-rewrite") {
            unsortedCount++;
        } else {
            sortedCount++;
        }
    }

    const hasFindings = unsortedCount > 0 || errorCount > 0;
    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;

    // Drop into the TUI only when there's something interesting to show.
    // Skip it on a clean run, in CI, or in non-TTY shells — those keep
    // the existing static text path.
    if (isTTY && hasFindings) {
        const store = new SortPackageJsonStore(entries);
        const instance = render(React.createElement(VisSortPackageJsonApp, { checkMode, store }), {
            alternateScreen: true,
            exitOnCtrlC: false,
            interactive: true,
            patchConsole: true,
        });

        await instance.waitUntilExit();
    } else {
        for (const entry of entries) {
            switch (entry.status) {
                case "error": {
                    printStaticError(entry);
                    break;
                }
                case "rewritten": {
                    pail.success(`Sorted ${entry.filePath}`);
                    break;
                }
                case "would-rewrite": {
                    pail.warn(`${entry.filePath} is not sorted`);
                    break;
                }
                default: {
                    break;
                }
            }
        }
    }

    if (checkMode) {
        if (unsortedCount > 0) {
            pail.info(`${String(unsortedCount)} file${unsortedCount === 1 ? "" : "s"} not sorted, ${String(sortedCount)} already sorted`);
            process.exitCode = 1;
        } else if (errorCount === 0) {
            pail.info(`All ${String(sortedCount)} package.json file${sortedCount === 1 ? " is" : "s are"} sorted`);
        }
    } else {
        const parts: string[] = [];

        if (unsortedCount > 0) {
            parts.push(`sorted ${String(unsortedCount)} file${unsortedCount === 1 ? "" : "s"}`);
        }

        if (sortedCount > 0) {
            parts.push(`${String(sortedCount)} already sorted`);
        }

        if (errorCount > 0) {
            parts.push(`${String(errorCount)} error${errorCount === 1 ? "" : "s"}`);
        }

        if (parts.length > 0) {
            pail.info(parts.join(", "));
        }
    }

    if (errorCount > 0) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
export { buildSnippet, computeKeyDiff, computeLineColumn, extractParseErrorContext, processFile };
