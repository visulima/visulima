import { createPrivateKey } from "node:crypto";
import { readFile } from "node:fs/promises";

import { fromBER, ObjectIdentifier, OctetString, UTCTime } from "asn1js";
import {
    AlgorithmIdentifier,
    Attribute,
    Certificate,
    ContentInfo,
    EncapsulatedContentInfo,
    id_ContentType,
    id_Data,
    id_MessageDigest,
    id_RSASSA_PKCS1_v1_5,
    id_SHA256,
    id_SignedData,
    id_SigningTime,
    IssuerAndSerialNumber,
    SignedAttributes,
    SignedData,
    SignedDataVersion,
    SignerInfo,
    SignerInfoVersion,
} from "pkijs";

import type { EmailOptions } from "../types";
import type { EmailSigner, SmimeSignOptions } from "./types";

const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Converts PEM to DER (binary) format.
 * @param pem The PEM string to convert.
 * @returns The DER format as Uint8Array.
 */
const pemToDer = (pem: string): Uint8Array => {
    const base64 = pem
        .replaceAll(/-----BEGIN[^-]+-----/g, "")
        .replaceAll(/-----END[^-]+-----/g, "")
        .replaceAll(/\s/g, "");

    if (hasBuffer) {
        return Buffer.from(base64, "base64");
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
};

/**
 * Converts DER to PEM format.
 * @param der The DER format as ArrayBuffer.
 * @param type The type of certificate/key (e.g., 'CERTIFICATE', 'PRIVATE KEY').
 * @returns The PEM formatted string.
 */
const derToPem = (der: ArrayBuffer, type: string): string => {
    let base64: string;

    if (hasBuffer) {
        base64 = Buffer.from(der).toString("base64");
    } else {
        const bytes = new Uint8Array(der);

        base64 = btoa(String.fromCharCode(...bytes));
    }

    // Split into 64-character lines
    const lines = base64.match(/.{1,64}/g) || [];

    return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----\n`;
};

/**
 * S/MIME signer implementation using PKIjs
 * Note: Requires pkijs and asn1js for S/MIME operations
 * Works in Node.js, Bun, and Deno (with Web Crypto API support)
 */
export class SmimeSigner implements EmailSigner {
    private readonly options: SmimeSignOptions;

    /**
     * Creates a new S/MIME signer.
     * @param options S/MIME signing options.
     */
    constructor(options: SmimeSignOptions) {
        this.options = options;
    }

    /**
     * Signs an email message with S/MIME.
     * @param email The email options to sign.
     * @returns The email options with S/MIME signature.
     * @throws {Error} When signing fails (e.g., invalid certificate/key or missing Web Crypto API).
     */
    async sign(email: EmailOptions): Promise<EmailOptions> {
        // Get Web Crypto API
        const { crypto } = globalThis;

        if (!crypto || !crypto.subtle) {
            throw new Error("Web Crypto API is required for S/MIME signing. Available in Node.js 20+, Bun, and Deno.");
        }

        // Load certificate and private key
        const certificatePem = await readFile(this.options.certificate, "utf-8");
        const privateKeyPem = await readFile(this.options.privateKey, "utf-8");

        // Parse certificate from PEM
        const certDer = pemToDer(certificatePem);
        const asn1 = fromBER(certDer.buffer);

        if (asn1.offset === -1) {
            throw new Error("Failed to parse certificate: Invalid ASN.1 structure");
        }

        const cert = new Certificate({ schema: asn1.result });

        // Parse private key - use Node.js crypto for all key formats (PKCS#8, PKCS#1, encrypted)
        // Node.js crypto handles encrypted keys (PBES2/PBKDF2) automatically
        let privateKey: CryptoKey;

        try {
            const keyObject = this.options.passphrase
                ? createPrivateKey({
                    key: privateKeyPem,
                    passphrase: this.options.passphrase,
                })
                : createPrivateKey(privateKeyPem);

            // Convert Node.js key to Web Crypto format
            const keyDer = keyObject.export({ format: "der", type: "pkcs8" });

            // Try RSA-PSS first
            try {
                privateKey = await crypto.subtle.importKey(
                    "pkcs8",
                    keyDer,
                    {
                        hash: "SHA-256",
                        name: "RSA-PSS",
                    },
                    false,
                    ["sign"],
                );
            } catch {
                // Fallback to RSASSA-PKCS1-v1_5
                privateKey = await crypto.subtle.importKey(
                    "pkcs8",
                    keyDer,
                    {
                        hash: "SHA-256",
                        name: "RSASSA-PKCS1-v1_5",
                    },
                    false,
                    ["sign"],
                );
            }
        } catch (error) {
            throw new Error(`Failed to parse private key: ${(error as Error).message}`);
        }

        // Load intermediate certificates if provided
        const intermediateCerts: Certificate[] = [];

        if (this.options.intermediateCerts) {
            for (const certPath of this.options.intermediateCerts) {
                const certPem = await readFile(certPath, "utf-8");
                const certDer = pemToDer(certPem);
                const asn1 = fromBER(certDer.buffer);

                if (asn1.offset === -1) {
                    throw new Error(`Failed to parse intermediate certificate ${certPath}: Invalid ASN.1 structure`);
                }

                intermediateCerts.push(new Certificate({ schema: asn1.result }));
            }
        }

        // Build the email message
        const message = await this.buildMessage(email);
        const messageBuffer = new TextEncoder().encode(message);

        // Create PKCS#7 signed data
        const signedData = new SignedData({
            version: SignedDataVersion.v1,
        });

        // Set content (detached signature)
        signedData.encapContentInfo = new EncapsulatedContentInfo({
            eContentType: id_Data,
        });

        // Create signer info
        const signerInfo = new SignerInfo({
            digestAlgorithm: new AlgorithmIdentifier({
                algorithmId: id_SHA256,
            }),
            sid: new IssuerAndSerialNumber({
                issuer: cert.issuer,
                serialNumber: cert.serialNumber,
            }),
            signatureAlgorithm: new AlgorithmIdentifier({
                algorithmId: id_RSASSA_PKCS1_v1_5, // Use PKCS1-v1_5 for better compatibility
            }),
            version: SignerInfoVersion.v1,
        });

        // Calculate message digest
        const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
        const messageDigest = new Uint8Array(hashBuffer);

        // Create authenticated attributes
        const authenticatedAttributes = new SignedAttributes({
            attributes: [
                new Attribute({
                    type: id_ContentType,
                    values: [new ObjectIdentifier({ value: id_Data })],
                }),
                new Attribute({
                    type: id_MessageDigest,
                    values: [new OctetString({ valueHex: messageDigest.buffer })],
                }),
                new Attribute({
                    type: id_SigningTime,
                    values: [
                        new UTCTime({
                            valueDate: new Date(),
                        }),
                    ],
                }),
            ],
        });

        signerInfo.signedAttrs = authenticatedAttributes;

        // Sign the authenticated attributes
        const attributesBuffer = authenticatedAttributes.toSchema().toBER(false);

        // Determine signature algorithm based on key type
        let signature: ArrayBuffer;
        const keyAlgorithm = (privateKey.algorithm as RsaHashedKeyAlgorithm).name;

        if (keyAlgorithm === "RSA-PSS") {
            signature = await crypto.subtle.sign(
                {
                    name: "RSA-PSS",
                    saltLength: 32,
                },
                privateKey,
                attributesBuffer,
            );
        } else {
            // RSASSA-PKCS1-v1_5
            signature = await crypto.subtle.sign(
                {
                    name: "RSASSA-PKCS1-v1_5",
                },
                privateKey,
                attributesBuffer,
            );
        }

        signerInfo.signature = new Uint8Array(signature);

        // Add signer info
        signedData.signerInfos.push(signerInfo);

        // Add certificates
        signedData.certificates = [cert, ...intermediateCerts];

        // Encode to BER
        const cmsContent = new ContentInfo({
            content: signedData.toSchema(),
            contentType: id_SignedData,
        });

        const cmsBuffer = cmsContent.toSchema().toBER(false);

        // Convert to PEM format
        const signedDataPem = derToPem(cmsBuffer, "PKCS7");

        // Create multipart/signed message
        const boundary = `----_=_NextPart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const signedMessage = [
            `Content-Type: multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="${boundary}"`,
            "",
            `--${boundary}`,
            message,
            `--${boundary}`,
            "Content-Type: application/pkcs7-signature; name=smime.p7s",
            "Content-Transfer-Encoding: base64",
            "Content-Disposition: attachment; filename=smime.p7s",
            "",
            signedDataPem
                .split("\n")
                .filter((line) => line.trim() && !line.includes("-----"))
                .join(""),
            `--${boundary}--`,
        ].join("\r\n");

        // Return modified email with signed content
        return {
            ...email,
            headers: {
                ...email.headers,
                "Content-Type": `multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="${boundary}"`,
            },
            html: undefined, // S/MIME signed messages are typically text-based
            text: signedMessage,
        };
    }

    /**
     * Build the email message from options
     */
    private async buildMessage(email: EmailOptions): Promise<string> {
        const lines: string[] = [];

        lines.push(`From: ${this.formatAddress(email.from)}`);
        lines.push(`To: ${this.formatAddresses(email.to)}`);

        if (email.cc) {
            lines.push(`Cc: ${this.formatAddresses(email.cc)}`);
        }

        if (email.replyTo) {
            lines.push(`Reply-To: ${this.formatAddress(email.replyTo)}`);
        }

        lines.push(`Subject: ${email.subject}`, "MIME-Version: 1.0");

        if (email.headers) {
            for (const [key, value] of Object.entries(email.headers)) {
                lines.push(`${key}: ${value}`);
            }
        }

        lines.push("");

        if (email.text) {
            lines.push(email.text);
        } else if (email.html) {
            lines.push(email.html);
        }

        return lines.join("\r\n");
    }

    /**
     * Format email address for headers
     */
    private formatAddress(address: { email: string; name?: string }): string {
        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }

        return address.email;
    }

    /**
     * Format email addresses for headers
     */
    private formatAddresses(addresses: { email: string; name?: string } | { email: string; name?: string }[]): string {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];

        return addressArray.map((addr) => this.formatAddress(addr)).join(", ");
    }
}

/**
 * Create an S/MIME signer instance
 */

/**
 * Create an S/MIME signer instance
 * @param options S/MIME signing options
 * @returns A new SmimeSigner instance
 */
export const createSmimeSigner = (options: SmimeSignOptions): SmimeSigner => new SmimeSigner(options);
