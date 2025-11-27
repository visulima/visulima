import { createCipheriv, createPublicKey, publicEncrypt, randomBytes } from "node:crypto";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readFile } from "@visulima/fs";
import { fromBER, OctetString } from "asn1js";
import {
    AlgorithmIdentifier,
    Certificate,
    ContentInfo,
    EncryptedContentInfo,
    EnvelopedData,
    id_ContentType_Data,
    id_ContentType_EnvelopedData,
    IssuerAndSerialNumber,
    KeyTransRecipientInfo,
    RecipientInfo,
} from "pkijs";

import type { EmailAddress, EmailOptions } from "../types";
import type { EmailEncrypter, SmimeEncryptOptions } from "./types";

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

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i += 1) {
        // eslint-disable-next-line unicorn/prefer-code-point -- charCodeAt is correct for binary data, not codePointAt
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
        let binaryString = "";
        const chunkSize = 8192;

        // Convert in chunks to avoid stack overflow for large inputs
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

            // eslint-disable-next-line unicorn/prefer-code-point -- fromCharCode is correct for binary data, not fromCodePoint
            binaryString += String.fromCharCode.apply(undefined, chunk as unknown as number[]);
        }

        base64 = btoa(binaryString);
    }

    const lines = base64.match(/.{1,64}/g) || [];

    return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----\n`;
};

/**
 * S/MIME encrypter implementation using PKIjs
 * Note: Requires pkijs and asn1js for S/MIME operations
 * Uses Node.js crypto for all cryptographic operations
 */
export class SmimeEncrypter implements EmailEncrypter {
    /**
     * Collects and normalizes all recipients (to, cc, bcc) from email options.
     * Normalizes each to an array, extracts email addresses, and deduplicates.
     * @param email The email options containing recipients.
     * @returns An array of unique email addresses (strings).
     */
    private static collectRecipients(email: EmailOptions): string[] {
        const emailAddresses: string[] = [];

        // Helper to normalize and extract email addresses from a recipient field
        const extractEmails = (recipients: EmailAddress | EmailAddress[] | undefined): void => {
            if (!recipients) {
                return;
            }

            const normalized = Array.isArray(recipients) ? recipients : [recipients];

            for (const recipient of normalized) {
                // Handle both string (for backward compatibility) and EmailAddress object
                const emailAddress = typeof recipient === "string" ? recipient : recipient.email;

                if (emailAddress) {
                    emailAddresses.push(emailAddress);
                }
            }
        };

        // Collect from to, cc, and bcc
        extractEmails(email.to);
        extractEmails(email.cc);
        extractEmails(email.bcc);

        // Deduplicate by converting to Set and back to array
        return [...new Set(emailAddresses)];
    }

    /**
     * Formats an email address for use in email headers.
     * @param address The email address to format (string or EmailAddress object).
     * @returns The formatted email address string in RFC 5322 format.
     */
    private static formatAddress(address: EmailAddress | string): string {
        if (typeof address === "string") {
            return address;
        }

        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }

        return address.email;
    }

    /**
     * Formats email addresses for use in email headers.
     * @param addresses The email addresses to format (single or array, string or EmailAddress objects).
     * @returns The formatted email addresses string (comma-separated if multiple).
     */
    private static formatAddresses(addresses: EmailAddress | EmailAddress[] | string | string[]): string {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];

        return addressArray.map((addr) => SmimeEncrypter.formatAddress(addr)).join(", ");
    }

    private readonly options: SmimeEncryptOptions;

    /**
     * Creates a new S/MIME encrypter.
     * @param options S/MIME encryption options.
     */
    public constructor(options: SmimeEncryptOptions) {
        this.options = options;
    }

    /**
     * Encrypts an email message with S/MIME.
     * @param email The email options to encrypt.
     * @returns The encrypted email options.
     * @throws {Error} When encryption fails (e.g., invalid certificate).
     */
    public async encrypt(email: EmailOptions): Promise<EmailOptions> {
        // Collect all recipients (to, cc, bcc) and deduplicate
        const recipients = SmimeEncrypter.collectRecipients(email);
        const certificates: Certificate[] = [];

        if (typeof this.options.certificates === "string") {
            const certPem = await readFile(this.options.certificates, { encoding: "utf8" });
            const certDer = pemToDer(certPem);
            const asn1 = fromBER(certDer);

            if (asn1.offset === -1) {
                throw new Error("Failed to parse certificate: Invalid ASN.1 structure");
            }

            certificates.push(new Certificate({ schema: asn1.result }));
        } else {
            const certPromises = recipients.map(async (emailAddress) => {
                const certPath = (this.options.certificates as Record<string, string>)[emailAddress];

                if (!certPath) {
                    throw new Error(`No certificate found for recipient: ${emailAddress}`);
                }

                const certPem = await readFile(certPath, { encoding: "utf8" });
                const certDer = pemToDer(certPem);
                const asn1 = fromBER(certDer);

                if (asn1.offset === -1) {
                    throw new Error(`Failed to parse certificate for ${emailAddress}: Invalid ASN.1 structure`);
                }

                return new Certificate({ schema: asn1.result });
            });

            certificates.push(...await Promise.all(certPromises));
        }

        const message = await this.buildMessage(email);
        const messageBuffer = new TextEncoder().encode(message);

        const envelopedData = new EnvelopedData({
            version: 0,
        });

        envelopedData.encryptedContentInfo = new EncryptedContentInfo({
            contentType: id_ContentType_Data,
        });

        const algorithm = this.options.algorithm || "aes-256-cbc";
        const algorithmLower = algorithm.toLowerCase();

        if (algorithmLower === "3des" || algorithmLower === "des-ede3-cbc") {
            throw new Error(
                "3DES/DES-EDE3-CBC is deprecated and insecure (Sweet32 vulnerability). Please use AES-256-CBC, AES-192-CBC, or AES-128-CBC instead.",
            );
        }

        let algorithmId: string;
        let keyLength: number;

        switch (algorithmLower) {
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
            default: {
                algorithmId = "2.16.840.1.101.3.4.1.42";
                keyLength = 32;
                break;
            }
        }

        const contentEncryptionKey = randomBytes(keyLength);
        const keyArray = hasBuffer ? contentEncryptionKey : new Uint8Array(contentEncryptionKey);

        const iv = randomBytes(16);
        const ivArray = hasBuffer ? iv : new Uint8Array(iv);

        const cipher = createCipheriv(`aes-${keyLength * 8}-cbc`, contentEncryptionKey, iv);
        const messageBufferNode = Buffer.from(messageBuffer);
        const encryptedChunks: Buffer[] = [cipher.update(messageBufferNode), cipher.final()];
        const encryptedContent = Buffer.concat(encryptedChunks);

        envelopedData.encryptedContentInfo.encryptedContent = new OctetString({
            valueHex: encryptedContent.buffer.slice(encryptedContent.byteOffset, encryptedContent.byteOffset + encryptedContent.byteLength),
        });

        const recipientInfos = await Promise.all(
            certificates.map(async (cert) => {
                const certPem = cert.toSchema().toBER(false);
                const certPemString = derToPem(certPem, "CERTIFICATE");
                const publicKeyObject = createPublicKey(certPemString);

                const keyBuffer = Buffer.from(keyArray);
                const encryptedKeyBuffer = publicEncrypt(
                    {
                        key: publicKeyObject,
                        padding: 1,
                    },
                    keyBuffer,
                );

                return new RecipientInfo({
                    value: new KeyTransRecipientInfo({
                        encryptedKey: new OctetString({
                            valueHex: encryptedKeyBuffer.buffer.slice(
                                encryptedKeyBuffer.byteOffset,
                                encryptedKeyBuffer.byteOffset + encryptedKeyBuffer.byteLength,
                            ),
                        }),
                        keyEncryptionAlgorithm: new AlgorithmIdentifier({
                            algorithmId: "1.2.840.113549.1.1.1", // RSAES-PKCS1-v1_5
                        }),
                        rid: new IssuerAndSerialNumber({
                            issuer: cert.issuer,
                            serialNumber: cert.serialNumber,
                        }),
                        version: 0,
                    }),
                    variant: 0, // RecipientIdentifierType.issuerAndSerialNumber
                });
            }),
        );

        envelopedData.recipientInfos.push(...recipientInfos);

        envelopedData.encryptedContentInfo.contentEncryptionAlgorithm = new AlgorithmIdentifier({
            algorithmId,
            algorithmParams: new OctetString({ valueHex: ivArray.buffer }),
        });

        const cmsContent = new ContentInfo({
            content: envelopedData.toSchema(),
            contentType: id_ContentType_EnvelopedData,
        });

        const cmsBuffer = cmsContent.toSchema().toBER(false);

        const encryptedDataPem = derToPem(cmsBuffer, "PKCS7");

        return {
            ...email,
            headers: {
                ...email.headers,
                "Content-Disposition": "attachment; filename=smime.p7m",
                "Content-Transfer-Encoding": "base64",
                "Content-Type": "application/pkcs7-mime; smime-type=enveloped-data; name=smime.p7m",
            },
            html: undefined,
            text: encryptedDataPem,
        };
    }

    /**
     * Builds the email message string from email options.
     * @param email The email options to build the message from.
     * @returns The formatted email message as a string.
     */
    // eslint-disable-next-line class-methods-use-this
    private async buildMessage(email: EmailOptions): Promise<string> {
        const lines: string[] = [
            `From: ${SmimeEncrypter.formatAddress(email.from)}`,
            `To: ${SmimeEncrypter.formatAddresses(email.to)}`,
            ...email.cc ? [`Cc: ${SmimeEncrypter.formatAddresses(email.cc)}`] : [],
        ];

        if (email.replyTo) {
            lines.push(`Reply-To: ${SmimeEncrypter.formatAddress(email.replyTo)}`);
        }

        lines.push(`Subject: ${email.subject}`, "MIME-Version: 1.0");

        if (email.headers) {
            for (const [key, value] of Object.entries(email.headers)) {
                lines.push(`${key}: ${value}`);
            }
        }

        if (email.html) {
            lines.push("Content-Type: text/html; charset=utf-8");
        } else if (email.text) {
            lines.push("Content-Type: text/plain; charset=utf-8");
        }

        lines.push("");

        if (email.html) {
            lines.push(email.html);
        } else if (email.text) {
            lines.push(email.text);
        }

        return lines.join("\r\n");
    }
}

/**
 * Creates a new S/MIME encrypter instance.
 * @param options The S/MIME encryption options.
 * @returns A new SmimeEncrypter instance ready to encrypt emails.
 */
export const createSmimeEncrypter = (options: SmimeEncryptOptions): SmimeEncrypter => new SmimeEncrypter(options);
