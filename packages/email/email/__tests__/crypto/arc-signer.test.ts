import { Buffer } from "node:buffer";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ArcSealOptions } from "../../src/crypto/arc-signer";
import { arcMessageSignatureBase, arcSealBase, signArc, verifyArc } from "../../src/crypto/arc-signer";
import type { EmailOptions } from "../../src/types";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" });
const ed = generateKeyPairSync("ed25519");
const edPrivatePem = ed.privateKey.export({ format: "pem", type: "pkcs8" });

const email: EmailOptions = {
    from: { email: "sender@example.com", name: "Sender" },
    html: "<p>Hi</p>",
    subject: "Hello",
    text: "Hi",
    to: { email: "rcpt@example.org" },
};

const options: ArcSealOptions = {
    authenticationResults: "example.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com",
    domainName: "example.com",
    keySelector: "arc1",
    privateKey: privateKeyPem,
    timestamp: 1_700_000_000,
};

const tagValue = (header: string, tag: string): string | undefined => header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${tag}=`))?.slice(tag.length + 1);

describe("arc signer", () => {
    it("produces an i=1 ARC header set with the expected tags", async () => {
        expect.assertions(7);

        const { headers } = await signArc(email, options);

        expect(headers["ARC-Authentication-Results"]).toBe(`i=1; ${options.authenticationResults}`);
        expect(tagValue(headers["ARC-Seal"], "i")).toBe("1");
        expect(tagValue(headers["ARC-Seal"], "cv")).toBe("none");
        expect(tagValue(headers["ARC-Seal"], "d")).toBe("example.com");
        expect(tagValue(headers["ARC-Message-Signature"], "a")).toBe("rsa-sha256");
        expect(tagValue(headers["ARC-Message-Signature"], "bh")?.length ?? 0).toBeGreaterThan(0);
        expect(tagValue(headers["ARC-Seal"], "b")?.length ?? 0).toBeGreaterThan(0);
    });

    it("adds the three ARC headers to the returned email", async () => {
        expect.assertions(3);

        const { email: sealed } = await signArc(email, options);
        const headers = sealed.headers as Record<string, string>;

        expect(headers["ARC-Authentication-Results"]).toBeDefined();
        expect(headers["ARC-Message-Signature"]).toBeDefined();
        expect(headers["ARC-Seal"]).toBeDefined();
    });

    it("signs AMS and AS so both verify against the public key", async () => {
        expect.assertions(2);

        const { headers } = await signArc(email, options);

        // ARC-Message-Signature: strip the b= value and verify it over the AMS sign base.
        const amsSignature = tagValue(headers["ARC-Message-Signature"], "b") as string;
        const ams = arcMessageSignatureBase(email, options);

        expect(cryptoVerify("RSA-SHA256", Buffer.from(ams.signBase), publicKey, Buffer.from(amsSignature, "base64"))).toBe(true);

        // ARC-Seal: verify over the seal sign base (built from the AAR + full AMS).
        const sealSignature = tagValue(headers["ARC-Seal"], "b") as string;
        const seal = arcSealBase(headers["ARC-Authentication-Results"], headers["ARC-Message-Signature"], options);

        expect(cryptoVerify("RSA-SHA256", Buffer.from(seal.signBase), publicKey, Buffer.from(sealSignature, "base64"))).toBe(true);
    });

    it("is deterministic for a fixed timestamp", async () => {
        expect.assertions(1);

        const first = await signArc(email, options);
        const second = await signArc(email, options);

        expect(first.headers).toStrictEqual(second.headers);
    });

    describe(verifyArc, () => {
        it("verifies an RSA-signed chain it produced", async () => {
            expect.assertions(4);

            const { headers } = await signArc(email, options);
            const result = verifyArc(email, headers, { publicKey });

            expect(result.valid).toBe(true);
            expect(result.components.ams).toBe(true);
            expect(result.components.seal).toBe(true);
            expect(result.cv).toBe("none");
        });

        it("verifies an Ed25519-signed chain (RFC 8463)", async () => {
            expect.assertions(1);

            const { headers } = await signArc(email, { ...options, algorithm: "ed25519-sha256", privateKey: edPrivatePem });
            const result = verifyArc(email, headers, { publicKey: ed.publicKey });

            expect(result.valid).toBe(true);
        });

        it("rejects a tampered body (body-hash mismatch)", async () => {
            expect.assertions(2);

            const { headers } = await signArc(email, options);
            const result = verifyArc({ ...email, text: "tampered" }, headers, { publicKey });

            expect(result.valid).toBe(false);
            expect(result.components.bodyHash).toBe(false);
        });

        it("rejects verification with the wrong key", async () => {
            expect.assertions(1);

            const { headers } = await signArc(email, options);
            const result = verifyArc(email, headers, { publicKey: ed.publicKey });

            expect(result.valid).toBe(false);
        });

        it("reports missing ARC headers", () => {
            expect.assertions(2);

            const result = verifyArc(email, {}, { publicKey });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("missing-arc-headers");
        });
    });
});
