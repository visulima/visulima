import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import { autoSendProvider } from "../../src/providers/autosend/index";
import type { AutoSendEmailOptions } from "../../src/providers/autosend/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return { makeRequest: vi.fn() };
});
vi.mock(import("../../src/utils/retry"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

const okResponse = {
    data: {
        body: { data: { emailId: "698afb75ff4bc5466e3a797a", message: "Email queued successfully.", totalRecipients: 1 }, success: true },
        statusCode: 200,
    },
    success: true,
};

const baseEmail: AutoSendEmailOptions = {
    from: { email: "hello@mail.acme.com", name: "Acme" },
    html: "<p>Hi</p>",
    subject: "Welcome",
    to: { email: "jane@example.com", name: "Jane Doe" },
};

const requestBody = (): Record<string, unknown> => JSON.parse((makeRequest as ReturnType<typeof vi.fn>).mock.calls[0][2] as string) as Record<string, unknown>;

describe(autoSendProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws without an apiKey", () => {
        expect.assertions(1);

        expect(() => autoSendProvider({} as never)).toThrow(RequiredOptionError);
    });

    it("posts to the send endpoint with a bearer token and returns the emailId", async () => {
        expect.assertions(4);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce(okResponse);

        const result = await autoSendProvider({ apiKey: "as_key" }).sendEmail(baseEmail);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("698afb75ff4bc5466e3a797a");

        const [url, requestOptions] = makeRequestMock.mock.calls[0];

        expect(String(url)).toBe("https://api.autosend.com/v1/mails/send");
        expect((requestOptions as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer as_key");
    });

    it("maps addresses to AutoSend's recipient objects", async () => {
        expect.assertions(4);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            bcc: { email: "bcc@example.com" },
            cc: [{ email: "cc1@example.com", name: "CC One" }, { email: "cc2@example.com" }],
            replyTo: { email: "reply@acme.com", name: "Support" },
        });

        const body = requestBody();

        expect(body.to).toStrictEqual({ email: "jane@example.com", name: "Jane Doe" });
        expect(body.cc).toStrictEqual([{ email: "cc1@example.com", name: "CC One" }, { email: "cc2@example.com" }]);
        expect(body.bcc).toStrictEqual([{ email: "bcc@example.com" }]);
        expect(body.replyTo).toStrictEqual({ email: "reply@acme.com", name: "Support" });
    });

    it("rejects multiple 'to' recipients rather than silently dropping them", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            to: [{ email: "a@example.com" }, { email: "b@example.com" }],
        });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("exactly one 'to' recipient");
        // The request must never leave, or the second recipient is silently lost.
        expect(makeRequestMock).not.toHaveBeenCalled();
    });

    it("sends a single-element 'to' array as one recipient", async () => {
        expect.assertions(1);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, to: [{ email: "solo@example.com" }] });

        expect(requestBody().to).toStrictEqual({ email: "solo@example.com" });
    });

    it("rejects more than 50 recipients across to/cc/bcc", async () => {
        expect.assertions(2);

        const cc = Array.from({ length: 50 }, (_, index) => {
            return { email: `cc${String(index)}@example.com` };
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, cc });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("at most 50 recipients");
    });

    it("rejects more than 20 attachments", async () => {
        expect.assertions(2);

        const attachments = Array.from({ length: 21 }, (_, index) => {
            return { content: "eA==", filename: `f${String(index)}.txt` };
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, attachments });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("at most 20 attachments");
    });

    it("rejects a subject longer than 998 characters", async () => {
        expect.assertions(2);

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, subject: "s".repeat(999) });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("at most 998 characters");
    });

    it("maps attachments to AutoSend's fileName/content shape", async () => {
        expect.assertions(1);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            attachments: [{ content: Buffer.from("hello"), contentType: "application/pdf", filename: "invoice.pdf" }],
        });

        expect(requestBody().attachments).toStrictEqual([
            { content: Buffer.from("hello").toString("base64"), contentType: "application/pdf", fileName: "invoice.pdf" },
        ]);
    });

    it("sends templateId instead of html/text", async () => {
        expect.assertions(3);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            dynamicData: { name: "Jane" },
            templateId: "tpl_123",
        });

        const body = requestBody();

        expect(body.templateId).toBe("tpl_123");
        expect(body.html).toBeUndefined();
        expect(body.dynamicData).toStrictEqual({ name: "Jane" });
    });

    it("passes AutoSend-specific flags through", async () => {
        expect.assertions(4);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            bypassSuppressions: false,
            trackingClick: false,
            trackingOpen: true,
            unsubscribeGroupId: "grp_1",
        });

        const body = requestBody();

        // `false` must survive: a truthiness check would drop it and silently re-enable tracking.
        expect(body.trackingClick).toBe(false);
        expect(body.trackingOpen).toBe(true);
        expect(body.bypassSuppressions).toBe(false);
        expect(body.unsubscribeGroupId).toBe("grp_1");
    });

    it("rejects more than 20 custom headers", async () => {
        expect.assertions(2);

        const headers = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`X-H-${String(index)}`, "v"]));

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, headers });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("at most 20 custom headers");
    });

    it("treats success:false on a 200 as a failure", async () => {
        expect.assertions(2);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { body: { message: "Domain not verified.", success: false }, statusCode: 200 },
            success: true,
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("Domain not verified.");
    });

    it("surfaces the API message on an error status", async () => {
        expect.assertions(2);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { body: { message: "Invalid API key", success: false }, statusCode: 401 },
            error: new Error("Request failed with status 401"),
            success: false,
        });

        const result = await autoSendProvider({ apiKey: "bad" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("Invalid API key");
    });

    it("reports an accepted message that carries no emailId", async () => {
        expect.assertions(2);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { body: { data: {}, success: true }, statusCode: 200 }, success: true });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("returned no emailId");
    });

    it("sends a template-only message, which has no html/text body of its own", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce(okResponse);

        // The documented template example: templateId + dynamicData, no html/text.
        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({
            dynamicData: { name: "Jane" },
            from: { email: "hello@mail.acme.com" },
            subject: "Your order",
            templateId: "tpl_123",
            to: { email: "jane@example.com" },
        });

        expect(result.success).toBe(true);
        expect(requestBody().templateId).toBe("tpl_123");
        expect(makeRequestMock).toHaveBeenCalledTimes(1);
    });

    it("still requires a body when no templateId is given", async () => {
        expect.assertions(2);

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({
            from: { email: "hello@mail.acme.com" },
            subject: "s",
            to: { email: "jane@example.com" },
        });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("Either text or html content is required");
    });

    it("rejects inline (cid) attachments instead of sending a broken image", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            attachments: [{ cid: "logo", content: Buffer.from("x"), contentDisposition: "inline", contentType: "image/png", filename: "logo.png" }],
            html: "<img src=\"cid:logo\">",
        });

        // AutoSend has no contentId field, so the cid can never resolve.
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("inline (cid) attachments");
        expect(makeRequestMock).not.toHaveBeenCalled();
    });

    it("rejects an empty 'to' array with a validation error, not a TypeError", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, to: [] });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("exactly one 'to' recipient");
        expect(makeRequestMock).not.toHaveBeenCalled();
    });

    it("accepts exactly 50 recipients across to/cc/bcc", async () => {
        expect.assertions(1);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        const cc = Array.from({ length: 49 }, (_, index) => {
            return { email: `cc${String(index)}@example.com` };
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, cc });

        expect(result.success).toBe(true);
    });

    it("accepts exactly 20 attachments, 20 headers and a 998-character subject", async () => {
        expect.assertions(1);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse);

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({
            ...baseEmail,
            attachments: Array.from({ length: 20 }, (_, index) => {
                return { content: "eA==", filename: `f${String(index)}.txt` };
            }),
            headers: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`X-H-${String(index)}`, "v"])),
            subject: "s".repeat(998),
        });

        expect(result.success).toBe(true);
    });

    it("rejects a header name AutoSend would not accept", async () => {
        expect.assertions(2);

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, headers: { "X Bad Name": "v" } });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("header names must match");
    });

    it("rejects a header value longer than 1000 characters", async () => {
        expect.assertions(2);

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail({ ...baseEmail, headers: { "X-Long": "v".repeat(1001) } });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("header values of at most 1000");
    });

    it("preserves the transport error on a timeout instead of reporting a bad body", async () => {
        expect.assertions(2);

        // What make-request returns on an AbortError timeout: an error, and no data at all.
        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            error: new EmailError("http", "Request timed out after 30000ms"),
            success: false,
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("timed out after 30000ms");
    });

    it("preserves the HTTP status when a gateway returns a non-JSON error page", async () => {
        expect.assertions(2);

        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { body: "<html>502 Bad Gateway</html>", statusCode: 502 },
            error: new EmailError("http", "Request failed with status 502"),
            success: false,
        });

        const result = await autoSendProvider({ apiKey: "k" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("502");
    });

    it("surfaces a vendor error body that omits the success flag", async () => {
        expect.assertions(2);

        // The vendor does not document its error shape, so `success: false` cannot be assumed.
        (makeRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { body: { error: "Invalid API key provided" }, statusCode: 401 },
            error: new EmailError("http", "Request failed with status 401"),
            success: false,
        });

        const result = await autoSendProvider({ apiKey: "bad" }).sendEmail(baseEmail);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("Invalid API key provided");
    });

    it("declares only the features AutoSend documents", () => {
        expect.assertions(2);

        const provider = autoSendProvider({ apiKey: "k" });

        expect(provider.features).toMatchObject({ attachments: true, html: true, replyTo: true, templates: true, tracking: true });
        // /mails/bulk exists, but the Provider contract has no batch hook to expose it.
        expect(provider.features).toMatchObject({ batchSending: false, scheduling: false, tagging: false });
    });
});
