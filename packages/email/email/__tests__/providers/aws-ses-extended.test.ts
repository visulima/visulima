import { beforeEach, describe, expect, it, vi } from "vitest";

import { awsSesProvider } from "../../src/providers/aws-ses/index";
import type { AwsSesEmailOptions } from "../../src/providers/aws-ses/types";
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
});
