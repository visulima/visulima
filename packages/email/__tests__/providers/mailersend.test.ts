import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailerSendProvider } from "../../src/providers/mailersend/index.js";
import type { MailerSendEmailOptions } from "../../src/providers/mailersend/types.js";
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

describe(mailerSendProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiToken is missing", () => {
            expect(() => {
                mailerSendProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiToken", () => {
            const provider = mailerSendProvider({ apiToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailersend");
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
                        body: { message_id: "test-message-id" },
                        statusCode: 202,
                    },
                    success: true,
                });

            const provider = mailerSendProvider({ apiToken: "test123" });
            const emailOptions: MailerSendEmailOptions = {
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
