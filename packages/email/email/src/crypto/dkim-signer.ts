import type { KeyObject } from "node:crypto";
import { createHash, createPrivateKey, createSign, sign as cryptoSign } from "node:crypto";

import { canonicalizeBody, canonicalizeHeader, orderSignedHeaders, parseMimeHeaders, splitMimeMessage } from "./canonicalize";
import type { DkimOptions } from "./types";

/**
 * Headers signed by default when present in the message.
 *
 * `Return-Path` and `Bcc` are deliberately absent: MTAs rewrite the former and strip the latter,
 * so signing either guarantees a verification failure downstream. Everything here is stable from
 * the moment the message leaves this process.
 *
 * Only headers that are actually present get listed in `h=`. The alternative — "over-signing", where
 * an absent name is listed anyway so that adding one later invalidates the signature — is not done
 * here, because a signature that a legitimate mailing list breaks is worse for deliverability than
 * a replay that appends a `Subject` the original never had. Revisit that trade-off deliberately if
 * this signer ever needs to defend against header-injection replays.
 */
const DEFAULT_SIGNED_HEADERS = new Set([
    "cc",
    "content-transfer-encoding",
    "content-type",
    "date",
    "from",
    "in-reply-to",
    "message-id",
    "mime-version",
    "references",
    "reply-to",
    "subject",
    "to",
]);

/**
 * Signs the canonicalized DKIM data with the configured algorithm.
 * @param data The data to sign.
 * @param key The private key.
 * @param algorithm The signature algorithm.
 * @returns The base64-encoded signature.
 */
const signDkimData = (data: string, key: KeyObject, algorithm?: "ed25519-sha256" | "rsa-sha256"): string => {
    if (algorithm === "ed25519-sha256") {
        // RFC 8463: Ed25519 signs the SHA-256 digest of the signed data. node requires `null` algorithm.
        // eslint-disable-next-line unicorn/no-null
        return cryptoSign(null, createHash("sha256").update(data).digest(), key).toString("base64");
    }

    return createSign("RSA-SHA256").update(data).sign(key, "base64");
};

/**
 * DKIM signer.
 *
 * DKIM signs the message **as transmitted**: the `bh=` tag is a hash of the canonicalized MIME
 * body, and `h=` covers the headers the recipient's MTA will see. That means signing can only
 * happen after the message has been serialized, so this deliberately does **not** implement
 * `EmailSigner` — `MailMessage.sign()` runs at the `EmailOptions` layer, where the body does not
 * exist yet, and passing a DKIM signer there is a compile error rather than a runtime surprise.
 * Configure DKIM on a transport that emits raw MIME instead.
 */
export class DkimSigner {
    private readonly options: DkimOptions;

    /**
     * Creates a new DKIM signer.
     * @param options DKIM signing options.
     */
    public constructor(options: DkimOptions) {
        this.options = options;
    }

    /**
     * Signs a fully-built MIME message and returns it with a `DKIM-Signature` header prepended.
     * @param message The complete MIME message: headers, a blank line, then the body, CRLF-delimited.
     * @returns The message with the signature prepended.
     * @throws {Error} When the message has no header/body separator, has no signable `From` header,
     * or signing fails (e.g. an unreadable or malformed private key).
     * @example
     * ```typescript
     * const raw = await buildMimeMessage(emailOptions);
     * const signed = await createDkimSigner({ domainName: "example.com", keySelector: "s1", privateKey }).signMimeMessage(raw);
     * ```
     */
    public async signMimeMessage(message: string): Promise<string> {
        const parts = splitMimeMessage(message);

        if (parts === undefined) {
            throw new Error("Failed to create DKIM signature: the message has no CRLFCRLF header/body separator, so it is not a complete MIME message.");
        }

        const { body: bodyPart, headersPart } = parts;

        const headerCanon = this.options.headerCanon ?? "simple";
        const bodyCanon = this.options.bodyCanon ?? "simple";

        const bodyHash = createHash("sha256").update(canonicalizeBody(bodyPart, bodyCanon)).digest("base64");

        const ignored = new Set((this.options.headersToIgnore ?? []).map((header) => header.toLowerCase()));
        const candidates = parseMimeHeaders(headersPart).filter((header) => {
            const lower = header.name.toLowerCase();

            return DEFAULT_SIGNED_HEADERS.has(lower) && !ignored.has(lower);
        });

        const orderedHeaders = orderSignedHeaders(candidates);

        // RFC 6376 §5.4: `from` is mandatory in `h=`. Without it the signature is still well-formed,
        // so the failure only surfaces at the recipient and reads like a DNS or key problem. Both a
        // message with no From header and `headersToIgnore: ["from"]` land here.
        if (!orderedHeaders.some((header) => header.name.toLowerCase() === "from")) {
            throw new Error("Failed to create DKIM signature: the message has no signable From header (RFC 6376 §5.4 requires it in h=).");
        }

        const dkimTags = [
            "v=1",
            `a=${this.options.algorithm ?? "rsa-sha256"}`,
            `c=${headerCanon}/${bodyCanon}`,
            `d=${this.options.domainName}`,
            `s=${this.options.keySelector}`,
            // Signature time. Verifiers use it to reject a signature older than any `x=` expiry
            // and to bound replay windows; RFC 6376 §3.5 recommends including it.
            `t=${Math.floor(Date.now() / 1000).toString()}`,
            `bh=${bodyHash}`,
            `h=${orderedHeaders.map((header) => header.name.toLowerCase()).join(":")}`,
            "b=",
        ].join("; ");

        // RFC 6376 §3.7: the DKIM-Signature field itself is signed last, with an empty `b=` value
        // and no trailing CRLF. Verifiers blank out `b=` before hashing, so folding the signature
        // into the emitted header below does not disturb this.
        const signData = [...orderedHeaders.map((header) => canonicalizeHeader(header.name, header.value, headerCanon)), canonicalizeHeader("DKIM-Signature", ` ${dkimTags}`, headerCanon)].join(
            "\r\n",
        );

        let signature: string;

        try {
            let privateKeyContent = this.options.privateKey;

            if (privateKeyContent.startsWith("file://")) {
                // Imported lazily: `@visulima/fs` reaches for `node:fs/promises` and `node:zlib` at
                // module-evaluation time, and this signer is reachable from the Cloudflare Email
                // provider — a runtime with no filesystem, where a static import fails the build.
                // eslint-disable-next-line import/no-extraneous-dependencies
                const { readFile } = await import("@visulima/fs");

                privateKeyContent = await readFile(privateKeyContent.slice(7), { encoding: "utf8" });
            }

            const key = createPrivateKey({ key: privateKeyContent, passphrase: this.options.passphrase });

            signature = signDkimData(signData, key, this.options.algorithm);
        } catch (error) {
            // eslint-disable-next-line preserve-caught-error
            throw new Error(`Failed to create DKIM signature: ${(error as Error).message}`);
        }

        const foldedSignature = signature.match(/.{1,72}/g)?.join("\r\n ") ?? signature;

        return `DKIM-Signature: ${dkimTags}${foldedSignature}\r\n${message}`;
    }
}

/**
 * Creates a DKIM signer instance.
 * @param options DKIM signing options.
 * @returns A new DkimSigner instance.
 */
export const createDkimSigner = (options: DkimOptions): DkimSigner => new DkimSigner(options);

/**
 * Builds a signer for a transport that writes the MIME message itself.
 *
 * Canonicalization defaults to relaxed/relaxed rather than the `simple/simple` of
 * {@link DkimOptions}: SMTP hops routinely re-wrap whitespace, which `simple` does not survive.
 * Callers can still override either field.
 * @param options DKIM signing options from the transport config.
 * @returns A signer configured for on-the-wire use.
 */
export const createTransportDkimSigner = (options: DkimOptions): DkimSigner => new DkimSigner({ bodyCanon: "relaxed", headerCanon: "relaxed", ...options });
