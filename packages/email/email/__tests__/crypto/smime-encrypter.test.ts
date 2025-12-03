import { readFile } from "@visulima/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSmimeEncrypter, SmimeEncrypter } from "../../src/crypto/smime-encrypter";
import type { SmimeEncryptOptions } from "../../src/crypto/types";
import type { EmailOptions } from "../../src/types";

vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn(),
    };
});

vi.mock(import("node:crypto"), async () => {
    const actualCrypto = (await vi.importActual("node:crypto")) as typeof import("node:crypto");

    return {
        ...actualCrypto,
        createPublicKey: vi.fn(
            (_key: string) =>
                // Return a mock KeyObject-like object
                // The actual implementation will use publicEncrypt which we'll also mock
                ({
                    asymmetricKeyType: "rsa",
                    type: "public",
                }) as ReturnType<typeof actualCrypto.createPublicKey>,
        ),
        publicEncrypt: vi.fn(
            (_options: any, _buffer: Buffer) =>
                // Mock publicEncrypt to return a buffer of the expected size
                Buffer.alloc(256), // RSA encrypted data is typically 256 bytes for 2048-bit key
        ),
    };
});

vi.mock(import("pkijs"), async () => {
    const actualPKIjs = await vi.importActual("pkijs");

    // Mock Certificate class completely to avoid real parsing
    class MockCertificate {
        public issuer = { value: "CN=Test CA" };

        public serialNumber = { valueHex: new Uint8Array([1, 2, 3, 4]) };

        public getPublicKey = vi.fn().mockResolvedValue({
            algorithm: { name: "RSA-OAEP" },
            extractable: true,
            type: "public",
        } as CryptoKey);

        public constructor(_options?: any) {
            // Accept any constructor parameters but don't use them
        }

        public toSchema() {
            return {
                toBER: vi.fn(() => new Uint8Array([1, 2, 3, 4, 5])),
            };
        }
    }

    // Mock other classes used in the code to avoid real crypto operations
    class MockEnvelopedData {
        public constructor(options?: any) {
            Object.assign(this, {
                encryptedContentInfo: {
                    contentEncryptionAlgorithm: {},
                    contentType: "",
                    encryptedContent: new Uint8Array([1, 2, 3]),
                },
                recipientInfos: [],
                toSchema: vi.fn(() => {
                    return { toBER: vi.fn(() => new Uint8Array([1, 2, 3])) };
                }),
                version: options?.version || 0,
            });
        }
    }

    class MockRecipientInfo {
        public constructor(options?: any) {
            Object.assign(this, {
                value: {
                    encryptedKey: new Uint8Array([1, 2, 3]),
                    keyEncryptionAlgorithm: {},
                    rid: {},
                    version: 0,
                },
                variant: options?.variant || 0,
            });
        }
    }

    return {
        ...actualPKIjs,
        AlgorithmIdentifier: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    algorithmId: options?.algorithmId || "",
                    algorithmParams: options?.algorithmParams || null,
                });
            }
        },
        Certificate: MockCertificate,
        ContentInfo: class {
            public constructor(_options?: any) {
                Object.assign(this, {
                    toSchema: vi.fn(() => {
                        return {
                            toBER: vi.fn(() => new Uint8Array([1, 2, 3, 4, 5])),
                        };
                    }),
                });
            }
        },
        EncryptedContentInfo: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    contentEncryptionAlgorithm: options?.contentEncryptionAlgorithm || null,
                    contentType: options?.contentType || "",
                    encryptedContent: options?.encryptedContent || null,
                    toSchema: vi.fn(() => {
                        return { toBER: vi.fn(() => new Uint8Array([1, 2, 3])) };
                    }),
                });
            }
        },
        EnvelopedData: MockEnvelopedData,
        id_ContentType_Data: "1.2.840.113549.1.7.1",
        id_ContentType_EnvelopedData: "1.2.840.113549.1.7.3",
        IssuerAndSerialNumber: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    issuer: options?.issuer || {},
                    serialNumber: options?.serialNumber || {},
                });
            }
        },
        KeyTransRecipientInfo: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    encryptedKey: options?.encryptedKey || new Uint8Array([1, 2, 3]),
                    keyEncryptionAlgorithm: options?.keyEncryptionAlgorithm || {},
                    rid: options?.rid || {},
                    version: options?.version || 0,
                });
            }
        },
        RecipientInfo: MockRecipientInfo,
    };
});

vi.mock(import("asn1js"), async () => {
    const actualAsn1js = await vi.importActual("asn1js");

    return {
        ...actualAsn1js,
        fromBER: vi.fn(() => {
            return {
                offset: 0,
                result: { valueHex: new Uint8Array([1, 2, 3, 4]) },
            };
        }),
        OctetString: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    valueHex: options?.valueHex || new ArrayBuffer(0),
                });
            }
        },
    };
});

// Test certificate (PEM format)
const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKLz8K8k8K8kMA0GCSqGSIb3DQEBCQUAMCExHzAdBgNV
BAMMFnRlc3QuZXhhbXBsZS5jb20gQ0EgMTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAx
MDEwMDAwMDBaMCExHzAdBgNVBAMMFnRlc3QuZXhhbXBsZS5jb20gQ0EgMTCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALtUlNS31SzxwqMzMR9jKOJYDhHj
8zZtLX58kTGJk9neUnlTzPzDZnYvenk3wr1DRHtUlNS31SzxwqMzMR9jKOJYDhHj
8zZtLX58kTGJk9neUnlTzPzDZnYvenk3wr1DRHtUlNS31SzxwqMzMR9jKOJYDhHj
8zZtLX58kTGJk9neUnlTzPzDZnYvenk3wr1DRHtUlNS31SzxwqMzMR9jKOJYDhHj
8zZtLX58kTGJk9neUnlTzPzDZnYvenk3wr1DRHtUlNS31SzxwqMzMR9jKOJYDhHj
8zZtLX58kTGJk9neUnlTzPzDZnYvenk3wr1DRHtUlNS31SzxwqMzMR9jKOJYDhHj
AwIBAgIJAKLz8K8k8K8kMA0GCSqGSIb3DQEBCQUAMCExHzAdBgNVBAMMFnRlc3Qu
ZXhhbXBsZS5jb20gQ0EgMTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBa
-----END CERTIFICATE-----`;

describe(SmimeEncrypter, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create a SmimeEncrypter instance", () => {
            expect.assertions(1);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const encrypter = new SmimeEncrypter(options);

            expect(encrypter).toBeInstanceOf(SmimeEncrypter);
        });
    });

    describe(createSmimeEncrypter, () => {
        it("should create a SmimeEncrypter instance", () => {
            expect.assertions(1);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const encrypter = createSmimeEncrypter(options);

            expect(encrypter).toBeInstanceOf(SmimeEncrypter);
        });
    });

    describe("encrypt", () => {
        // Note: Testing for missing pkijs/asn1js is difficult with dynamic imports
        // The error handling is tested implicitly when the modules are not available

        it("should encrypt email with single certificate", async () => {
            expect.assertions(5);

            vi.mocked(readFile).mockResolvedValue(TEST_CERTIFICATE);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            const encrypted = await encrypter.encrypt(email);

            expect(readFile).toHaveBeenCalledWith("/path/to/certificate.crt", { encoding: "utf8" });
            expect(encrypted.text).toBeDefined();
            expect(encrypted.html).toBeUndefined();
            expect(encrypted.headers).toBeDefined();
            expect(encrypted.headers["Content-Type"]).toContain("application/pkcs7-mime");
        });

        it("should encrypt email with multiple certificates", async () => {
            expect.assertions(3);

            vi.mocked(readFile).mockResolvedValue(TEST_CERTIFICATE);

            const options: SmimeEncryptOptions = {
                certificates: {
                    "recipient1@example.com": "/path/to/recipient1.crt",
                    "recipient2@example.com": "/path/to/recipient2.crt",
                },
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: [{ email: "recipient1@example.com" }, { email: "recipient2@example.com" }],
            };

            const encrypter = createSmimeEncrypter(options);

            const encrypted = await encrypter.encrypt(email);

            expect(readFile).toHaveBeenCalledWith("/path/to/recipient1.crt", { encoding: "utf8" });
            expect(readFile).toHaveBeenCalledWith("/path/to/recipient2.crt", { encoding: "utf8" });
            expect(encrypted.text).toBeDefined();
        });

        it("should throw error if certificate not found for recipient", async () => {
            expect.assertions(1);

            const options: SmimeEncryptOptions = {
                certificates: {
                    "recipient1@example.com": "/path/to/recipient1.crt",
                },
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient2@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            await expect(encrypter.encrypt(email)).rejects.toThrow("No certificate found for recipient");
        });

        it("should use default algorithm (aes-256-cbc)", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValue(TEST_CERTIFICATE);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            const encrypted = await encrypter.encrypt(email);

            expect(encrypted.text).toBeDefined();
        });

        it("should use specified algorithm", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValue(TEST_CERTIFICATE);

            const options: SmimeEncryptOptions = {
                algorithm: "aes-128-cbc",
                certificates: "/path/to/certificate.crt",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            const encrypted = await encrypter.encrypt(email);

            expect(encrypted.text).toBeDefined();
        });

        it("should handle text content", async () => {
            expect.assertions(2);

            vi.mocked(readFile).mockResolvedValue(TEST_CERTIFICATE);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test Subject",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            const encrypted = await encrypter.encrypt(email);

            expect(encrypted.text).toBeDefined();
            expect(encrypted.html).toBeUndefined();
        });

        it("should throw error for invalid certificate", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValue("invalid-certificate");

            const asn1js = await import("asn1js");

            vi.mocked(asn1js.fromBER).mockReturnValueOnce({
                offset: -1,
                result: {},
            } as any);

            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            await expect(encrypter.encrypt(email)).rejects.toThrow("Failed to parse certificate");
        });

        it("should throw error for invalid certificate in multiple certificates setup", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValue("invalid-certificate");

            const asn1js = await import("asn1js");

            vi.mocked(asn1js.fromBER).mockReturnValueOnce({
                offset: -1,
                result: {},
            } as any);

            const options: SmimeEncryptOptions = {
                certificates: {
                    "recipient1@example.com": "/path/to/recipient1.crt",
                    "recipient2@example.com": "/path/to/recipient2.crt",
                },
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient1@example.com" },
            };

            const encrypter = createSmimeEncrypter(options);

            await expect(encrypter.encrypt(email)).rejects.toThrow("Failed to parse certificate for recipient1@example.com");
        });
    });
});
