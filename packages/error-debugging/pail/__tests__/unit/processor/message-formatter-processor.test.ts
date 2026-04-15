import { describe, expect, it } from "vitest";

import MessageFormatterProcessor from "../../../src/processor/message-formatter-processor";
import type { Meta } from "../../../src/types";

describe("messageFormatterProcessor", () => {
    it("should format message array with formatters and serializers", () => {
        expect.assertions(1);

        const formatters = {
            u: (argument: any) => argument.toUpperCase(),
        };

        const processor = new MessageFormatterProcessor({ formatters });

        const meta: Meta<string> = {
            badge: undefined,
            context: ["UPPERCASE"],
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: "%uHello world",
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("UPPERCASEHello world");
    });

    it("should not change message array with no remaining elements", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: "Hello",
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello");
    });

    it("should not change message if its a array", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: ["Hello"],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toStrictEqual(["Hello"]);
    });

    it("should format message array with default build function", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: ["world"],
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: ["Hello %s"],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toStrictEqual(["Hello world"]);
    });

    // Given a MessageFormatterProcessor instance with no options provided, when calling process() with a Meta object containing a message array with a string as the first element and an object as the second element, and the object contains a circular reference, then the function should not crash and the message property of the Meta object should be assigned a string representation of the object.
    it("should handle circular reference in object", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const object: any = { prop: "value" };

        object.circular = object;

        const meta: Meta<string> = {
            badge: undefined,
            context: [object],
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: "Hello %o",
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello \"[Circular]\"");
    });

    // Given a MessageFormatterProcessor instance with no options provided, when calling process() with a Meta object containing a message array with a string as the first element and an object as the second element, and the object contains a function, then the function should be ignored and the message property of the Meta object should be assigned a string representation of the object.
    it("should ignore function in object", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const object: any = { func: () => {}, prop: "value" };

        const meta: Meta<string> = {
            badge: undefined,
            context: [object],
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: "Hello %o",
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello {\"prop\":\"value\"}");
    });
});
