import { beforeEach, describe, expect, it, vi } from "vitest";

import { outlook365Provider } from "../../src/providers/outlook365/index";
import { makeRequest } from "../../src/utils/make-request";

// Deliberately does NOT stub `retry` — these tests cover the token request's retry behaviour,
// which the stub in outlook365.test.ts short-circuits.
vi.mock(import("../../src/utils/make-request"), () => {
    return { makeRequest: vi.fn() };
});

const email = { from: { email: "from@x.com" }, subject: "s", text: "t", to: { email: "to@x.com" } };
const sendResponse = { data: { body: "", statusCode: 202 }, success: true };
const tokenResponse = { data: { body: { access_token: "graph-token", expires_in: 3600 }, statusCode: 200 }, success: true };

const config = { clientId: "client-id", clientSecret: "client-secret", tenantId: "tenant-id", userId: "sender@contoso.com" };

const tokenCalls = (): unknown[][] => (makeRequest as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes("/oauth2/v2.0/token"));

describe("outlook365 token retries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("retries a throttled token request and succeeds", async () => {
        expect.assertions(2);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock
            .mockResolvedValueOnce({ data: { body: { error: "temporarily_unavailable" }, statusCode: 429 }, success: false })
            .mockResolvedValueOnce(tokenResponse)
            .mockResolvedValueOnce(sendResponse);

        const result = await outlook365Provider({ ...config, retries: 1 }).sendEmail(email);

        expect(result.success).toBe(true);
        expect(tokenCalls()).toHaveLength(2);
    });

    it("retries a 5xx from the token endpoint", async () => {
        expect.assertions(2);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock
            .mockResolvedValueOnce({ data: { body: "gateway", statusCode: 503 }, success: false })
            .mockResolvedValueOnce(tokenResponse)
            .mockResolvedValueOnce(sendResponse);

        const result = await outlook365Provider({ ...config, retries: 1 }).sendEmail(email);

        expect(result.success).toBe(true);
        expect(tokenCalls()).toHaveLength(2);
    });

    it("does not retry a credential rejection, which can never succeed", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValue({
            data: { body: { error: "invalid_client", error_description: "AADSTS7000215: Invalid client secret provided." }, statusCode: 401 },
            success: false,
        });

        const result = await outlook365Provider({ ...config, retries: 3 }).sendEmail(email);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("AADSTS7000215");
        expect(tokenCalls()).toHaveLength(1);
    });
});
