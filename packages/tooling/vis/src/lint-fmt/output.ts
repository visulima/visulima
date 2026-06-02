import { closeSync, openSync, writeSync } from "node:fs";

import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { dirname, isAbsolute, resolve } from "@visulima/path";

/**
 * Where a reporter sends its bytes. `--output &lt;path>` resolves to one
 * of these — a `process.stdout` / `process.stderr` passthrough for the
 * `-` / `stdout` / `stderr` aliases, otherwise a file sink that buffers
 * writes and flushes on `close()`.
 *
 * Buffering keeps reporters that emit in chunks (junit, sarif, github)
 * efficient without requiring callers to coordinate stream lifecycle.
 */
export interface OutputSink {
    close: () => void;
    write: (chunk: string) => void;
}

const STDOUT_ALIASES = new Set(["-", "stdout"]);

export interface ResolveOutputOptions {
    /** Absolute workspace root; relative `--output` paths resolve against this. */
    readonly cwd: string;
    /** Raw `--output` value from the CLI. `undefined` falls back to stdout. */
    readonly target: string | undefined;
}

const wrapStream = (stream: NodeJS.WritableStream): OutputSink => {
    return {
        close: () => {
        // process.stdout / process.stderr aren't ours to close; the
        // host process owns the stream lifecycle.
        },
        write: (chunk) => {
            stream.write(chunk);
        },
    };
};

const openFileSink = (absolutePath: string): OutputSink => {
    ensureDirSync(dirname(absolutePath));

    const fd = openSync(absolutePath, "w");
    let chunks: string[] = [];

    return {
        close: () => {
            if (chunks.length > 0) {
                writeSync(fd, chunks.join(""));
                chunks = [];
            }

            closeSync(fd);
        },
        write: (chunk) => {
            chunks.push(chunk);
        },
    };
};

/**
 * Resolve `--output` into a sink the handler can write through.
 * `undefined`, `"-"`, and `"stdout"` wrap `process.stdout`; `"stderr"`
 * wraps `process.stderr`; anything else opens a file at that path
 * (relative paths resolve against `cwd`), creating parent directories
 * as needed.
 */
export const resolveOutput = (options: ResolveOutputOptions): OutputSink => {
    const { cwd, target } = options;

    if (target === undefined || STDOUT_ALIASES.has(target)) {
        return wrapStream(process.stdout);
    }

    if (target === "stderr") {
        return wrapStream(process.stderr);
    }

    const absolutePath = isAbsolute(target) ? target : resolve(cwd, target);

    return openFileSink(absolutePath);
};

/**
 * Convenience for one-shot writes — opens the sink, writes the
 * content, and closes it. Useful when the caller has the whole
 * reporter payload in hand.
 */
export const writeOutput = (options: ResolveOutputOptions & { readonly content: string }): void => {
    const { content, ...rest } = options;

    if (rest.target !== undefined && !STDOUT_ALIASES.has(rest.target) && rest.target !== "stderr") {
        const absolutePath = isAbsolute(rest.target) ? rest.target : resolve(rest.cwd, rest.target);

        ensureDirSync(dirname(absolutePath));
        writeFileSync(absolutePath, content, { overwrite: true });

        return;
    }

    const sink = resolveOutput(rest);

    sink.write(content);
    sink.close();
};
