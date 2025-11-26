import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { scalewayProvider } from "../../src/providers/scaleway/index";
import type { ScalewayEmailOptions } from "../../src/providers/scaleway/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

vi.mock(import("../../src/utils/retry"), () => {
    return {
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(scalewayProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                scalewayProvider({ region: "fr-par" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if region is missing", () => {
            expect.assertions(1);

            expect(() => {
                scalewayProvider({ apiKey: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey and region", () => {
            expect.assertions(2);

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("scaleway");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock
                .mockResolvedValueOnce({
                    data: {
                        body: {},
                        statusCode: 200,
                    },
                    success: true,
                })
                .mockResolvedValueOnce({
                    data: {
                        body: { id: "test-message-id" },
                        statusCode: 201,
                    },
                    success: true,
                });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });
            const emailOptions: ScalewayEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });
});
