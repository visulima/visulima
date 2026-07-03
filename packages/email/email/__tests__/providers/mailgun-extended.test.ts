import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailgunProvider } from "../../src/providers/mailgun/index";
import type { MailgunEmailOptions } from "../../src/providers/mailgun/types";
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

const okSend = {
    data: { body: { id: "<msg_123@mg>" }, statusCode: 200 },
    success: true,
};

const baseEmail: MailgunEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const parseForm = (): URLSearchParams => {
    const lastCall = makeRequestMock.mock.calls.at(-1);

    return new URLSearchParams(lastCall?.[2] as string);
};

const config = { apiKey: "key", domain: "mg.example.com" };

describe("mailgun provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEmail", () => {
        it("returns an error when no id is supplied", async () => {
            expect.assertions(2);

            const provider = mailgunProvider(config);
            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Email ID is required");
        });

        it("returns the message headers from the events API", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ data: { items: [{ message: { headers: { "message-id": "abc" } } }] }, success: true });

            const provider = mailgunProvider(config);
            const result = await provider.getEmail?.("abc");

            expect(result?.success).toBe(true);
            expect(result?.data).toStrictEqual({ "message-id": "abc" });
        });

        it("resolves with undefined when no events are returned", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockResolvedValueOnce({ data: { items: [] }, success: true });

            const provider = mailgunProvider(config);
            const result = await provider.getEmail?.("missing");

            expect(result?.success).toBe(true);
            expect(result?.data).toBeUndefined();
        });

        it("wraps an API failure into an EmailError", async () => {
            expect.assertions(2);

            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("not found"), success: false });

            const provider = mailgunProvider(config);
            const result = await provider.getEmail?.("missing");

            expect(result?.success).toBe(false);
            expect((result?.error as Error).message).toContain("Failed to retrieve email");
        });

        it("catches thrown errors", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValueOnce({ data: { statusCode: 200 }, success: true }).mockRejectedValueOnce(new Error("network down"));

            const provider = mailgunProvider(config);
            const result = await provider.getEmail?.("abc");

            expect(result?.success).toBe(false);
        });
    });

    describe("isAvailable", () => {
        it("returns false when the request throws", async () => {
            expect.assertions(1);

            makeRequestMock.mockRejectedValue(new Error("boom"));

            const provider = mailgunProvider(config);

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the response has no usable data", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: undefined, success: true });

            const provider = mailgunProvider(config);

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("throws when the API is not available", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 401 }, success: false });

            const provider = mailgunProvider(config);

            await expect(provider.initialize()).rejects.toThrow("Mailgun API not available");
        });
    });

    describe("sendEmail payload", () => {
        beforeEach(() => {
            makeRequestMock.mockResolvedValue(okSend);
        });

        it("includes text, replyTo, campaign and delivery time", async () => {
            expect.assertions(4);

            const provider = mailgunProvider(config);
            const deliveryTime = Math.floor(Date.parse("2030-01-01T00:00:00.000Z") / 1000);

            await provider.sendEmail({
                ...baseEmail,
                campaignId: "camp-1",
                deliveryTime,
                replyTo: { email: "reply@example.com" },
                text: "plain body",
            });

            const form = parseForm();

            expect(form.get("text")).toBe("plain body");
            expect(form.get("h:Reply-To")).toBe("reply@example.com");
            expect(form.get("o:campaign")).toBe("camp-1");
            expect(form.get("o:deliverytime")).toBe(new Date(deliveryTime * 1000).toUTCString());
        });

        it("maps the tracking flags to yes/no", async () => {
            expect.assertions(3);

            const provider = mailgunProvider(config);

            await provider.sendEmail({
                ...baseEmail,
                clickTracking: true,
                openTracking: false,
                unsubscribeTracking: true,
            });

            const form = parseForm();

            expect(form.get("o:clicktracking")).toBe("yes");
            expect(form.get("o:tracking")).toBe("no");
            expect(form.get("o:tracking-clicks")).toBe("yes");
        });

        it("includes test mode, require TLS and skip verification flags", async () => {
            expect.assertions(3);

            const provider = mailgunProvider(config);

            await provider.sendEmail({
                ...baseEmail,
                requireTls: true,
                skipVerification: true,
                testMode: true,
            });

            const form = parseForm();

            expect(form.get("o:testmode")).toBe("yes");
            expect(form.get("o:require-tls")).toBe("yes");
            expect(form.get("o:skip-verification")).toBe("yes");
        });

        it("expands template variables with the v: prefix, JSON-encoding objects and dropping nullish values", async () => {
            expect.assertions(4);

            const provider = mailgunProvider(config);

            await provider.sendEmail({
                ...baseEmail,
                template: "welcome",
                templateVariables: { meta: { a: 1 }, name: "John", skip: undefined },
            });

            const form = parseForm();

            expect(form.get("template")).toBe("welcome");
            expect(form.get("v:name")).toBe("John");
            expect(form.get("v:meta")).toBe(JSON.stringify({ a: 1 }));
            expect(form.get("v:skip")).toBeNull();
        });

        it("encodes attachments under indexed keys", async () => {
            expect.assertions(4);

            const provider = mailgunProvider(config);

            await provider.sendEmail({
                ...baseEmail,
                attachments: [
                    { content: "plain-text", filename: "a.txt" },
                    { content: Promise.resolve(new Uint8Array([104, 105])), filename: "b.bin" },
                    { content: Buffer.from("buffered"), filename: "c.bin" },
                    { filename: "d.txt", raw: "raw-string" },
                ],
            });

            const form = parseForm();

            expect(form.get("attachment[0]")).toBe("plain-text");
            expect(form.get("attachment[1]")).toBe(Buffer.from([104, 105]).toString("base64"));
            expect(form.get("attachment[2]")).toBe(Buffer.from("buffered").toString("base64"));
            expect(form.get("attachment[3]")).toBe("raw-string");
        });

        it("fails when an attachment has no content", async () => {
            expect.assertions(1);

            const provider = mailgunProvider(config);

            const result = await provider.sendEmail({
                ...baseEmail,
                attachments: [{ filename: "empty.txt" }],
            });

            expect(result.success).toBe(false);
        });

        it("returns failure when the send request is unsuccessful", async () => {
            expect.assertions(2);

            makeRequestMock.mockReset();
            makeRequestMock
                .mockResolvedValueOnce({ data: { statusCode: 200 }, success: true })
                .mockResolvedValueOnce({ error: new Error("rejected"), success: false });

            const provider = mailgunProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { statusCode: 200 }, success: true });

            const provider = mailgunProvider(config);

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
