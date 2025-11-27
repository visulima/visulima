import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { mailomatProvider } from "../../src/providers/mailomat/index";
import type { MailomatEmailOptions } from "../../src/providers/mailomat/types";
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

describe(mailomatProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                mailomatProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = mailomatProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailomat");
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
                        body: { messageId: "test-message-id" },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = mailomatProvider({ apiKey: "test123" });
            const emailOptions: MailomatEmailOptions = {
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
