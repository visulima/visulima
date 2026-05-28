import { Buffer } from "node:buffer";

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

const baseEmail: AzureEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const available = { data: { statusCode: 202 }, success: true };

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("azure provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("authenticates with a connection string", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ data: { body: { id: "m1" } }, success: true });

            const provider = azureProvider({ connectionString: "endpoint=test;accesskey=key123", region: "eastus" });
            const result = await provider.getEmail?.("m1");

            expect(result?.success).toBe(true);
        });

        it("wraps a failed retrieval", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.getEmail?.("missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches a thrown error", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce(available).mockRejectedValueOnce(new Error("network down"));

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.getEmail?.("m1");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns true on a 2xx response", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 202 }, success: true });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("returns false when credentials are rejected with 401", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns true when the payload is rejected with 400", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 400 }, success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("returns false on any other status", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 500 }, success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the request throws an auth error", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("HTTP 401 Unauthorized"));

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the request throws a generic error", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("encodes a promise-based attachment as base64", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ data: { body: { messageId: "id-1" }, statusCode: 202 }, success: true });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" }],
            });

            const attachments = parsePayload().attachments as { contentInBase64: string }[];

            expect(result.success).toBe(true);
            expect(attachments[0].contentInBase64).toBe(Buffer.from([104, 105]).toString("base64"));
        });

        it("returns failure when the send request fails", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ error: new Error("rejected"), success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("authenticates the send request with a connection string", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce(available)
                .mockResolvedValueOnce({ data: { body: { messageId: "cs-1" }, statusCode: 202 }, success: true });

            const provider = azureProvider({ connectionString: "endpoint=test;accesskey=key123", region: "eastus" });
            const result = await provider.sendEmail(baseEmail);

            const lastCall = makeRequestMock.mock.calls.at(-1);

            expect(result.success).toBe(true);
            expect((lastCall?.[1] as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer key123");
        });

        it("sends a text-only email without an html body", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce(available)
                .mockResolvedValueOnce({ data: { body: { messageId: "t-1" }, statusCode: 202 }, success: true });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "plain text",
                to: { email: "user@example.com" },
            });

            const payload = parsePayload() as { content: { html?: string } };

            expect(result.success).toBe(true);
            expect(payload.content.html).toBeUndefined();
        });

        it("falls back to a generic error when a failed send has no error", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("uses a generic message when a getEmail failure has no error", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce(available).mockResolvedValueOnce({ success: false });

            const provider = azureProvider({ accessToken: "test123", region: "eastus" });
            const result = await provider.getEmail?.("m1");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Unknown error");
        });
    });
});
