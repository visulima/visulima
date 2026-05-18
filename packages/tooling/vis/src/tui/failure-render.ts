import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bold, cyan, dim, red } from "@visulima/colorize";
import type { Trace } from "@visulima/error";
import { codeFrame, parseStacktrace } from "@visulima/error";
import { loadSourceMap, originalPositionFor, sourceContentFor } from "@visulima/source-map";

export interface RenderFailureOptions {
    /** Emit ANSI color. When false, the block is plain text. */
    color: boolean;
    /** Workspace/process root used to shorten and resolve frame paths. */
    cwd: string;
}

const ANSI_REGEX = /\[[0-9;]*m/g;

const stripAnsi = (value: string): string => value.replaceAll(ANSI_REGEX, "");

// A line that opens a JS error: optional leading noise, then `SomeError`
// or `Some.Error: message`. Kept deliberately conservative — a false
// positive only costs us a code frame, never the raw output (which is
// always preserved below the rendered block).
const ERROR_HEADER_REGEX = /^(?<name>(?:[A-Z][\w$]*)?(?:Error|Exception))(?::[ \t](?<message>.*))?$/;
const STACK_FRAME_REGEX = /^\s*at\s+/;

interface ErrorBlock {
    message: string;
    name: string;
    /** `name: message\n    at …` — the synthetic `error.stack` form. */
    stack: string;
}

/**
 * Find the last error header in `text` that is followed by at least one
 * V8/Node `at …` frame. The last one wins because the most recent throw
 * is what a runner reports as the failure.
 */
const extractErrorBlock = (text: string): ErrorBlock | undefined => {
    const lines = text.split("\n");
    let found: ErrorBlock | undefined;

    for (let index = 0; index < lines.length; index++) {
        const header = ERROR_HEADER_REGEX.exec(lines[index]!.trim());

        if (!header) {
            continue;
        }

        const frames: string[] = [];

        for (let next = index + 1; next < lines.length && next <= index + 200; next++) {
            const line = lines[next]!;

            if (STACK_FRAME_REGEX.test(line)) {
                frames.push(line.trim());
            } else if (frames.length > 0) {
                break;
            } else if (line.trim() !== "") {
                // Non-empty, non-frame line before any frame — not a stack.
                break;
            }
        }

        if (frames.length > 0) {
            const name = header.groups?.["name"] ?? "Error";
            const message = header.groups?.["message"] ?? "";

            found = {
                message,
                name,
                stack: `${name}: ${message}\n${frames.map((f) => `    ${f}`).join("\n")}`,
            };
        }
    }

    return found;
};

const normalizeFramePath = (file: string): string => {
    if (file.startsWith("file://")) {
        try {
            return fileURLToPath(file);
        } catch {
            return file;
        }
    }

    return file;
};

const isUserFrame = (file: string): boolean => !file.includes("node_modules") && !file.startsWith("node:") && !file.startsWith("internal/");

interface ResolvedFrame {
    column: number | undefined;
    file: string;
    line: number;
    source: string;
}

/**
 * Resolve a parsed frame to source text + position, applying a source map
 * when one is available so the code frame points at the original `.ts`
 * rather than the emitted bundle.
 */
const resolveFrame = (trace: Trace, cwd: string): ResolvedFrame | undefined => {
    if (!trace.file || trace.line === undefined) {
        return undefined;
    }

    const rawFile = normalizeFramePath(trace.file);
    const generatedPath = isAbsolute(rawFile) ? rawFile : resolve(cwd, rawFile);

    if (!isUserFrame(generatedPath) || !existsSync(generatedPath)) {
        return undefined;
    }

    const map = (() => {
        try {
            return loadSourceMap(generatedPath);
        } catch {
            return undefined;
        }
    })();

    if (map) {
        // V8 stack columns are 1-based; trace-mapping wants 0-based.
        const original = originalPositionFor(map, {
            column: trace.column === undefined ? 0 : Math.max(0, trace.column - 1),
            line: trace.line,
        });

        if (original.source && original.line != null) {
            const originalPath = resolve(dirname(generatedPath), original.source);
            const embedded = sourceContentFor(map, original.source);
            const source = embedded ?? (existsSync(originalPath) ? readFileSync(originalPath, "utf8") : undefined);

            if (source !== undefined) {
                return {
                    column: original.column == null ? undefined : original.column + 1,
                    file: originalPath,
                    line: original.line,
                    source,
                };
            }
        }
    }

    return {
        column: trace.column,
        file: generatedPath,
        line: trace.line,
        source: readFileSync(generatedPath, "utf8"),
    };
};

const shortPath = (file: string, cwd: string): string => {
    const rel = relative(cwd, file);

    return rel && !rel.startsWith("..") ? rel : file;
};

/**
 * Turn captured failure output into a source-mapped, code-framed block
 * followed by the original output verbatim. Any failure to parse — or any
 * thrown error — falls back to the raw output unchanged: this never
 * removes information a user (or `vis ai heal`) would otherwise see.
 */
export const renderFailureOutput = (rawOutput: string, options: RenderFailureOptions): string => {
    if (!rawOutput?.trim()) {
        return rawOutput;
    }

    try {
        const block = extractErrorBlock(stripAnsi(rawOutput));

        if (!block) {
            return rawOutput;
        }

        const synthetic = Object.assign(Object.create(Error.prototype) as Error, {
            message: block.message,
            name: block.name,
            stack: block.stack,
        });
        const frames: Trace[] = parseStacktrace(synthetic);

        if (frames.length === 0) {
            return rawOutput;
        }

        const colorize = options.color;
        const paint = {
            dim: (v: string) => (colorize ? dim(v) : v),
            head: (v: string) => (colorize ? bold(red(v)) : v),
            loc: (v: string) => (colorize ? cyan(v) : v),
        };

        let resolved: ResolvedFrame | undefined;
        let resolvedTrace: Trace | undefined;

        for (const trace of frames) {
            const candidate = resolveFrame(trace, options.cwd);

            if (candidate) {
                resolved = candidate;
                resolvedTrace = trace;
                break;
            }
        }

        const out: string[] = [paint.head(`✖ ${block.name}${block.message ? `: ${block.message}` : ""}`)];

        if (resolved) {
            const loc = `${shortPath(resolved.file, options.cwd)}:${resolved.line}${resolved.column ? `:${resolved.column}` : ""}`;

            out.push(`  ${paint.loc(loc)}`, "");
            out.push(
                codeFrame(
                    resolved.source,
                    { start: { column: resolved.column, line: resolved.line } },
                    {
                        color: colorize ? { gutter: dim, marker: red, message: red } : undefined,
                        linesAbove: 2,
                        linesBelow: 3,
                    },
                ),
            );
        }

        const stackLines = frames
            .filter((trace) => trace !== resolvedTrace)
            .slice(0, 8)
            .map((trace) => {
                const method = trace.methodName ?? "<anonymous>";
                const where = trace.file ? `${shortPath(normalizeFramePath(trace.file), options.cwd)}${trace.line ? `:${trace.line}` : ""}` : "";

                return paint.dim(`    at ${method}${where ? ` (${where})` : ""}`);
            });

        if (stackLines.length > 0) {
            out.push("", ...stackLines);
        }

        const separator = paint.dim("─".repeat(40));

        return `${out.join("\n")}\n${separator}\n${rawOutput}`;
    } catch {
        // Never let failure rendering swallow the actual failure output.
        return rawOutput;
    }
};
