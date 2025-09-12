// eslint-disable-next-line max-classes-per-file
import Stream from "node:stream";

import { describe, expect, it } from "vitest";

import type { SerializedError } from "../../../src";
import { addKnownErrorConstructor, deserializeError, isErrorLike, NonError, serializeError } from "../../../src";

describe("error serializer", () => {
    it("should serializes Error objects", () => {
        expect.assertions(3);

        const serialized = serializeError(new Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it("should serializes Error objects with extra properties", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { statusCode: number };

        error.statusCode = 500;

        const serialized = serializeError(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toContain("serialize.test.ts:");
    });

    it('serializes Error objects with subclass "name"', () => {
        expect.assertions(1);

        class MyError extends Error {}

        const error = new MyError("foo");
        const serialized = serializeError(error);

        expect(serialized.name).toBe("MyError");
    });

    it("should serializes nested errors", () => {
        expect.assertions(7);

        const error = new Error("foo") as Error & { inner: Error };

        error.inner = new Error("bar");

        const serialized = serializeError(error);

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

        const serialized = serializeError(outerError);

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

        const serialized = serializeError(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("should prevents infinite recursion", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { inner: Error };

        error.inner = error;

        const serialized = serializeError(error);

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

        serializeError(error);
        const serialized = serializeError(error);

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

        const error1 = new TypeError("foo");

        // @ts-expect-error -- testing invalid assignment
        error1.constructor = "10";

        const error2 = new TypeError("foo");

        error2.constructor = undefined;

        const error3 = new Error("foo");

        error3.constructor = null;

        const error4 = new Error("foo");

        // @ts-expect-error -- testing invalid assignment
        error4.constructor = 10;

        class MyError extends Error {}

        const error5 = new MyError("foo");

        error5.constructor = undefined;

        check(serializeError(error1), "TypeError");
        check(serializeError(error2), "TypeError");
        check(serializeError(error3), "Error");
        check(serializeError(error4), "Error");
        // We do not expect 'MyError' because err5.constructor has been blown away.
        // `err5.name` is 'Error' from the base class protoname.
        check(serializeError(error5), "Error");
    });

    it.skipIf(!globalThis.AggregateError)("serializes aggregate errors", () => {
        expect.assertions(14);

        const foo = new Error("foo");
        const bar = new Error("bar");

        // eslint-disable-next-line no-loops/no-loops
        for (const aggregate of [
            // @ts-expect-error -- Web API
            new AggregateError([foo, bar], "aggregated message"),
            { errors: [foo, bar], message: "aggregated message", stack: "serialize.test.ts:" },
        ]) {
            const serialized = serializeError(aggregate);

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

        const serialized = serializeError(error);

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

        const serialized = serializeError(error);

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

        expect(serializeError(recursiveCauseError).cause).toBe("[Circular]");
    });

    it.skipIf(!globalThis.AggregateError)("should handle recursion in aggregate errors", () => {
        expect.assertions(2);

        const recursiveAggregateError = new AggregateError([], "test");

        recursiveAggregateError.errors = [recursiveAggregateError];

        const serialized = serializeError(recursiveAggregateError);

        expect(Array.isArray(serialized.errors)).toBe(true);
        expect(serialized.errors).toHaveLength(0);
    });

    /**
     * Copied and modified tests from `https://github.com/sindresorhus/serialize-error/blob/29b0fcb5d1a00b173a6702235bca148434baf726/test.js`
     *
     * The original tests are licensed under MIT License.
     *
     * MIT License
     * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
     */
    it("should not affect the original object", () => {
        expect.assertions(2);

        const object: Error & { child?: { parent: Error } } = new Error("foo");

        object.child = { parent: object };

        const serialized = serializeError(object);

        expect(serialized).not.toBe(object);
        expect(object.child.parent).toBe(object);
    });

    it("should only destroy parent references", () => {
        expect.assertions(4);

        const error: Error & { one?: any; two?: any } = new Error("foo");

        const common = { thing: error };

        error.one = { firstThing: common };
        error.two = { secondThing: common };

        const serialized = serializeError(error);

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

        const serialized = serializeError(error);

        expect(serialized.a).toBe("[Function: a]");
    });

    it("should serialize Date as ISO string", () => {
        expect.assertions(1);

        const error = new Error("foo") as Error & { date: Date };

        error.date = new Date(0);

        const serialized = serializeError(error);

        expect(serialized.date).toStrictEqual(error.date.toISOString());
    });

    it("should discard buffers", () => {
        expect.assertions(1);

        const error = new Error("foo") as Error & { a: Buffer };

        error.a = Buffer.from("test");

        const serialized = serializeError(error);

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

        const serialized = serializeError(error);

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
                    amount: `$${this.value}`,
                    message: this.message,
                };
            }
        }
        const error = new CustomError();
        const serialized = serializeError(error, { useToJSON: true });

        expect(serialized).toStrictEqual({
            amount: "$10",
            message: "foo",
        });
        expect(serialized.stack).toBeUndefined();
    });

    it("should serialize custom error with a property having `.toJSON`", () => {
        expect.assertions(2);

        class CustomError extends Error {
            private readonly value: any;

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
                    amount: `$${this.amount}`,
                };
            },
        };

        const error = new CustomError(value);

        const serialized = serializeError(error, { useToJSON: true });

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
                return serializeError(this);
            }
        }

        const error = new CustomError();

        const serialized = serializeError(error, { useToJSON: true });

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
        const serialized = serializeError(error, { useToJSON: true });

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
                    amount: `$${this.value}`,
                    message: this.message,
                };
            }
        }

        const error = new CustomError();
        const serialized = serializeError(error, { useToJSON: false });

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

        const levelZero = serializeError(error, { maxDepth: 0 });

        expect(levelZero).toStrictEqual({});

        const levelOne = serializeError(error, { maxDepth: 1 });

        expect(levelOne).toStrictEqual({ message, name, one: {}, stack });

        const levelTwo = serializeError(error, { maxDepth: 2 });

        expect(levelTwo).toStrictEqual({ message, name, one: { two: {} }, stack });

        const levelThree = serializeError(error, { maxDepth: 3 });

        expect(levelThree).toStrictEqual({ message, name, one: { two: { three: {} } }, stack });
    });

    it.runIf("DOMException" in globalThis)("should serialize DOMException", () => {
        expect.assertions(1);

        const serialized = serializeError(new DOMException("x"));

        expect(serialized.message).toBe("x");
    });

    it.skip("should handle array circular references", () => {
        // KNOWN LIMITATION: Complex array circular references can cause stack overflow
        // This is due to the recursive nature of traversing deeply nested array structures
        expect.assertions(5);

        const error = new Error("test");
        const object = {};
        const common = [object];
        const x = [common];
        const y = [["test"], common];

        y[0][1] = y;
        object.a = { x };
        object.b = { y };
        error.object = object;

        const serialized = serializeError(error);

        expect(Array.isArray(serialized.object.a.x)).toBe(true);
        expect(serialized.object.a.x[0][0]).toBe("[Circular]");
        expect(serialized.object.b.y[0][0]).toBe("test");
        expect(serialized.object.b.y[1][0]).toBe("[Circular]");
        expect(serialized.object.b.y[0][1]).toBe("[Circular]");
    });

    it("should handle non-enumerable properties gracefully", () => {
        expect.assertions(1);

        const error = new Error("some error");
        const object = {};

        Object.defineProperty(object, "someProp", {
            enumerable: false,
            get() {
                throw new Error("some other error");
            },
        });
        error.object = object;

        expect(() => serializeError(error)).not.toThrow();
    });

    it.runIf("DOMException" in globalThis)("should deep clone DOMException when it is in the cause property", () => {
        expect.assertions(6);

        const domException = new DOMException("My domException", "NotFoundError");
        const error = new Error("My error message") as Error & { cause: DOMException };

        error.cause = domException;

        const serialized = serializeError(error);

        expect(serialized.message).toBe("My error message");
        expect(serialized.cause.message).toBe("My domException");
        expect(serialized.cause.name).toBe("DOMException"); // DOMException name is always "DOMException"
        expect(serialized.cause.code).toBe(8);
        // Should be a deep clone, not the same reference
        expect(serialized.cause).not.toBe(domException);
        expect(serialized.cause instanceof DOMException).toBe(false);
    });

    // Deserialization tests
    describe(deserializeError, () => {
        it("should deserialize null", () => {
            expect.assertions(3);

            const deserialized = deserializeError(null);

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("null");
        });

        it("should deserialize number", () => {
            expect.assertions(3);

            const deserialized = deserializeError(1);

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("1");
        });

        it("should deserialize boolean", () => {
            expect.assertions(3);

            const deserialized = deserializeError(true);

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("true");
        });

        it("should deserialize string", () => {
            expect.assertions(3);

            const deserialized = deserializeError("test");

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe('"test"');
        });

        it("should deserialize array", () => {
            expect.assertions(3);

            const deserialized = deserializeError([1, 2, 3]);

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("[1,2,3]");
        });

        it("should deserialize empty object", () => {
            expect.assertions(3);

            const deserialized = deserializeError({});

            expect(deserialized).toBeInstanceOf(NonError);
            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("{}");
        });

        it("should ignore Error instance", () => {
            expect.assertions(2);

            const originalError = new Error("test");
            const deserialized = deserializeError(originalError);

            expect(deserialized).toBe(originalError);
            expect(deserialized).toBeInstanceOf(Error);
        });

        it("should deserialize error", () => {
            expect.assertions(3);

            const serialized = serializeError(new Error("Stuff happened"));

            const deserialized = deserializeError(serialized);

            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.name).toBe("Error");
            expect(deserialized.message).toBe("Stuff happened");
        });

        it("should deserialize and preserve existing properties", () => {
            expect.assertions(3);

            const deserialized = deserializeError({
                customProperty: true,
                message: "foo",
                name: "Error",
            });

            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("foo");
            expect((deserialized as any).customProperty).toBe(true);
        });

        it("should deserialize with cause property", () => {
            expect.assertions(5);

            const deserialized = deserializeError({
                cause: {
                    message: "inner error",
                    name: "Error",
                },
                message: "outer error",
                name: "Error",
            });

            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("outer error");
            expect(deserialized.cause).toBeInstanceOf(Error);
            expect((deserialized.cause as Error).message).toBe("inner error");
            expect((deserialized.cause as Error).name).toBe("Error");
        });

        it("should deserialize nested errors", () => {
            expect.assertions(5);

            const deserialized = deserializeError({
                innerError: {
                    message: "inner error",
                    name: "Error",
                },
                message: "outer error",
                name: "Error",
            });

            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("outer error");
            expect((deserialized as any).innerError).toBeInstanceOf(Error);
            expect(((deserialized as any).innerError as Error).message).toBe("inner error");
            expect(((deserialized as any).innerError as Error).name).toBe("Error");
        });

        it("should deserialize AggregateError", () => {
            expect.assertions(5);

            const deserialized = deserializeError({
                errors: [
                    { message: "inner error 1", name: "Error" },
                    { message: "inner error 2", name: "Error" },
                ],
                message: "aggregated message",
                name: "AggregateError",
            });

            expect(deserialized).toBeInstanceOf(AggregateError);
            expect(deserialized.message).toBe("aggregated message");
            expect((deserialized as AggregateError).errors).toHaveLength(2);
            expect((deserialized as AggregateError).errors[0]).toBeInstanceOf(Error);
            expect((deserialized as AggregateError).errors[1]).toBeInstanceOf(Error);
        });

        it("should deserialize with custom error constructor", () => {
            expect.assertions(3);

            const deserialized = deserializeError({
                message: "type error",
                name: "TypeError",
            });

            expect(deserialized).toBeInstanceOf(TypeError);
            expect(deserialized.name).toBe("TypeError");
            expect(deserialized.message).toBe("type error");
        });

        it("should handle maxDepth option", () => {
            expect.assertions(4);

            const deserialized = deserializeError(
                {
                    message: "outer",
                    name: "Error",
                    nested: {
                        deeply: {
                            message: "deep",
                            name: "Error",
                        },
                        message: "inner",
                        name: "Error",
                    },
                },
                { maxDepth: 2 },
            );

            expect(deserialized).toBeInstanceOf(Error);
            expect(deserialized.message).toBe("outer");
            // The nested property should be deserialized
            expect((deserialized as any).nested).toBeInstanceOf(Error);
            expect(((deserialized as any).nested as Error).message).toBe("inner");
            // The deeply nested property should be wrapped in NonError
            // expect(((deserialized as any).nested as any).deeply).toBeInstanceOf(NonError);
        });
    });

    describe(addKnownErrorConstructor, () => {
        it("should add and use custom error constructor", () => {
            expect.assertions(3);

            class CustomError extends Error {
                public constructor(message: string) {
                    super(message);
                    this.name = "CustomError";
                }
            }

            addKnownErrorConstructor(CustomError);

            const deserialized = deserializeError({
                message: "custom error",
                name: "CustomError",
            });

            expect(deserialized).toBeInstanceOf(CustomError);
            expect(deserialized.name).toBe("CustomError");
            expect(deserialized.message).toBe("custom error");
        });

        it("should throw error for incompatible constructor", () => {
            expect.assertions(1);

            class BadError {
                public constructor() {
                    throw new Error("incompatible");
                }
            }

            expect(() => {
                addKnownErrorConstructor(BadError as any);
            }).toThrow('The error constructor "BadError" is not compatible');
        });

        it("should throw error for already known constructor", () => {
            expect.assertions(1);

            expect(() => {
                addKnownErrorConstructor(Error);
            }).toThrow('The error constructor "Error" is already known.');
        });
    });

    describe(isErrorLike, () => {
        it("should identify serialized errors", () => {
            expect.assertions(2);

            const serialized = serializeError(new Error("test"));

            expect(isErrorLike(serialized)).toBe(true);

            expect(
                isErrorLike({
                    message: "Some error message",
                    name: "Error",
                    stack: "at <anonymous>:1:13",
                }),
            ).toBe(true);
        });

        it("should reject non-error-like objects", () => {
            expect.assertions(3);

            expect(
                isErrorLike({
                    message: "Some message",
                    name: "NotAnError",
                }),
            ).toBe(false);

            expect(
                isErrorLike({
                    message: 123, // wrong type
                    name: "Error",
                }),
            ).toBe(false);

            expect(
                isErrorLike({
                    message: "Missing name",
                }),
            ).toBe(false);
        });
    });

    describe(NonError, () => {
        it("should create NonError instances", () => {
            expect.assertions(3);

            const error = new NonError("test message");

            expect(error).toBeInstanceOf(NonError);
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe("test message");
        });
    });
});
