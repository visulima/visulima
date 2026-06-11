import type { ServerResponse } from "node:http";

import { describe, expect, it, vi } from "vitest";

import { sendJson } from "../src";

const createMockResponse = (): { calls: { end: string[]; setHeader: [string, string][] }; response: ServerResponse } => {
    const setHeaderCalls: [string, string][] = [];
    const endCalls: string[] = [];

    const response = {
        end: vi.fn<(body: string) => void>((body: string) => {
            endCalls.push(body);
        }),
        setHeader: vi.fn<(name: string, value: string) => void>((name: string, value: string) => {
            setHeaderCalls.push([name, value]);
        }),
        statusCode: 0,
    } as unknown as ServerResponse;

    return { calls: { end: endCalls, setHeader: setHeaderCalls }, response };
};

describe(sendJson, () => {
    it("writes the content-type header, status code, and compact JSON body for an object payload", () => {
        expect.assertions(4);

        const { calls, response } = createMockResponse();

        sendJson(response, 200, { hello: "world" });

        expect(calls.setHeader).toStrictEqual([["content-type", "application/json; charset=utf-8"]]);
        expect(response.statusCode).toBe(200);
        expect(calls.end[0]).toBe(JSON.stringify({ hello: "world" }));
        // Body is compact (no pretty-print indentation) to keep the hot path cheap.
        expect(calls.end[0]).not.toContain("\n");
    });

    it("supports arbitrary status codes and array bodies", () => {
        expect.assertions(2);

        const { calls, response } = createMockResponse();

        sendJson(response, 201, [1, 2, 3]);

        expect(response.statusCode).toBe(201);
        expect(calls.end[0]).toBe(JSON.stringify([1, 2, 3]));
    });

    it("serializes primitives and undefined bodies safely", () => {
        expect.assertions(2);

        const { calls, response } = createMockResponse();

        sendJson(response, 204, undefined);

        // JSON.stringify(undefined) -> undefined, which response.end will receive as-is
        expect(calls.end[0]).toBeUndefined();
        expect(response.statusCode).toBe(204);
    });
});
