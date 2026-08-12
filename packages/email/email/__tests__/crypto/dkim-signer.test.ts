import type { KeyObject } from "node:crypto";
import { createHash, createPublicKey, createVerify, generateKeyPairSync, verify as cryptoVerify } from "node:crypto";

import { readFile } from "@visulima/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDkimSigner, DkimSigner } from "../../src/crypto/dkim-signer";
import type { DkimOptions, EmailSigner } from "../../src/crypto/types";
import type { EmailOptions } from "../../src/types";
import buildMimeMessage from "../../src/utils/build-mime-message";
import { TEST_PRIVATE_KEY } from "./fixtures";

vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn<Parameters<typeof readFile>>(),
    };
});

/*
 * An independent DKIM verifier. The point of these tests is that a signature this package emits
 * actually validates against the message as transmitted — the property the previous implementation
 * silently failed. Asserting "a DKIM-Signature header exists" cannot catch that, so the checks
 * below re-derive the body hash and the signature from the signed message the way a receiving MTA
 * would, rather than trusting the signer's own canonicalization.
 */

interface ParsedHeader {
    name: string;
    value: string;
}

const parseHeaders = (headersPart: string): ParsedHeader[] => {
    const headers: ParsedHeader[] = [];

    for (const line of headersPart.split("\r\n")) {
        const previous = headers.at(-1);

        if (previous !== undefined && (line.startsWith(" ") || line.startsWith("\t"))) {
            previous.value += `\r\n${line}`;

            continue;
        }

        const colon = line.indexOf(":");

        if (colon !== -1) {
            headers.push({ name: line.slice(0, colon), value: line.slice(colon + 1) });
        }
    }

    return headers;
};

const WSP_RUN = /[ \t]+/g;
const FOLDING_WHITESPACE = /\s+/g;
const SIGNATURE_TAG = /;\s*b=[\s\S]*$/;

const canonicalizeBody = (body: string, method: string): string => {
    const lines = body.replaceAll("\r\n", "\n").split("\n");

    if (method === "relaxed") {
        for (const [index, line] of lines.entries()) {
            const collapsed = line.replaceAll(WSP_RUN, " ");

            lines[index] = collapsed.endsWith(" ") ? collapsed.slice(0, -1) : collapsed;
        }
    }

    let end = lines.length;

    while (end > 0 && lines[end - 1] === "") {
        end -= 1;
    }

    if (end === 0) {
        return method === "simple" ? "\r\n" : "";
    }

    return `${lines.slice(0, end).join("\r\n")}\r\n`;
};

const canonicalizeHeader = (name: string, value: string, method: string): string => {
    if (method === "simple") {
        return `${name}:${value}`;
    }

    return `${name.toLowerCase().trim()}:${value.replaceAll(FOLDING_WHITESPACE, " ").trim()}`;
};

interface VerifyResult {
    bodyHashMatches: boolean;
    signatureVerifies: boolean;
    signedHeaderNames: string[];
    tags: Record<string, string>;
}

const verifyDkim = (signedMessage: string, publicKey: KeyObject): VerifyResult => {
    const splitIndex = signedMessage.indexOf("\r\n\r\n");
    const headers = parseHeaders(signedMessage.slice(0, splitIndex));
    const body = signedMessage.slice(splitIndex + 4);

    const dkimHeader = headers.find((header) => header.name.toLowerCase() === "dkim-signature");

    if (dkimHeader === undefined) {
        throw new Error("no DKIM-Signature header");
    }

    const tags: Record<string, string> = {};

    for (const part of dkimHeader.value.replaceAll(FOLDING_WHITESPACE, "").split(";")) {
        const equals = part.indexOf("=");

        if (equals !== -1) {
            tags[part.slice(0, equals)] = part.slice(equals + 1);
        }
    }

    const [headerCanon = "simple", bodyCanon = "simple"] = (tags.c ?? "simple/simple").split("/");

    const bodyHash = createHash("sha256").update(canonicalizeBody(body, bodyCanon)).digest("base64");

    // RFC 6376 §3.7: rebuild the signed data from the signed headers plus the DKIM-Signature
    // field with its b= value emptied.
    const signedHeaderNames = tags.h === undefined || tags.h === "" ? [] : tags.h.split(":");
    // RFC 6376 §5.4.2: repeated names in h= are satisfied from the bottom of the header block
    // upward, so the nth mention of a name takes the nth-from-last instance.
    const takenPerName = new Map<string, number>();
    const signedHeaders = signedHeaderNames.map((name) => {
        const instances = headers.filter((candidate) => candidate.name.toLowerCase() === name);
        const taken = takenPerName.get(name) ?? 0;

        takenPerName.set(name, taken + 1);

        const header = instances[instances.length - 1 - taken];

        if (header === undefined) {
            throw new Error(`h= lists ${name}, which is absent from the message`);
        }

        return canonicalizeHeader(header.name, header.value, headerCanon);
    });

    const dkimWithoutSignature = dkimHeader.value.replace(SIGNATURE_TAG, "; b=");
    const signData = [...signedHeaders, canonicalizeHeader(dkimHeader.name, dkimWithoutSignature, headerCanon)].join("\r\n");

    const signature = Buffer.from(tags.b ?? "", "base64");
    const signatureVerifies
        = tags.a === "ed25519-sha256"
            ? cryptoVerify(undefined, createHash("sha256").update(signData).digest(), publicKey, signature)
            : createVerify("RSA-SHA256").update(signData).verify(publicKey, signature);

    return { bodyHashMatches: bodyHash === tags.bh, signatureVerifies, signedHeaderNames, tags };
};

/** A line feed not preceded by a carriage return — forbidden on the wire by RFC 5322 §2.1. */
const RE_BARE_LINE_FEED = /[^\r]\n/;
const RE_REPLY_TO_LINE = /^Reply-To:/gm;

const TEST_PUBLIC_KEY = createPublicKey(TEST_PRIVATE_KEY);

const baseOptions: DkimOptions = {
    domainName: "example.com",
    keySelector: "default",
    privateKey: TEST_PRIVATE_KEY,
};

const email: EmailOptions = {
    from: { email: "sender@example.com", name: "Sender Name" },
    html: "<h1>Test</h1>",
    subject: "Test Subject",
    text: "Test content",
    to: { email: "recipient@example.com" },
};

describe(DkimSigner, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe("constructor", () => {
        it("creates a DkimSigner instance", () => {
            expect.assertions(2);

            expect(new DkimSigner(baseOptions)).toBeInstanceOf(DkimSigner);
            expect(createDkimSigner(baseOptions)).toBeInstanceOf(DkimSigner);
        });
    });

    describe("emailSigner compatibility", () => {
        it("is not accepted by MailMessage.sign, because DKIM needs the serialized body", () => {
            expect.assertions(1);

            const signer = createDkimSigner(baseOptions);

            // @ts-expect-error -- DkimSigner deliberately does not satisfy EmailSigner: a DKIM
            // signature commits to the MIME message, which does not exist at the EmailOptions
            // layer. Catching this at compile time beats a rejected promise at send time.
            const rejected: EmailSigner = signer;

            expect(rejected).toBeInstanceOf(DkimSigner);
        });
    });

    describe("signMimeMessage", () => {
        it.each([
            ["simple", "simple"],
            ["relaxed", "relaxed"],
            ["relaxed", "simple"],
            ["simple", "relaxed"],
        ] as const)("produces a signature that verifies with %s/%s canonicalization", async (headerCanon, bodyCanon) => {
            expect.assertions(3);

            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner({ ...baseOptions, bodyCanon, headerCanon }).signMimeMessage(raw);

            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(result.tags.c).toBe(`${headerCanon}/${bodyCanon}`);
            expect(result.bodyHashMatches).toBe(true);
            expect(result.signatureVerifies).toBe(true);
        });

        it("hashes the multipart body as transmitted, not the raw text/html", async () => {
            expect.assertions(2);

            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner(baseOptions).signMimeMessage(raw);
            const { tags } = verifyDkim(signed, TEST_PUBLIC_KEY);

            // The old implementation hashed `text + "\n\n" + html`. That value must not be what
            // lands in bh=, or the signature fails at every recipient.
            const naiveHash = createHash("sha256")
                .update(`${email.text as string}\n\n${email.html as string}\n`)
                .digest("base64");

            expect(tags.bh).not.toBe(naiveHash);
            expect(verifyDkim(signed, TEST_PUBLIC_KEY).bodyHashMatches).toBe(true);
        });

        it("breaks verification when the body is tampered with after signing", async () => {
            expect.assertions(1);

            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner(baseOptions).signMimeMessage(raw);
            const tampered = signed.replace("<h1>Test</h1>", "<h1>Evil</h1>");

            expect(verifyDkim(tampered, TEST_PUBLIC_KEY).bodyHashMatches).toBe(false);
        });

        it("breaks verification when a signed header is tampered with after signing", async () => {
            expect.assertions(2);

            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner(baseOptions).signMimeMessage(raw);
            const tampered = signed.replace("Subject: Test Subject", "Subject: Wire me money");

            const result = verifyDkim(tampered, TEST_PUBLIC_KEY);

            expect(result.bodyHashMatches).toBe(true);
            expect(result.signatureVerifies).toBe(false);
        });

        it("signs attachments and preserves the closing multipart boundary", async () => {
            expect.assertions(3);

            const raw = await buildMimeMessage({
                ...email,
                attachments: [{ content: "aGVsbG8gd29ybGQ=", contentType: "text/plain", encoding: "base64", filename: "hello.txt" }],
            });
            const signed = await createDkimSigner({ ...baseOptions, bodyCanon: "relaxed", headerCanon: "relaxed" }).signMimeMessage(raw);

            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(signed).toContain("hello.txt");
            expect(result.bodyHashMatches).toBe(true);
            expect(result.signatureVerifies).toBe(true);
        });

        it("signs an ed25519 signature that verifies (RFC 8463)", async () => {
            expect.assertions(3);

            const { privateKey, publicKey } = generateKeyPairSync("ed25519");
            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner({
                ...baseOptions,
                algorithm: "ed25519-sha256",
                privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
            }).signMimeMessage(raw);

            const result = verifyDkim(signed, publicKey);

            expect(result.tags.a).toBe("ed25519-sha256");
            expect(result.bodyHashMatches).toBe(true);
            expect(result.signatureVerifies).toBe(true);
        });

        it("omits ignored headers from h= and still verifies", async () => {
            expect.assertions(3);

            const raw = await buildMimeMessage({ ...email, headers: { "Message-ID": "<test@example.com>" } });
            const signed = await createDkimSigner({ ...baseOptions, headersToIgnore: ["Message-ID"] }).signMimeMessage(raw);

            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(result.signedHeaderNames).not.toContain("message-id");
            expect(result.signedHeaderNames).toContain("subject");
            expect(result.signatureVerifies).toBe(true);
        });

        it("never signs Return-Path, which MTAs rewrite in transit", async () => {
            expect.assertions(2);

            const raw = await buildMimeMessage({ ...email, headers: { "Return-Path": "bounce@example.com" } });
            const signed = await createDkimSigner(baseOptions).signMimeMessage(raw);

            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(result.signedHeaderNames).not.toContain("return-path");
            expect(result.signatureVerifies).toBe(true);
        });

        it("verifies when a signed header is folded across lines", async () => {
            expect.assertions(2);

            const raw = await buildMimeMessage({
                ...email,
                subject: "A subject long enough that the MIME encoder is entitled to fold it across more than one physical line",
            });
            const signed = await createDkimSigner({ ...baseOptions, bodyCanon: "relaxed", headerCanon: "relaxed" }).signMimeMessage(raw);

            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(result.signedHeaderNames).toContain("subject");
            expect(result.signatureVerifies).toBe(true);
        });

        it("reads a file:// private key", async () => {
            expect.assertions(2);

            vi.mocked(readFile).mockResolvedValue(TEST_PRIVATE_KEY);

            const raw = await buildMimeMessage(email);
            const signed = await createDkimSigner({ ...baseOptions, privateKey: "file:///path/to/private-key.pem" }).signMimeMessage(raw);

            expect(readFile).toHaveBeenCalledWith("/path/to/private-key.pem", { encoding: "utf8" });
            expect(verifyDkim(signed, TEST_PUBLIC_KEY).signatureVerifies).toBe(true);
        });

        it("emits a body with no bare line feeds, so bh= covers what is actually sent", async () => {
            expect.assertions(2);

            // Bodies arrive as ordinary JS strings with "\n". RFC 5322 requires CRLF on the wire,
            // and RFC 6376 hashes the octets as transmitted — if the builder leaves bare LFs in
            // while the signer canonicalizes CRLF, bh= describes a message that was never sent.
            const raw = await buildMimeMessage({ ...email, html: "<p>one</p>\n<p>two</p>", text: "line one\nline two\nline three" });

            expect(RE_BARE_LINE_FEED.test(raw)).toBe(false);
            expect(raw).toContain("line one\r\nline two");
        });

        it("signs the exact octets of the transmitted body", async () => {
            expect.assertions(1);

            const raw = await buildMimeMessage({ ...email, text: "alpha\nbeta\ngamma" });
            const signed = await createDkimSigner(baseOptions).signMimeMessage(raw);

            // Hash the wire body directly rather than through the test helper, which shares the
            // signer's canonicalization and so cannot catch a disagreement with the wire.
            const body = signed.slice(signed.indexOf("\r\n\r\n") + 4);
            const lines = body.split("\r\n");

            let end = lines.length;

            while (end > 0 && lines[end - 1] === "") {
                end -= 1;
            }

            const wireHash = createHash("sha256")
                .update(end === 0 ? "\r\n" : `${lines.slice(0, end).join("\r\n")}\r\n`)
                .digest("base64");

            expect(verifyDkim(signed, TEST_PUBLIC_KEY).tags.bh).toBe(wireHash);
        });

        it("signs a repeated header from the bottom up, as a verifier reads it", async () => {
            expect.assertions(3);

            // buildMimeMessage emits Reply-To from `replyTo` and again from `headers`, with no
            // dedupe. RFC 6376 §5.4.2 takes repeated instances bottom-up; signing them top-down
            // yields a signature no verifier can reproduce.
            const raw = await buildMimeMessage({
                ...email,
                headers: { "Reply-To": "second@example.com" },
                replyTo: { email: "first@example.com" },
            });

            expect(raw.match(RE_REPLY_TO_LINE)).toHaveLength(2);

            const signed = await createDkimSigner({ ...baseOptions, bodyCanon: "relaxed", headerCanon: "relaxed" }).signMimeMessage(raw);
            const result = verifyDkim(signed, TEST_PUBLIC_KEY);

            expect(result.bodyHashMatches).toBe(true);
            expect(result.signatureVerifies).toBe(true);
        });

        // RFC 6376 §3.4.5 worked example. Asserting the resulting bh= pins the source's
        // canonicalization to the spec, independently of the verifier further up this file — which
        // was written by reading the implementation and could drift alongside it.
        it.each([
            ["simple", " C \r\nD \t E\r\n"],
            ["relaxed", " C\r\nD E\r\n"],
        ] as const)("matches the RFC 6376 §3.4.5 %s body vector", async (bodyCanon, expectedCanonicalBody) => {
            expect.assertions(1);

            const message = `From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Vector\r\n\r\n C \r\nD \t E\r\n\r\n\r\n`;
            const signed = await createDkimSigner({ ...baseOptions, bodyCanon }).signMimeMessage(message);

            expect(verifyDkim(signed, TEST_PUBLIC_KEY).tags.bh).toBe(createHash("sha256").update(expectedCanonicalBody).digest("base64"));
        });

        it("matches the RFC 6376 §3.4.5 relaxed header vector", async () => {
            expect.assertions(1);

            // "A: X" and a folded "B : Y\t\r\n\tZ  " canonicalize to "a:X" and "b:Y Z".
            const message = `A: X\r\nB : Y\t\r\n\tZ  \r\nFrom: sender@example.com\r\n\r\nbody\r\n`;
            const signed = await createDkimSigner({ ...baseOptions, headerCanon: "relaxed" }).signMimeMessage(message);

            // A and B are not in the default signed set, so only `from` is signed — the point is
            // that folded, whitespace-padded neighbours do not disturb it.
            expect(verifyDkim(signed, TEST_PUBLIC_KEY).signatureVerifies).toBe(true);
        });

        it("rejects a message with no header/body separator", async () => {
            expect.assertions(1);

            await expect(createDkimSigner(baseOptions).signMimeMessage("Subject: no body\r\n")).rejects.toThrow("no CRLFCRLF header/body separator");
        });

        it("rejects an invalid private key", async () => {
            expect.assertions(1);

            const raw = await buildMimeMessage(email);

            await expect(createDkimSigner({ ...baseOptions, privateKey: "invalid-key" }).signMimeMessage(raw)).rejects.toThrow("Failed to create DKIM signature");
        });

        it("canonicalizes an empty body per RFC 6376 — CRLF for simple, nothing for relaxed", async () => {
            expect.assertions(2);

            const message = "From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Empty\r\n\r\n";

            const simple = await createDkimSigner(baseOptions).signMimeMessage(message);
            const relaxed = await createDkimSigner({ ...baseOptions, bodyCanon: "relaxed" }).signMimeMessage(message);

            expect(verifyDkim(simple, TEST_PUBLIC_KEY).tags.bh).toBe(createHash("sha256").update("\r\n").digest("base64"));
            expect(verifyDkim(relaxed, TEST_PUBLIC_KEY).tags.bh).toBe(createHash("sha256").update("").digest("base64"));
        });
    });
});
