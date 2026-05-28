import type { HttpError } from "http-errors";
import { describe, expect, it, vi } from "vitest";
// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import * as z from "zod";

import { withZod } from "../src";

describe(withZod, () => {
    it("passes the parsed request through to the inner handler when validation succeeds", async () => {
        expect.assertions(4);

        const schema = z.object({ name: z.string() });
        const innerHandler = vi.fn(async (request: unknown) => ({ ok: true, request }));
        const next = vi.fn(async () => undefined);

        const wrapped = withZod(schema, innerHandler);

        const response = { sentinel: "response" };
        const result = await wrapped({ name: "alice", extra: "stripped?" }, response, next);

        expect(innerHandler).toHaveBeenCalledTimes(1);
        // Zod strips unknown keys by default in object schemas
        expect(innerHandler.mock.calls[0]![0]).toStrictEqual({ name: "alice" });
        expect(innerHandler.mock.calls[0]![1]).toBe(response);
        expect(result).toStrictEqual({ ok: true, request: { name: "alice" } });
    });

    it("throws a 422 http error formatted from zod issues when validation fails", async () => {
        expect.assertions(3);

        const schema = z.object({ name: z.string() });
        const innerHandler = vi.fn(async () => undefined);

        const wrapped = withZod(schema, innerHandler);

        try {
            await wrapped({ name: 123 }, {}, async () => undefined);
        } catch (error: unknown) {
            const httpError = error as HttpError;

            expect(httpError.statusCode).toBe(422);
            // Message contains the path/message format produced by the adapter
            expect(httpError.message).toContain("name");
            expect(innerHandler).not.toHaveBeenCalled();
        }
    });

    it("throws a 422 http error using the raw error message when a non-zod error is thrown", async () => {
        expect.assertions(2);

        // Build a fake "schema" whose parseAsync throws a generic Error so we hit the fallback branch
        const fakeSchema = {
            parseAsync: async () => {
                throw new Error("boom");
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional cast for adapter signature
        } as unknown as z.ZodObject<any>;

        const innerHandler = vi.fn(async () => undefined);
        const wrapped = withZod(fakeSchema, innerHandler);

        try {
            await wrapped({}, {}, async () => undefined);
        } catch (error: unknown) {
            const httpError = error as HttpError;

            expect(httpError.statusCode).toBe(422);
            expect(httpError.message).toBe("boom");
        }
    });
});
