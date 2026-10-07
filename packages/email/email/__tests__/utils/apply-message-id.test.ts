import { describe, expect, it } from "vitest";

import applyMessageId from "../../src/utils/apply-message-id";

const from = { email: "sender@example.com" };

describe(applyMessageId, () => {
    it("should generate a Message-ID on the sender's domain", () => {
        expect.assertions(2);

        const { headers, messageId } = applyMessageId({ from, headers: { "X-Custom": "1" } });

        // eslint-disable-next-line e18e/prefer-static-regex
        expect(messageId).toMatch(/@example\.com>$/);
        expect(headers).toStrictEqual({ "Message-ID": messageId, "X-Custom": "1" });
    });

    it("should keep a caller-supplied Message-ID regardless of header casing", () => {
        expect.assertions(2);

        const { headers, messageId } = applyMessageId({ from, headers: new Headers({ "message-id": "<mine@example.com>" }) });

        expect(messageId).toBe("<mine@example.com>");
        expect(headers).toStrictEqual({ "Message-ID": "<mine@example.com>" });
    });

    it("should strip CR/LF from a caller-supplied Message-ID", () => {
        expect.assertions(1);

        const { messageId } = applyMessageId({ from, headers: { "Message-ID": "<a@example.com>\r\nBcc: victim@example.com" } });

        expect(messageId).not.toContain("\n");
    });
});
