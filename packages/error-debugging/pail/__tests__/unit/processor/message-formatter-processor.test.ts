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

    it("should leave the metadata untouched when the message is undefined", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: undefined,
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            message: undefined,
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

        expect(processedMeta.message).toBeUndefined();
    });

    it("should recursively format object message values of every type", () => {
        expect.assertions(1);

        const processor = new MessageFormatterProcessor();

        const meta: Meta<string> = {
            badge: undefined,
            context: [],
            date: new Date(),
            error: undefined,
            groups: [],
            label: undefined,
            // Mixed value types exercise the recursive branch for string, array, object, null, and primitive.
            message: { arr: ["a"], nested: { k: "v" }, nul: null, num: 5, str: "hello" },
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

        expect(processedMeta.message).toStrictEqual({ arr: ["a"], nested: { k: "v" }, nul: null, num: 5, str: "hello" });
    });

    // Passing `stringify` to `build()` replaces the guarded serializer `@visulima/fmt` would
    // otherwise use, so every way that callback can throw has to be handled here instead.
    describe("serializer failures", () => {
        const createMeta = (message: string, context: unknown[]): Meta<string> => {
            return {
                badge: undefined,
                context,
                date: new Date(),
                error: undefined,
                groups: [],
                label: undefined,
                message,
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
        };

        it("renders an indirect cycle as [Circular] instead of throwing", () => {
            expect.assertions(1);

            const processor = new MessageFormatterProcessor();

            const a: Record<string, unknown> = {};
            const b: Record<string, unknown> = {};
            const c: Record<string, unknown> = {};

            a.b = b;
            b.c = c;
            c.a = a;

            expect(processor.process(createMeta("Hello %o", [a])).message).toBe("Hello \"[Circular]\"");
        });

        it("serializes a repeated but acyclic reference normally", () => {
            expect.assertions(1);

            const processor = new MessageFormatterProcessor();
            const shared = { id: 1 };

            // The same object twice is not a cycle: `JSON.stringify` handles it, so the value must
            // survive intact rather than be written off as circular.
            expect(processor.process(createMeta("Hello %j", [{ left: shared, right: shared }])).message).toBe(
                "Hello {\"left\":{\"id\":1},\"right\":{\"id\":1}}",
            );
        });

        it("reports a supplied stringify that throws without crashing the log call", () => {
            expect.assertions(1);

            const processor = new MessageFormatterProcessor();

            processor.setStringify(() => {
                throw new Error("serializer exploded");
            });

            // A defect in the consumer's serializer must stay visible in the output — it is not a
            // cycle, so it must not be disguised as one.
            expect(processor.process(createMeta("Hello %o", [{ prop: "value" }])).message).toBe("Hello \"[unserializable: serializer exploded]\"");
        });

        it("prefers a supplied stringify over the built-in circular guard", () => {
            expect.assertions(1);

            const processor = new MessageFormatterProcessor();

            processor.setStringify((value: unknown) => `<${typeof value}>`);

            const object: Record<string, unknown> = { prop: "value" };

            object.circular = object;

            expect(processor.process(createMeta("Hello %o", [object])).message).toBe("Hello <object>");
        });
    });
});
