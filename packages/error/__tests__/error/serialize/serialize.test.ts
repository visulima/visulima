// eslint-disable-next-line max-classes-per-file
import Stream from "node:stream";

import { describe, expect, it } from "vitest";

import type { SerializedError } from "../../../src";
import { serialize } from "../../../src/error/serialize/serialize";

describe("error serializer", () => {
    it("should serializes Error objects", () => {
        expect.assertions(3);

        const serialized = serialize(new Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should serializes Error objects with extra properties", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { statusCode: number };
        error.statusCode = 500;

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it('serializes Error objects with subclass "name"', () => {
        expect.assertions(1);

        class MyError extends Error {}

        const error = new MyError("foo");
        const serialized = serialize(error);

        expect(serialized.name).toBe("MyError");
    });

    it("should serializes nested errors", () => {
        expect.assertions(7);

        const error = new Error("foo") as Error & { inner: Error };
        error.inner = new Error("bar");

        const serialized = serialize(error);

        const serializedInner = serialized.inner as SerializedError;

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("serialize.test.ts:");
        expect(serializedInner.name).toBe("Error");
        expect(serializedInner.message).toBe("bar");
        expect(serializedInner.stack).toContain("Error: bar");
        expect(serializedInner.stack).toContain("serialize.test.ts:");
    });

    it("should serializes error causes", () => {
        expect.assertions(9);

        const innerError = new Error("inner");
        const middleError = new Error("middle") as Error & { cause: Error };
        middleError.cause = innerError;

        const outerError = new Error("outer") as Error & { cause: Error };
        outerError.cause = middleError;

        const serialized = serialize(outerError);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("outer");
        expect(serialized.stack).toContain("serialize.test.ts:");

        const serializedCause = serialized.cause as SerializedError;

        expect(serializedCause.name).toBe("Error");
        expect(serializedCause.message).toBe("middle");
        expect(serializedCause.stack).toContain("serialize.test.ts:");

        const serializedCauseCause = (serialized.cause as SerializedError).cause as SerializedError;

        expect(serializedCauseCause.name).toBe("Error");
        expect(serializedCauseCause.message).toBe("inner");
        expect(serializedCauseCause.stack).toContain("serialize.test.ts:");
    });

    it("should keeps non-error cause", () => {
        expect.assertions(3);

        const error = new Error("foo") as Error & { cause: string };
        error.cause = "abc";

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("should prevents infinite recursion", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { inner: Error };
        error.inner = error;

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("serialize.test.ts:");
        expect(serialized.inner).toBe("[Circular]");
    });

    it("should cleans up infinite recursion tracking", () => {
        expect.assertions(8);

        const error = new Error("foo") as Error & { inner: Error };
        const bar = new Error("bar") as Error & { inner: Error };
        error.inner = bar;
        bar.inner = error;

        serialize(error);
        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("serialize.test.ts:");

        expect(serialized.inner).toBeDefined();

        const serializedInner = serialized.inner as SerializedError;

        expect(serializedInner.name).toBe("Error");
        expect(serializedInner.message).toBe("bar");
        expect(serializedInner.stack).toContain("Error: bar");
        expect(serializedInner.inner).toBe("[Circular]");
    });

    it("should redefined err.constructor doesnt crash serializer", () => {
        expect.assertions(10);

        const check = (a: Error, name: string): void => {
            expect(a.name).toBe(name);
            expect(a.message).toBe("foo");
        };

        const error1 = TypeError("foo");
        // @ts-expect-error -- testing invalid assignment
        error1.constructor = "10";

        const error2 = TypeError("foo");
        error2.constructor = undefined;

        const error3 = new Error("foo");
        error3.constructor = null;

        const error4 = new Error("foo");
        // @ts-expect-error -- testing invalid assignment
        error4.constructor = 10;

        class MyError extends Error {}

        const error5 = new MyError("foo");
        error5.constructor = undefined;

        check(serialize(error1), "TypeError");
        check(serialize(error2), "TypeError");
        check(serialize(error3), "Error");
        check(serialize(error4), "Error");
        // We do not expect 'MyError' because err5.constructor has been blown away.
        // `err5.name` is 'Error' from the base class protoname.
        check(serialize(error5), "Error");
    });

    it.skipIf(!global.AggregateError)("serializes aggregate errors", () => {
        expect.assertions(14);

        const foo = new Error("foo");
        const bar = new Error("bar");

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const aggregate of [
            // @ts-expect-error -- Web API
            new AggregateError([foo, bar], "aggregated message"),
            { errors: [foo, bar], message: "aggregated message", stack: "serialize.test.ts:" },
        ]) {
            const serialized = serialize(aggregate);

            expect(serialized.message).toBe("aggregated message");
            expect(serialized.errors).toHaveLength(2);
            expect(serialized.errors[0].message).toBe("foo");
            expect(serialized.errors[1].message).toBe("bar");
            expect(serialized.errors[0].stack).toContain("Error: foo");
            expect(serialized.errors[1].stack).toContain("Error: bar");
            expect(serialized.stack).toContain("serialize.test.ts:");
        }
    });

    it("should serialize error with non-configurable properties", () => {
        expect.assertions(2);

        const error = new Error("foo");
        Object.defineProperty(error, "message", {
            configurable: false,
            value: "bar",
        });

        const serialized = serialize(error);

        expect(serialized.message).toBe("bar");
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should serialize a full error", () => {
        expect.assertions(9);

        // Error with `cause` and `errors` set
        const error = Object.defineProperties(new Error("test"), {
            cause: {
                configurable: true,
                enumerable: false,
                value: new Error("inner"),
                writable: true,
            },
            errors: {
                configurable: true,
                enumerable: false,
                value: [new Error("otherInner")],
                writable: true,
            },
        });

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("test");
        expect(serialized.stack).toContain("serialize.test.ts:");

        expect(serialized.cause.name).toBe("Error");
        expect(serialized.cause.message).toBe("inner");
        expect(serialized.cause.stack).toContain("Error: inner");

        expect(serialized.errors[0].name).toBe("Error");
        expect(serialized.errors[0].message).toBe("otherInner");
        expect(serialized.errors[0].stack).toContain("Error: otherInner");
    });

    it("should handle recursion in cause", () => {
        expect.assertions(1);

        const recursiveCauseError = new Error("test");
        recursiveCauseError.cause = recursiveCauseError;

        expect(serialize(recursiveCauseError).cause).toBe("[Circular]");
    });

    it.skipIf(!global.AggregateError)("should handle recursion in aggregate errors", () => {
        expect.assertions(2);

        const recursiveAggregateError = new AggregateError([], "test");
        recursiveAggregateError.errors = [recursiveAggregateError];

        const serialized = serialize(recursiveAggregateError);

        expect(Array.isArray(serialized.errors)).toBeTruthy();
        expect(serialized.errors).toHaveLength(0);
    });

    // eslint-disable-next-line no-secrets/no-secrets
    /**
     * Copied and modified tests from `https://github.com/sindresorhus/serialize-error/blob/29b0fcb5d1a00b173a6702235bca148434baf726/test.js`
     *
     * The original tests are licensed under MIT License.
     *
     * MIT License
     * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
     */
    it("should not affect the original object", () => {
        expect.assertions(2);

        const object: Error & { child?: { parent: Error } } = new Error("foo");
        object.child = { parent: object };

        const serialized = serialize(object);

        expect(serialized).not.toBe(object);
        expect(object.child.parent).toBe(object);
    });

    it("should only destroy parent references", () => {
        expect.assertions(4);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error: Error & { one?: any; two?: any } = new Error("foo");

        const common = { thing: error };
        error.one = { firstThing: common };
        error.two = { secondThing: common };

        const serialized = serialize(error);

        expect(serialized.one.firstThing).toBeTypeOf("object");
        expect(serialized.two.secondThing).toBeTypeOf("object");
        expect(serialized.one.firstThing.thing).toBe("[Circular]");
        expect(serialized.two.secondThing.thing).toBe("[Circular]");
    });

    it("should discard nested functions", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-style
        function a() {}
        // eslint-disable-next-line func-style
        function b() {}
        a.b = b;

        const error = new Error("foo") as Error & { a: VoidFunction };
        error.a = a;

        const serialized = serialize(error);

        expect(serialized.a).toBe("[Function: a]");
    });

    it("should serialize Date as ISO string", () => {
        expect.assertions(1);

        const error = new Error("foo") as Error & { date: Date };
        error.date = new Date(0);

        const serialized = serialize(error);

        expect(serialized.date).toStrictEqual(error.date.toISOString());
    });

    it("should discard buffers", () => {
        expect.assertions(1);

        const error = new Error("foo") as Error & { a: Buffer };
        error.a = Buffer.from("test");

        const serialized = serialize(error);

        expect(serialized.a).toBe("[object Buffer]");
    });

    it.each([
        ["Stream.Stream", new Stream.Stream()],
        ["Stream.Readable", new Stream.Readable()],
        ["Stream.Writable", new Stream.Writable()],
        ["Stream.Duplex", new Stream.Duplex()],
        ["Stream.Transform", new Stream.Transform()],
        ["Stream.PassThrough", new Stream.PassThrough()],
    ])("should discard stream '%s'", (_, stream) => {
        expect.assertions(1);

        const error = new Error("foo") as Error & { s: Stream };
        error.s = stream;

        const serialized = serialize(error);

        expect(serialized.s).toBe("[object Stream]");
    });

    it("should serialize custom error with `.toJSON`", () => {
        expect.assertions(2);

        class CustomError extends Error {
            private readonly value: number;

            public constructor() {
                super("foo");
                this.name = this.constructor.name;
                this.value = 10;
            }

            public toJSON() {
                return {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    amount: `$${this.value}`,
                    message: this.message,
                };
            }
        }
        const error = new CustomError();
        const serialized = serialize(error, { useToJSON: true });

        expect(serialized).toStrictEqual({
            amount: "$10",
            message: "foo",
        });
        expect(serialized.stack).toBeUndefined();
    });

    it("should serialize custom error with a property having `.toJSON`", () => {
        expect.assertions(2);

        class CustomError extends Error {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            private readonly value: any;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            public constructor(value: any) {
                super("foo");
                this.name = this.constructor.name;
                this.value = value;
            }
        }

        const value = {
            amount: 20,
            toJSON() {
                return {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    amount: `$${this.amount}`,
                };
            },
        };

        const error = new CustomError(value);

        const serialized = serialize(error, { useToJSON: true });

        const { stack, ...rest } = serialized;

        expect(rest).toStrictEqual({
            message: "foo",
            name: "CustomError",
            value: {
                amount: "$20",
            },
        });
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should serialize custom error with `.toJSON` defined with `serialize`", () => {
        expect.assertions(2);

        class CustomError extends Error {
            private readonly value: number;

            public constructor() {
                super("foo");
                this.name = this.constructor.name;
                this.value = 30;
            }

            public toJSON() {
                return serialize(this);
            }
        }

        const error = new CustomError();

        const serialized = serialize(error, { useToJSON: true });

        const { stack, ...rest } = serialized;

        expect(rest).toStrictEqual({
            message: "foo",
            name: "CustomError",
            value: 30,
        });
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should serialize custom non-extensible error with custom `.toJSON` property", () => {
        expect.assertions(2);

        class CustomError extends Error {
            public constructor() {
                super("foo");
                this.name = this.constructor.name;
            }

            public toJSON() {
                return this;
            }
        }

        const error = Object.preventExtensions(new CustomError());
        const serialized = serialize(error, { useToJSON: true });

        const { stack, ...rest } = serialized;

        expect(rest).toStrictEqual({
            name: "CustomError",
        });
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should ignore `.toJSON` methods if set in the options", () => {
        expect.assertions(1);

        class CustomError extends Error {
            private readonly value: number;

            public constructor() {
                super("foo");
                this.name = this.constructor.name;
                this.value = 10;
            }

            public toJSON() {
                return {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    amount: `$${this.value}`,
                    message: this.message,
                };
            }
        }

        const error = new CustomError();
        const serialized = serialize(error, { useToJSON: false });

        expect(serialized).toStrictEqual({
            message: "foo",
            name: "CustomError",
            stack: expect.any(String),
            value: 10,
        });
    });

    it("should serialize properties up to `Options.maxDepth` levels deep", () => {
        expect.assertions(4);

        const error = new Error("errorMessage") as Error & { one: { two: { three: Record<string, string> } } };
        error.one = { two: { three: {} } };

        const { message, name, stack } = error;

        const levelZero = serialize(error, { maxDepth: 0 });

        expect(levelZero).toStrictEqual({});

        const levelOne = serialize(error, { maxDepth: 1 });

        expect(levelOne).toStrictEqual({ message, name, one: {}, stack });

        const levelTwo = serialize(error, { maxDepth: 2 });

        expect(levelTwo).toStrictEqual({ message, name, one: { two: {} }, stack });

        const levelThree = serialize(error, { maxDepth: 3 });

        expect(levelThree).toStrictEqual({ message, name, one: { two: { three: {} } }, stack });
    });

    it.runIf("DOMException" in globalThis)("should serialize DOMException", () => {
        expect.assertions(1);

        const serialized = serialize(new DOMException("x"));

        expect(serialized.message).toBe("x");
    });
});
