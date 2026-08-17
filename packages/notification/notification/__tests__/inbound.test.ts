import { describe, expect, it } from "vitest";

import { createInboundRouter } from "../src/inbound/router";
import type { InboundMessage } from "../src/inbound/types";
import { createDiscordReceiver } from "../src/providers/chat/discord";
import { createMsTeamsReceiver } from "../src/providers/chat/msteams";
import { createSlackReceiver } from "../src/providers/chat/slack";
import { createTelegramReceiver } from "../src/providers/chat/telegram";
import { mockProvider } from "../src/providers/mock/provider";
import { createMessageBirdReceiver } from "../src/providers/sms/messagebird";
import { createTelnyxReceiver } from "../src/providers/sms/telnyx";
import { createTwilioReceiver } from "../src/providers/sms/twilio";
import { createVonageReceiver } from "../src/providers/sms/vonage";

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";

    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => Uint8Array.from(atob(value), (character) => character.codePointAt(0) ?? 0);

const hmac = async (secret: string, message: string, hash: "SHA-1" | "SHA-256"): Promise<ArrayBuffer> => {
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), { hash, name: "HMAC" }, false, ["sign"]);

    return globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
};

const toBase64Url = (value: string): string => btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const sha256Hex = async (value: string): Promise<string> => toHex(await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value)));

const signJwt = async (secret: string, claims: Record<string, unknown>): Promise<string> => {
    const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = toBase64Url(JSON.stringify(claims));
    const signature = toBase64(await hmac(secret, `${header}.${payload}`, "SHA-256")).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

    return `${header}.${payload}.${signature}`;
};

const inFiveMinutes = (): number => Math.floor(Date.now() / 1000) + 300;

describe(createSlackReceiver, () => {
    const secret = "slack-signing-secret";

    const signedRequest = async (body: string, contentType: string): Promise<Request> => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = `v0=${toHex(await hmac(secret, `v0:${timestamp}:${body}`, "SHA-256"))}`;

        return new Request("https://example.com/webhooks/slack", {
            body,
            headers: { "content-type": contentType, "x-slack-request-timestamp": timestamp, "x-slack-signature": signature },
            method: "POST",
        });
    };

    it("answers the url_verification handshake with the challenge", async () => {
        expect.assertions(2);

        const channel = createSlackReceiver({ onMessage: () => undefined, signingSecret: secret });
        const body = JSON.stringify({ challenge: "abc123", type: "url_verification" });
        const response = await channel.handle(await signedRequest(body, "application/json"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({ challenge: "abc123" });
    });

    it("parses an Events API message and acknowledges with 200", async () => {
        expect.assertions(4);

        let received: InboundMessage | undefined;
        const channel = createSlackReceiver({
            onMessage: (message) => {
                received = message;
            },
            signingSecret: secret,
        });
        const body = JSON.stringify({
            event: { channel: "C1", text: "hello bot", ts: "1700000000.0001", type: "app_mention", user: "U1" },
            event_id: "Ev1",
            type: "event_callback",
        });
        const response = await channel.handle(await signedRequest(body, "application/json"));

        expect(response.status).toBe(200);
        expect(received?.type).toBe("message");
        expect(received?.text).toBe("hello bot");
        expect(received?.conversationId).toBe("C1");
    });

    it("serialises a slash-command reply into the JSON response", async () => {
        expect.assertions(2);

        const channel = createSlackReceiver({
            onMessage: () => {
                return { text: "pong" };
            },
            signingSecret: secret,
        });
        const body = new URLSearchParams({ channel_id: "C9", command: "/ping", text: "", user_id: "U2" }).toString();
        const response = await channel.handle(await signedRequest(body, "application/x-www-form-urlencoded"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ text: "pong" });
    });

    it("replies to an Events API message out-of-band through the provider", async () => {
        expect.assertions(3);

        const provider = mockProvider({ channel: "chat", id: "slack" });
        const channel = createSlackReceiver({
            onMessage: async (_message, context) => {
                await context.reply("hello back");
            },
            provider,
            signingSecret: secret,
        });
        const body = JSON.stringify({
            event: { channel: "C1", text: "hi", ts: "1700000000.0001", type: "app_mention", user: "U1" },
            event_id: "Ev2",
            type: "event_callback",
        });
        const response = await channel.handle(await signedRequest(body, "application/json"));
        const sent = provider.getInstance?.().last();

        expect(response.status).toBe(200);
        expect(sent?.payload).toMatchObject({ text: "hello back", to: "C1" });
        expect((sent?.payload as { threadId?: string }).threadId).toBe("1700000000.0001");
    });

    it("rejects a tampered signature with 401", async () => {
        expect.assertions(1);

        const channel = createSlackReceiver({ onMessage: () => undefined, signingSecret: secret });
        const request = new Request("https://example.com/webhooks/slack", {
            body: "{}",
            headers: { "content-type": "application/json", "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)), "x-slack-signature": "v0=deadbeef" },
            method: "POST",
        });

        const response = await channel.handle(request);

        expect(response.status).toBe(401);
    });
});

describe(createDiscordReceiver, () => {
    const generateKey = async (): Promise<CryptoKeyPair> =>
        await globalThis.crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);

    const signedRequest = async (keyPair: CryptoKeyPair, body: string): Promise<Request> => {
        const timestamp = "1700000000";
        const signature = await globalThis.crypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, encoder.encode(`${timestamp}${body}`));

        return new Request("https://example.com/webhooks/discord", {
            body,
            headers: { "content-type": "application/json", "x-signature-ed25519": toHex(signature), "x-signature-timestamp": timestamp },
            method: "POST",
        });
    };

    const publicKeyHex = async (keyPair: CryptoKeyPair): Promise<string> => toHex(await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey));

    it("answers the PING handshake with a PONG", async () => {
        expect.assertions(2);

        const keyPair = await generateKey();
        const channel = createDiscordReceiver({ onMessage: () => undefined, publicKey: await publicKeyHex(keyPair) });
        const response = await channel.handle(await signedRequest(keyPair, JSON.stringify({ type: 1 })));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({ type: 1 });
    });

    it("parses an application command and replies with a channel message", async () => {
        expect.assertions(3);

        const keyPair = await generateKey();
        let received: InboundMessage | undefined;
        const channel = createDiscordReceiver({
            onMessage: (message) => {
                received = message;

                return { text: "hi" };
            },
            publicKey: await publicKeyHex(keyPair),
        });
        const body = JSON.stringify({ channel_id: "C1", data: { name: "ask" }, id: "I1", member: { user: { id: "U1", username: "ada" } }, type: 2 });
        const response = await channel.handle(await signedRequest(keyPair, body));

        expect(received?.command?.name).toBe("ask");
        expect(received?.from.username).toBe("ada");
        await expect(response.json()).resolves.toStrictEqual({ data: { content: "hi" }, type: 4 });
    });

    it("defers the interaction when the handler outruns the deadline", async () => {
        expect.assertions(2);

        const keyPair = await generateKey();
        let finished = false;
        const channel = createDiscordReceiver({
            deferAfterMs: 10,
            onMessage: async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 60);
                });
                finished = true;

                return { text: "too late" };
            },
            publicKey: await publicKeyHex(keyPair),
        });
        const body = JSON.stringify({ channel_id: "C1", data: { name: "slow" }, id: "I2", member: { user: { id: "U1" } }, type: 2 });
        const response = await channel.handle(await signedRequest(keyPair, body));

        // Discord discards an interaction that is unanswered after three seconds, so a slow
        // handler has to be deferred rather than waited on.
        await expect(response.json()).resolves.toStrictEqual({ type: 5 });
        expect(finished).toBe(false);
    });

    it("rejects an invalid signature with 401", async () => {
        expect.assertions(1);

        const keyPair = await generateKey();
        const otherKey = await generateKey();
        const channel = createDiscordReceiver({ onMessage: () => undefined, publicKey: await publicKeyHex(otherKey) });
        const response = await channel.handle(await signedRequest(keyPair, JSON.stringify({ type: 1 })));

        expect(response.status).toBe(401);
    });
});

describe(createTelegramReceiver, () => {
    const secretToken = "telegram-secret";

    const request = (body: unknown, token?: string): Request =>
        new Request("https://example.com/webhooks/telegram", {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json", ...token === undefined ? {} : { "x-telegram-bot-api-secret-token": token } },
            method: "POST",
        });

    it("verifies the secret token and serialises a sendMessage reply", async () => {
        expect.assertions(3);

        let received: InboundMessage | undefined;
        const channel = createTelegramReceiver({
            onMessage: (message) => {
                received = message;

                return { text: "pong" };
            },
            secretToken,
        });
        const response = await channel.handle(
            request({ message: { chat: { id: 42, type: "private" }, date: 1_700_000_000, from: { first_name: "Ada", id: 7 }, message_id: 5, text: "ping" }, update_id: 1 }, secretToken),
        );

        expect(received?.text).toBe("ping");
        expect(received?.conversationId).toBe("42");
        await expect(response.json()).resolves.toMatchObject({ chat_id: "42", method: "sendMessage", text: "pong" });
    });

    it("rejects a mismatched secret token with 401", async () => {
        expect.assertions(1);

        const channel = createTelegramReceiver({ onMessage: () => undefined, secretToken });
        const response = await channel.handle(request({ update_id: 1 }, "wrong"));

        expect(response.status).toBe(401);
    });

    it("sends a topic reply as message_thread_id, not as a quoted message", async () => {
        expect.assertions(2);

        const channel = createTelegramReceiver({ onMessage: (message) => ({ text: "pong", threadId: message.threadId }), secretToken });
        const response = await channel.handle(
            request(
                { message: { chat: { id: 42, type: "supergroup" }, date: 1_700_000_000, from: { id: 7 }, message_id: 5, message_thread_id: 99, text: "ping" }, update_id: 1 },
                secretToken,
            ),
        );
        const payload = (await response.json()) as Record<string, unknown>;

        // 99 is a forum topic, not message 99 — quoting it would target the wrong message.
        expect(payload.message_thread_id).toBe(99);
        expect(payload.reply_parameters).toBeUndefined();
    });

    it("detects bot commands", async () => {
        expect.assertions(2);

        let received: InboundMessage | undefined;
        const channel = createTelegramReceiver({
            onMessage: (message) => {
                received = message;
            },
            secretToken,
        });

        await channel.handle(request({ message: { chat: { id: 1 }, from: { id: 1 }, message_id: 1, text: "/start now" }, update_id: 2 }, secretToken));

        expect(received?.type).toBe("command");
        expect(received?.command).toStrictEqual({ args: "now", name: "start" });
    });
});

describe(createTwilioReceiver, () => {
    const authToken = "twilio-auth-token";
    const url = "https://example.com/webhooks/twilio";

    const signedRequest = async (parameters: Record<string, string>): Promise<Request> => {
        const body = new URLSearchParams(parameters).toString();
        const keys = Object.keys(parameters).toSorted((a, b) => a.localeCompare(b));
        let base = url;

        for (const key of keys) {
            base += `${key}${parameters[key] ?? ""}`;
        }

        const signature = toBase64(await hmac(authToken, base, "SHA-1"));

        return new Request(url, { body, headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature }, method: "POST" });
    };

    it("parses an inbound SMS and replies with TwiML", async () => {
        expect.assertions(4);

        let received: InboundMessage | undefined;
        const channel = createTwilioReceiver({
            authToken,
            onMessage: (message) => {
                received = message;

                return { text: "got it" };
            },
        });
        const response = await channel.handle(await signedRequest({ Body: "hello", From: "+15555550100", MessageSid: "SM1", To: "+15555550111" }));

        expect(received?.text).toBe("hello");
        expect(received?.from.id).toBe("+15555550100");
        expect(response.headers.get("content-type")).toContain("text/xml");
        await expect(response.text()).resolves.toContain("<Message>got it</Message>");
    });

    it("drops XML-illegal control characters from the reply", async () => {
        expect.assertions(2);

        // A handler echoing the inbound Body can carry anything the sender typed; a control
        // character reaches TwiML and Twilio answers with a document-parse error instead.
        const channel = createTwilioReceiver({ authToken, onMessage: (message) => ({ text: message.text }) });
        const response = await channel.handle(await signedRequest({ Body: "ok\u0000 <bad>\u0007", From: "+15555550100", MessageSid: "SM9", To: "+15555550111" }));
        const document = await response.text();

        expect(document).toContain("<Message>ok &lt;bad&gt;</Message>");
        expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(document)).toBe(false);
    });

    it("flags WhatsApp transport and strips the prefix", async () => {
        expect.assertions(2);

        let received: InboundMessage | undefined;
        const channel = createTwilioReceiver({
            authToken,
            onMessage: (message) => {
                received = message;
            },
        });

        await channel.handle(await signedRequest({ Body: "hi", From: "whatsapp:+15555550100", MessageSid: "SM2", To: "whatsapp:+15555550111" }));

        expect(received?.from.id).toBe("+15555550100");
        expect(received?.metadata?.transport).toBe("whatsapp");
    });

    it("replies to the sender through the provider, re-applying the WhatsApp prefix", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms", id: "twilio" });
        const channel = createTwilioReceiver({
            authToken,
            onMessage: async (_message, context) => {
                await context.reply("got it");
            },
            provider,
        });

        await channel.handle(await signedRequest({ Body: "hi", From: "whatsapp:+15555550100", MessageSid: "SM3", To: "whatsapp:+15555550111" }));

        expect(provider.getInstance?.().last()?.payload).toMatchObject({ from: "whatsapp:+15555550111", text: "got it", to: "whatsapp:+15555550100" });
    });

    it("rejects context.reply when no provider is configured", async () => {
        expect.assertions(1);

        const channel = createTwilioReceiver({
            authToken,
            onMessage: async (_message, context) => {
                await context.reply("nope");
            },
        });

        const request = await signedRequest({ Body: "hi", From: "+15555550100", MessageSid: "SM4", To: "+15555550111" });

        await expect(channel.handle(request)).rejects.toThrow("No `provider` configured to send replies");
    });
});

describe(createMsTeamsReceiver, () => {
    const securityToken = btoa("teams-security-token-value-0123456789");

    const signedRequest = async (activity: unknown): Promise<Request> => {
        const body = JSON.stringify(activity);
        const key = await globalThis.crypto.subtle.importKey("raw", base64ToBytes(securityToken), { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
        const signature = toBase64(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(body)));

        return new Request("https://example.com/webhooks/teams", {
            body,
            headers: { authorization: `HMAC ${signature}`, "content-type": "application/json" },
            method: "POST",
        });
    };

    it("verifies the HMAC and replies with a message activity", async () => {
        expect.assertions(3);

        let received: InboundMessage | undefined;
        const channel = createMsTeamsReceiver({
            onMessage: (message) => {
                received = message;

                return { text: "hello back" };
            },
            securityToken,
        });
        const response = await channel.handle(await signedRequest({ conversation: { id: "19:abc" }, from: { id: "U1", name: "Ada" }, id: "A1", text: "hi bot", type: "message" }));

        expect(received?.text).toBe("hi bot");
        expect(received?.from.name).toBe("Ada");
        await expect(response.json()).resolves.toMatchObject({ text: "hello back", type: "message" });
    });

    it("falls back to now when the activity timestamp is malformed", async () => {
        expect.assertions(1);

        let received: InboundMessage | undefined;
        const channel = createMsTeamsReceiver({
            onMessage: (message) => {
                received = message;
            },
            securityToken,
        });

        await channel.handle(await signedRequest({ from: { id: "U1" }, id: "A2", text: "hi", timestamp: "not-a-date", type: "message" }));

        // An `Invalid Date` passes silently through assignment and only throws in the consumer.
        expect(Number.isNaN(received?.timestamp.getTime())).toBe(false);
    });

    it("rejects a tampered HMAC with 401", async () => {
        expect.assertions(1);

        const channel = createMsTeamsReceiver({ onMessage: () => undefined, securityToken });
        const request = new Request("https://example.com/webhooks/teams", {
            body: JSON.stringify({ text: "hi", type: "message" }),
            headers: { authorization: "HMAC bm90LXZhbGlk", "content-type": "application/json" },
            method: "POST",
        });
        const response = await channel.handle(request);

        expect(response.status).toBe(401);
    });
});

describe(createTelnyxReceiver, () => {
    const generateKey = async (): Promise<CryptoKeyPair> =>
        await globalThis.crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);

    const publicKeyBase64 = async (keyPair: CryptoKeyPair): Promise<string> => toBase64(await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey));

    const signedRequest = async (keyPair: CryptoKeyPair, payload: unknown): Promise<Request> => {
        const body = JSON.stringify(payload);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = toBase64(await globalThis.crypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, encoder.encode(`${timestamp}|${body}`)));

        return new Request("https://example.com/webhooks/telnyx", {
            body,
            headers: { "content-type": "application/json", "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp },
            method: "POST",
        });
    };

    it("verifies Ed25519, parses the message and replies through the provider", async () => {
        expect.assertions(3);

        const keyPair = await generateKey();
        const provider = mockProvider({ channel: "sms", id: "telnyx" });
        let received: InboundMessage | undefined;
        const channel = createTelnyxReceiver({
            onMessage: async (message, context) => {
                received = message;

                await context.reply("ok");
            },
            provider,
            publicKey: await publicKeyBase64(keyPair),
        });
        const payload = {
            data: { event_type: "message.received", payload: { from: { phone_number: "+15551230001" }, id: "msg1", text: "hey", to: [{ phone_number: "+15551230009" }], type: "SMS" } },
        };
        const response = await channel.handle(await signedRequest(keyPair, payload));

        expect(received?.text).toBe("hey");
        expect(response.status).toBe(204);
        expect(provider.getInstance?.().last()?.payload).toMatchObject({ from: "+15551230009", text: "ok", to: "+15551230001" });
    });

    it("rejects a signature made with a different key with 401", async () => {
        expect.assertions(1);

        const keyPair = await generateKey();
        const otherKey = await generateKey();
        const channel = createTelnyxReceiver({ onMessage: () => undefined, publicKey: await publicKeyBase64(otherKey) });
        const payload = { data: { event_type: "message.received", payload: { from: { phone_number: "+1" }, id: "m", text: "x", to: [{ phone_number: "+2" }] } } };
        const response = await channel.handle(await signedRequest(keyPair, payload));

        expect(response.status).toBe(401);
    });
});

describe(createMessageBirdReceiver, () => {
    const signingKey = "messagebird-signing-key";
    const url = "https://example.com/webhooks/messagebird";

    it("verifies the signed JWT, parses the message and replies through the provider", async () => {
        expect.assertions(3);

        const body = JSON.stringify({ body: "hey there", createdDatetime: "2026-01-01T00:00:00+00:00", id: "mb1", originator: "+15551230001", recipient: "+15551230009" });
        const token = await signJwt(signingKey, { exp: inFiveMinutes(), iss: "MessageBird", jti: "j1", payload_hash: await sha256Hex(body), url_hash: await sha256Hex(url) });
        const provider = mockProvider({ channel: "sms", id: "messagebird" });
        let received: InboundMessage | undefined;
        const channel = createMessageBirdReceiver({
            onMessage: async (message, context) => {
                received = message;

                await context.reply("thanks");
            },
            provider,
            signingKey,
            url,
        });
        const response = await channel.handle(new Request(url, { body, headers: { "content-type": "application/json", "messagebird-signature-jwt": token }, method: "POST" }));

        expect(received?.text).toBe("hey there");
        expect(response.status).toBe(204);
        expect(provider.getInstance?.().last()?.payload).toMatchObject({ from: "+15551230009", text: "thanks", to: "+15551230001" });
    });

    it("ignores a message with no provider id", async () => {
        expect.assertions(2);

        // Normalising a missing id to "" makes every id-less message look like the same one to a
        // consumer that deduplicates or persists on it.
        const body = JSON.stringify({ body: "no id", createdDatetime: "2026-01-01T00:00:00+00:00", originator: "+15551230001", recipient: "+15551230009" });
        const token = await signJwt(signingKey, { exp: inFiveMinutes(), iss: "MessageBird", jti: "j3", payload_hash: await sha256Hex(body), url_hash: await sha256Hex(url) });
        let called = false;
        const channel = createMessageBirdReceiver({
            onMessage: () => {
                called = true;
            },
            signingKey,
            url,
        });
        const response = await channel.handle(new Request(url, { body, headers: { "content-type": "application/json", "messagebird-signature-jwt": token }, method: "POST" }));

        expect(called).toBe(false);
        expect(response.status).toBe(204);
    });

    it("rejects a JWT signed with the wrong key with 401", async () => {
        expect.assertions(1);

        const body = JSON.stringify({ id: "mb2", originator: "+1", recipient: "+2" });
        const token = await signJwt("wrong-key", { exp: inFiveMinutes(), iss: "MessageBird", jti: "j2", payload_hash: await sha256Hex(body), url_hash: await sha256Hex(url) });
        const channel = createMessageBirdReceiver({ onMessage: () => undefined, signingKey, url });
        const response = await channel.handle(new Request(url, { body, headers: { "messagebird-signature-jwt": token }, method: "POST" }));

        expect(response.status).toBe(401);
    });
});

describe(createVonageReceiver, () => {
    const signatureSecret = "vonage-signature-secret";
    const url = "https://example.com/webhooks/vonage";

    it("verifies the Bearer JWT and payload_hash, parses and replies", async () => {
        expect.assertions(3);

        const body = JSON.stringify({ channel: "sms", from: "15551230001", message_type: "text", message_uuid: "v1", text: "hi vonage", timestamp: "2026-01-01T00:00:00Z", to: "15551230009" });
        const token = await signJwt(signatureSecret, { exp: inFiveMinutes(), payload_hash: await sha256Hex(body) });
        const provider = mockProvider({ channel: "sms", id: "vonage" });
        let received: InboundMessage | undefined;
        const channel = createVonageReceiver({
            onMessage: async (message, context) => {
                received = message;

                await context.reply("reply");
            },
            provider,
            signatureSecret,
        });
        const response = await channel.handle(new Request(url, { body, headers: { authorization: `Bearer ${token}` }, method: "POST" }));

        expect(received?.text).toBe("hi vonage");
        expect(response.status).toBe(204);
        expect(provider.getInstance?.().last()?.payload).toMatchObject({ from: "15551230009", text: "reply", to: "15551230001" });
    });

    it("rejects a tampered body (payload_hash mismatch) with 401", async () => {
        expect.assertions(1);

        const body = JSON.stringify({ from: "1", text: "original", to: "2" });
        const token = await signJwt(signatureSecret, { exp: inFiveMinutes(), payload_hash: await sha256Hex(body) });
        const channel = createVonageReceiver({ onMessage: () => undefined, signatureSecret });
        const tampered = JSON.stringify({ from: "1", text: "changed", to: "2" });
        const response = await channel.handle(new Request(url, { body: tampered, headers: { authorization: `Bearer ${token}` }, method: "POST" }));

        expect(response.status).toBe(401);
    });
});

describe(createInboundRouter, () => {
    it("dispatches by path and 404s unknown paths", async () => {
        expect.assertions(2);

        const channel = createTelegramReceiver({ onMessage: () => undefined });
        const router = createInboundRouter({ "/webhooks/telegram": channel });

        const ok = await router(new Request("https://example.com/webhooks/telegram", { body: JSON.stringify({ update_id: 1 }), method: "POST" }));
        const missing = await router(new Request("https://example.com/nope", { method: "POST" }));

        expect(ok.status).toBe(204);
        expect(missing.status).toBe(404);
    });

    it("matches a route only at a path-segment boundary", async () => {
        expect.assertions(1);

        const router = createInboundRouter({ telegram: createTelegramReceiver({ onMessage: () => undefined }) });

        // The path ends with "telegram", but as part of "evil-telegram" — a different endpoint.
        const response = await router(new Request("https://example.com/webhooks/evil-telegram", { body: "{}", method: "POST" }));

        expect(response.status).toBe(404);
    });

    it("prefers the most specific route over declaration order", async () => {
        expect.assertions(1);

        let reached: string | undefined;
        const receiver = (name: string) =>
            createTelegramReceiver({
                onMessage: () => {
                    reached = name;
                },
            });
        // The short route is declared first; an unordered scan would let it swallow the request.
        const router = createInboundRouter({ "/telegram": receiver("short"), "/inbound/telegram": receiver("specific") });

        await router(
            new Request("https://example.com/inbound/telegram", {
                body: JSON.stringify({ message: { chat: { id: 1 }, from: { id: 1 }, message_id: 1, text: "hi" }, update_id: 1 }),
                method: "POST",
            }),
        );

        expect(reached).toBe("specific");
    });
});
