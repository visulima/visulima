import { Buffer } from "node:buffer";
import { createHmac, createPrivateKey, createSign, generateKeyPairSync, sign as cryptoSign } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
    isValidSigningCertUrl,
    verifyMailgunWebhook,
    verifyPostmarkWebhook,
    verifySendGridWebhook,
    verifySnsMessage,
    verifyStandardWebhook,
} from "../../src/webhooks";

const NOW = 1_700_000_000_000;
const NOW_SECONDS = Math.floor(NOW / 1000);

describe("webhooks", () => {
    describe(verifyStandardWebhook, () => {
        const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
        const id = "msg_2KWPBgLlAfxdpx2AI54pPJ85f4W";
        const payload = JSON.stringify({ type: "email.delivered" });

        const sign = (timestamp: number): string => {
            const key = Buffer.from(secret.slice("whsec_".length), "base64");
            const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");

            return `v1,${signature}`;
        };

        it("accepts a valid signature", () => {
            expect.assertions(1);

            const result = verifyStandardWebhook({
                headers: {
                    "webhook-id": id,
                    "webhook-signature": sign(NOW_SECONDS),
                    "webhook-timestamp": String(NOW_SECONDS),
                },
                now: NOW,
                payload,
                secret,
            });

            expect(result.valid).toBe(true);
        });

        it("accepts svix-* header aliases", () => {
            expect.assertions(1);

            const result = verifyStandardWebhook({
                headers: {
                    "svix-id": id,
                    "svix-signature": sign(NOW_SECONDS),
                    "svix-timestamp": String(NOW_SECONDS),
                },
                now: NOW,
                payload,
                secret,
            });

            expect(result.valid).toBe(true);
        });

        it("rejects a tampered payload", () => {
            expect.assertions(2);

            const result = verifyStandardWebhook({
                headers: {
                    "webhook-id": id,
                    "webhook-signature": sign(NOW_SECONDS),
                    "webhook-timestamp": String(NOW_SECONDS),
                },
                now: NOW,
                payload: `${payload}tampered`,
                secret,
            });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("signature-mismatch");
        });

        it("rejects a stale timestamp", () => {
            expect.assertions(2);

            const stale = NOW_SECONDS - 1000;
            const result = verifyStandardWebhook({
                headers: {
                    "webhook-id": id,
                    "webhook-signature": sign(stale),
                    "webhook-timestamp": String(stale),
                },
                now: NOW,
                payload,
                secret,
            });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("timestamp-out-of-tolerance");
        });

        it("rejects missing headers", () => {
            expect.assertions(2);

            const result = verifyStandardWebhook({ headers: {}, now: NOW, payload, secret });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("missing-headers");
        });
    });

    describe(verifyMailgunWebhook, () => {
        const signingKey = "key-mailgun-signing-secret";
        const token = "a".repeat(50);

        it("accepts a valid signature", () => {
            expect.assertions(1);

            const signature = createHmac("sha256", signingKey).update(`${NOW_SECONDS}${token}`).digest("hex");

            const result = verifyMailgunWebhook({ now: NOW, signature, signingKey, timestamp: NOW_SECONDS, token });

            expect(result.valid).toBe(true);
        });

        it("rejects a forged signature", () => {
            expect.assertions(2);

            const result = verifyMailgunWebhook({ now: NOW, signature: "deadbeef", signingKey, timestamp: NOW_SECONDS, token });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("signature-mismatch");
        });
    });

    describe(verifyPostmarkWebhook, () => {
        it("accepts valid basic-auth credentials", () => {
            expect.assertions(1);

            const authorization = `Basic ${Buffer.from("hook-user:hook-pass").toString("base64")}`;
            const result = verifyPostmarkWebhook({ authorization, password: "hook-pass", username: "hook-user" });

            expect(result.valid).toBe(true);
        });

        it("rejects wrong credentials", () => {
            expect.assertions(2);

            const authorization = `Basic ${Buffer.from("hook-user:wrong").toString("base64")}`;
            const result = verifyPostmarkWebhook({ authorization, password: "hook-pass", username: "hook-user" });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("credentials-mismatch");
        });

        it("rejects a missing header", () => {
            expect.assertions(1);

            const result = verifyPostmarkWebhook({ authorization: undefined, password: "p", username: "u" });

            expect(result.valid).toBe(false);
        });
    });

    describe(verifySendGridWebhook, () => {
        const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
        const publicKeyBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
        const payload = JSON.stringify([{ event: "delivered" }]);
        const timestamp = String(NOW_SECONDS);

        it("accepts a valid ECDSA signature", () => {
            expect.assertions(1);

            const signature = cryptoSign("sha256", Buffer.from(timestamp + payload), { dsaEncoding: "der", key: privateKey }).toString("base64");

            const result = verifySendGridWebhook({ payload, publicKey: publicKeyBase64, signature, timestamp });

            expect(result.valid).toBe(true);
        });

        it("rejects a tampered payload", () => {
            expect.assertions(1);

            const signature = cryptoSign("sha256", Buffer.from(timestamp + payload), { dsaEncoding: "der", key: privateKey }).toString("base64");

            const result = verifySendGridWebhook({ payload: "[]", publicKey: publicKeyBase64, signature, timestamp });

            expect(result.valid).toBe(false);
        });
    });

    describe(verifySnsMessage, () => {
        // Throwaway self-signed cert (CN=sns.amazonaws.com) and its key — fixtures only, never real.
        const certificatePem = [
            "-----BEGIN CERTIFICATE-----",
            "MIIDGTCCAgGgAwIBAgIUXmc1IJXJvpuSYp43k9xBJaOpEVMwDQYJKoZIhvcNAQEL",
            "BQAwHDEaMBgGA1UEAwwRc25zLmFtYXpvbmF3cy5jb20wHhcNMjYwNjAyMjEwNjU2",
            "WhcNMzYwNTMwMjEwNjU2WjAcMRowGAYDVQQDDBFzbnMuYW1hem9uYXdzLmNvbTCC",
            "ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAN7CvMDoXZjhCTijqJiWxbMa",
            "8nqJUco9ur8I7pnHFCcTznFeMF+tHnf0pDvOp+T4RioTUvWgdnFz6KsYKRZfyoRF",
            "OuuP3ffpqpEtV40kJT/q8fWiLoXdkhmPhgIOnwYCEMSWxK1fcbhTC79ev78knkp4",
            "Sxw3UINc9Y8C0WEBgv3W7Jh+EkVAhObYiYfJrE0Jb4SpEPUwl4HtHDDDhfnBGh30",
            "CGGDaZzbH+uq0PHfjeYos+EAoe+iGcxWg9hRgreYTrhBizZuaZy+lWhT6KWHh4oG",
            "5fbjWzuZ4POE8UDGBwxNhLLf8Hxjw8oV46ZIlIWffRyodpbfhePYSttsN/naTbsC",
            "AwEAAaNTMFEwHQYDVR0OBBYEFCh5NnrBY4TphTmDZRxazxgZppPIMB8GA1UdIwQY",
            "MBaAFCh5NnrBY4TphTmDZRxazxgZppPIMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI",
            "hvcNAQELBQADggEBAEVqyWANQMANIiVcKaokwdWGFEk/u8YPWIC8F562722OYI1A",
            "4azn+OxymorAp8RLMB4NYNHiGKnhYODLDZJP6BgqfeRSsrn9z7fsDIt1Nq0/No/1",
            "clj6DFyXRbmRegSHxr550QIS4gMW3+D9vrp/Z0UcTodJf/YbNgz5HwMp7veezHKV",
            "CHfFM7qQVTT743SRsXrlW0VeSFbK4v6LwvrFvbK8QjvHScYE0c+/hLKrIBaWXW+F",
            "rmqXkAI3PKs0sy7bAZXOiRCgvUIZnK9yD+4xLPna2aTtzG/pV6RT/+PJqO0bHNrv",
            "hLdHHl8tDFIMkX8DjVSTeq6IBbjpXZhsW37D/Cw=",
            "-----END CERTIFICATE-----",
        ].join("\n");

        const privateKeyDerBase64
            = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDewrzA6F2Y4Qk4o6iYlsWzGvJ6iVHKPbq/CO6ZxxQnE85xXjBfrR539KQ7zqfk+EYqE1L1oHZxc+irGCkWX8qERTrrj9336aqRLVeNJCU/6vH1oi6F3ZIZj4YCDp8GAhDElsStX3G4Uwu/Xr+/JJ5KeEscN1CDXPWPAtFhAYL91uyYfhJFQITm2ImHyaxNCW+EqRD1MJeB7Rwww4X5wRod9Ahhg2mc2x/rqtDx343mKLPhAKHvohnMVoPYUYK3mE64QYs2bmmcvpVoU+ilh4eKBuX241s7meDzhPFAxgcMTYSy3/B8Y8PKFeOmSJSFn30cqHaW34Xj2ErbbDf52k27AgMBAAECggEAH7rPVg8DHf6X6KhvIGUBfhSNi2S58LvAOOvVyLOxrCtHEaDf9RDcsSt4pUg3ZAb1P5MHExOrK1feQVisqZI1b4fI77rLXD+9WvaBbQpEAAnAM0PJqqm34MovxWU9w4ZRyx7KnwNkWGQD3VtqpphZr7PYxwkd/8gi9h7pog6sEOnjKZr70Knw6NmaroQvDw9SWzRkew5YRN+olUpi/tRvaTQop5sYAXm8uXEbNiI3JNiqz41iMpWLLVCKZ932fMxCovcbU9Vizq6xd/Bu7mVJp+RFSWQHAGS7IHSOSba763mJ+QhPb12wcL4E3aMasD2IPQaXWPyabB4BresTSG/UsQKBgQD58tl4IBEPfro7KqnQnvfknoKUbADEr7jF3FYVnKwfMI9oM+QA6Wy2fWTd+MAK39qTQPtL2QBqf3umN52ttMXzGFtTuOcBTIqqqZcW91vkVyPCgD5mPwvUsjYF2hraYpcMU+KlprNlLpl8a4DNCC1TIrCjeJ4tknCPGes3ZjuMaQKBgQDkJ2FgC03bEm7Hrsu746TZ5Gbw08+42EtjVHuw/smdAtmlejlSQLKb6a8172dFnw9rPSc2HQA/hnPQszQOMilxjq8rXueQkcJS8AxL4osuH0gGfGUMjzJULqs8EviS+ZXZ5sGbB8ng/r8+2A5U2YBNLFKWOMZ5yFR1zNYstvdUgwKBgQCs+ENInyBPUcq88TxNNAWmv47r+YXalyROQLmOATsX5noHiYlqnB7wdvxbpC36GInhR6HgDk78ZDaEg45pzGUEYsGowZeTTY3UpsH5UbrU3PzROAB2r4CXc7BxAkt8/6c6D78UFbWl+saa1KZwvQzosGP+7JTCQsoELdKaJvRkqQKBgFxuk+WsTrt9SUI+z61sOaJJBWd1+Ibjog847++yGY4x1GlVDhoDuhiuYNySBB3RphaFLPigYTRbTVp075b8vYuTCeahSWFpm/er5t9rhYWHCNAP34RqEzLFwXvSF8C7uvkPosojKqerrWFReOTpRTB+z2qqz8YQ4h7jgLWW3rbvAoGAVb3bzeAvmf8Pia1Ewbf5MbRoafca78rDbWLb3fbW91MYsD3WcGM1YrMO77SQoPZmlcUcc54KttEYtYBa+d5MYqYIIDp1J959cCcrgxCX38G2BAFAaCetDmEvbGRCv6Bs4wtbbkWjRhGy3pSenQyVXf3LeGNPOKfOqdubbbKO68o=";

        const buildSignedMessage = (): Record<string, string> => {
            const message: Record<string, string> = {
                Message: "delivery notification",
                MessageId: "1234",
                Timestamp: "2026-06-02T21:00:00.000Z",
                TopicArn: "arn:aws:sns:us-east-1:000:topic",
                Type: "Notification",
            };

            const stringToSign = ["Message", "MessageId", "Timestamp", "TopicArn", "Type"].map((key) => `${key}\n${message[key]}\n`).join("");

            const privateKey = createPrivateKey({ format: "der", key: Buffer.from(privateKeyDerBase64, "base64"), type: "pkcs8" });
            const signature = createSign("RSA-SHA1").update(stringToSign, "utf8").sign(privateKey, "base64");

            return {
                ...message,
                Signature: signature,
                SignatureVersion: "1",
                SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
            };
        };

        const resolver = () => certificatePem;

        it("accepts a validly signed notification", async () => {
            expect.assertions(1);

            const result = await verifySnsMessage(buildSignedMessage(), { certificateResolver: resolver });

            expect(result.valid).toBe(true);
        });

        it("rejects a tampered message body", async () => {
            expect.assertions(1);

            const message = { ...buildSignedMessage(), Message: "i was tampered with" };
            const result = await verifySnsMessage(message, { certificateResolver: resolver });

            expect(result.valid).toBe(false);
        });

        it("rejects a message without a signature", async () => {
            expect.assertions(2);

            const result = await verifySnsMessage({ Type: "Notification" }, { certificateResolver: resolver });

            expect(result.valid).toBe(false);
            expect(result.reason).toBe("missing-signature");
        });
    });

    describe(isValidSigningCertUrl, () => {
        it("accepts amazonaws.com https URLs", () => {
            expect.assertions(2);
            expect(isValidSigningCertUrl("https://sns.us-east-1.amazonaws.com/x.pem")).toBe(true);
            expect(isValidSigningCertUrl("https://amazonaws.com/x.pem")).toBe(true);
        });

        it("rejects non-AWS or non-https URLs", () => {
            expect.assertions(3);
            expect(isValidSigningCertUrl("http://sns.us-east-1.amazonaws.com/x.pem")).toBe(false);
            expect(isValidSigningCertUrl("https://evil.com/x.pem")).toBe(false);
            expect(isValidSigningCertUrl("https://amazonaws.com.evil.com/x.pem")).toBe(false);
        });
    });
});
