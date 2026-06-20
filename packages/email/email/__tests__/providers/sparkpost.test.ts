import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { sparkpostProvider } from "../../src/providers/sparkpost/index";
import type { SparkPostEmailOptions } from "../../src/providers/sparkpost/types";
import { makeRequest } from "../../src/utils/make-request";

vi.mock(import("../../src/utils/make-request"), () => {
    return { makeRequest: vi.fn() };
});
vi.mock(import("../../src/utils/retry"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(sparkpostProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when apiKey is missing", () => {
        expect.assertions(1);

        expect(() => sparkpostProvider({} as any)).toThrow(RequiredOptionError);
    });

    it("uses the default endpoint and provider name", () => {
        expect.assertions(2);

        const provider = sparkpostProvider({ apiKey: "k" });

        expect(provider.name).toBe("sparkpost");
        expect(provider.options?.endpoint).toBe("https://api.sparkpost.com/api/v1");
    });

    it("sends and returns the transmission id", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: { results: { id: "11668787484950529" } }, statusCode: 200 }, success: true });

        const provider = sparkpostProvider({ apiKey: "k" });
        const options: SparkPostEmailOptions = {
            from: { email: "from@x.com", name: "From" },
            html: "<h1>Hi</h1>",
            subject: "Hi",
            to: { email: "to@x.com" },
        };

        const result = await provider.sendEmail(options);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("11668787484950529");

        const [url] = makeRequestMock.mock.calls[0];

        expect(String(url)).toContain("/transmissions");
    });

    it("propagates failure from the API", async () => {
        expect.assertions(1);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ error: new Error("invalid key"), success: false });

        const provider = sparkpostProvider({ apiKey: "k" });
        const result = await provider.sendEmail({ from: { email: "f@x.com" }, subject: "s", text: "t", to: { email: "t@x.com" } });

        expect(result.success).toBe(false);
    });
});
