import { beforeEach, describe, expect, it, vi } from "vitest";

import { sweegoProvider } from "../../src/providers/sweego/index.js";
import type { SweegoEmailOptions } from "../../src/providers/sweego/types.js";
import { makeRequest } from "../../src/utils/make-request.js";
import { retry } from "../../src/utils/retry.js";

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

describe(sweegoProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                sweegoProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiKey", () => {
            const provider = sweegoProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("sweego");
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
                        body: { messageId: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = sweegoProvider({ apiKey: "test123" });
            const emailOptions: SweegoEmailOptions = {
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
