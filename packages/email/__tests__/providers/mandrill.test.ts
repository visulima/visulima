import { beforeEach, describe, expect, it, vi } from "vitest";

import { mandrillProvider } from "../../src/providers/mandrill/index.js";
import type { MandrillEmailOptions } from "../../src/providers/mandrill/types.js";
import * as utils from "../../src/utils.js";

vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(mandrillProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect(() => {
                mandrillProvider({} as any);
            }).toThrow();
        });

        it("should create provider with apiKey", () => {
            const provider = mandrillProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mandrill");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
                data: {
                    body: [{ _id: "test-message-id" }],
                    statusCode: 200,
                },
                success: true,
            });

            const provider = mandrillProvider({ apiKey: "test123" });
            const emailOptions: MandrillEmailOptions = {
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
