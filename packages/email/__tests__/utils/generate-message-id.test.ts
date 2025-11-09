import { describe, expect, it } from "vitest";

import { generateMessageId } from "../../src/utils/generate-message-id.js";

describe(generateMessageId, () => {
    it("should generate a message ID", () => {
        const messageId = generateMessageId();

        expect(messageId).toMatch(/^<.+@visulima\.local>$/);
    });

    it("should generate unique message IDs", () => {
        const id1 = generateMessageId();
        const id2 = generateMessageId();

        expect(id1).not.toBe(id2);
    });
});
