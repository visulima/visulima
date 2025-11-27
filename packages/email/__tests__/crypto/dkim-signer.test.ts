import { readFile } from "@visulima/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDkimSigner, DkimSigner } from "../../src/crypto/dkim-signer";
import type { DkimOptions } from "../../src/crypto/types";
import type { EmailOptions } from "../../src/types";
import { TEST_PRIVATE_KEY } from "./fixtures";

// Mock @visulima/fs
vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn<Parameters<typeof import("@visulima/fs").readFile>>(),
    };
});

describe(DkimSigner, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });
    describe("constructor", () => {
        it("should create a DkimSigner instance", () => {
            expect.assertions(1);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const signer = new DkimSigner(options);

            expect(signer).toBeInstanceOf(DkimSigner);
        });
    });

    describe(createDkimSigner, () => {
        it("should create a DkimSigner instance", () => {
            expect.assertions(1);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const signer = createDkimSigner(options);

            expect(signer).toBeInstanceOf(DkimSigner);
        });
    });

    describe("sign", () => {
        it("should sign an email message with DKIM", async () => {
            expect.assertions(6);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers).toBeDefined();
            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers["DKIM-Signature"]).toContain("v=1");
            expect(signed.headers["DKIM-Signature"]).toContain("a=rsa-sha256");
            expect(signed.headers["DKIM-Signature"]).toContain("d=example.com");
            expect(signed.headers["DKIM-Signature"]).toContain("s=default");
        });

        it("should sign an email with text content", async () => {
            expect.assertions(1);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test Subject",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
        });

        it("should sign an email with both text and html", async () => {
            expect.assertions(1);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
        });

        it("should handle file-based private keys", async () => {
            expect.assertions(2);

            const filePath = "/path/to/private-key.pem";

            vi.mocked(readFile).mockResolvedValue(TEST_PRIVATE_KEY);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: `file://${filePath}`,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(readFile).toHaveBeenCalledWith(filePath, { encoding: "utf8" });
            expect(signed.headers["DKIM-Signature"]).toBeDefined();
        });

        it("should handle CC recipients", async () => {
            expect.assertions(2);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers.Cc).toBeDefined();
        });

        it("should handle Reply-To header", async () => {
            expect.assertions(2);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers["Reply-To"]).toBeDefined();
        });

        it("should handle multiple recipients", async () => {
            expect.assertions(3);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: [{ email: "recipient1@example.com" }, { email: "recipient2@example.com", name: "Recipient 2" }],
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers.To).toContain("recipient1@example.com");
            expect(signed.headers.To).toContain("\"Recipient 2\" <recipient2@example.com>");
        });

        it("should handle custom headers", async () => {
            expect.assertions(2);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                headers: {
                    "X-Custom-Header": "custom-value",
                },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers["X-Custom-Header"]).toBe("custom-value");
        });

        it("should use relaxed canonicalization when specified", async () => {
            expect.assertions(1);

            const options: DkimOptions = {
                bodyCanon: "relaxed",
                domainName: "example.com",
                headerCanon: "relaxed",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toContain("c=relaxed/relaxed");
        });

        it("should ignore specified headers", async () => {
            expect.assertions(3);

            const options: DkimOptions = {
                domainName: "example.com",
                headersToIgnore: ["Message-ID", "X-Custom-Header"],
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                headers: {
                    "Message-ID": "<test@example.com>",
                    "X-Custom-Header": "custom-value",
                },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers["DKIM-Signature"]).not.toContain("message-id");
            expect(signed.headers["DKIM-Signature"]).not.toContain("x-custom-header");
        });

        it("should handle email addresses with names", async () => {
            expect.assertions(3);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com", name: "Sender Name" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com", name: "Recipient Name" },
            };

            const signer = createDkimSigner(options);
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
            expect(signed.headers.From).toContain("Sender Name");
            expect(signed.headers.To).toContain("Recipient Name");
        });

        it("should throw error for invalid private key", async () => {
            expect.assertions(1);

            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                privateKey: "invalid-key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);

            await expect(signer.sign(email)).rejects.toThrow("Failed to create DKIM signature");
        });

        it("should handle passphrase option for encrypted keys", async () => {
            expect.assertions(1);

            // Note: The test key is not encrypted, so providing a passphrase won't cause an error
            // This test verifies that the passphrase option is accepted and processed
            const options: DkimOptions = {
                domainName: "example.com",
                keySelector: "default",
                // eslint-disable-next-line sonarjs/no-hardcoded-passwords
                passphrase: "test-passphrase",
                privateKey: TEST_PRIVATE_KEY,
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createDkimSigner(options);
            // The test key is not encrypted, so it will succeed even with a passphrase
            const signed = await signer.sign(email);

            expect(signed.headers["DKIM-Signature"]).toBeDefined();
        });
    });
});
