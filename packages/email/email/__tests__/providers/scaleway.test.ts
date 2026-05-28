import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import { scalewayProvider } from "../../src/providers/scaleway/index";
import type { ScalewayEmailOptions } from "../../src/providers/scaleway/types";
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

describe(scalewayProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if apiKey is missing", () => {
            expect.assertions(1);

            expect(() => {
                scalewayProvider({ region: "fr-par" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if region is missing", () => {
            expect.assertions(1);

            expect(() => {
                scalewayProvider({ apiKey: "test123" } as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with apiKey and region", () => {
            expect.assertions(2);

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("scaleway");
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: {
                    body: { id: "test-message-id" },
                    statusCode: 201,
                },
                success: true,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });
            const emailOptions: ScalewayEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("should send with cc/bcc/replyTo/template/projectId/headers/text", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-1" }, statusCode: 201 },
                success: true,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                projectId: "project-1",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                templateId: "tmpl-1",
                templateVariables: { name: "John" },
                text: "Hi",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send with attachments (string/Buffer/raw)", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "id-2" }, statusCode: 201 },
                success: true,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

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

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

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

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            });

            expect(result.success).toBe(false);
        });

        it("should return error when request fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                error: new Error("Network error"),
                success: false,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

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

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.getEmail?.("");

            expect(result?.success).toBe(false);
        });

        it("should return email details on success", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "msg-1" }, statusCode: 200 },
                success: true,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.getEmail?.("msg-1");

            expect(result?.success).toBe(true);
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

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("branch coverage", () => {
        it("should send an attachment whose content is a Promise", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({
                data: { body: { id: "p-1" }, statusCode: 200 },
                success: true,
            });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                attachments: [{ content: Promise.resolve(new Uint8Array([104, 105])), filename: "p.bin" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return an error when retrieving an email fails", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: new Error("not found"), success: false });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should return an error when retrieving an email throws", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockRejectedValue(new Error("network down"));

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should report unknown error when getEmail fails with a non-Error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ error: "string failure", success: false });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.getEmail?.("msg-x");

            expect(result?.success).toBe(false);
        });

        it("should fail initialize when the availability check errors", async () => {
            expect.assertions(1);

            const throwingConsole = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn((message: string) => {
                    if (message.includes("Checking Scaleway API availability")) {
                        throw new Error("logger boom");
                    }
                }),
                warn: vi.fn(),
            } as unknown as Console;

            const provider = scalewayProvider({ apiKey: "test123", logger: throwingConsole, region: "fr-par" });

            await expect(provider.initialize()).rejects.toThrow(EmailError);
        });

        it("should send with templateId but no templateVariables", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "tv-1" }, statusCode: 201 }, success: true });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                templateId: "tmpl-only",
                to: { email: "user@example.com" },
            } as any);

            expect(result.success).toBe(true);
        });

        it("should send an attachment with a raw Buffer", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { body: { id: "rb-1" }, statusCode: 201 }, success: true });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                attachments: [{ filename: "r.bin", raw: Buffer.from("rawbytes") }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("should return a default error when send fails without an error", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ success: false });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should generate a message id when the response body lacks one", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValue({ data: { statusCode: 201 }, success: true });

            const provider = scalewayProvider({ apiKey: "test123", region: "fr-par" });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });
});
