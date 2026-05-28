import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

const baseEmail: MailomatEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const config = { apiKey: "test123" };

const parsePayload = (): Record<string, unknown> => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return JSON.parse(lastCall?.[2] as string) as Record<string, unknown>;
};

describe("mailomat provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = mailomatProvider(config);
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce({ data: { body: { id: "m1", status: "sent" } }, success: true });

            const provider = mailomatProvider(config);
            const result = await provider.getEmail?.("m1");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ id: "m1", status: "sent" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = mailomatProvider(config);
            const result = await provider.getEmail?.("missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValueOnce(new Error("network down"));

            const provider = mailomatProvider(config);
            const result = await provider.getEmail?.("m1");

            expect(result?.success).toBe(false);
        });
    });

    describe("sendEmail payload", () => {
        it("encodes a promise-based attachment as base64", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: { id: "id-1" }, statusCode: 200 }, success: true });

            const provider = mailomatProvider(config);
            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" }],
            });

            const attachments = parsePayload().attachments as { content: string }[];

            expect(result.success).toBe(true);
            expect(attachments[0].content).toBe(Buffer.from([104, 105]).toString("base64"));
        });

        it("falls back to a generated message id when the body has none", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: {}, statusCode: 200 }, success: true });

            const provider = mailomatProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });
});
