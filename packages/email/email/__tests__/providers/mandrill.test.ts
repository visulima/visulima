import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { mandrillProvider } from "../../src/providers/mandrill/index";
import type { MandrillEmailOptions } from "../../src/providers/mandrill/types";
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

describe(mandrillProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                mandrillProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey", () => {
            expect.assertions(2);

            const provider = mandrillProvider({ apiKey: "test123" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mandrill");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
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

        it("should send with cc/bcc/replyTo/tags/headers/template/metadata/subaccount/globalAnalytics", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: [{ _id: "id-1" }], statusCode: 200 },
                success: true,
            });

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                globalAnalyticsCampaign: "campaign-1",
                globalAnalyticsDomains: ["example.com"],
                globalMergeVars: [{ content: "John", name: "FNAME" }],
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                mergeVars: [{ rcpt: "user@example.com", vars: [] }],
                metadata: { user_id: "123" },
                replyTo: { email: "reply@example.com", name: "Reply" },
                sendAt: "2026-01-01 00:00:00",
                subaccount: "sub-1",
                subject: "Test",
                tags: ["welcome"],
                templateContent: [{ content: "<h1>{{name}}</h1>", name: "block-1" }],
                templateName: "tmpl-1",
                templateVariables: [{ content: "John", name: "fname" }],
                text: "Hi",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: [{ _id: "id-2" }], statusCode: 200 },
                success: true,
            });

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [
                    { content: "abc", contentType: "text/plain", filename: "a.txt" },
                    { content: Buffer.from("hi"), filename: "b.bin" },
                    { filename: "c.txt", raw: "rawcontent" },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should fail attachment without content/raw", async () => {
            expect.assertions(1);

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "empty.txt" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should return validation error for invalid options", async () => {
            expect.assertions(1);

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            } as any);

            expect(result.success).toBe(false);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });
    });

    describe("getEmail", () => {
        it("should return error if id is empty", async () => {
            expect.assertions(1);

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.getEmail!("");

            expect(result.success).toBe(false);
        });

        it("should return email details on success", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { _id: "msg-1" }, statusCode: 200 },
                success: true,
            });

            const provider = mandrillProvider({ apiKey: "test123" });

            const result = await provider.getEmail!("msg-1");

            expect(result.success).toBe(true);
        });
    });

    describe("validateCredentials", () => {
        it("should delegate to isAvailable", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { statusCode: 200 },
                success: true,
            });

            const provider = mandrillProvider({ apiKey: "test123" });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
        });
    });
});
