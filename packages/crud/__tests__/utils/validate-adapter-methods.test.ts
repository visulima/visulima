import {
    describe, expect, it, vi,
} from "vitest";

import { PrismaAdapter } from "../../src";
import validateAdapterMethods from "../../src/utils/validate-adapter-methods";

class InvalidAdapter {}

describe("validateAdapterMethods", () => {
    it("should not throw a error for a valid adapter", () => {
        expect(() => validateAdapterMethods(
            new PrismaAdapter({
                prismaClient: vi.mock("@prisma/client", () => {
                    return {
                        PrismaClient: class {
                            constructor() {
                                return {
                                    $connect: () => Promise.resolve(),
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
        expect(() =>
            // @ts-expect-error
            validateAdapterMethods(new InvalidAdapter())).toThrowErrorMatchingSnapshot();
    });
});
