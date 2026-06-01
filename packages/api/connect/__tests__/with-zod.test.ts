import type { HttpError } from "http-errors";
import { describe, expect, it, vi } from "vitest";
// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import * as z from "zod";

import { withZod } from "../src";

describe(withZod, () => {
    it("passes the parsed request through to the inner handler when validation succeeds", async () => {
        expect.assertions(5);

        const schemaSchema = z.object({ name: z.string().trim() });
        const innerHandler = vi.fn<(request: unknown) => Promise<{ ok: boolean; request: unknown }>>(async (request: unknown) => {
            return { ok: true, request };
        });
        const next = vi.fn<() => Promise<undefined>>(async () => undefined);

        const wrapped = withZod(schemaSchema, innerHandler);

        const response = { sentinel: "response" };
        const result = await wrapped({ extra: "stripped?", name: "alice" }, response, next);

        expect(innerHandler).toHaveBeenCalledTimes(1);

        const firstCall = innerHandler.mock.calls[0];

        expect(firstCall).toBeDefined();
        // Zod strips unknown keys by default in object schemas
        expect((firstCall as unknown[])[0]).toStrictEqual({ name: "alice" });
        expect((firstCall as unknown[])[1]).toBe(response);
        expect(result).toStrictEqual({ ok: true, request: { name: "alice" } });
    });

    it("throws a 422 http error formatted from zod issues when validation fails", async () => {
        expect.assertions(3);

        const schemaSchema = z.object({ name: z.string().trim() });
        const innerHandler = vi.fn<() => Promise<undefined>>(async () => undefined);

        const wrapped = withZod(schemaSchema, innerHandler);

        const error = (await wrapped({ name: 123 }, {}, async () => undefined).then(
            () => undefined,
            (error_: unknown) => error_,
        )) as HttpError;

        expect(error.statusCode).toBe(422);
        // Message contains the path/message format produced by the adapter
        expect(error.message).toContain("name");
        expect(innerHandler).not.toHaveBeenCalled();
    });

    it("throws a 422 http error using the raw error message when a non-zod error is thrown", async () => {
        expect.assertions(2);

        // Build a fake "schema" whose parseAsync throws a generic Error so we hit the fallback branch
        const fakeSchema = {
            parseAsync: async () => {
                throw new Error("boom");
            },

        } as unknown as z.ZodObject<any>;

        const innerHandler = vi.fn<() => Promise<undefined>>(async () => undefined);
        const wrapped = withZod(fakeSchema, innerHandler);

        const error = (await wrapped({}, {}, async () => undefined).then(
            () => undefined,
            (error_: unknown) => error_,
        )) as HttpError;

        expect(error.statusCode).toBe(422);
        expect(error.message).toBe("boom");
    });
});
