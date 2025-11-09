import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailtrapProvider } from "../../src/providers/mailtrap/index.js";
import type { MailtrapEmailOptions } from "../../src/providers/mailtrap/types.js";
import { makeRequest } from "../../src/utils/make-request.js";
import { retry } from "../../src/utils/retry.js";

vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(mailtrapProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiToken is missing", () => {
            expect(() => {
                mailtrapProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiToken", () => {
            const provider = mailtrapProvider({ apiToken: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailtrap");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: { message_ids: ["test-message-id"] },
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mailtrapProvider({ apiToken: "test123" });
            const emailOptions: MailtrapEmailOptions = {
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
