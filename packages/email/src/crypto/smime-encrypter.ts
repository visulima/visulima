import { readFile } from "node:fs/promises";

import { fromBER } from "asn1js";
import {
    AlgorithmIdentifier,
    Certificate,
    ContentInfo,
    EnvelopedData,
    EnvelopedDataVersion,
    id_Data,
    id_EnvelopedData,
    KeyTransRecipientInfo,
    RecipientIdentifierType,
    RecipientInfo,
} from "pkijs";

import type { EmailAddress, EmailOptions } from "../types";
import type { EmailEncrypter, SmimeEncryptOptions } from "./types";

const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Convert PEM to DER (binary) format
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
 * Convert DER to PEM format
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
 * S/MIME encrypter implementation using PKIjs
 * Note: Requires pkijs and asn1js for S/MIME operations
 * Works in Node.js, Bun, and Deno (with Web Crypto API support)
 */
export class SmimeEncrypter implements EmailEncrypter {
    private readonly options: SmimeEncryptOptions;

    /**
     * Create a new S/MIME encrypter
     */
    constructor(options: SmimeEncryptOptions) {
        this.options = options;
    }

    /**
     * Encrypt an email message with S/MIME
     */
    async encrypt(email: EmailOptions): Promise<EmailOptions> {
        // Get Web Crypto API
        const { crypto } = globalThis;

        if (!crypto || !crypto.subtle) {
            throw new Error("Web Crypto API is required for S/MIME encryption. Available in Node.js 20+, Bun, and Deno.");
        }

        // Determine which certificate(s) to use
        const recipients = Array.isArray(email.to) ? email.to : [email.to];
        const certificates: Certificate[] = [];

        if (typeof this.options.certificates === "string") {
            // Single certificate for all recipients
            const certPem = await readFile(this.options.certificates, "utf-8");
            const certDer = pemToDer(certPem);
            const asn1 = fromBER(certDer.buffer);

            if (asn1.offset === -1) {
                throw new Error("Failed to parse certificate: Invalid ASN.1 structure");
            }

            certificates.push(new Certificate({ schema: asn1.result }));
        } else {
            // Map of email -> certificate path
            for (const recipient of recipients) {
                const emailAddress = typeof recipient === "string" ? recipient : recipient.email;
                const certPath = this.options.certificates[emailAddress];

                if (!certPath) {
                    throw new Error(`No certificate found for recipient: ${emailAddress}`);
                }

                const certPem = await readFile(certPath, "utf-8");
                const certDer = pemToDer(certPem);
                const asn1 = fromBER(certDer.buffer);

                if (asn1.offset === -1) {
                    throw new Error(`Failed to parse certificate for ${emailAddress}: Invalid ASN.1 structure`);
                }

                certificates.push(new Certificate({ schema: asn1.result }));
            }
        }

        // Build the email message
        const message = await this.buildMessage(email);
        const messageBuffer = new TextEncoder().encode(message);

        // Create PKCS#7 enveloped data
        const envelopedData = new EnvelopedData({
            version: EnvelopedDataVersion.v0,
        });

        // Set content type
        envelopedData.encryptedContentInfo = {
            contentType: id_Data,
        };

        // Determine encryption algorithm
        const algorithm = this.options.algorithm || "aes-256-cbc";
        let algorithmId: string;
        let keyLength: number;

        switch (algorithm.toLowerCase()) {
            case "3des":
            case "des-ede3-cbc": {
                algorithmId = "1.2.840.113549.3.7"; // 3DES-CBC
                keyLength = 24;
                break;
            }
            case "aes128":
            case "aes-128-cbc": {
                algorithmId = "2.16.840.1.101.3.4.1.2"; // AES-128-CBC
                keyLength = 16;
                break;
            }
            case "aes192":
            case "aes-192-cbc": {
                algorithmId = "2.16.840.1.101.3.4.1.22"; // AES-192-CBC
                keyLength = 24;
                break;
            }
            case "aes256":
            case "aes-256-cbc":
            default: {
                algorithmId = "2.16.840.1.101.3.4.1.42"; // AES-256-CBC
                keyLength = 32;
                break;
            }
        }

        // Generate content encryption key
        const contentEncryptionKey = await crypto.subtle.generateKey(
            {
                length: keyLength * 8,
                name: "AES-CBC",
            },
            true,
            ["encrypt"],
        );

        const keyData = await crypto.subtle.exportKey("raw", contentEncryptionKey);
        const keyArray = new Uint8Array(keyData);

        // Generate IV
        const iv = crypto.getRandomValues(new Uint8Array(16));

        // Encrypt content
        const encryptedContent = await crypto.subtle.encrypt(
            {
                iv,
                name: "AES-CBC",
            },
            contentEncryptionKey,
            messageBuffer,
        );

        // Set encrypted content
        envelopedData.encryptedContentInfo.encryptedContent = new Uint8Array(encryptedContent);

        // Add recipient infos (one per certificate)
        for (const cert of certificates) {
            // Extract public key from certificate
            const publicKey = await cert.getPublicKey();

            if (!publicKey) {
                throw new Error("Failed to extract public key from certificate");
            }

            // Encrypt content encryption key with recipient's public key
            const encryptedKey = await crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP",
                },
                publicKey,
                keyArray,
            );

            // Create recipient info
            const recipientInfo = new RecipientInfo({
                value: new KeyTransRecipientInfo({
                    encryptedKey: new Uint8Array(encryptedKey),
                    keyEncryptionAlgorithm: new AlgorithmIdentifier({
                        algorithmId: "1.2.840.113549.1.1.1", // RSA-OAEP
                    }),
                    rid: {
                        issuer: cert.issuer,
                        serialNumber: cert.serialNumber,
                    },
                    version: 0,
                }),
                variant: RecipientIdentifierType.issuerAndSerialNumber,
            });

            envelopedData.recipientInfos.push(recipientInfo);
        }

        // Set encryption algorithm
        envelopedData.encryptedContentInfo.contentEncryptionAlgorithm = new AlgorithmIdentifier({
            algorithmId,
            algorithmParams: iv,
        });

        // Encode to BER
        const cmsContent = new ContentInfo({
            content: envelopedData.toSchema(),
            contentType: id_EnvelopedData,
        });

        const cmsBuffer = cmsContent.toSchema().toBER(false);

        // Convert to PEM format
        const encryptedDataPem = derToPem(cmsBuffer, "PKCS7");

        // Return encrypted email
        return {
            ...email,
            headers: {
                ...email.headers,
                "Content-Disposition": "attachment; filename=smime.p7m",
                "Content-Transfer-Encoding": "base64",
                "Content-Type": "application/pkcs7-mime; smime-type=enveloped-data; name=smime.p7m",
            },
            html: undefined, // Encrypted messages are binary/text
            text: encryptedDataPem,
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
    private formatAddress(address: EmailAddress | string): string {
        if (typeof address === "string") {
            return address;
        }

        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }

        return address.email;
    }

    /**
     * Format email addresses for headers
     */
    private formatAddresses(addresses: EmailAddress | EmailAddress[] | string | string[]): string {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];

        return addressArray.map((addr) => this.formatAddress(addr)).join(", ");
    }
}

/**
 * Create an S/MIME encrypter instance
 */
export const createSmimeEncrypter = (options: SmimeEncryptOptions): SmimeEncrypter => new SmimeEncrypter(options);
