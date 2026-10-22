import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMail } from "../src/mail";
import MailMessage from "../src/mail-message";
import type { Provider } from "../src/providers/provider";
import { resendProvider } from "../src/providers/resend/index";
import type { ResendEmailOptions } from "../src/providers/resend/types";
import type { EmailOptions, FeatureFlags } from "../src/types";
import { makeRequest } from "../src/utils/make-request";
import checkFeatureSupport from "../src/utils/validation/check-feature-support";

vi.mock(import("../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

vi.mock(import("../src/utils/retry"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

const okResponse = {
    data: { body: { id: "message-id" }, headers: {}, statusCode: 200 },
    success: true,
};

const baseOptions: ResendEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Hi</h1>",
    subject: "Hi",
    to: { email: "user@example.com" },
};

describe("idempotencyKey", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("resend provider", () => {
        it("sends the key as an Idempotency-Key HTTP header", async () => {
            expect.assertions(1);

            vi.mocked(makeRequest).mockResolvedValue(okResponse);

            const provider = resendProvider({ apiKey: "re_test123" });

            await provider.sendEmail({ ...baseOptions, idempotencyKey: "order-42-confirmation" });

            const [, requestOptions] = vi.mocked(makeRequest).mock.calls[0] ?? [];

            expect(requestOptions?.headers).toMatchObject({ "Idempotency-Key": "order-42-confirmation" });
        });

        it("keeps the key out of the JSON body", async () => {
            expect.assertions(2);

            vi.mocked(makeRequest).mockResolvedValue(okResponse);

            const provider = resendProvider({ apiKey: "re_test123" });

            await provider.sendEmail({ ...baseOptions, idempotencyKey: "order-42-confirmation" });

            const body = (vi.mocked(makeRequest).mock.calls[0] ?? [])[2];

            expect(String(body)).not.toContain("order-42-confirmation");
            expect(String(body)).not.toContain("Idempotency");
        });

        it("omits the header when no key is set", async () => {
            expect.assertions(1);

            vi.mocked(makeRequest).mockResolvedValue(okResponse);

            const provider = resendProvider({ apiKey: "re_test123" });

            await provider.sendEmail(baseOptions);

            const [, requestOptions] = vi.mocked(makeRequest).mock.calls[0] ?? [];

            expect(requestOptions?.headers).not.toHaveProperty("Idempotency-Key");
        });

        it.each([
            ["contains a space", "order 42"],
            ["contains a line break", "order\r\nX-Injected: 1"],
            ["is empty", ""],
            ["exceeds 256 characters", "k".repeat(257)],
        ])("rejects a key that %s without calling the API", async (_label, key) => {
            expect.assertions(2);

            vi.mocked(makeRequest).mockClear();

            const provider = resendProvider({ apiKey: "re_test123" });
            const result = await provider.sendEmail({ ...baseOptions, idempotencyKey: key });

            expect(result.success).toBe(false);
            expect(makeRequest).not.toHaveBeenCalled();
        });

        it("accepts a key of exactly 256 characters", async () => {
            expect.assertions(1);

            vi.mocked(makeRequest).mockResolvedValue(okResponse);

            const provider = resendProvider({ apiKey: "re_test123" });
            const result = await provider.sendEmail({ ...baseOptions, idempotencyKey: "k".repeat(256) });

            expect(result.success).toBe(true);
        });

        it("declares the idempotency feature", () => {
            expect.assertions(1);

            expect(resendProvider({ apiKey: "re_test123" }).features?.idempotency).toBe(true);
        });
    });

    describe("message builder", () => {
        it("carries the key onto the built options", async () => {
            expect.assertions(1);

            const built = await new MailMessage()
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Hi")
                .text("Body")
                .idempotencyKey("order-42")
                .build();

            expect(built.idempotencyKey).toBe("order-42");
        });

        it("leaves the key unset when the builder never received one", async () => {
            expect.assertions(1);

            const built = await new MailMessage().from("sender@example.com").to("user@example.com").subject("Hi").text("Body").build();

            expect(built).not.toHaveProperty("idempotencyKey");
        });
    });

    describe("capability guard", () => {
        const message: EmailOptions = {
            from: { email: "sender@example.com" },
            idempotencyKey: "order-42",
            subject: "Hi",
            text: "Body",
            to: { email: "user@example.com" },
        };

        it("flags a provider that declares no idempotency support", () => {
            expect.assertions(2);

            const features: FeatureFlags = { idempotency: false };
            const { supported, violations } = checkFeatureSupport(message, features);

            expect(supported).toBe(false);
            expect(violations[0]?.feature).toBe("idempotency");
        });

        it("does not flag a provider that has not declared the capability", () => {
            expect.assertions(1);

            expect(checkFeatureSupport(message, {}).supported).toBe(true);
        });
    });

    describe("through Mail", () => {
        it("reaches the Resend Idempotency-Key header via mail.send()", async () => {
            expect.assertions(1);

            vi.mocked(makeRequest).mockResolvedValue(okResponse);

            const mail = createMail(resendProvider({ apiKey: "re_test123" }));

            await mail.send(
                new MailMessage()
                    .from("sender@example.com")
                    .to("user@example.com")
                    .subject("Hi")
                    .text("Body")
                    .idempotencyKey("order-42-confirmation"),
            );

            const [, requestOptions] = vi.mocked(makeRequest).mock.calls[0] ?? [];

            expect(requestOptions?.headers).toMatchObject({ "Idempotency-Key": "order-42-confirmation" });
        });

        it("does not copy a batch-level key onto each personalized message", async () => {
            expect.assertions(2);

            const sent: EmailOptions[] = [];
            const provider: Provider = {
                initialize: () => {},
                isAvailable: () => true,
                sendEmail: (options) => {
                    sent.push(options);

                    return { data: { messageId: "id", sent: true, timestamp: new Date(0) }, success: true };
                },
            };

            // `to` is replaced per personalization, so the placeholder only satisfies build().
            const base = new MailMessage()
                .from("sender@example.com")
                .to("placeholder@example.com")
                .subject("Hi")
                .text("Body")
                .idempotencyKey("campaign-7");

            const receipts = [];

            for await (const receipt of createMail(provider).sendBatch(base, [{ to: { email: "a@example.com" } }, { to: { email: "b@example.com" } }])) {
                receipts.push(receipt);
            }

            expect(receipts).toHaveLength(2);
            expect(sent.map((options) => options.idempotencyKey)).toStrictEqual([undefined, undefined]);
        });
    });

    it("never writes the key into the EML draft", async () => {
        expect.assertions(1);

        const provider: Provider = {
            initialize: () => {},
            isAvailable: () => true,
            sendEmail: () => {
                return { data: { messageId: "id-1", sent: true, timestamp: new Date(0) }, success: true };
            },
        };

        const eml = await createMail(provider).draft({ ...baseOptions, idempotencyKey: "order-42-confirmation" });

        expect(eml).not.toContain("order-42-confirmation");
    });
});
