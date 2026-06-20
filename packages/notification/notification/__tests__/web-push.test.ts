import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { webPushProvider } from "../src/providers/push/web-push";

const VAPID_HEADER = /^vapid t=.+,k=.+/;
const MISSING_PUBLIC_KEY = /vapidPublicKey/;

const toBase64Url = (bytes: Uint8Array): string => {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    let encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");

    while (encoded.endsWith("=")) {
        encoded = encoded.slice(0, -1);
    }

    return encoded;
};

/**
 * Generates a real ECDSA P-256 VAPID keypair (public as uncompressed point, private as
 * raw scalar) so the provider's JWT signing path runs against genuine key material.
 */
const generateVapidKeys = async (): Promise<{ privateKey: string; publicKey: string }> => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

    return { privateKey: jwk.d ?? "", publicKey: toBase64Url(raw) };
};

/**
 * Generates a real client push subscription (ECDH P-256 public key + random auth secret)
 * so the RFC 8291 encryption path completes end-to-end.
 */
const generateSubscription = async (endpoint: string): Promise<string> => {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const auth = new Uint8Array(16);

    crypto.getRandomValues(auth);

    return JSON.stringify({ endpoint, keys: { auth: toBase64Url(auth), p256dh: toBase64Url(raw) } });
};

describe("web-push provider", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("encrypts, signs VAPID and succeeds on a 201", async () => {
        expect.assertions(6);

        fetchMock.mockResolvedValue(new Response("", { status: 201 }));

        const keys = await generateVapidKeys();
        const subscription = await generateSubscription("https://push.example.com/sub/abc");

        const provider = webPushProvider({ vapidPrivateKey: keys.privateKey, vapidPublicKey: keys.publicKey, vapidSubject: "mailto:dev@example.com" });
        const result = await provider.send({ body: "hi there", title: "Hello", to: subscription });

        expect(result.success).toBe(true);
        expect(result.data?.recipients?.[0]?.status).toBe("sent");

        const [url, init] = fetchMock.mock.calls[0];

        expect(String(url)).toBe("https://push.example.com/sub/abc");
        expect(String(init.headers.Authorization)).toMatch(VAPID_HEADER);
        expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
        expect(init.body).toBeInstanceOf(Uint8Array);
    });

    it("maps a 410 Gone to a failed result", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(new Response("", { status: 410 }));

        const keys = await generateVapidKeys();
        const subscription = await generateSubscription("https://push.example.com/sub/dead");

        const provider = webPushProvider({ vapidPrivateKey: keys.privateKey, vapidPublicKey: keys.publicKey, vapidSubject: "mailto:dev@example.com" });
        const result = await provider.send({ body: "hi", to: subscription });

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("Subscription gone");
    });

    it("fails a malformed subscription without calling fetch", async () => {
        expect.assertions(2);

        const keys = await generateVapidKeys();
        const provider = webPushProvider({ vapidPrivateKey: keys.privateKey, vapidPublicKey: keys.publicKey, vapidSubject: "mailto:dev@example.com" });
        const result = await provider.send({ body: "hi", to: "not-json" });

        expect(result.success).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when VAPID config is missing", () => {
        expect.assertions(1);

        expect(() => webPushProvider({ vapidPrivateKey: "", vapidPublicKey: "", vapidSubject: "" })).toThrow(MISSING_PUBLIC_KEY);
    });
});
