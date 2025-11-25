import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailPaceProvider } from "../../src/providers/mailpace/index.js";
import type { MailPaceEmailOptions } from "../../src/providers/mailpace/types.js";
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

describe(mailPaceProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiToken is missing", () => {
            expect(() => {
                mailPaceProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiToken", () => {
            const provider = mailPaceProvider({ apiToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailpace");
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
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = mailPaceProvider({ apiToken: "test123" });
            const emailOptions: MailPaceEmailOptions = {
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
