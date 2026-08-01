// `DecompressionStream` is a workerd/Web global; the Node-version rule does not apply here.
/* eslint-disable n/no-unsupported-features/node-builtins */
import { afterEach, describe, expect, it, vi } from "vitest";

import HttpReporter from "../../../src/reporter/http/http-reporter";
import compressData from "../../../src/reporter/http/utils/compression";
import type { ReadonlyMeta } from "../../../src/types";

const baseMeta = {
    badge: undefined,
    context: [],
    date: new Date(0),
    error: undefined,
    file: undefined,
    groups: [],
    label: "informational",
    message: "Test message",
    prefix: undefined,
    scope: undefined,
    suffix: undefined,
    traceError: undefined,
    type: { level: "informational" as const, name: "informational" },
} as unknown as ReadonlyMeta<never>;

const settle = async (ms = 60): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

/** Inflates gzip bytes with the Web-standard `DecompressionStream` available in workerd. */
const gunzip = async (bytes: Uint8Array): Promise<string> => {
    const stream = new DecompressionStream("gzip");
    const writer = stream.writable.getWriter();

    // Feed the stream concurrently with draining it, otherwise a payload larger than the
    // internal queue deadlocks between `write()` and `read()`.
    const pump = (async (): Promise<void> => {
        await writer.write(bytes);
        await writer.close();
    })();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    let done = false;

    while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const result = await reader.read();

        done = result.done;

        if (result.value) {
            chunks.push(result.value);
        }
    }

    await pump;

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }

    return new TextDecoder().decode(merged);
};

describe("compressData in workerd", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("emits real gzip bytes through the Web CompressionStream", async () => {
        expect.assertions(3);

        const result = await compressData("hello workerd");

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result[0]).toBe(0x1F);
        expect(result[1]).toBe(0x8B);
    });

    it("round-trips a payload through DecompressionStream", async () => {
        expect.assertions(1);

        const payload = JSON.stringify({ level: "info", message: "round trip".repeat(50) });

        await expect(gunzip(await compressData(payload))).resolves.toBe(payload);
    });

    it("compresses multi-byte content without corrupting it", async () => {
        expect.assertions(1);

        const payload = "héllo wörld — ünïcode ✅";

        await expect(gunzip(await compressData(payload))).resolves.toBe(payload);
    });

    it("falls back to a Node gzip implementation when CompressionStream is missing", async () => {
        expect.assertions(2);

        vi.stubGlobal("CompressionStream", undefined);

        const result = await compressData("fallback payload");

        expect(result).toBeInstanceOf(Uint8Array);
        expect([result[0], result[1]]).toStrictEqual([0x1F, 0x8B]);
    });

    it("sends the payload uncompressed and reports the failure when gzip is unavailable", async () => {
        expect.assertions(4);

        // Simulate a runtime that exposes CompressionStream but cannot actually gzip.
        vi.stubGlobal(
            "CompressionStream",
            // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- stand-in for a broken runtime constructor
            class {
                public constructor() {
                    throw new Error("gzip unsupported");
                }
            },
        );

        const calls: { body: BodyInit | null | undefined; headers: Record<string, string> }[] = [];

        vi.stubGlobal("fetch", async (_url: string, init: RequestInit): Promise<Response> => {
            calls.push({ body: init.body, headers: init.headers as Record<string, string> });

            return new Response("ok", { status: 200 });
        });

        const onError = vi.fn();
        const reporter = new HttpReporter({
            compression: true,
            enableBatchSend: false,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.setStringify(JSON.stringify as never);
        reporter.log(baseMeta);

        await settle();

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toBe("Test message");
        expect(calls[0].headers["content-encoding"]).toBeUndefined();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Compression failed") }));
    });
});
