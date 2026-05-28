import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock nodemailer before importing the provider.
const createTransportMock = vi.fn();

vi.mock("nodemailer", () => {
    return {
        default: {
            createTransport: (...arguments_: unknown[]) => createTransportMock(...arguments_),
        },
    };
});

// eslint-disable-next-line import/first
import RequiredOptionError from "../../src/errors/required-option-error";
// eslint-disable-next-line import/first
import { nodemailerProvider } from "../../src/providers/nodemailer/index";

const createMockTransporter = (overrides: Partial<Record<string, unknown>> = {}) => ({
    close: vi.fn(),
    sendMail: vi.fn().mockResolvedValue({ messageId: "nm-msg-id" }),
    verify: vi.fn().mockResolvedValue(true),
    ...overrides,
});

describe(nodemailerProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createTransportMock.mockReset();
    });

    describe("initialization", () => {
        it("should throw error if transport is missing", () => {
            expect.assertions(1);

            expect(() => {
                nodemailerProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with transport object", () => {
            expect.assertions(2);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("nodemailer");
        });

        it("should initialize and verify the transporter", async () => {
            expect.assertions(2);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.initialize();

            expect(createTransportMock).toHaveBeenCalledWith({ host: "smtp.example.com" });
            expect(transporter.verify).toHaveBeenCalled();
        });

        it("should throw EmailError if verify fails", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter({
                verify: vi.fn().mockRejectedValue(new Error("verify failed")),
            });

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await expect(provider.initialize()).rejects.toThrow(/Failed to initialize nodemailer/);
        });

        it("should not re-initialize on subsequent calls", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.initialize();
            await provider.initialize();

            expect(transporter.verify).toHaveBeenCalledTimes(1);
        });
    });

    describe("isAvailable / validateCredentials", () => {
        it("should return true on successful verify", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("should return false on failed verify", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter({
                verify: vi.fn().mockRejectedValue(new Error("failed")),
            });

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should return true via validateCredentials", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
        });

        it("should return false via validateCredentials on failure", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter({
                verify: vi.fn().mockRejectedValue(new Error("denied")),
            });

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await expect(provider.validateCredentials!()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email with minimum required fields", async () => {
            expect.assertions(2);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("nm-msg-id");
        });

        it("should format addresses with names properly", async () => {
            expect.assertions(2);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.sendEmail({
                from: { email: "sender@example.com", name: "Sender" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com", name: "User" },
            });

            const mailOptions = transporter.sendMail.mock.calls[0]![0];

            expect(mailOptions.from).toBe("Sender <sender@example.com>");
            expect(mailOptions.to).toBe("User <user@example.com>");
        });

        it("should handle to arrays, cc, bcc, replyTo and headers", async () => {
            expect.assertions(3);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.sendEmail({
                bcc: { email: "bcc@example.com" },
                cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com", name: "Reply" },
                subject: "Test",
                text: "Hi",
                to: [{ email: "u1@example.com" }, { email: "u2@example.com" }],
            });

            const mailOptions = transporter.sendMail.mock.calls[0]![0];

            expect(Array.isArray(mailOptions.to)).toBe(true);
            expect(mailOptions.cc).toHaveLength(2);
            expect(mailOptions.replyTo).toBe("Reply <reply@example.com>");
        });

        it("should pass attachments with raw, content, path", async () => {
            expect.assertions(3);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.sendEmail({
                attachments: [
                    {
                        cid: "cid-1",
                        contentDisposition: "inline",
                        contentType: "text/plain",
                        encoding: "utf-8",
                        filename: "a.txt",
                        headers: { "X-Attach": "1" },
                        raw: "rawcontent",
                    },
                    {
                        content: Buffer.from("hi"),
                        filename: "b.txt",
                    },
                    {
                        filename: "c.txt",
                        href: "https://example.com/c.txt",
                        httpHeaders: { Authorization: "Bearer" },
                        path: "/tmp/c.txt",
                    },
                ],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "u@example.com" },
            });

            const mailOptions = transporter.sendMail.mock.calls[0]![0];

            expect(mailOptions.attachments).toHaveLength(3);
            expect(mailOptions.attachments[0].content).toBe("rawcontent");
            expect(mailOptions.attachments[2].path).toBe("/tmp/c.txt");
        });

        it("should use defaultFrom when provided", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({
                defaultFrom: { email: "default@example.com", name: "Default" },
                transport: { host: "smtp.example.com" },
            });

            await provider.sendEmail({
                from: { email: "ignored@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "u@example.com" },
            });

            expect(transporter.sendMail.mock.calls[0]![0].from).toBe("Default <default@example.com>");
        });

        it("should use transportOverride when provided", async () => {
            expect.assertions(2);

            const defaultTransporter = createMockTransporter();
            const overrideTransporter = createMockTransporter();

            createTransportMock.mockReturnValueOnce(defaultTransporter).mockReturnValueOnce(overrideTransporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.default.com" } });

            await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "u@example.com" },
                transportOverride: { host: "smtp.override.com" },
            });

            expect(overrideTransporter.sendMail).toHaveBeenCalled();
            expect(defaultTransporter.sendMail).not.toHaveBeenCalled();
        });

        it("should return validation errors for invalid options", async () => {
            expect.assertions(2);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            const result = await provider.sendEmail({
                from: { email: "" },
                subject: "",
                to: { email: "" },
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Validation failed");
        });

        it("should return error when sendMail throws", async () => {
            expect.assertions(2);

            const transporter = createMockTransporter({
                sendMail: vi.fn().mockRejectedValue(new Error("SMTP rejected")),
            });

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "u@example.com" },
            });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Failed to send email");
        });
    });

    describe("shutdown", () => {
        it("should close the transporter", async () => {
            expect.assertions(1);

            const transporter = createMockTransporter();

            createTransportMock.mockReturnValue(transporter);

            const provider = nodemailerProvider({ transport: { host: "smtp.example.com" } });

            await provider.initialize();
            await provider.shutdown!();

            expect(transporter.close).toHaveBeenCalled();
        });
    });
});
