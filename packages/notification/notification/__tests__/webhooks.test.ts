import { afterEach, describe, expect, it, vi } from "vitest";

import { slackWebhook, snsWebhook, standardWebhook, twilioWebhook } from "../src/webhooks";

const encoder = new TextEncoder();

const sign = async (secret: string, message: string, hash: "SHA-1" | "SHA-256"): Promise<ArrayBuffer> => {
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), { hash, name: "HMAC" }, false, ["sign"]);

    return globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
};

const toHex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";

    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

describe("slackWebhook", () => {
    it("verifies a known-good v0 signature and rejects a tampered one", async () => {
        expect.assertions(3);

        const secret = "slack-signing-secret";
        const timestamp = String(Math.floor(Date.now() / 1000));
        const body = JSON.stringify({ event: { channel: "C123", ts: "1.2" }, event_id: "Ev1" });
        const digest = toHex(await sign(secret, `v0:${timestamp}:${body}`, "SHA-256"));

        const headers = { "X-Slack-Request-Timestamp": timestamp, "X-Slack-Signature": `v0=${digest}` };

        await expect(slackWebhook.verify(body, headers, secret)).resolves.toBe(true);
        await expect(slackWebhook.verify(body, { ...headers, "X-Slack-Signature": "v0=deadbeef" }, secret)).resolves.toBe(false);

        const event = slackWebhook.parse(body);

        expect(event?.messageId).toBe("Ev1");
    });

    it("rejects a signature outside the replay window", async () => {
        expect.assertions(1);

        const secret = "slack-signing-secret";
        const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 10);
        const body = "{}";
        const digest = toHex(await sign(secret, `v0:${timestamp}:${body}`, "SHA-256"));

        await expect(slackWebhook.verify(body, { "X-Slack-Request-Timestamp": timestamp, "X-Slack-Signature": `v0=${digest}` }, secret)).resolves.toBe(false);
    });
});

describe("twilioWebhook", () => {
    it("verifies a known-good signature and rejects a tampered one", async () => {
        expect.assertions(3);

        const secret = "twilio-auth-token";
        const url = "https://example.com/webhooks/twilio";
        const body = "MessageSid=SM1&MessageStatus=delivered&To=%2B15555550100";
        // Sorted keys: MessageSid, MessageStatus, To -> url + key+value concatenation.
        const base = `${url}MessageSidSM1MessageStatusdeliveredTo+15555550100`;
        const signature = toBase64(await sign(secret, base, "SHA-1"));

        const headers = { "X-Twilio-Signature": signature, "x-twilio-signature-url": url };

        await expect(twilioWebhook.verify(body, headers, secret)).resolves.toBe(true);
        await expect(twilioWebhook.verify(body, { ...headers, "X-Twilio-Signature": "bm90LXZhbGlk" }, secret)).resolves.toBe(false);

        const event = twilioWebhook.parse(body);

        expect(event).toMatchObject({ messageId: "SM1", provider: "twilio", type: "delivered" });
    });

    it("sorts keys by Unicode code unit, not locale collation", async () => {
        expect.assertions(1);

        const secret = "twilio-auth-token";
        const url = "https://example.com/webhooks/twilio";
        const body = "Zebra=1&apple=2";
        // Code-unit order places uppercase "Zebra" before lowercase "apple"; locale
        // collation would reverse them and produce a different (rejected) signature.
        const base = `${url}Zebra1apple2`;
        const signature = toBase64(await sign(secret, base, "SHA-1"));

        const headers = { "X-Twilio-Signature": signature, "x-twilio-signature-url": url };

        await expect(twilioWebhook.verify(body, headers, secret)).resolves.toBe(true);
    });
});

describe("standardWebhook", () => {
    it("verifies a known-good v1 signature and rejects a tampered one", async () => {
        expect.assertions(2);

        const secret = "standard-secret";
        const id = "msg_1";
        const timestamp = String(Math.floor(Date.now() / 1000));
        const body = JSON.stringify({ id, recipient: "user@example.com", type: "delivered" });
        const signature = toBase64(await sign(secret, `${id}.${timestamp}.${body}`, "SHA-256"));

        const headers = { "webhook-id": id, "webhook-signature": `v1,${signature}`, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(true);
        await expect(standardWebhook.verify(body, { ...headers, "webhook-signature": "v1,deadbeef" }, secret)).resolves.toBe(false);
    });

    it("decodes a whsec_ base64 key to raw bytes and verifies against it", async () => {
        expect.assertions(2);

        // Per the Standard Webhooks spec the part after `whsec_` is base64-encoded raw key
        // BYTES; the HMAC must be keyed with the decoded bytes, not the base64 string.
        const keyBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        let binary = "";

        for (const byte of keyBytes) {
            binary += String.fromCodePoint(byte);
        }

        const base64Key = btoa(binary);
        const secret = `whsec_${base64Key}`;

        const id = "msg_2";
        const timestamp = String(Math.floor(Date.now() / 1000));
        const body = JSON.stringify({ id, type: "delivered" });

        const cryptoKey = await globalThis.crypto.subtle.importKey("raw", keyBytes, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
        const mac = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${id}.${timestamp}.${body}`));
        const signature = toBase64(mac);

        const headers = { "webhook-id": id, "webhook-signature": `v1,${signature}`, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(true);
        await expect(standardWebhook.verify(`${body} `, headers, secret)).resolves.toBe(false);
    });

    it("rejects an empty secret (an empty HMAC key is forgeable)", async () => {
        expect.assertions(1);

        const id = "msg_3";
        const timestamp = String(Math.floor(Date.now() / 1000));
        const body = "{}";
        const headers = { "webhook-id": id, "webhook-signature": "v1,anything", "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, "   ")).resolves.toBe(false);
    });
});

describe("snsWebhook", () => {
    // Minimal DER encoder used to wrap an exported SPKI in a valid-enough X.509 certificate.
    const derLength = (length: number): number[] => {
        if (length < 0x80) {
            return [length];
        }

        const bytes: number[] = [];
        let remaining = length;

        while (remaining > 0) {
            bytes.unshift(remaining % 256);
            remaining = Math.floor(remaining / 256);
        }

        return [128 + bytes.length, ...bytes];
    };

    const der = (tag: number, content: number[]): number[] => [tag, ...derLength(content.length), ...content];

    // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }, where
    // tbsCertificate ::= SEQUENCE { version[0], serialNumber, signature, issuer, validity,
    // subject, subjectPublicKeyInfo }. Only the SPKI is real; the rest are skippable stubs.
    const buildCertificate = (spki: Uint8Array): string => {
        const version = der(0xa0, der(0x02, [0x02]));
        const serial = der(0x02, [0x01]);
        const empty = der(0x30, []);
        const tbs = der(0x30, [...version, ...serial, ...empty, ...empty, ...empty, ...empty, ...spki]);
        const certificate = der(0x30, [...tbs, ...der(0x30, []), ...der(0x03, [0x00])]);

        return `-----BEGIN CERTIFICATE-----\n${toBase64(new Uint8Array(certificate).buffer)}\n-----END CERTIFICATE-----\n`;
    };

    const stringToSign = (message: Record<string, string>): string => {
        const keys = ["Message", "MessageId", "Subject", "SubscribeURL", "Timestamp", "TopicArn", "Type"];
        let result = "";

        for (const key of keys) {
            if (message[key] !== undefined) {
                result += `${key}\n${message[key]}\n`;
            }
        }

        return result;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("verifies a genuine SignatureVersion 2 (RSA-SHA256) message and rejects a tampered one", async () => {
        expect.assertions(3);

        const keyPair = await globalThis.crypto.subtle.generateKey(
            { hash: "SHA-256", modulusLength: 2048, name: "RSASSA-PKCS1-v1_5", publicExponent: new Uint8Array([1, 0, 1]) },
            true,
            ["sign", "verify"],
        );
        const spki = new Uint8Array(await globalThis.crypto.subtle.exportKey("spki", keyPair.publicKey));
        const pem = buildCertificate(spki);

        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(pem, { status: 200 }))));

        const message: Record<string, string> = {
            Message: "inbound sms",
            MessageId: "id-1",
            SignatureVersion: "2",
            SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem",
            Timestamp: "2026-01-01T00:00:00.000Z",
            TopicArn: "arn:aws:sns:us-east-1:1:topic",
            Type: "Notification",
        };
        const signature = toBase64(await globalThis.crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, keyPair.privateKey, encoder.encode(stringToSign(message))));

        await expect(snsWebhook.verify(JSON.stringify({ ...message, Signature: signature }), {}, "")).resolves.toBe(true);
        await expect(snsWebhook.verify(JSON.stringify({ ...message, Message: "tampered", Signature: signature }), {}, "")).resolves.toBe(false);

        const event = snsWebhook.parse(JSON.stringify(message));

        expect(event).toMatchObject({ messageId: "id-1", provider: "sns" });
    });

    it("rejects a certificate URL that is not an AWS SNS host without fetching", async () => {
        expect.assertions(2);

        const fetchSpy = vi.fn(() => Promise.resolve(new Response("", { status: 200 })));

        vi.stubGlobal("fetch", fetchSpy);

        const spoofed = JSON.stringify({ MessageId: "id-2", Signature: "abc", SignatureVersion: "2", SigningCertURL: "https://evil.example.com/cert.pem", Type: "Notification" });

        await expect(snsWebhook.verify(spoofed, {}, "")).resolves.toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
