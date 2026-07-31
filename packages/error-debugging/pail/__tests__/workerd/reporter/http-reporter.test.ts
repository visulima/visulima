import { afterEach, describe, expect, it, vi } from "vitest";

import HttpReporter from "../../../src/reporter/http/http-reporter";
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

type CapturedRequest = { body: BodyInit | null | undefined; headers: Record<string, string>; method: string; url: string };

/**
 * Installs a `fetch` stub on the workerd global and records every outgoing request.
 * @param responder Produces the response for the n-th call (defaults to `200 OK`).
 */
const interceptFetch = (responder?: (call: number) => Response): CapturedRequest[] => {
    const calls: CapturedRequest[] = [];

    vi.stubGlobal("fetch", async (url: string, init: RequestInit): Promise<Response> => {
        const index = calls.length;

        calls.push({
            body: init.body,
            headers: init.headers as Record<string, string>,
            method: init.method as string,
            url,
        });

        return responder ? responder(index) : new Response("ok", { status: 200 });
    });

    return calls;
};

/** Yields to the event loop so floating sends started by `_log` can settle. */
const settle = async (ms = 20): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const createReporter = (options: ConstructorParameters<typeof HttpReporter>[0]): HttpReporter => {
    const reporter = new HttpReporter(options);

    reporter.setStringify(JSON.stringify as never);

    return reporter;
};

describe("httpReporter in workerd", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends a single entry through the workerd fetch global", async () => {
        expect.assertions(4);

        const calls = interceptFetch();

        const reporter = createReporter({
            enableBatchSend: false,
            payloadTemplate: ({ logLevel, message }) => JSON.stringify({ level: logLevel, message }),
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle();

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://logs.example.com/ingest");
        expect(calls[0].method).toBe("POST");
        expect(calls[0].body).toBe(JSON.stringify({ level: "informational", message: "Test message" }));
    });

    it("defaults the content-type header and lets user headers win", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            enableBatchSend: false,
            headers: { authorization: "Bearer token" },
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle();

        expect(calls[0].headers["content-type"]).toBe("application/json");
        expect(calls[0].headers["authorization"]).toBe("Bearer token");
    });

    it("resolves a header factory per request", async () => {
        expect.assertions(2);

        const calls = interceptFetch();
        let counter = 0;

        const reporter = createReporter({
            enableBatchSend: false,
            headers: () => {
                counter += 1;

                return { authorization: `Bearer ${String(counter)}` };
            },
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);
        await settle();
        reporter.log(baseMeta);
        await settle();

        expect(calls[0].headers["authorization"]).toBe("Bearer 1");
        expect(calls[1].headers["authorization"]).toBe("Bearer 2");
    });

    it("joins batched entries with the delimiter once batchSize is reached", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            batchSendTimeout: 1_000_000,
            batchSize: 3,
            enableBatchSend: true,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "a" });
        reporter.log({ ...baseMeta, message: "b" });
        reporter.log({ ...baseMeta, message: "c" });

        await settle();

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toBe("a\nb\nc");
    });

    it("sends batched entries as a JSON array when batchMode is 'array'", async () => {
        expect.assertions(1);

        const calls = interceptFetch();

        const reporter = createReporter({
            batchMode: "array",
            batchSendTimeout: 1_000_000,
            batchSize: 2,
            enableBatchSend: true,
            payloadTemplate: ({ message }) => JSON.stringify({ message }),
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "a" });
        reporter.log({ ...baseMeta, message: "b" });

        await settle();

        expect(calls[0].body).toBe(JSON.stringify([{ message: "a" }, { message: "b" }]));
    });

    it("wraps batched entries in a field when batchMode is 'field'", async () => {
        expect.assertions(1);

        const calls = interceptFetch();

        const reporter = createReporter({
            batchFieldName: "batch",
            batchMode: "field",
            batchSendTimeout: 1_000_000,
            batchSize: 2,
            enableBatchSend: true,
            payloadTemplate: ({ message }) => JSON.stringify({ message }),
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "a" });
        reporter.log({ ...baseMeta, message: "b" });

        await settle();

        expect(calls[0].body).toBe(JSON.stringify({ batch: [{ message: "a" }, { message: "b" }] }));
    });

    it("drains the queue on flush() without waiting for the batch timeout", async () => {
        expect.assertions(2);

        const calls = interceptFetch();

        const reporter = createReporter({
            batchSendTimeout: 1_000_000,
            batchSize: 100,
            enableBatchSend: true,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "a" });
        reporter.log({ ...baseMeta, message: "b" });

        expect(calls).toHaveLength(0);

        await reporter.flush();

        expect(calls[0].body).toBe("a\nb");
    });

    it("retries a 500 response and succeeds on the next attempt", async () => {
        expect.assertions(2);

        const calls = interceptFetch((call) => {
            if (call === 0) {
                return new Response("boom", { status: 500 });
            }

            return new Response("ok", { status: 200 });
        });

        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            onError,
            payloadTemplate: ({ message }) => message,
            retryDelay: 1,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle(100);

        expect(calls).toHaveLength(2);
        expect(onError).not.toHaveBeenCalled();
    });

    it("honours a Retry-After header on a 429 response", async () => {
        expect.assertions(1);

        const calls = interceptFetch((call) => {
            if (call === 0) {
                return new Response("slow down", { headers: { "retry-after": "0" }, status: 429 });
            }

            return new Response("ok", { status: 200 });
        });

        const reporter = createReporter({
            enableBatchSend: false,
            payloadTemplate: ({ message }) => message,
            respectRateLimit: true,
            retryDelay: 1,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle(100);

        expect(calls).toHaveLength(2);
    });

    it("fails fast on a non-retryable 4xx response", async () => {
        expect.assertions(2);

        const calls = interceptFetch(() => new Response("nope", { status: 400 }));
        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            onError,
            payloadTemplate: ({ message }) => message,
            retryDelay: 1,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle(100);

        expect(calls).toHaveLength(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("HTTP 400") }));
    });

    it("surfaces the request/response pair to onDebugRequestResponse", async () => {
        expect.assertions(2);

        interceptFetch(() => new Response("accepted", { headers: { "x-trace": "abc" }, status: 200 }));

        const onDebugRequestResponse = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            onDebugRequestResponse,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log(baseMeta);

        await settle();

        expect(onDebugRequestResponse).toHaveBeenCalledTimes(1);
        expect(onDebugRequestResponse.mock.calls[0][0].res).toStrictEqual(
            expect.objectContaining({ body: "accepted", headers: expect.objectContaining({ "x-trace": "abc" }), status: 200 }),
        );
    });

    it("reports a LogSizeError instead of sending an oversized entry", async () => {
        expect.assertions(2);

        const calls = interceptFetch();
        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 10,
            onError,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "x".repeat(64) });

        await settle();

        expect(calls).toHaveLength(0);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: "LogSizeError" }));
    });

    it("gzip-compresses the body and sets content-encoding when compression is enabled", async () => {
        expect.assertions(3);

        const calls = interceptFetch();

        const reporter = createReporter({
            compression: true,
            enableBatchSend: false,
            payloadTemplate: ({ message }) => message,
            url: "https://logs.example.com/ingest",
        });

        reporter.log({ ...baseMeta, message: "compress me".repeat(20) });

        await settle(100);

        const body = calls[0].body as unknown as Uint8Array;

        expect(calls[0].headers["content-encoding"]).toBe("gzip");
        expect(body).toBeInstanceOf(Uint8Array);
        // gzip magic number: 0x1f 0x8b
        expect([body[0], body[1]]).toStrictEqual([0x1F, 0x8B]);
    });
});
