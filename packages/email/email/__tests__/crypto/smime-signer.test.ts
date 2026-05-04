import { readFile } from "@visulima/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSmimeSigner, SmimeSigner } from "../../src/crypto/smime-signer";
import type { SmimeSignOptions } from "../../src/crypto/types";
import type { EmailOptions } from "../../src/types";

vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn(),
    };
});

vi.mock(import("node:crypto"), async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const actualCrypto = (await vi.importActual("node:crypto")) as typeof import("node:crypto");

    return {
        ...actualCrypto,
        createHash: vi.fn(() => {
            return {
                digest: vi.fn(() => Buffer.alloc(32)),
                update: vi.fn().mockReturnThis(),
            };
        }),
        createPrivateKey: vi.fn((key: string | { key: string; passphrase?: string }) => {
            const keyString = typeof key === "string" ? key : key.key;

            if (keyString === "invalid-key") {
                throw new Error("Invalid key format");
            }

            return {
                asymmetricKeyType: "rsa",
                type: "private",
            } as ReturnType<typeof actualCrypto.createPrivateKey>;
        }),
        createSign: vi.fn(() => {
            return {
                sign: vi.fn(() => Buffer.alloc(256)),
                update: vi.fn().mockReturnThis(),
            };
        }),
        randomBytes: vi.fn((size: number) => Buffer.alloc(size)),
    };
});

vi.mock(import("pkijs"), async () => {
    const actualPKIjs = await vi.importActual("pkijs");

    // Mock Certificate class completely to avoid real parsing
    class MockCertificate {
        public issuer = { value: "CN=Test CA" };

        public serialNumber = { valueHex: new Uint8Array([1, 2, 3, 4]) };

        public getPublicKey = vi.fn().mockResolvedValue({
            algorithm: { name: "RSA-PSS" },
            extractable: true,
            type: "public",
        });

        public constructor(_options?: any) {
            // Accept any constructor parameters but don't use them
        }
    }

    // Mock other classes used in the code to avoid real crypto operations
    class MockSignedData {
        public constructor(options?: any) {
            Object.assign(this, {
                certificates: [],
                encapContentInfo: {},
                signerInfos: [],
                toSchema: vi.fn(() => {
                    return { toBER: vi.fn(() => new Uint8Array([1, 2, 3])) };
                }),

                version: options?.version ?? 1,
            });
        }
    }

    class MockSignerInfo {
        public constructor(options?: any) {
            Object.assign(this, {
                digestAlgorithm: {},
                sid: {},
                signature: new Uint8Array([1, 2, 3]),
                signatureAlgorithm: {},
                signedAttrs: {},

                version: options?.version ?? 1,
            });
        }
    }

    return {
        ...actualPKIjs,
        AlgorithmIdentifier: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    algorithmId: options?.algorithmId ?? "",

                    algorithmParams: options?.algorithmParams ?? null,
                });
            }
        },
        Attribute: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    type: options?.type ?? "",

                    values: options?.values ?? [],
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
        EncapsulatedContentInfo: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    eContent: options?.eContent ?? null,

                    eContentType: options?.eContentType ?? "",
                });
            }
        },
        id_ContentType_Data: "1.2.840.113549.1.7.1",
        id_ContentType_SignedData: "1.2.840.113549.1.7.2",
        id_sha256: "2.16.840.1.101.3.4.2.1",
        IssuerAndSerialNumber: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    issuer: options?.issuer ?? {},

                    serialNumber: options?.serialNumber ?? {},
                });
            }
        },
        SignedAndUnsignedAttributes: class {
            public attributes: any[];

            public type: number;

            public encodedValue: ArrayBuffer;

            public constructor(options?: any) {
                this.attributes = options?.attributes ?? [];
                this.type = 0;
                this.encodedValue = new ArrayBuffer(0);
            }

            public toSchema() {
                return {
                    toBER: vi.fn(() => new Uint8Array([1, 2, 3])),
                };
            }
        },
        SignedData: MockSignedData,
        SignedDataVersion: { v1: 1 },
        SignerInfo: MockSignerInfo,
        SignerInfoVersion: { v1: 1 },
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
        ObjectIdentifier: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    value: options?.value ?? "",
                });
            }
        },
        OctetString: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    valueHex: options?.valueHex ?? new ArrayBuffer(0),
                });
            }
        },
        UTCTime: class {
            public constructor(options?: any) {
                Object.assign(this, {
                    valueDate: options?.valueDate ?? new Date(),
                });
            }
        },
    };
});

// Test certificate and private key (PEM format)
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

// Test fixture - not a real private key, used only for mocked crypto operations
const TEST_PRIVATE_KEY = "test-private-key-fixture-for-mocking";

describe(SmimeSigner, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create a SmimeSigner instance", () => {
            expect.assertions(1);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const signer = new SmimeSigner(options);

            expect(signer).toBeInstanceOf(SmimeSigner);
        });
    });

    describe(createSmimeSigner, () => {
        it("should create a SmimeSigner instance", () => {
            expect.assertions(1);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const signer = createSmimeSigner(options);

            expect(signer).toBeInstanceOf(SmimeSigner);
        });
    });

    describe("sign", () => {
        // Note: Testing for missing pkijs/asn1js is difficult with dynamic imports
        // The error handling is tested implicitly when the modules are not available

        it("should read certificate and private key from files", async () => {
            expect.assertions(5);

            vi.mocked(readFile).mockResolvedValueOnce(TEST_CERTIFICATE).mockResolvedValueOnce(TEST_PRIVATE_KEY);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            const signed = await signer.sign(email);

            expect(readFile).toHaveBeenCalledWith("/path/to/certificate.crt", { encoding: "utf8" });
            expect(readFile).toHaveBeenCalledWith("/path/to/private-key.key", { encoding: "utf8" });
            expect(signed.text).toBeDefined();
            expect(signed.headers).toBeDefined();
            expect(signed.headers["Content-Type"]).toContain("multipart/signed");
        });

        it("should handle passphrase for encrypted keys", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValueOnce(TEST_CERTIFICATE).mockResolvedValueOnce(TEST_PRIVATE_KEY);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                passphrase: "test-passphrase",
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            const signed = await signer.sign(email);

            expect(signed.text).toBeDefined();
        });

        it("should handle intermediate certificates", async () => {
            expect.assertions(2);

            vi.mocked(readFile).mockResolvedValueOnce(TEST_CERTIFICATE).mockResolvedValueOnce(TEST_PRIVATE_KEY).mockResolvedValueOnce(TEST_CERTIFICATE);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                intermediateCerts: ["/path/to/intermediate.crt"],
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            const signed = await signer.sign(email);

            expect(readFile).toHaveBeenCalledWith("/path/to/intermediate.crt", { encoding: "utf8" });
            expect(signed.text).toBeDefined();
        });

        it("should handle text content", async () => {
            expect.assertions(2);

            vi.mocked(readFile).mockResolvedValueOnce(TEST_CERTIFICATE).mockResolvedValueOnce(TEST_PRIVATE_KEY);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test Subject",
                text: "Test content",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            const signed = await signer.sign(email);

            expect(signed.text).toBeDefined();
            expect(signed.html).toBeUndefined();
        });

        it("should throw error for invalid certificate", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValueOnce("invalid-certificate").mockResolvedValueOnce(TEST_PRIVATE_KEY);

            const asn1js = await import("asn1js");

            vi.mocked(asn1js.fromBER).mockReturnValueOnce({
                offset: -1,
                result: {},
            } as any);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            await expect(signer.sign(email)).rejects.toThrow("Failed to parse certificate");
        });

        it("should throw error for invalid private key", async () => {
            expect.assertions(1);

            vi.mocked(readFile).mockResolvedValueOnce(TEST_CERTIFICATE).mockResolvedValueOnce("invalid-key");

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            await expect(signer.sign(email)).rejects.toThrow("Failed to parse private key");
        });

        it("should throw error for invalid intermediate certificate", async () => {
            expect.assertions(1);

            vi.mocked(readFile)
                .mockResolvedValueOnce(TEST_CERTIFICATE)
                .mockResolvedValueOnce(TEST_PRIVATE_KEY)
                .mockResolvedValueOnce("invalid-intermediate-cert");

            const asn1js = await import("asn1js");

            // Mock sequence: main cert (succeeds), intermediate cert (fails)
            vi.mocked(asn1js.fromBER)

                .mockReturnValueOnce({
                    // Main certificate - succeeds
                    offset: 0,
                    result: { valueHex: new Uint8Array([1, 2, 3, 4]) },
                } as any)

                .mockReturnValueOnce({
                    // Intermediate certificate - should fail
                    offset: -1,
                    result: {},
                } as any);

            const options: SmimeSignOptions = {
                certificate: "/path/to/certificate.crt",
                intermediateCerts: ["/path/to/intermediate.crt"],
                privateKey: "/path/to/private-key.key",
            };

            const email: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "recipient@example.com" },
            };

            const signer = createSmimeSigner(options);

            await expect(signer.sign(email)).rejects.toThrow("Failed to parse intermediate certificate");
        });
    });
});
