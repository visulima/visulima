import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { postalProvider } from "../../src/providers/postal/index";
import type { PostalEmailOptions } from "../../src/providers/postal/types";
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

describe(postalProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if host is missing", () => {
            expect.assertions(1);

            expect(() => {
                postalProvider({ apiKey: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                postalProvider({ host: "example.com" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with host and apiKey", () => {
            expect.assertions(2);

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("postal");
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
                        body: { message_id: 12_345 },
                        statusCode: 200,
                    },
                    success: true,
                });

            const provider = postalProvider({ apiKey: "test123", host: "example.com" });
            const emailOptions: PostalEmailOptions = {
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
