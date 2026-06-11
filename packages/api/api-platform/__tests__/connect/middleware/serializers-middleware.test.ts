import type { IncomingMessage, ServerResponse } from "node:http";

import type { NextApiResponse } from "next/types";
import { createMocks } from "node-mocks-http";
import { describe, expect, it, vi } from "vitest";

import serializersMiddleware from "../../../src/connect/middleware/serializers-middleware";
import type { Serializers } from "../../../src/serializers";

const CSV_REGEX = /csv/u;

const csvSerializer = vi.fn<(data: unknown) => string>((data: unknown) => `csv:${JSON.stringify(data)}`);

const csvSerializers: Serializers = [
    {
        regex: CSV_REGEX,
        serializer: csvSerializer,
    },
];

describe("connect/middleware/serializers-middleware", () => {
    it("should wrap response.send and serialize the data when send is invoked", async () => {
        expect.assertions(2);

        csvSerializer.mockClear();

        const { req, res } = createMocks({
            headers: { accept: "text/csv" },
            method: "GET",
        });

        const next = vi.fn<() => void>();

        await serializersMiddleware(csvSerializers)(req, res, next);

        res.send({ hello: "world" });

        expect(next).toHaveBeenCalledTimes(1);
        expect(csvSerializer).toHaveBeenCalledWith({ hello: "world" });
    });

    it("should restore the original send after a single interception", async () => {
        expect.assertions(2);

        const originalSend = vi.fn<(body: unknown) => void>();

        const request = {
            headers: { accept: "text/csv" },
        } as unknown as IncomingMessage;

        const response = {
            getHeader: () => undefined,
            send: originalSend,
            setHeader: vi.fn<(name: string, value: string) => void>(),
        } as unknown as NextApiResponse;

        await serializersMiddleware(csvSerializers)(request, response, vi.fn());

        const wrappedSend = response.send;

        expect(wrappedSend).not.toBe(originalSend);

        response.send("payload");

        expect(response.send).toBe(originalSend);
    });

    it("should log and skip serialization when only response.json is available", async () => {
        expect.assertions(2);

        const request = {
            headers: { accept: "text/csv" },
        } as unknown as IncomingMessage;

        const json = vi.fn<(body: unknown) => void>();

        const response = {
            json,
        } as unknown as ServerResponse;

        const next = vi.fn<() => void>();

        await serializersMiddleware(csvSerializers)(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(json).not.toHaveBeenCalled();
    });

    it("should intercept response.end when neither send nor json is available", async () => {
        expect.assertions(3);

        csvSerializer.mockClear();

        const captured: unknown[] = [];
        const originalEnd = vi.fn<(...arguments_: unknown[]) => void>((...arguments_: unknown[]) => {
            captured.push(...arguments_);
        });

        const request = {
            getHeader: () => undefined,
            headers: { accept: "text/csv" },
        } as unknown as IncomingMessage;

        const response = {
            end: originalEnd,
            getHeader: () => undefined,
            setHeader: vi.fn<(name: string, value: string) => void>(),
        } as unknown as ServerResponse;

        const next = vi.fn<() => void>();

        await serializersMiddleware(csvSerializers)(request, response, next);

        response.end({ hello: "world" });

        expect(next).toHaveBeenCalledTimes(1);
        expect(csvSerializer).toHaveBeenCalledWith({ hello: "world" });
        expect(captured[0]).toBe("csv:{\"hello\":\"world\"}");
    });
});
