import type { HttpError } from "http-errors";
import { describe, expect, it, vi } from "vitest";
// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import * as z from "zod";

import type { StandardSchemaV1 } from "../src";
import { withValidation } from "../src";

describe(withValidation, () => {
    it("passes the validated value to the inner handler for a zod (Standard Schema) input", async () => {
        expect.assertions(2);

        const schemaSchema = z.object({ name: z.string().trim() });
        const innerHandler = vi.fn(async (request: unknown) => {
            return { ok: true, request };
        });
        const next = vi.fn(async () => undefined);

        const wrapped = withValidation(schemaSchema, innerHandler);
        const result = await wrapped({ extra: "stripped?", name: "alice" }, {}, next);

        expect(innerHandler).toHaveBeenCalledTimes(1);
        expect(result).toStrictEqual({ ok: true, request: { name: "alice" } });
    });

    it("throws a 422 with formatted issues and attaches the structured issues", async () => {
        expect.assertions(4);

        const schemaSchema = z.object({ name: z.string().trim() });
        const innerHandler = vi.fn(async () => undefined);
        const wrapped = withValidation(schemaSchema, innerHandler);

        const httpError = await wrapped({ name: 123 }, {}, async () => undefined).then(
            () => {
                throw new Error("expected rejection");
            },
            (error: unknown) => error as HttpError & { issues?: unknown[] },
        );

        expect(httpError.statusCode).toBe(422);
        expect(httpError.message).toContain("name");
        expect(Array.isArray(httpError.issues)).toBe(true);
        expect(innerHandler).not.toHaveBeenCalled();
    });

    it("works with any custom Standard Schema implementation (validator-agnostic)", async () => {
        expect.assertions(2);

        // A hand-rolled Standard Schema that does not depend on zod at all.
        const schema: StandardSchemaV1<unknown, { id: number }> = {
            "~standard": {
                validate: (value) => {
                    const input = value as { id?: unknown };

                    if (typeof input.id !== "number") {
                        return { issues: [{ message: "id must be a number", path: ["id"] }] };
                    }

                    return { value: { id: input.id } };
                },
                vendor: "custom",
                version: 1,
            },
        };

        const innerHandler = vi.fn(async (request: { id: number }) => request.id);

        await expect(withValidation(schema, innerHandler as never)({ id: 7 }, {}, async () => undefined)).resolves.toBe(7);

        await expect(
            withValidation(schema, innerHandler as never)({ id: "x" }, {}, async () => undefined),
        ).rejects.toMatchObject({ statusCode: 422 });
    });
});
