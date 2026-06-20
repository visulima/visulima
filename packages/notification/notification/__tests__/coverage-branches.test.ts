import { describe, expect, it, vi } from "vitest";

import { emailChannel } from "../src/channels/email";
import { MemoryInAppStore } from "../src/channels/inapp";
import { createNotificationMessage, NotificationMessageBuilder } from "../src/notification-message";
import { renderHandlebars } from "../src/template-engines/handlebars";
import { renderLiquid } from "../src/template-engines/liquid";
import { renderString } from "../src/template-engines/string";
import { slackWebhook, snsWebhook, standardWebhook, twilioWebhook } from "../src/webhooks";
import { isWithinReplayWindow, REPLAY_WINDOW_SECONDS, timingSafeEqual } from "../src/webhooks/crypto";

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

const nowSeconds = (): string => String(Math.floor(Date.now() / 1000));

describe("crypto helpers", () => {
    it("timingSafeEqual returns false for unequal lengths and true for equal strings", () => {
        expect.assertions(3);

        expect(timingSafeEqual("abc", "abcd")).toBe(false);
        expect(timingSafeEqual("abc", "abd")).toBe(false);
        expect(timingSafeEqual("abc", "abc")).toBe(true);
    });

    it("isWithinReplayWindow rejects undefined, non-numeric and out-of-window timestamps", () => {
        expect.assertions(4);

        expect(isWithinReplayWindow(undefined, REPLAY_WINDOW_SECONDS)).toBe(false);
        expect(isWithinReplayWindow("not-a-number", REPLAY_WINDOW_SECONDS)).toBe(false);
        expect(isWithinReplayWindow(String(Math.floor(Date.now() / 1000) - REPLAY_WINDOW_SECONDS - 60), REPLAY_WINDOW_SECONDS)).toBe(false);
        expect(isWithinReplayWindow(nowSeconds(), REPLAY_WINDOW_SECONDS)).toBe(true);
    });
});

describe("standardWebhook branches", () => {
    it("matches one signature within a multi-signature (rotated) header", async () => {
        expect.assertions(1);

        const secret = "standard-secret";
        const id = "msg_multi";
        const timestamp = nowSeconds();
        const body = JSON.stringify({ id, type: "delivered" });
        const good = toBase64(await sign(secret, `${id}.${timestamp}.${body}`, "SHA-256"));

        // Space-separated list of `v1,<sig>` candidates; the second one is valid.
        const headers = { "webhook-id": id, "webhook-signature": `v1,deadbeef v1a,${good}`, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(true);
    });

    it("accepts a hex digest as a fallback signature", async () => {
        expect.assertions(1);

        const secret = "standard-secret";
        const id = "msg_hex";
        const timestamp = nowSeconds();
        const body = JSON.stringify({ id, type: "delivered" });
        const hex = toHex(await sign(secret, `${id}.${timestamp}.${body}`, "SHA-256"));

        const headers = { "webhook-id": id, "webhook-signature": `v1,${hex}`, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(true);
    });

    it("accepts a bare (comma-less) candidate signature", async () => {
        expect.assertions(1);

        const secret = "standard-secret";
        const id = "msg_bare";
        const timestamp = nowSeconds();
        const body = JSON.stringify({ id, type: "delivered" });
        const good = toBase64(await sign(secret, `${id}.${timestamp}.${body}`, "SHA-256"));

        const headers = { "webhook-id": id, "webhook-signature": good, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(true);
    });

    it("rejects when a required header is missing", async () => {
        expect.assertions(1);

        const headers = { "webhook-signature": "v1,anything", "webhook-timestamp": nowSeconds() };

        await expect(standardWebhook.verify("{}", headers, "secret")).resolves.toBe(false);
    });

    it("rejects an invalid (non-numeric) timestamp", async () => {
        expect.assertions(1);

        const headers = { "webhook-id": "msg", "webhook-signature": "v1,anything", "webhook-timestamp": "not-a-number" };

        await expect(standardWebhook.verify("{}", headers, "secret")).resolves.toBe(false);
    });

    it("rejects a timestamp outside the replay window", async () => {
        expect.assertions(1);

        const secret = "standard-secret";
        const id = "msg_stale";
        const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 10);
        const body = JSON.stringify({ id, type: "delivered" });
        const good = toBase64(await sign(secret, `${id}.${timestamp}.${body}`, "SHA-256"));

        const headers = { "webhook-id": id, "webhook-signature": `v1,${good}`, "webhook-timestamp": timestamp };

        await expect(standardWebhook.verify(body, headers, secret)).resolves.toBe(false);
    });

    it("parse returns undefined for a non-object body and normalises unknown types to delivered", () => {
        expect.assertions(3);

        expect(standardWebhook.parse("not-json")).toBeUndefined();

        const known = standardWebhook.parse(JSON.stringify({ id: "a", recipient: "u@x.com", type: "bounced" }));

        expect(known).toMatchObject({ messageId: "a", recipient: "u@x.com", type: "bounced" });

        const unknown = standardWebhook.parse(JSON.stringify({ type: "weird" }));

        expect(unknown).toMatchObject({ messageId: "", type: "delivered" });
    });
});

describe("twilioWebhook branches", () => {
    it("verifies a valid signature and rejects tampered params", async () => {
        expect.assertions(2);

        const secret = "twilio-auth-token";
        const url = "https://example.com/webhooks/twilio";
        const body = "MessageSid=SM1&MessageStatus=delivered&To=%2B15555550100";
        const base = `${url}MessageSidSM1MessageStatusdeliveredTo+15555550100`;
        const signature = toBase64(await sign(secret, base, "SHA-1"));

        const headers = { "X-Twilio-Signature": signature, "x-twilio-signature-url": url };

        await expect(twilioWebhook.verify(body, headers, secret)).resolves.toBe(true);

        const tampered = "MessageSid=SM1&MessageStatus=failed&To=%2B15555550100";

        await expect(twilioWebhook.verify(tampered, headers, secret)).resolves.toBe(false);
    });

    it("rejects a missing signature header", async () => {
        expect.assertions(1);

        await expect(twilioWebhook.verify("MessageSid=SM1", { "x-twilio-signature-url": "https://x.com" }, "secret")).resolves.toBe(false);
    });

    it("rejects a missing url header", async () => {
        expect.assertions(1);

        await expect(twilioWebhook.verify("MessageSid=SM1", { "X-Twilio-Signature": "sig" }, "secret")).resolves.toBe(false);
    });

    it("rejects an empty secret", async () => {
        expect.assertions(1);

        await expect(twilioWebhook.verify("MessageSid=SM1", { "X-Twilio-Signature": "sig", "x-twilio-signature-url": "https://x.com" }, "  ")).resolves.toBe(
            false,
        );
    });

    it("parse returns undefined when status is missing or unknown", () => {
        expect.assertions(2);

        expect(twilioWebhook.parse("MessageSid=SM1")).toBeUndefined();
        expect(twilioWebhook.parse("MessageStatus=bogus")).toBeUndefined();
    });
});

describe("slackWebhook branches", () => {
    it("verifies a valid v0 signature", async () => {
        expect.assertions(1);

        const secret = "slack-signing-secret";
        const timestamp = nowSeconds();
        const body = JSON.stringify({ event: { channel: "C1", ts: "1.2" } });
        const digest = toHex(await sign(secret, `v0:${timestamp}:${body}`, "SHA-256"));

        await expect(slackWebhook.verify(body, { "X-Slack-Request-Timestamp": timestamp, "X-Slack-Signature": `v0=${digest}` }, secret)).resolves.toBe(true);
    });

    it("rejects a stale timestamp", async () => {
        expect.assertions(1);

        const secret = "slack-signing-secret";
        const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 10);
        const body = "{}";
        const digest = toHex(await sign(secret, `v0:${timestamp}:${body}`, "SHA-256"));

        await expect(slackWebhook.verify(body, { "X-Slack-Request-Timestamp": timestamp, "X-Slack-Signature": `v0=${digest}` }, secret)).resolves.toBe(false);
    });

    it("rejects missing signature/timestamp headers and an empty secret", async () => {
        expect.assertions(3);

        await expect(slackWebhook.verify("{}", { "X-Slack-Request-Timestamp": nowSeconds() }, "secret")).resolves.toBe(false);
        await expect(slackWebhook.verify("{}", { "X-Slack-Signature": "v0=abc" }, "secret")).resolves.toBe(false);
        await expect(slackWebhook.verify("{}", { "X-Slack-Request-Timestamp": nowSeconds(), "X-Slack-Signature": "v0=abc" }, "")).resolves.toBe(false);
    });

    it("parse returns undefined for malformed body and falls back to event ts", () => {
        expect.assertions(2);

        expect(slackWebhook.parse("not-json")).toBeUndefined();

        const event = slackWebhook.parse(JSON.stringify({ event: { channel: "C9", ts: "9.9" } }));

        expect(event).toMatchObject({ messageId: "9.9", provider: "slack", recipient: "C9" });
    });
});

describe("snsWebhook branches", () => {
    it("parses a Notification envelope into metadata.message", () => {
        expect.assertions(1);

        const body = JSON.stringify({ Message: "hi", MessageId: "id-1", Timestamp: "2020-01-01T00:00:00.000Z", Type: "Notification" });

        expect(snsWebhook.parse(body)).toMatchObject({ messageId: "id-1", metadata: { message: "hi", type: "Notification" }, provider: "sns" });
    });

    it("parses a SubscriptionConfirmation envelope into metadata.subscribeUrl", () => {
        expect.assertions(1);

        const body = JSON.stringify({ MessageId: "id-2", SubscribeURL: "https://sns.example/confirm", Type: "SubscriptionConfirmation" });

        expect(snsWebhook.parse(body)).toMatchObject({ metadata: { subscribeUrl: "https://sns.example/confirm", type: "SubscriptionConfirmation" } });
    });

    it("parse returns undefined for non-JSON or missing Type", () => {
        expect.assertions(2);

        expect(snsWebhook.parse("not-json")).toBeUndefined();
        expect(snsWebhook.parse(JSON.stringify({ MessageId: "id-3" }))).toBeUndefined();
    });

    it("verify fails closed", async () => {
        expect.assertions(1);

        await expect(snsWebhook.verify("{}", {}, "secret")).resolves.toBe(false);
    });
});

describe("renderString branches", () => {
    it("throws a TypeError for a non-string template", () => {
        expect.assertions(1);

        const notAString = 42 as unknown;

        expect(() => renderString(notAString as string)).toThrow(TypeError);
    });

    it("resolves deeply nested paths and renders missing/whitespace placeholders as empty", () => {
        expect.assertions(2);

        expect(renderString("{{ a.b.c }}", { a: { b: { c: "deep" } } })).toBe("deep");
        expect(renderString("[{{ a.missing }}][{{  }}]", { a: {} })).toBe("[][{{  }}]");
    });

    it("stringifies non-string values and bails when a segment is a non-object", () => {
        expect.assertions(2);

        expect(renderString("{{ n }}-{{ flag }}-{{ obj }}", { flag: true, n: 7, obj: { x: 1 } })).toBe("7-true-{\"x\":1}");
        expect(renderString("{{ a.b }}", { a: "scalar" })).toBe("");
    });
});

describe("renderHandlebars branches", () => {
    it("throws a TypeError for a non-string template", async () => {
        expect.assertions(1);

        const notAString = 42 as unknown;

        await expect(renderHandlebars(notAString as string)).rejects.toThrow(TypeError);
    });

    it("wraps a render-time error in a NotificationError", async () => {
        expect.assertions(2);

        // An unknown helper makes handlebars throw at render time, hitting the catch branch.
        await expect(renderHandlebars("{{#each}}{{/each}}")).rejects.toThrow("Failed to render Handlebars template");
        await expect(renderHandlebars("{{name}}", { name: "ok" })).resolves.toBe("ok");
    });
});

describe("renderLiquid branches", () => {
    it("throws a TypeError for a non-string template", async () => {
        expect.assertions(1);

        const notAString = 42 as unknown;

        await expect(renderLiquid(notAString as string)).rejects.toThrow(TypeError);
    });

    it("wraps a render-time error in a NotificationError", async () => {
        expect.assertions(1);

        // Unclosed tag causes liquidjs to throw, hitting the catch branch.
        await expect(renderLiquid("{% if %}")).rejects.toThrow("Failed to render Liquid template");
    });
});

describe("emailChannel adapter branches", () => {
    it("returns a failed receipt carrying the cause when mail.send fails", async () => {
        expect.assertions(3);

        const cause = new Error("smtp down");
        const mail = { send: vi.fn().mockResolvedValue({ error: cause, success: false }) };
        const provider = emailChannel(mail, { id: "custom-email" });

        const result = await provider.send({ subject: "Hi", to: "b@x.com" });

        expect(result.success).toBe(false);
        expect(result.success ? "" : result.error.message).toContain("smtp down");
        expect(result.success ? undefined : (result.error as { cause?: unknown }).cause).toBe(cause);
    });

    it("uses a generic message when the error is not an Error instance", async () => {
        expect.assertions(2);

        const mail = { send: vi.fn().mockResolvedValue({ success: false }) };
        const provider = emailChannel(mail);

        const result = await provider.send({ subject: "Hi", to: "b@x.com" });

        expect(result.success).toBe(false);
        expect(result.success ? "" : result.error.message).toContain("Email send failed");
    });

    it("maps a successful send and applies fallback fields", async () => {
        expect.assertions(2);

        const mail = { send: vi.fn().mockResolvedValue({ data: { messageId: "eml-1" }, success: true }) };
        const provider = emailChannel(mail);

        const result = await provider.send({ subject: "Hi", to: "b@x.com" });

        expect(result.success).toBe(true);
        expect(result.success ? result.data.provider : "").toBe("email");
    });
});

describe("memoryInAppStore branches", () => {
    it("lists with limit and unreadOnly, then reflects markAllRead", async () => {
        expect.assertions(5);

        const store = new MemoryInAppStore();

        const first = await store.add({ body: "a", subscriberId: "u1" });

        await store.add({ body: "b", subscriberId: "u1" });
        await store.add({ body: "c", subscriberId: "u2" });

        const limited = await store.list("u1", { limit: 1 });

        expect(limited).toHaveLength(1);

        await store.markRead(first.id);

        const unread = await store.list("u1", { unreadOnly: true });

        expect(unread).toHaveLength(1);
        await expect(store.unreadCount("u1")).resolves.toBe(1);

        await store.markAllRead("u1");

        await expect(store.unreadCount("u1")).resolves.toBe(0);

        const all = await store.list("u1");

        expect(all).toHaveLength(2);
    });

    it("markRead of an unknown id is a no-op and remove deletes an item", async () => {
        expect.assertions(2);

        const store = new MemoryInAppStore();
        const stored = await store.add({ body: "x", id: "fixed-id", subscriberId: "u3" });

        await expect(store.markRead("does-not-exist")).resolves.toBeUndefined();

        await store.remove(stored.id);

        const remaining = await store.list("u3");

        expect(remaining).toHaveLength(0);
    });
});

describe("notificationMessageBuilder branches", () => {
    it("exercises every builder setter and build() shape", () => {
        expect.assertions(7);

        const builder = createNotificationMessage()
            .chat({ text: "hi", to: "C1" })
            .inApp({ body: "welcome", to: "u1" })
            .webhook({ body: { ok: true }, url: "https://x.com/hook" })
            .email({ subject: "Hi", to: "b@x.com" })
            .metadata({ campaign: "launch" });

        expect(builder).toBeInstanceOf(NotificationMessageBuilder);

        const message = builder.build();

        expect(message.chat).toMatchObject({ text: "hi", to: "C1" });
        expect(message.inapp).toMatchObject({ body: "welcome", to: "u1" });
        expect(message.webhook).toMatchObject({ url: "https://x.com/hook" });
        expect(message.email).toMatchObject({ subject: "Hi", to: "b@x.com" });
        expect(message.chat?.metadata).toStrictEqual({ campaign: "launch" });
        expect(message.email?.metadata).toStrictEqual({ campaign: "launch" });
    });

    it("createNotificationMessage returns a fresh builder and build() clones when no metadata/key set", () => {
        expect.assertions(2);

        const message = createNotificationMessage().sms({ text: "hi", to: "+1" }).build();

        expect(message).toStrictEqual({ sms: { text: "hi", to: "+1" } });
        expect(createNotificationMessage()).toBeInstanceOf(NotificationMessageBuilder);
    });
});
