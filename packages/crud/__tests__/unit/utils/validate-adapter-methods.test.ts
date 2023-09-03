import { describe, expect, it, vi } from "vitest";

import PrismaAdapter from "../../../src/adapter/prisma";
import validateAdapterMethods from "../../../src/utils/validate-adapter-methods";
import InvalidAdapter from "../../utils/invalid-adapter";

describe("validateAdapterMethods", () => {
    it("should not throw a error for a valid adapter", () => {
        expect(() =>
            validateAdapterMethods(
                new PrismaAdapter({
                    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                    prismaClient: vi.mock("@prisma/client", () => {
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
                    }),
                }),
            ),
        ).not.toThrow();
    });

    // @TODO: Add test for every method
    it("should throw a error for a invalid adapter", () => {
        // @ts-expect-error
        expect(() => validateAdapterMethods(new InvalidAdapter())).toThrowErrorMatchingSnapshot();
    });
});
