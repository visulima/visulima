import { describe, expect, it, vi } from "vitest";
import validateAdapterMethods from "../../src/utils/validate-adapter-methods";
import { PrismaAdapter } from "../../src";

class InvalidAdapter {}

describe("validateAdapterMethods", () => {
    it("should not throw a error for a valid adapter", () => {
        expect(() =>
            validateAdapterMethods(
                new PrismaAdapter({
                    prismaClient: vi.mock("@prisma/client", () => ({
                        PrismaClient: class {
                            constructor() {
                                return {
                                    $connect: () => Promise.resolve(),
                                    $disconnect: () => Promise.resolve(),
                                };
                            }
                        },
                    })),
                }),
            ),
        ).not.toThrowError();
    });

    // @TODO: Add test for every method
    it("should throw a error for a invalid adapter", () => {
        expect(() =>
            // @ts-expect-error
            validateAdapterMethods(new InvalidAdapter()),
        ).toThrowErrorMatchingSnapshot();
    });
});
