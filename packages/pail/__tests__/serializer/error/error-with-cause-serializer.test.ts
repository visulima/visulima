// eslint-disable-next-line max-classes-per-file
import { describe, expect, it } from "vitest";

import type { SerializedError } from "../../../src/serializer/error/error-proto";
import errorWithCauseSerializer from "../../../src/serializer/error/error-with-cause-serializer";

const { isApplicable, name, serialize } = errorWithCauseSerializer;

describe("error with cause serializer", () => {
    it("should should have correct name", () => {
        expect(name).toBe("error");
    });

    it.each([
        [new Error("foo"), true],
        [new TypeError("foo"), true],
        [new SyntaxError("foo"), true],
        ["foo", false],
    ])("should not be applicable to %p", (value, expected) => {
        expect(isApplicable(value)).toStrictEqual(expected);
    });

    it("should serializes Error objects", () => {
        const serialized = serialize(new Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it("should serializes Error objects with extra properties", () => {
        const error = new Error("foo") as Error & { statusCode: number };
        error.statusCode = 500;

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it('serializes Error objects with subclass "name"', () => {
        class MyError extends Error {}

        const error = new MyError("foo");
        const serialized = serialize(error);

        expect(serialized.name).toBe("MyError");
    });

    it("should serializes nested errors", () => {
        const error = new Error("foo") as Error & { inner: Error };
        error.inner = new Error("bar");

        const serialized = serialize(error);

        const serializedInner = serialized.inner as SerializedError;

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
        expect(serializedInner.name).toBe("Error");
        expect(serializedInner.message).toBe("bar");
        expect(serializedInner.stack).toContain("Error: bar");
        expect(serializedInner.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it("should serializes error causes", () => {
        const innerError = new Error("inner");
        const middleError = new Error("middle") as Error & { cause: Error };
        middleError.cause = innerError;

        const outerError = new Error("outer") as Error & { cause: Error };
        outerError.cause = middleError;

        const serialized = serialize(outerError);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("outer");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");

        const serializedCause = serialized.cause as SerializedError;

        expect(serializedCause.name).toBe("Error");
        expect(serializedCause.message).toBe("middle");
        expect(serializedCause.stack).toContain("error-with-cause-serializer.test.ts:");

        const serializedCauseCause = (serialized.cause as SerializedError).cause as SerializedError;

        expect(serializedCauseCause.name).toBe("Error");
        expect(serializedCauseCause.message).toBe("inner");
        expect(serializedCauseCause.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it("should keeps non-error cause", () => {
        const error = new Error("foo") as Error & { cause: string };
        error.cause = "abc";

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("should prevents infinite recursion", () => {
        const error = new Error("foo") as Error & { inner: Error };
        error.inner = error;

        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
        expect(serialized.inner).toBeUndefined();
    });

    it("should cleans up infinite recursion tracking", () => {
        const error = new Error("foo") as Error & { inner: Error };
        const bar = new Error("bar") as Error & { inner: Error };
        error.inner = bar;
        bar.inner = error;

        serialize(error);
        const serialized = serialize(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");

        expect(serialized.inner).toBeDefined();

        const serializedInner = serialized.inner as SerializedError;

        expect(serializedInner.name).toBe("Error");
        expect(serializedInner.message).toBe("bar");
        expect(serializedInner.stack).toContain("Error: bar");
        expect(serializedInner.inner).toBeUndefined();
    });

    it("should err.raw is available", () => {
        const error = new Error("foo");
        const serialized = serialize(error);

        expect(serialized.raw).toBe(error);
    });

    it("should redefined err.constructor doesnt crash serializer", () => {
        const check = (a: Error, name: string): void => {
            expect(a.name).toBe(name);
            expect(a.message).toBe("foo");
        };

        const error1 = TypeError("foo");
        error1.constructor = "10";

        const error2 = TypeError("foo");
        error2.constructor = undefined;

        const error3 = new Error("foo");
        error3.constructor = null;

        const error4 = new Error("foo");
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
        const foo = new Error("foo");
        const bar = new Error("bar");

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const aggregate of [
            new AggregateError([foo, bar], "aggregated message"),
            { errors: [foo, bar], message: "aggregated message", stack: "error-with-cause-serializer.test.ts:" },
        ]) {
            const serialized = serialize(aggregate);

            expect(serialized.message).toBe("aggregated message");
            expect(serialized.aggregateErrors).toHaveLength(2);
            expect(serialized.aggregateErrors[0].message).toBe("foo");
            expect(serialized.aggregateErrors[1].message).toBe("bar");
            expect(serialized.aggregateErrors[0].stack).toContain("Error: foo");
            expect(serialized.aggregateErrors[1].stack).toContain("Error: bar");
            expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
        }
    });
});
