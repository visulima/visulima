import { describe, expect, it } from "vitest";

import { MessageFormatterProcessor } from "../../src/processor/message-formatter-processor";
import type { Meta } from "../../src/types";

describe("messageFormatterProcessor", () => {
    // Given a MessageFormatterProcessor instance, when calling process() with a Meta object containing a message array with a string as the first element and unknown values as the remaining elements, then the message should be formatted using the build function with the formatters and serializers provided in the constructor, and the resulting string should be assigned to the message property of the Meta object.
    it("should format message array with formatters and serializers", () => {
        expect.assertions(1);

        const formatters = {
            uppercase: (argument: any) => argument.toUpperCase(),
        };

        const serializers = [
            {
                isApplicable: (value: any) => typeof value === "string",
                name: "string",
                serialize: (value: any) => value.toUpperCase(),
            },
        ];

        const processor = new MessageFormatterProcessor({ formatters, serializers });

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: ["Hello", "world"],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("HELLO WORLD");
    });

    // Given a MessageFormatterProcessor instance, when calling process() with a Meta object containing a message array with a string as the first element and no remaining elements, then the message property of the Meta object should remain unchanged.
    it("should not change message array with no remaining elements", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: ["Hello"],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello");
    });

    // Given a MessageFormatterProcessor instance, when calling process() with a Meta object containing a message that is not an array, then the message property of the Meta object should remain unchanged.
    it("should not change message if not an array", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: "Hello",
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello");
    });

    // Given a MessageFormatterProcessor instance with no options provided, when calling process() with a Meta object containing a message array with a string as the first element and unknown values as the remaining elements, then the message should be formatted using the default build function, and the resulting string should be assigned to the message property of the Meta object.
    it("should format message array with default build function", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: ["Hello", "world"],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello world");
    });

    // Given a MessageFormatterProcessor instance with no options provided, when calling process() with a Meta object containing a message array with a string as the first element and an object as the second element, and the object contains a circular reference, then the function should not crash and the message property of the Meta object should be assigned a string representation of the object.
    it("should handle circular reference in object", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const object: any = { prop: "value" };
        object.circular = object;

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: ["Hello", object],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe("Hello [object Object]");
    });

    // Given a MessageFormatterProcessor instance with no options provided, when calling process() with a Meta object containing a message array with a string as the first element and an object as the second element, and the object contains a function, then the function should be ignored and the message property of the Meta object should be assigned a string representation of the object.
    it("should ignore function in object", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const object: any = { func: () => {}, prop: "value" };

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: undefined,
            label: undefined,
            message: ["Hello", object],
            prefix: undefined,
            repeated: undefined,
            scope: undefined,
            suffix: undefined,
            type: {
                level: "info",
                name: "test",
            },
        };

        const processedMeta = processor.process(meta);

        expect(processedMeta.message).toBe('Hello {"prop":"value"}');
    });
});
