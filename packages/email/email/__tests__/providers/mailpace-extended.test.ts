import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailPaceProvider } from "../../src/providers/mailpace/index";
import type { MailPaceEmailOptions } from "../../src/providers/mailpace/types";
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

const baseEmail: MailPaceEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const config = { apiToken: "token123" };

describe("mailpace provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = mailPaceProvider(config);
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the email body on success", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { body: { id: "msg_1", status: "queued" } }, success: true });

            const provider = mailPaceProvider(config);
            const result = await provider.getEmail?.("msg_1");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ id: "msg_1", status: "queued" });
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = mailPaceProvider(config);
            const result = await provider.getEmail?.("missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockRejectedValueOnce(new Error("network down"));

            const provider = mailPaceProvider(config);
            const result = await provider.getEmail?.("msg_1");

            expect(result?.success).toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: true });

            const provider = mailPaceProvider(config);

            await expect(provider.initialize()).rejects.toThrow("MailPace API not available");
        });
    });

    describe("sendEmail payload", () => {
        it("returns failure when the send request is unsuccessful", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("rejected"), success: false });

            const provider = mailPaceProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("falls back to a generated message id when the body has none", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: {}, statusCode: 200 }, success: true });

            const provider = mailPaceProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });
});
