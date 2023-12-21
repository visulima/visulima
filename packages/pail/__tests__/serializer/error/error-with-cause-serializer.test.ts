import { describe, it, expect } from "vitest";

import errorWithCauseSerializer from "../../../src/serializer/error/error-with-cause-serializer";

describe("error with cause serializer", () => {
    it("serializes Error objects", function () {
        const serialized = errorWithCauseSerializer(Error("foo"));

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it("serializes Error objects with extra properties", function () {
        const err = Error("foo");
        err.statusCode = 500;

        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.statusCode).toBe(500);
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it('serializes Error objects with subclass "name"', function () {
        class MyError extends Error {}

        const err = new MyError("foo");
        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("MyError");
    });

    it("serializes nested errors", function () {
        const err = Error("foo");
        err.inner = Error("bar");

        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner.name).toBe("Error");
        expect(serialized.inner.message).toBe("bar");
        expect(serialized.inner.stack).toBe(/Error: bar/);
        expect(serialized.inner.stack).toBe(/err-with-cause\.test\.js:/);
    });

    it("serializes error causes", function () {
        const innerErr = Error("inner");
        const middleErr = Error("middle");
        middleErr.cause = innerErr;

        const outerErr = Error("outer");
        outerErr.cause = middleErr;

        const serialized = errorWithCauseSerializer(outerErr);

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

    it("keeps non-error cause", function () {
        const err = Error("foo");
        err.cause = "abc";

        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.cause).toBe("abc");
    });

    it("prevents infinite recursion", function () {
        const err = Error("foo");
        err.inner = err;

        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner).toBeUndefined();
    });

    it("cleans up infinite recursion tracking", function () {
        const err = Error("foo");
        const bar = Error("bar");
        err.inner = bar;
        bar.inner = err;

        errorWithCauseSerializer(err);
        const serialized = errorWithCauseSerializer(err);

        expect(serialized.name).toBe("Error");
        expect(serialized.message).toBe("foo");
        expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        expect(serialized.inner).not.toBeUndefined();
        expect(serialized.inner.name).toBe("Error");
        expect(serialized.inner.message).toBe("bar");
        expect(serialized.inner.stack).toBe(/Error: bar/);
        expect(serialized.inner.inner).toBeUndefined();
    });

    it("err.raw is available", function () {
        const err = Error("foo");
        const serialized = errorWithCauseSerializer(err);
        expect(serialized.raw).toBe(err);
    });

    it("redefined err.constructor doesnt crash serializer", function () {
        const check = (a: Error, name: string): void => {
            expect(a.name).toBe(name);
            expect(a.message).toBe("foo");
        }

        const err1 = TypeError("foo");
        err1.constructor = "10";

        const err2 = TypeError("foo");
        err2.constructor = undefined;

        const err3 = Error("foo");
        err3.constructor = null;

        const err4 = Error("foo");
        err4.constructor = 10;

        class MyError extends Error {}

        const err5 = new MyError("foo");
        err5.constructor = undefined;

        check(errorWithCauseSerializer(err1), "TypeError");
        check(errorWithCauseSerializer(err2), "TypeError");
        check(errorWithCauseSerializer(err3), "Error");
        check(errorWithCauseSerializer(err4), "Error");
        // We do not expect 'MyError' because err5.constructor has been blown away.
        // `err5.name` is 'Error' from the base class protoname.
        check(errorWithCauseSerializer(err5), "Error");
    });

    it("pass through anything that does not look like an Error", function () {
        const check = (a: any): void => {
            expect(errorWithCauseSerializer(a), a);
        }

        check("foo");
        check({ hello: "world" });
        check([1, 2]);
    });

    it.skipIf(!global.AggregateError)("serializes aggregate errors", function () {
        const foo = new Error("foo");
        const bar = new Error("bar");

        for (const aggregate of [
            new AggregateError([foo, bar], "aggregated message"), // eslint-disable-line no-undef
            { errors: [foo, bar], message: "aggregated message", stack: "err-with-cause.test.js:" },
        ]) {
            const serialized = errorWithCauseSerializer(aggregate);

            expect(serialized.message).toBe("aggregated message");
            expect(serialized.aggregateErrors.length).toBe(2);
            expect(serialized.aggregateErrors[0].message).toBe("foo");
            expect(serialized.aggregateErrors[1].message).toBe("bar");
            expect(serialized.aggregateErrors[0].stack).toBe(/^Error: foo/);
            expect(serialized.aggregateErrors[1].stack).toBe(/^Error: bar/);
            expect(serialized.stack).toBe(/err-with-cause\.test\.js:/);
        }
    });
});
