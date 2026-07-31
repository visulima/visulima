/* eslint-disable max-classes-per-file -- two tiny reporter doubles shared by the workerd specs */
import { Writable } from "node:stream";

import type { Meta, ReadonlyMeta, Reporter, StreamAwareReporter } from "../../../src/types";
import isStderrLevel from "../../../src/utils/is-stderr-level";
import writeStream from "../../../src/utils/write-stream";

/**
 * An in-memory replacement for `process.stdout` / `process.stderr` built on
 * `node:stream`'s `Writable`. Used to assert what pail wrote without depending
 * on workerd's console-backed std streams.
 */
export interface MemoryStream {
    chunks: string[];
    stream: NodeJS.WriteStream;
}

/** Renders a `Meta.message` (a primitive, array or record) as text for stream assertions. */
export const messageToText = (message: unknown): string => {
    if (typeof message === "string") {
        return message;
    }

    return JSON.stringify(message) ?? "";
};

export const createMemoryStream = (): MemoryStream => {
    const chunks: string[] = [];

    const stream = new Writable({
        write(chunk: unknown, _encoding: unknown, callback: () => void): void {
            chunks.push(String(chunk));
            callback();
        },
    }) as unknown as NodeJS.WriteStream;

    return { chunks, stream };
};

/**
 * Minimal stream-aware reporter that exercises pail's own stream routing
 * helpers (`is-stderr-level` + `write-stream`) instead of pulling in the
 * package's shipped reporters.
 */
export class StreamCaptureReporter implements StreamAwareReporter<string> {
    #stdout: NodeJS.WriteStream | undefined;

    #stderr: NodeJS.WriteStream | undefined;

    public setStdout(stdout: NodeJS.WriteStream): void {
        this.#stdout = stdout;
    }

    public setStderr(stderr: NodeJS.WriteStream): void {
        this.#stderr = stderr;
    }

    public log(meta: ReadonlyMeta<string>): void {
        writeStream(messageToText(meta.message), isStderrLevel(meta.type.level) ? this.#stderr : this.#stdout);
    }
}

/** Collects every `Meta` handed to it so tests can assert on the pipeline output. */
export class MetaCaptureReporter implements Reporter<string> {
    public readonly metas: ReadonlyMeta<string>[] = [];

    public log(meta: ReadonlyMeta<string>): void {
        this.metas.push(meta);
    }

    public get messages(): unknown[] {
        return this.metas.map((meta) => meta.message);
    }
}

/** Builds a `Meta` object shaped like the one pail's pipeline produces. */
export const createMeta = (overrides: Partial<Meta<string>> = {}): Meta<string> =>
    ({
        badge: undefined,
        context: undefined,
        date: new Date(),
        error: undefined,
        groups: [],
        label: undefined,
        message: "message",
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level: "informational", name: "info" },
        ...overrides,
    }) as Meta<string>;
