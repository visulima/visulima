// eslint-disable-next-line max-classes-per-file
import { describe, expect, it } from "vitest";

import type { SerializedError } from "../../../../src/processor/error/error-proto";
import errorWithCauseSerializer from "../../../../src/processor/error/error-with-cause-serializer";

describe("error with cause serializer", () => {
    it("should serializes Error objects", () => {
        expect.assertions(3);

        const serialized = errorWithCauseSerializer(new Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it("should serializes Error objects with extra properties", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { statusCode: number };
        error.statusCode = 500;

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
    });

    it('serializes Error objects with subclass "name"', () => {
        expect.assertions(1);

        class MyError extends Error {}

        const error = new MyError("foo");
        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("MyError");
    });

    it("should serializes nested errors", () => {
        expect.assertions(7);

        const error = new Error("foo") as Error & { inner: Error };
        error.inner = new Error("bar");

        const serialized = errorWithCauseSerializer(error);

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
        expect.assertions(9);

        const innerError = new Error("inner");
        const middleError = new Error("middle") as Error & { cause: Error };
        middleError.cause = innerError;

        const outerError = new Error("outer") as Error & { cause: Error };
        outerError.cause = middleError;

        const serialized = errorWithCauseSerializer(outerError);

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
        expect.assertions(3);

        const error = new Error("foo") as Error & { cause: string };
        error.cause = "abc";

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("should prevents infinite recursion", () => {
        expect.assertions(4);

        const error = new Error("foo") as Error & { inner: Error };
        error.inner = error;

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toContain("error-with-cause-serializer.test.ts:");
        expect(serialized.inner).toBeUndefined();
    });

    it("should cleans up infinite recursion tracking", () => {
        expect.assertions(8);

        const error = new Error("foo") as Error & { inner: Error };
        const bar = new Error("bar") as Error & { inner: Error };
        error.inner = bar;
        bar.inner = error;

        errorWithCauseSerializer(error);
        const serialized = errorWithCauseSerializer(error);

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
        expect.assertions(1);

        const error = new Error("foo");
        const serialized = errorWithCauseSerializer(error);

        expect(serialized.raw).toBe(error);
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

        check(errorWithCauseSerializer(error1), "TypeError");
        check(errorWithCauseSerializer(error2), "TypeError");
        check(errorWithCauseSerializer(error3), "Error");
        check(errorWithCauseSerializer(error4), "Error");
        // We do not expect 'MyError' because err5.constructor has been blown away.
        // `err5.name` is 'Error' from the base class protoname.
        check(errorWithCauseSerializer(error5), "Error");
    });

    it.skipIf(!global.AggregateError)("serializes aggregate errors", () => {
        expect.assertions(14);

        const foo = new Error("foo");
        const bar = new Error("bar");

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const aggregate of [
            // @ts-expect-error -- Web API
            new AggregateError([foo, bar], "aggregated message"),
            { errors: [foo, bar], message: "aggregated message", stack: "error-with-cause-serializer.test.ts:" },
        ]) {
            const serialized = errorWithCauseSerializer(aggregate);

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
