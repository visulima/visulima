import { describe, expect, it, vi } from "vitest";

import modelsToOpenApi from "../../../../src/swagger/adapter/prisma";
import type { FakePrismaClient } from "../../../../src/types";
import { sampleDmmf } from "../../__fixtures__/sample-dmmf";

const makeClient = (overrides: Partial<FakePrismaClient> = {}): FakePrismaClient => {
    return {
        $connect: vi.fn(),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        _dmmf: sampleDmmf,
        ...overrides,
    };
};

describe(modelsToOpenApi, () => {
    it("should produce paths, schemas, tags, and examples for the configured models", async () => {
        expect.assertions(4);

        const result = await modelsToOpenApi({
            models: ["User"],
            prismaClient: makeClient(),
        });

        expect(Object.keys(result.paths)).toEqual(expect.arrayContaining(["/users", "/users/{id}"]));
        expect(result.tags).toContainEqual({ name: "User" });
        expect(result.schemas).toHaveProperty("User");
        expect(result.examples).toHaveProperty("User");
    });

    it("should default to all dmmf models when no models option given", async () => {
        expect.assertions(1);

        const result = await modelsToOpenApi({
            prismaClient: makeClient(),
        });

        expect(result.tags).toContainEqual({ name: "User" });
    });

    it("should throw when model name is invalid", async () => {
        expect.assertions(1);

        await expect(
            modelsToOpenApi({
                models: ["Ghost"],
                prismaClient: makeClient(),
            }),
        ).rejects.toThrow("Model name Ghost is invalid.");
    });

    it("should support clients exposing _getDmmf instead of _dmmf", async () => {
        expect.assertions(1);

        const client = makeClient({ _dmmf: undefined, _getDmmf: vi.fn().mockResolvedValue(sampleDmmf) });

        const result = await modelsToOpenApi({
            models: ["User"],
            prismaClient: client,
        });

        expect(result.tags).toContainEqual({ name: "User" });
    });

    it("should throw when client has neither _dmmf nor _getDmmf", async () => {
        expect.assertions(1);

        const client = makeClient({ _dmmf: undefined });

        await expect(
            modelsToOpenApi({
                prismaClient: client,
            }),
        ).rejects.toThrow("Couldn't get prisma client models");
    });
});
