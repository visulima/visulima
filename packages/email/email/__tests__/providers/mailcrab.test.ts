import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the SMTP provider so MailCrab never opens a real socket.
const smtpProviderMock = vi.fn();

vi.mock(import("../../src/providers/smtp/index"), () => {
    return {
        smtpProvider: (...arguments_: unknown[]): unknown => smtpProviderMock(...arguments_) as unknown,
    };
});

// eslint-disable-next-line import/first
import { mailCrabProvider } from "../../src/providers/mailcrab/index";

describe(mailCrabProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        smtpProviderMock.mockReset();
    });

    describe("initialization", () => {
        it("should create provider with defaults (localhost:1025)", () => {
            expect.assertions(3);

            smtpProviderMock.mockReturnValue({
                initialize: vi.fn(),
                isAvailable: vi.fn(),
                sendEmail: vi.fn(),
                validateCredentials: vi.fn(),
            });

            const provider = mailCrabProvider();

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mailcrab");
            expect(smtpProviderMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: "localhost",
                    port: 1025,
                }),
            );
        });

        it("should accept custom host and port", () => {
            expect.assertions(1);

            smtpProviderMock.mockReturnValue({
                initialize: vi.fn(),
                isAvailable: vi.fn(),
                sendEmail: vi.fn(),
                validateCredentials: vi.fn(),
            });

            mailCrabProvider({ host: "mailcrab.local", port: 2525, secure: true });

            expect(smtpProviderMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: "mailcrab.local",
                    port: 2525,
                    secure: true,
                }),
            );
        });
    });

    describe("features", () => {
        it("should declare features", () => {
            expect.assertions(1);

            smtpProviderMock.mockReturnValue({});

            const provider = mailCrabProvider();

            expect(provider.features).toStrictEqual({
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: false,
                tracking: false,
            });
        });
    });

    describe("delegation", () => {
        it("should delegate initialize() to SMTP provider", async () => {
            expect.assertions(1);

            const initialize = vi.fn().mockResolvedValue(undefined);

            smtpProviderMock.mockReturnValue({ initialize });

            const provider = mailCrabProvider();

            await provider.initialize();

            expect(initialize).toHaveBeenCalledTimes(1);
        });

        it("should delegate isAvailable() to SMTP provider", async () => {
            expect.assertions(2);

            const isAvailable = vi.fn().mockResolvedValue(true);

            smtpProviderMock.mockReturnValue({ isAvailable });

            const provider = mailCrabProvider();

            await expect(provider.isAvailable()).resolves.toBe(true);
            expect(isAvailable).toHaveBeenCalledTimes(1);
        });

        it("should delegate sendEmail() and override provider name on success", async () => {
            expect.assertions(2);

            const sendEmail = vi.fn().mockResolvedValue({
                data: {
                    messageId: "abc",
                    provider: "smtp",
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            });

            smtpProviderMock.mockReturnValue({ sendEmail });

            const provider = mailCrabProvider();

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("mailcrab");
        });

        it("should pass through failure responses unchanged", async () => {
            expect.assertions(1);

            const sendEmail = vi.fn().mockResolvedValue({
                error: new Error("SMTP error"),
                success: false,
            });

            smtpProviderMock.mockReturnValue({ sendEmail });

            const provider = mailCrabProvider();

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
        });

        it("should delegate validateCredentials when SMTP supports it", async () => {
            expect.assertions(2);

            const validateCredentials = vi.fn().mockResolvedValue(true);

            smtpProviderMock.mockReturnValue({ validateCredentials });

            const provider = mailCrabProvider();
            const validate = provider.validateCredentials as () => Promise<boolean>;

            await expect(validate()).resolves.toBe(true);
            expect(validateCredentials).toHaveBeenCalledTimes(1);
        });

        it("should return false when SMTP does not implement validateCredentials", async () => {
            expect.assertions(1);

            smtpProviderMock.mockReturnValue({});

            const provider = mailCrabProvider();
            const validate = provider.validateCredentials as () => Promise<boolean>;

            await expect(validate()).resolves.toBe(false);
        });
    });
});
