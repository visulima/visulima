import { Buffer } from "node:buffer";
import { createVerify, X509Certificate } from "node:crypto";

import EmailError from "../errors/email-error";
import type { WebhookVerificationResult } from "./types";

/**
 * The subset of an Amazon SNS message envelope relevant to signature verification.
 *
 * AWS SES delivers events (deliveries, bounces, complaints) wrapped in SNS notifications.
 */
interface SnsMessage {
    [key: string]: unknown;
    Message?: string;
    MessageId?: string;
    Signature?: string;
    SignatureVersion?: string;
    SigningCertURL?: string;
    Subject?: string;
    SubscribeURL?: string;
    Timestamp?: string;
    Token?: string;
    TopicArn?: string;
    Type?: string;
}

/**
 * Resolves a signing-certificate URL to its PEM contents. Injectable for testing and caching.
 */
type CertificateResolver = (url: string) => Promise<string> | string;

/**
 * Options for {@link verifySnsMessage}.
 */
interface SnsVerifyOptions {
    /**
     * Override how the signing certificate is fetched. Defaults to a `fetch`-based resolver that
     * only accepts `https://*.amazonaws.com` URLs.
     */
    certificateResolver?: CertificateResolver;
}

const SIGNABLE_KEYS_BY_TYPE: Record<string, string[]> = {
    Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
    SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
    UnsubscribeConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

// Only AWS's documented SNS signing hosts: `sns.<region>.amazonaws.com` (and `.cn` for China).
// A broader `*.amazonaws.com` allowlist would let an attacker host a forged cert on any AWS-owned
// domain they can write to (e.g. a public S3 bucket), bypassing signature verification, and enable
// SSRF via the default cert fetcher.
const SIGNING_CERT_HOST_PATTERN = /^sns\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/;
const TRAILING_DOT_PATTERN = /\.$/;

/**
 * Validates that a signing-certificate URL points at an AWS SNS signing host over HTTPS.
 * @param url The `SigningCertURL` from the SNS message.
 * @returns `true` when the URL is an acceptable AWS SNS certificate endpoint.
 */
const isValidSigningCertUrl = (url: string): boolean => {
    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== "https:") {
        return false;
    }

    // Reject embedded credentials and explicit ports — both are vectors for slipping past host checks.
    if (parsed.username !== "" || parsed.password !== "" || parsed.port !== "") {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase().replace(TRAILING_DOT_PATTERN, "");

    return SIGNING_CERT_HOST_PATTERN.test(hostname);
};

/**
 * Default certificate resolver: fetches the PEM over HTTPS after validating the host.
 * @param url The signing-certificate URL.
 * @returns The certificate PEM text.
 * @throws {EmailError} When the URL is not an AWS HTTPS endpoint or the fetch fails.
 */
const defaultCertificateResolver: CertificateResolver = async (url: string): Promise<string> => {
    if (!isValidSigningCertUrl(url)) {
        throw new EmailError("webhooks", `Refusing to fetch SNS signing certificate from untrusted URL: ${url}`);
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new EmailError("webhooks", `Failed to fetch SNS signing certificate (status ${String(response.status)})`);
    }

    return await response.text();
};

/**
 * Builds the canonical, newline-delimited string that SNS signs.
 * @param message The SNS message.
 * @returns The string to verify, or `undefined` when the message type is unknown.
 */
const buildStringToSign = (message: SnsMessage): string | undefined => {
    const keys = SIGNABLE_KEYS_BY_TYPE[message.Type ?? ""];

    if (!keys) {
        return undefined;
    }

    let result = "";

    for (const key of keys) {
        const value = message[key];

        if (typeof value !== "string") {
            continue;
        }

        result += `${key}\n${value}\n`;
    }

    return result;
};

/**
 * Verifies the RSA signature on an Amazon SNS message (used to wrap AWS SES events).
 *
 * Signature version `1` uses SHA1, version `2` uses SHA256. The signing certificate is fetched from
 * `SigningCertURL` (validated to be an `*.amazonaws.com` HTTPS endpoint) unless a custom
 * {@link CertificateResolver} is supplied.
 * @param message The parsed SNS message envelope.
 * @param options Optional overrides. See {@link SnsVerifyOptions}.
 * @returns The verification result.
 * @throws {EmailError} When the certificate cannot be resolved.
 */
const verifySnsMessage = async (message: SnsMessage, options: SnsVerifyOptions = {}): Promise<WebhookVerificationResult> => {
    const { certificateResolver = defaultCertificateResolver } = options;

    if (!message.Signature || !message.SigningCertURL) {
        return { reason: "missing-signature", valid: false };
    }

    const stringToSign = buildStringToSign(message);

    if (stringToSign === undefined) {
        return { reason: "unknown-message-type", valid: false };
    }

    const algorithm = message.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";

    const pem = await certificateResolver(message.SigningCertURL);

    let publicKey;

    try {
        publicKey = new X509Certificate(pem).publicKey;
    } catch (error) {
        throw new EmailError("webhooks", "Failed to parse SNS signing certificate", { cause: error });
    }

    let valid: boolean;

    try {
        valid = createVerify(algorithm).update(stringToSign, "utf8").verify(publicKey, Buffer.from(message.Signature, "base64"));
    } catch {
        return { reason: "signature-malformed", valid: false };
    }

    if (!valid) {
        return { reason: "signature-mismatch", valid: false };
    }

    return { valid: true };
};

export type { CertificateResolver, SnsMessage, SnsVerifyOptions };
export { isValidSigningCertUrl, verifySnsMessage };
