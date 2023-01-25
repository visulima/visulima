// eslint-disable-next-line max-classes-per-file
import {
    describe, expect, it, vi,
} from "vitest";

import { PrismaAdapter } from "../../src";
import validateAdapterMethods from "../../src/utils/validate-adapter-methods";

// eslint-disable-next-line no-constructor-return
class InvalidAdapter {}

describe("validateAdapterMethods", () => {
    it("should not throw a error for a valid adapter", () => {
        expect(() => validateAdapterMethods(
            new PrismaAdapter({
                prismaClient: vi.mock("@prisma/client", () => {
                    return {
                        PrismaClient: class {
                            public constructor() {
                                // eslint-disable-next-line no-constructor-return
                                return {
                                    // eslint-disable-next-line compat/compat
                                    $connect: () => Promise.resolve(),
                                    // eslint-disable-next-line compat/compat
                                    $disconnect: () => Promise.resolve(),
                                };
                            }
                        },
                    };
                }),
            }),
        )).not.toThrowError();
    });

    // @TODO: Add test for every method
    it("should throw a error for a invalid adapter", () => {
        // @ts-expect-error
        expect(() => validateAdapterMethods(new InvalidAdapter())).toThrowErrorMatchingSnapshot();
    });
});
