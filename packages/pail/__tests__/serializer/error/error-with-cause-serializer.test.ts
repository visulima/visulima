import { describe, expect,it } from "vitest";

import errorWithCauseSerializer from "../../../src/serializer/error/error-with-cause-serializer";

describe("error with cause serializer", () => {
    it("serializes Error objects", () => {
        const serialized = errorWithCauseSerializer(new Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it("serializes Error objects with extra properties", () => {
        const error = new Error("foo");
        error.statusCode = 500;

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it('serializes Error objects with subclass "name"', () => {
        class MyError extends Error {}

        const error = new MyError("foo");
        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("MyError");
    });

    it("serializes nested errors", () => {
        const error = new Error("foo");
        error.inner = new Error("bar");

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner.name).toBe("Error");
        expect(serialized.inner.message).toBe("bar");
        expect(serialized.inner.stack).toBe(/Error: bar/);
        expect(serialized.inner.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it("serializes error causes", () => {
        const innerError = new Error("inner");
        const middleError = new Error("middle");
        middleError.cause = innerError;

        const outerError = new Error("outer");
        outerError.cause = middleError;

        const serialized = errorWithCauseSerializer(outerError);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("outer");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);

        expect(serialized.cause.name).toBe("Error");
        expect(serialized.cause.message).toBe("middle");
        expect(serialized.cause.stack).toBe(/err-with-cause\.test\.js:/);

        expect(serialized.cause.cause.name).toBe("Error");
        expect(serialized.cause.cause.message).toBe("inner");
        expect(serialized.cause.cause.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it("keeps non-error cause", () => {
        const error = new Error("foo");
        error.cause = "abc";

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("prevents infinite recursion", () => {
        const error = new Error("foo");
        error.inner = error;

        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner).toBeUndefined();
    });

    it("cleans up infinite recursion tracking", () => {
        const error = new Error("foo");
        const bar = new Error("bar");
        error.inner = bar;
        bar.inner = error;

        errorWithCauseSerializer(error);
        const serialized = errorWithCauseSerializer(error);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner).toBeDefined();
        expect(serialized.inner.name).toBe("Error");
        expect(serialized.inner.message).toBe("bar");
        expect(serialized.inner.stack).toBe(/Error: bar/);
        expect(serialized.inner.inner).toBeUndefined();
    });

    it("err.raw is available", () => {
        const error = new Error("foo");
        const serialized = errorWithCauseSerializer(error);
        expect(serialized.raw).toBe(error);
    });

    it("redefined err.constructor doesnt crash serializer", () => {
        const check = (a: Error, name: string): void => {
            expect(a.name).toBe(name);
            expect(a.message).toBe("foo");
        }

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

        check(errorWithCauseSerializer(error1), "TypeError");
        check(errorWithCauseSerializer(error2), "TypeError");
        check(errorWithCauseSerializer(error3), "Error");
        check(errorWithCauseSerializer(error4), "Error");
        // We do not expect 'MyError' because err5.constructor has been blown away.
        // `err5.name` is 'Error' from the base class protoname.
        check(errorWithCauseSerializer(error5), "Error");
    });

    it("pass through anything that does not look like an Error", () => {
        const check = (a: any): void => {
            expect(errorWithCauseSerializer(a), a);
        }

        check("foo");
        check({ hello: "world" });
        check([1, 2]);
    });

    it.skipIf(!global.AggregateError)("serializes aggregate errors", () => {
        const foo = new Error("foo");
        const bar = new Error("bar");

        for (const aggregate of [
            new AggregateError([foo, bar], "aggregated message"),  
            { errors: [foo, bar], message: "aggregated message", stack: "err-with-cause.test.js:" },
        ]) {
            const serialized = errorWithCauseSerializer(aggregate);

            expect(serialized.message).toBe("aggregated message");
            expect(serialized.aggregateErrors).toHaveLength(2);
            expect(serialized.aggregateErrors[0].message).toBe("foo");
            expect(serialized.aggregateErrors[1].message).toBe("bar");
            expect(serialized.aggregateErrors[0].stack).toBe(/^Error: foo/);
            expect(serialized.aggregateErrors[1].stack).toBe(/^Error: bar/);
            expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        }
    });
});
