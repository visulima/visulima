import { beforeEach, describe, expect, it, vi } from "vitest";

import { postalProvider } from "../../src/providers/postal/index.js";
import type { PostalEmailOptions } from "../../src/providers/postal/types.js";
import * as utils from "../../src/utils.js";

vi.mock(import("../../src/utils.js"), async () => {
    const actual = await vi.importActual("../../src/utils.js");

    return {
        ...actual,
        makeRequest: vi.fn(),
        retry: vi.fn(async (function_) => await function_()),
    };
});

describe(postalProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if host is missing", () => {
            expect(() => {
                postalProvider({ apiKey: "test123" } as any);
            }).toThrow();
        });

        it("should throw error if apiKey is missing", () => {
            expect(() => {
                postalProvider({ host: "example.com" } as any);
            }).toThrow();
        });

        it("should create provider with host and apiKey", () => {
            const provider = postalProvider({ apiKey: "test123", host: "example.com" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("postal");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            const makeRequestSpy = vi.spyOn(utils, "makeRequest").mockResolvedValue({
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
