import { beforeEach, describe, expect, it, vi } from "vitest";

import { awsSesProvider } from "../../src/providers/aws-ses/index";
import type { AwsSesConfig, AwsSesEmailOptions } from "../../src/providers/aws-ses/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return {
        makeRequest: vi.fn(),
    };
});

const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

const config = { accessKeyId: "AKIA", region: "us-east-1", secretAccessKey: "secret" };

const baseEmail: AwsSesEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const sendOk = {
    data: {
        body: "<SendRawEmailResponse><SendRawEmailResult><MessageId>mid-1</MessageId></SendRawEmailResult></SendRawEmailResponse>",
        statusCode: 200,
    },
    success: true,
};

const lastBody = (): string => makeRequestMock.mock.calls.at(-1)?.[2] as string;

describe("aws-ses provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("isAvailable", () => {
        it("returns true when GetSendQuota reports a daily limit", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({
                data: { body: "<GetSendQuotaResponse><Max24HourSend>200.0</Max24HourSend></GetSendQuotaResponse>", statusCode: 200 },
                success: true,
            });

            const provider = awsSesProvider(config);

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("returns false when the request fails", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ error: new Error("denied"), success: false });

            const provider = awsSesProvider(config);

            await expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe("initialize", () => {
        it("runs without throwing", () => {
            expect.assertions(1);

            const provider = awsSesProvider(config);

            expect(() => provider.initialize()).not.toThrow();
        });
    });

    describe("validateCredentials", () => {
        it("delegates to isAvailable", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({
                data: { body: "<GetSendQuotaResponse><Max24HourSend>1.0</Max24HourSend></GetSendQuotaResponse>", statusCode: 200 },
                success: true,
            });

            const provider = awsSesProvider(config);

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });

    describe("sendEmail request errors", () => {
        it("fails when the underlying request is unsuccessful", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ error: new Error("network fail"), success: false });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("network fail");
        });

        it("fails when the response has no body", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: undefined, statusCode: 200 }, success: true });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("No response body");
        });

        it("parses an AWS error message on a non-2xx status", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({
                data: { body: "<ErrorResponse><Error><Message>Access denied</Message></Error></ErrorResponse>", statusCode: 403 },
                success: true,
            });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Access denied");
        });
    });

    describe("sendEmail SES-specific params", () => {
        it("appends configuration set, source ARN, return path and return path ARN", async () => {
            expect.assertions(5);

            makeRequestMock.mockResolvedValue(sendOk);

            const provider = awsSesProvider({ ...config, sessionToken: "session-token" });
            const result = await provider.sendEmail({
                ...baseEmail,
                configurationSetName: "my-config-set",
                returnPath: "bounce@example.com",
                returnPathArn: "arn:aws:ses:us-east-1:111:identity/example.com",
                sourceArn: "arn:aws:ses:us-east-1:111:identity/sender",
            });

            const body = lastBody();

            expect(result.success).toBe(true);
            expect(body).toContain("ConfigurationSetName=my-config-set");
            expect(body).toContain("SourceArn=");
            expect(body).toContain("ReturnPath=");
            expect(body).toContain("ReturnPathArn=");
        });
    });

    describe("branch coverage", () => {
        it("falls back to the default region and api version when they are blank", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue(sendOk);

            const provider = awsSesProvider({ ...config, apiVersion: "", region: "" });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
        });

        it("fails with a generic error when the request has no error object", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ success: false });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("AWS SES API request failed");
        });

        it("coerces a non-Error request failure", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ error: "string failure", success: false });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("string failure");
        });

        it("returns false from isAvailable when the quota response omits the limit", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue({ data: { body: "<GetSendQuotaResponse></GetSendQuotaResponse>", statusCode: 200 }, success: true });

            const provider = awsSesProvider(config);

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("uses a generic message when a non-2xx response lacks an error message", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue({ data: { body: "<ErrorResponse></ErrorResponse>", statusCode: 400 }, success: true });

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Unknown AWS SES error");
        });

        it("builds a MIME message for array recipients with a text-only body", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue(sendOk);

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail({
                bcc: [{ email: "b1@example.com" }, { email: "b2@example.com" }],
                cc: [{ email: "c1@example.com" }, { email: "c2@example.com" }],
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "plain text body",
                to: [{ email: "u1@example.com" }, { email: "u2@example.com" }],
            });

            expect(result.success).toBe(true);
        });

        it("builds a MIME message for single cc and bcc recipients", async () => {
            expect.assertions(1);

            makeRequestMock.mockResolvedValue(sendOk);

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail({
                ...baseEmail,
                bcc: { email: "b@example.com" },
                cc: { email: "c@example.com" },
            });

            expect(result.success).toBe(true);
        });

        it("skips undefined message tag values when building the request body", async () => {
            expect.assertions(2);

            makeRequestMock.mockResolvedValue(sendOk);

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail({
                ...baseEmail,
                messageTags: { tag1: "value1", tag2: undefined as unknown as string },
            });

            const body = lastBody();

            expect(result.success).toBe(true);
            expect(body).toContain("Tags.member.1.Value=value1");
        });

        it("initializes without throwing when credentials are absent", () => {
            expect.assertions(1);

            const provider = awsSesProvider({ region: "us-east-1" } as AwsSesConfig);

            expect(() => provider.initialize()).not.toThrow();
        });

        it("returns undefined from getInstance", () => {
            expect.assertions(1);

            const provider = awsSesProvider(config);

            expect(provider.getInstance?.()).toBeUndefined();
        });

        it("fails validation for invalid email options", async () => {
            expect.assertions(2);

            const provider = awsSesProvider(config);
            const result = await provider.sendEmail({ from: { email: "" }, subject: "", to: { email: "" } });

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Invalid email options");
        });
    });
});
