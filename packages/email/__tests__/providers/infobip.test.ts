import { beforeEach, describe, expect, it, vi } from "vitest";

import { infobipProvider } from "../../src/providers/infobip/index.js";
import type { InfobipEmailOptions } from "../../src/providers/infobip/types.js";
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

describe(infobipProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                infobipProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiKey", () => {
            const provider = infobipProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("infobip");
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
                        body: { messages: [{ messageId: "test-message-id" }] },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = infobipProvider({ apiKey: "test123" });
            const emailOptions: InfobipEmailOptions = {
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
