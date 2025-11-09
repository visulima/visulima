import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailerSendProvider } from "../../src/providers/mailersend/index.js";
import type { MailerSendEmailOptions } from "../../src/providers/mailersend/types.js";
import * as utils from "../../src/utils.js";

vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
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
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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
