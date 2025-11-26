import { beforeEach, describe, expect, it, vi } from "vitest";

import { azureProvider } from "../../src/providers/azure/index";
import type { AzureEmailOptions } from "../../src/providers/azure/types";
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

describe(azureProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if region is missing", () => {
            expect(() => {
                azureProvider({ accessToken: "test123" } as any);
            }).toThrow();
        });

        it("should throw error if both connectionString and accessToken are missing", () => {
            expect(() => {
                azureProvider({ region: "eastus" } as any);
            }).toThrow();
        });

        it("should create provider with accessToken and region", () => {
            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("azure");
        });

        it("should create provider with connectionString and region", () => {
            const provider = azureProvider({ connectionString: "endpoint=test;accesskey=key123", region: "eastus" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("azure");
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
                        statusCode: 202,
                    },
                    success: true,
                });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const emailOptions: AzureEmailOptions = {
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
