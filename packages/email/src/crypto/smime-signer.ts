import { createHash, createPrivateKey, createSign, randomBytes } from "node:crypto";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readFile } from "@visulima/fs";
import { fromBER, ObjectIdentifier, OctetString, UTCTime } from "asn1js";
import {
    AlgorithmIdentifier,
    Attribute,
    Certificate,
    ContentInfo,
    EncapsulatedContentInfo,
    id_ContentType_Data,
    id_ContentType_SignedData,
    id_sha256,
    IssuerAndSerialNumber,
    SignedAndUnsignedAttributes,
    SignedData,
    SignerInfo,
} from "pkijs";

import type { EmailOptions } from "../types";
import type { EmailSigner, SmimeSignOptions } from "./types";

// OID constants for CMS attributes
const idContentType = "1.2.840.113549.1.9.3";
const idMessageDigest = "1.2.840.113549.1.9.4";
const idSigningTime = "1.2.840.113549.1.9.5";
// eslint-disable-next-line @typescript-eslint/naming-convention
const id_RSASSA_PKCS1_v1_5 = "1.2.840.113549.1.1.1";

// Version constants
const SignedDataVersion = { v1: 1 } as const;
const SignerInfoVersion = { v1: 1 } as const;

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

    for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.codePointAt(i) as number;
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
        // Convert in chunks to avoid stack overflow for large inputs
        let binaryString = "";
        const chunkSize = 8192;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

            // eslint-disable-next-line unicorn/prefer-code-point -- fromCharCode is correct for binary data, not fromCodePoint
            binaryString += String.fromCharCode.apply(undefined, chunk as unknown as number[]);
        }

        base64 = btoa(binaryString);
    }

    // Split into 64-character lines
    const lines = base64.match(/.{1,64}/g) || [];

    return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----\n`;
};

/**
 * S/MIME signer implementation using PKIjs
 * Note: Requires pkijs and asn1js for S/MIME operations
 * Uses Node.js crypto for all cryptographic operations
 */
export class SmimeSigner implements EmailSigner {
    /**
     * Formats an email address for use in email headers.
     * @param address The email address object to format.
     * @param address.email The email address string.
     * @param address.name Optional display name for the email address.
     * @returns The formatted email address string in RFC 5322 format.
     */
    private static formatAddress(address: { email: string; name?: string }): string {
        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }

        return address.email;
    }

    private readonly options: SmimeSignOptions;

    /**
     * Creates a new S/MIME signer.
     * @param options S/MIME signing options.
     */
    public constructor(options: SmimeSignOptions) {
        this.options = options;
    }

    /**
     * Signs an email message with S/MIME.
     * @param email The email options to sign.
     * @returns The email options with S/MIME signature.
     * @throws {Error} When signing fails (e.g., invalid certificate/key).
     */
    public async sign(email: EmailOptions): Promise<EmailOptions> {
        // Load certificate and private key
        const certificatePem = await readFile(this.options.certificate, { encoding: "utf8" });
        const privateKeyPem = await readFile(this.options.privateKey, { encoding: "utf8" });

        // Parse certificate from PEM
        const certDer = pemToDer(certificatePem);
        const asn1 = fromBER(certDer);

        if (asn1.offset === -1) {
            throw new Error("Failed to parse certificate: Invalid ASN.1 structure");
        }

        const cert = new Certificate({ schema: asn1.result });

        // Parse private key - use Node.js crypto for all key formats (PKCS#8, PKCS#1, encrypted)
        // Node.js crypto handles encrypted keys (PBES2/PBKDF2) automatically
        let privateKeyObject: ReturnType<typeof createPrivateKey>;

        try {
            privateKeyObject = this.options.passphrase
                ? createPrivateKey({
                    key: privateKeyPem,
                    passphrase: this.options.passphrase,
                })
                : createPrivateKey(privateKeyPem);
        } catch (error) {
            throw new Error(`Failed to parse private key: ${(error as Error).message}`);
        }

        // Load intermediate certificates if provided
        const intermediateCerts: Certificate[] = [];

        if (this.options.intermediateCerts) {
            const certPromises = this.options.intermediateCerts.map(async (certPath) => {
                const certPem = await readFile(certPath, { encoding: "utf8" });
                const intermediateCertDer = pemToDer(certPem);
                const intermediateAsn1 = fromBER(intermediateCertDer);

                if (intermediateAsn1.offset === -1) {
                    throw new Error(`Failed to parse intermediate certificate ${certPath}: Invalid ASN.1 structure`);
                }

                return new Certificate({ schema: intermediateAsn1.result });
            });

            intermediateCerts.push(...await Promise.all(certPromises));
        }

        // Build the email message
        const message = this.buildMessage(email);
        const messageBuffer = new TextEncoder().encode(message);

        // Create PKCS#7 signed data
        const signedData = new SignedData({
            version: SignedDataVersion.v1,
        });

        // Set content (detached signature)
        signedData.encapContentInfo = new EncapsulatedContentInfo({
            eContentType: id_ContentType_Data,
        });

        // Create signer info
        const signerInfo = new SignerInfo({
            digestAlgorithm: new AlgorithmIdentifier({
                algorithmId: id_sha256,
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

        // Calculate message digest using Node.js crypto
        const hash = createHash("sha256");

        hash.update(hasBuffer ? Buffer.from(messageBuffer) : messageBuffer);
        const digestBuffer = hash.digest();
        const messageDigest = new Uint8Array(digestBuffer);

        // Create authenticated attributes
        const authenticatedAttributes = new SignedAndUnsignedAttributes({
            attributes: [
                new Attribute({
                    type: idContentType,
                    values: [new ObjectIdentifier({ value: id_ContentType_Data })],
                }),
                new Attribute({
                    type: idMessageDigest,
                    // eslint-disable-next-line unicorn/prefer-spread
                    values: [new OctetString({ valueHex: messageDigest.buffer.slice(0) })],
                }),
                new Attribute({
                    type: idSigningTime,
                    values: [
                        new UTCTime({
                            valueDate: new Date(),
                        }),
                    ],
                }),
            ],
        });

        signerInfo.signedAttrs = authenticatedAttributes;

        // Sign the authenticated attributes using Node.js crypto
        const attributesBuffer = authenticatedAttributes.toSchema().toBER(false);
        const attributesArray = hasBuffer ? Buffer.from(attributesBuffer) : new Uint8Array(attributesBuffer);

        // Use RSASSA-PKCS1-v1_5 for signing (most compatible)
        const sign = createSign("RSA-SHA256");

        sign.update(attributesArray);
        const signatureBuffer = sign.sign(privateKeyObject);
        const signature = hasBuffer
            ? signatureBuffer.buffer.slice(signatureBuffer.byteOffset, signatureBuffer.byteOffset + signatureBuffer.byteLength)
            : signatureBuffer.buffer;

        signerInfo.signature = new OctetString({ valueHex: signature });

        // Add signer info
        signedData.signerInfos.push(signerInfo);

        // Add certificates
        signedData.certificates = [cert, ...intermediateCerts];

        // Encode to BER
        const cmsContent = new ContentInfo({
            content: signedData.toSchema(),
            contentType: id_ContentType_SignedData,
        });

        const cmsBuffer = cmsContent.toSchema().toBER(false);

        // Convert to PEM format
        const signedDataPem = derToPem(cmsBuffer, "PKCS7");

        // Create multipart/signed message
        const boundary = `----_=_NextPart_${Date.now()}_${randomBytes(8).toString("hex")}`;
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
     * Builds the email message string from email options.
     * @param email The email options to build the message from.
     * @returns The formatted email message as a string.
     */
    private buildMessage(email: EmailOptions): string {
        const lines: string[] = [`From: ${SmimeSigner.formatAddress(email.from)}`, `To: ${this.formatAddresses(email.to)}`];

        if (email.cc) {
            lines.push(`Cc: ${this.formatAddresses(email.cc)}`);
        }

        if (email.replyTo) {
            lines.push(`Reply-To: ${SmimeSigner.formatAddress(email.replyTo)}`);
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
     * Formats email addresses for use in email headers.
     * @param addresses The email addresses to format (single or array).
     * @returns The formatted email addresses string (comma-separated if multiple).
     */
    // eslint-disable-next-line class-methods-use-this
    private formatAddresses(addresses: { email: string; name?: string } | { email: string; name?: string }[]): string {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];

        return addressArray.map((addr) => SmimeSigner.formatAddress(addr)).join(", ");
    }
}

/**
 * Creates a new S/MIME signer instance.
 * @param options The S/MIME signing options.
 * @returns A new SmimeSigner instance ready to sign emails.
 */
export const createSmimeSigner = (options: SmimeSignOptions): SmimeSigner => new SmimeSigner(options);
