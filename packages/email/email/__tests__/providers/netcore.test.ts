import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { netcoreProvider } from "../../src/providers/netcore/index";
import type { NetcoreEmailOptions } from "../../src/providers/netcore/types";
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

describe(netcoreProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when apiKey is missing", () => {
        expect.assertions(1);

        expect(() => netcoreProvider({} as any)).toThrow(RequiredOptionError);
    });

    it("uses the default v5.1 endpoint", () => {
        expect.assertions(2);

        const provider = netcoreProvider({ apiKey: "k" });

        expect(provider.name).toBe("netcore");
        expect(provider.options?.endpoint).toBe("https://emailapi.netcorecloud.net/v5.1");
    });

    it("sends and returns the message id", async () => {
        expect.assertions(3);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: { data: { message_id: "msg-1" } }, statusCode: 200 }, success: true });

        const provider = netcoreProvider({ apiKey: "k" });
        const options: NetcoreEmailOptions = { from: { email: "from@x.com" }, html: "<b>Hi</b>", subject: "Hi", to: { email: "to@x.com" } };
        const result = await provider.sendEmail(options);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("msg-1");

        const [url] = makeRequestMock.mock.calls[0];

        expect(String(url)).toContain("/mail/send");
    });
});
