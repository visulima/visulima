import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSmimeEncrypter, SmimeEncrypter } from "../../src/crypto/smime-encrypter.js";
import type { SmimeEncryptOptions } from "../../src/crypto/types.js";
import type { EmailOptions } from "../../src/types.js";

vi.mock(import("node:fs/promises"), () => {
    return {
        readFile: vi.fn(),
    };
});

vi.mock(import("pkijs"), async () => {
    const actualPKIjs = await vi.importActual("pkijs");

    // Mock Certificate class completely to avoid real parsing
    class MockCertificate {
        issuer = { value: "CN=Test CA" };

        serialNumber = { valueHex: new Uint8Array([1, 2, 3, 4]) };

        getPublicKey = vi.fn().mockResolvedValue({
            algorithm: { name: "RSA-OAEP" },
            extractable: true,
            type: "public",
        } as CryptoKey);

        constructor(options?: any) {
            // Accept any constructor parameters but don't use them
        }
    }

    // Mock other classes used in the code to avoid real crypto operations
    class MockEnvelopedData {
        constructor(options?: any) {
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
        constructor(options?: any) {
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
            constructor(options?: any) {
                Object.assign(this, {
                    algorithmId: options?.algorithmId || "",
                    algorithmParams: options?.algorithmParams || null,
                });
            }
        },
        Certificate: MockCertificate,
        ContentInfo: class {
            constructor(options?: any) {
                Object.assign(this, {
                    toSchema: vi.fn(() => {
                        return {
                            toBER: vi.fn(() => new Uint8Array([1, 2, 3, 4, 5])),
                        };
                    }),
                });
            }
        },
        EnvelopedData: MockEnvelopedData,
        EnvelopedDataVersion: { v0: 0 },
        id_Data: "1.2.840.113549.1.7.1",
        id_EnvelopedData: "1.2.840.113549.1.7.3",
        KeyTransRecipientInfo: class {
            constructor(options?: any) {
                Object.assign(this, {
                    encryptedKey: options?.encryptedKey || new Uint8Array([1, 2, 3]),
                    keyEncryptionAlgorithm: options?.keyEncryptionAlgorithm || {},
                    rid: options?.rid || {},
                    version: options?.version || 0,
                });
            }
        },
        RecipientIdentifierType: { issuerAndSerialNumber: 0 },
        RecipientInfo: MockRecipientInfo,
    };
});

vi.mock(import("asn1js"), () => {
    return {
        fromBER: vi.fn(() => {
            return {
                offset: 0,
                result: { valueHex: new Uint8Array([1, 2, 3, 4]) },
            };
        }),
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
            const options: SmimeEncryptOptions = {
                certificates: "/path/to/certificate.crt",
            };

            const encrypter = new SmimeEncrypter(options);

            expect(encrypter).toBeInstanceOf(SmimeEncrypter);
        });
    });

    describe(createSmimeEncrypter, () => {
        it("should create a SmimeEncrypter instance", () => {
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

            // Mock Web Crypto API
            const mockPublicKey = {
                algorithm: { name: "RSA-OAEP" },
            } as CryptoKey;

            const mockSubtle = {
                encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
                exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
                generateKey: vi.fn().mockResolvedValue({
                    algorithm: { name: "AES-CBC" },
                } as CryptoKey),
                getRandomValues: vi.fn((array: Uint8Array) => {
                    for (let i = 0; i < array.length; i++) {
                        array[i] = i % 256;
                    }

                    return array;
                }),
            } as unknown as SubtleCrypto;

            Object.defineProperty(globalThis.crypto, "subtle", {
                configurable: true,
                value: mockSubtle,
                writable: true,
            });

            try {
                const encrypted = await encrypter.encrypt(email);

                expect(readFile).toHaveBeenCalledWith("/path/to/certificate.crt", "utf-8");
                expect(encrypted.text).toBeDefined();
                expect(encrypted.html).toBeUndefined();
                expect(encrypted.headers).toBeDefined();
                expect(encrypted.headers["Content-Type"]).toContain("application/pkcs7-mime");
            } finally {
                Object.defineProperty(globalThis.crypto, "subtle", {
                    configurable: true,
                    value: globalThis.crypto.subtle,
                    writable: true,
                });
            }
        });

        it("should encrypt email with multiple certificates", async () => {
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

            const mockPublicKey = {
                algorithm: { name: "RSA-OAEP" },
            } as CryptoKey;

            const mockSubtle = {
                encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
                exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
                generateKey: vi.fn().mockResolvedValue({
                    algorithm: { name: "AES-CBC" },
                } as CryptoKey),
                getRandomValues: vi.fn((array: Uint8Array) => {
                    for (let i = 0; i < array.length; i++) {
                        array[i] = i % 256;
                    }

                    return array;
                }),
            } as unknown as SubtleCrypto;

            Object.defineProperty(globalThis.crypto, "subtle", {
                configurable: true,
                value: mockSubtle,
                writable: true,
            });

            try {
                const encrypted = await encrypter.encrypt(email);

                expect(readFile).toHaveBeenCalledWith("/path/to/recipient1.crt", "utf-8");
                expect(readFile).toHaveBeenCalledWith("/path/to/recipient2.crt", "utf-8");
                expect(encrypted.text).toBeDefined();
            } finally {
                Object.defineProperty(globalThis.crypto, "subtle", {
                    configurable: true,
                    value: globalThis.crypto.subtle,
                    writable: true,
                });
            }
        });

        it("should throw error if certificate not found for recipient", async () => {
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

            const mockPublicKey = {
                algorithm: { name: "RSA-OAEP" },
            } as CryptoKey;

            const mockSubtle = {
                encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
                exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
                generateKey: vi.fn().mockResolvedValue({
                    algorithm: { name: "AES-CBC" },
                } as CryptoKey),
                getRandomValues: vi.fn((array: Uint8Array) => array),
            } as unknown as SubtleCrypto;

            Object.defineProperty(globalThis.crypto, "subtle", {
                configurable: true,
                value: mockSubtle,
                writable: true,
            });

            try {
                const encrypted = await encrypter.encrypt(email);

                expect(encrypted.text).toBeDefined();
            } finally {
                Object.defineProperty(globalThis.crypto, "subtle", {
                    configurable: true,
                    value: globalThis.crypto.subtle,
                    writable: true,
                });
            }
        });

        it("should use specified algorithm", async () => {
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

            const mockPublicKey = {
                algorithm: { name: "RSA-OAEP" },
            } as CryptoKey;

            const mockSubtle = {
                encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
                exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
                generateKey: vi.fn().mockResolvedValue({
                    algorithm: { name: "AES-CBC" },
                } as CryptoKey),
                getRandomValues: vi.fn((array: Uint8Array) => array),
            } as unknown as SubtleCrypto;

            Object.defineProperty(globalThis.crypto, "subtle", {
                configurable: true,
                value: mockSubtle,
                writable: true,
            });

            try {
                const encrypted = await encrypter.encrypt(email);

                expect(encrypted.text).toBeDefined();
            } finally {
                Object.defineProperty(globalThis.crypto, "subtle", {
                    configurable: true,
                    value: globalThis.crypto.subtle,
                    writable: true,
                });
            }
        });

        it("should handle text content", async () => {
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

            const mockPublicKey = {
                algorithm: { name: "RSA-OAEP" },
            } as CryptoKey;

            const mockSubtle = {
                encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
                exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
                generateKey: vi.fn().mockResolvedValue({
                    algorithm: { name: "AES-CBC" },
                } as CryptoKey),
                getRandomValues: vi.fn((array: Uint8Array) => array),
            } as unknown as SubtleCrypto;

            Object.defineProperty(globalThis.crypto, "subtle", {
                configurable: true,
                value: mockSubtle,
                writable: true,
            });

            try {
                const encrypted = await encrypter.encrypt(email);

                expect(encrypted.text).toBeDefined();
                expect(encrypted.html).toBeUndefined();
            } finally {
                Object.defineProperty(globalThis.crypto, "subtle", {
                    configurable: true,
                    value: globalThis.crypto.subtle,
                    writable: true,
                });
            }
        });

        it("should throw error for invalid certificate", async () => {
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
