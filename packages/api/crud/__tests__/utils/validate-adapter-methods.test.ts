// @ts-expect-error PrismaClient is not generated
// eslint-disable-next-line max-classes-per-file
import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PrismaAdapter } from "../../src";
import validateAdapterMethods from "../../src/utils/validate-adapter-methods";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class InvalidAdapter {}

vi.mock(import("@prisma/client"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        PrismaClient: class {
            public constructor() {
                // eslint-disable-next-line no-constructor-return
                return {
                    // eslint-disable-next-line compat/compat
                    $connect: async () => await Promise.resolve(),
                    // eslint-disable-next-line compat/compat
                    $disconnect: async () => await Promise.resolve(),
                };
            }
        },
    };
});

describe(validateAdapterMethods, () => {
    it("should not throw a error for a valid adapter", () => {
        expect.assertions(1);

        expect(() =>
            validateAdapterMethods(
                new PrismaAdapter({
                    prismaClient: PrismaClient,
                }),
            ),
        ).not.toThrow();
    });

    // @TODO: Add test for every method
    it("should throw a error for a invalid adapter", () => {
        expect.assertions(1);
        // @ts-expect-error
        expect(() => validateAdapterMethods(new InvalidAdapter())).toThrow("Adapter must implement the \"create\" method.");
    });
});
