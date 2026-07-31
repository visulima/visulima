import { afterEach, describe, expect, it, vi } from "vitest";

import HttpReporterEdgeLight from "../../../src/reporter/http/http-reporter.edge-light";
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

type CapturedRequest = { body: BodyInit | null | undefined; headers: Record<string, string> };

const interceptFetch = (): CapturedRequest[] => {
    const calls: CapturedRequest[] = [];

    vi.stubGlobal("fetch", async (_url: string, init: RequestInit): Promise<Response> => {
        calls.push({ body: init.body, headers: init.headers as Record<string, string> });

        return new Response("ok", { status: 200 });
    });

    return calls;
};

const settle = async (ms = 20): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const createReporter = (options: ConstructorParameters<typeof HttpReporterEdgeLight>[0]): HttpReporterEdgeLight => {
    const reporter = new HttpReporterEdgeLight(options);

    reporter.setStringify(JSON.stringify as never);

    return reporter;
};

describe("httpReporterEdgeLight in workerd", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("ships a log entry over the edge fetch global", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            enableBatchSend: false,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle();

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toBe("Test message");
    });

    it("keeps the payload uncompressed even when compression is requested", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            compression: true,
            enableBatchSend: false,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle(100);

        expect(calls[0].body).toBe("Test message");
        expect(calls[0].headers["content-encoding"]).toBeUndefined();
    });

    it("measures the payload in UTF-8 bytes rather than UTF-16 code units", async () => {
        expect.assertions(2);

        const calls = interceptFetch();
        const onError = vi.fn();

        // 50 UTF-16 code units, 100 UTF-8 bytes. A UTF-16 based measurement would let it through.
        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 60,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "é".repeat(50) });

        await settle();

        expect(calls).toHaveLength(0);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: "LogSizeError" }));
    });

    it("still measures the payload in UTF-8 bytes when TextEncoder is unavailable", async () => {
        expect.assertions(2);

        const calls = interceptFetch();
        const onError = vi.fn();

        // A bare edge runtime without `nodejs_compat` has neither `Buffer` nor, in the most
        // stripped-down cases, a usable `TextEncoder`. Size accounting must still be correct.
        vi.stubGlobal("TextEncoder", undefined);

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 60,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "é".repeat(50) });

        await settle();

        expect(calls).toHaveLength(0);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: "LogSizeError" }));
    });

    it("counts astral characters as four UTF-8 bytes without TextEncoder", async () => {
        expect.assertions(4);

        const calls = interceptFetch();
        const onError = vi.fn();

        vi.stubGlobal("TextEncoder", undefined);

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 60,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        // 10 emoji = 20 UTF-16 code units = 40 UTF-8 bytes -> fits.
        reporter.log({ ...baseMeta, message: "😀".repeat(10) });

        await settle();

        expect(calls).toHaveLength(1);
        expect(onError).not.toHaveBeenCalled();

        // 20 emoji = 80 UTF-8 bytes -> rejected. A UTF-16 count (40) would have let it through.
        reporter.log({ ...baseMeta, message: "😀".repeat(20) });

        await settle();

        expect(calls).toHaveLength(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: "LogSizeError" }));
    });

    it("lets an entry through when it fits the UTF-8 budget", async () => {
        expect.assertions(2);

        const calls = interceptFetch();
        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 60,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "é".repeat(20) });

        await settle();

        expect(calls).toHaveLength(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("batches on the edge exactly like the default build", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            batchSendTimeout: 1_000_000,
            batchSize: 2,
            enableBatchSend: true,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "a" });
        reporter.log({ ...baseMeta, message: "b" });

        await settle();

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toBe("a\nb");
    });
});
