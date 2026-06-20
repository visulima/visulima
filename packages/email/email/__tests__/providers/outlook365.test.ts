import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { outlook365Provider } from "../../src/providers/outlook365/index";
import type { Outlook365EmailOptions } from "../../src/providers/outlook365/types";
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

describe(outlook365Provider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when neither accessToken nor getAccessToken is provided", () => {
        expect.assertions(1);

        expect(() => outlook365Provider({} as any)).toThrow(RequiredOptionError);
    });

    it("calls getAccessToken and posts to the me/sendMail endpoint", async () => {
        expect.assertions(4);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: "", statusCode: 202 }, success: true });

        const getAccessToken = vi.fn().mockResolvedValue("ya29.token");
        const provider = outlook365Provider({ getAccessToken });
        const options: Outlook365EmailOptions = { from: { email: "from@x.com" }, html: "<p>Hi</p>", subject: "Hi", to: { email: "to@x.com" } };
        const result = await provider.sendEmail(options);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBeDefined();
        expect(getAccessToken).toHaveBeenCalledTimes(1);

        const [url] = makeRequestMock.mock.calls[0];

        expect(String(url)).toContain("/me/sendMail");
    });

    it("targets a specific mailbox when userId is set", async () => {
        expect.assertions(1);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: "", statusCode: 202 }, success: true });

        const provider = outlook365Provider({ accessToken: "tok", userId: "sender@contoso.com" });

        await provider.sendEmail({ from: { email: "from@x.com" }, subject: "s", text: "t", to: { email: "t@x.com" } });

        expect(String(makeRequestMock.mock.calls[0][0])).toContain("/users/sender@contoso.com/sendMail");
    });
});
