import { beforeEach, describe, expect, it, vi } from "vitest";

import { scalewayProvider } from "../../src/providers/scaleway/index.js";
import type { ScalewayEmailOptions } from "../../src/providers/scaleway/types.js";
import { makeRequest } from "../../src/utils/make-request.js";

vi.mock(import("../../src/utils/make-request.js"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

vi.mock(import("../../src/utils/retry.js"), () => {
    return {
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(scalewayProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                scalewayProvider({ region: "fr-par" } as any);
            }).toThrow();
        });

        it("should throw error if region is missing", () => {
            expect(() => {
                scalewayProvider({ apiKey: "test123" } as any);
            }).toThrow();
        });

        it("should create provider with apiKey and region", () => {
            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("scaleway");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
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
