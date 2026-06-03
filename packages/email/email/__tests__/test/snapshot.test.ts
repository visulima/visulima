import { describe, expect, it } from "vitest";

import { toEmailSnapshot } from "../../src/test";
import type { EmailOptions } from "../../src/types";

describe(toEmailSnapshot, () => {
    it("normalizes EmailOptions into a stable snapshot, omitting volatile fields", () => {
        expect.assertions(1);

        const options: EmailOptions = {
            attachments: [{ content: "x", contentType: "application/pdf", filename: "invoice.pdf" }],
            cc: { email: "cc@x.com" },
            from: { email: "from@x.com", name: "Sender" },
            html: "<p>hi</p>",
            subject: "Hello",
            text: "hi",
            to: [{ email: "a@x.com" }, { email: "b@x.com", name: "B" }],
        };

        expect(toEmailSnapshot(options)).toStrictEqual({
            attachments: [{ contentType: "application/pdf", filename: "invoice.pdf" }],
            cc: ["cc@x.com"],
            from: "Sender <from@x.com>",
            html: "<p>hi</p>",
            subject: "Hello",
            text: "hi",
            to: ["a@x.com", "B <b@x.com>"],
        });
    });

    it("accepts a mock outbox entry", () => {
        expect.assertions(1);

        const entry = {
            id: "1",
            options: { from: { email: "a@x.com" }, subject: "S", to: { email: "b@x.com" } },
            result: { messageId: "m", provider: "mock", sent: true, timestamp: new Date(0) },
            timestamp: new Date(0),
        };

        expect(toEmailSnapshot(entry).to).toStrictEqual(["b@x.com"]);
    });
});
