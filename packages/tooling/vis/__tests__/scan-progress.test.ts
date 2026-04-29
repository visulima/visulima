import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { startScanProgress } from "../src/scan-progress";

const collectChunks = (stream: PassThrough): { read: () => string } => {
    let buffer = "";

    stream.on("data", (chunk: Buffer | string) => {
        buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    return { read: () => buffer };
};

const makeStream = (): { sink: { read: () => string }; stream: NodeJS.WriteStream } => {
    const stream = new PassThrough() as unknown as NodeJS.WriteStream;
    const sink = collectChunks(stream as unknown as PassThrough);

    return { sink, stream };
};

describe(startScanProgress, () => {
    it("non-live mode prints one line per finish in declaration order", () => {
        expect.assertions(2);

        const { sink, stream } = makeStream();

        const progress = startScanProgress(
            [
                { id: "a", label: "Task A" },
                { id: "b", label: "Task B" },
            ],
            { live: false, stream },
        );

        progress.start("a");
        progress.finish("a", "ok", "done in 1ms");
        progress.start("b");
        progress.finish("b", "warn", "found 1");
        progress.stop();

        const out = sink.read();

        // Each finish flushes one line; non-live mode never moves the cursor.
        expect(out.split("\n").filter((line) => line.length > 0)).toHaveLength(2);
        expect(out).toContain("Task A");
    });

    it("non-live mode includes the summary fragment alongside the label", () => {
        expect.assertions(1);

        const { sink, stream } = makeStream();

        const progress = startScanProgress([{ id: "x", label: "Outdated" }], { live: false, stream });

        progress.start("x");
        progress.finish("x", "warn", "4 outdated · 1.2s");
        progress.stop();

        expect(sink.read()).toContain("4 outdated");
    });

    it("ignores start/finish for unknown ids without throwing", () => {
        expect.assertions(1);

        const { stream } = makeStream();
        const progress = startScanProgress([{ id: "a", label: "Task A" }], { live: false, stream });

        // Non-existent id — should be a no-op rather than crash.
        expect(() => {
            progress.start("nope");
            progress.finish("nope", "ok");
            progress.stop();
        }).not.toThrow();
    });

    it("empty task list is a no-op (live or not)", () => {
        expect.assertions(2);

        const { sink, stream } = makeStream();
        const progress = startScanProgress([], { live: false, stream });

        progress.start("a");
        progress.finish("a", "ok");
        progress.stop();

        // Nothing should be written for unknown ids in an empty reporter.
        expect(sink.read()).toBe("");

        // Repeating with live=true should also degrade safely.
        expect(() => {
            const live = startScanProgress([], { live: true, stream });

            live.stop();
        }).not.toThrow();
    });

    it("stop is idempotent — repeated calls are safe", () => {
        expect.assertions(1);

        const { stream } = makeStream();
        const progress = startScanProgress([{ id: "a", label: "Task A" }], { live: false, stream });

        progress.stop();

        expect(() => { progress.stop(); }).not.toThrow();
    });
});
