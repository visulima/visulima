import { describe, expect, it } from "vitest";

import NotificationError from "../src/errors/notification-error";
import type { Result } from "../src/types";
import { isErr as isError, isOk, mapOk, tryAsync, unwrap, unwrapOr } from "../src/utils/result";

const okResult = <T>(data: T): Result<T> => {
    return { data, success: true };
};
const failResult = <T>(error: unknown): Result<T> => {
    return { error, success: false };
};

describe("result utils", () => {
    it("isOk / isErr narrow on success", () => {
        expect.assertions(2);

        expect(isOk(okResult(1))).toBe(true);
        expect(isError(okResult(1))).toBe(false);
    });

    it("isOk / isErr narrow on failure", () => {
        expect.assertions(2);

        expect(isOk(failResult(new Error("x")))).toBe(false);
        expect(isError(failResult(new Error("x")))).toBe(true);
    });

    it("unwrap returns the data on success", () => {
        expect.assertions(1);

        expect(unwrap(okResult("value"))).toBe("value");
    });

    it("unwrap rethrows the original Error on failure", () => {
        expect.assertions(1);

        const error = new Error("boom");

        expect(() => unwrap(failResult(error))).toThrow(error);
    });

    it("unwrap wraps a non-Error failure in a NotificationError", () => {
        expect.assertions(2);

        let thrown: unknown;

        try {
            unwrap(failResult("plain string failure"));
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(NotificationError);
        expect((thrown as { cause?: unknown }).cause).toBe("plain string failure");
    });

    it("unwrapOr returns data on success and the fallback on failure", () => {
        expect.assertions(2);

        expect(unwrapOr(okResult(1), 99)).toBe(1);
        expect(unwrapOr(failResult<number>(new Error("x")), 99)).toBe(99);
    });

    it("mapOk maps the data on success", () => {
        expect.assertions(2);

        const mapped = mapOk(okResult(2), (value) => value * 10);

        expect(mapped.success).toBe(true);
        expect(mapped.data).toBe(20);
    });

    it("mapOk passes a failure through unchanged", () => {
        expect.assertions(2);

        const error = new Error("nope");
        const mapped = mapOk(failResult<number>(error), (value) => value * 10);

        expect(mapped.success).toBe(false);
        expect(mapped.error).toBe(error);
    });

    it("tryAsync resolves to an ok result", async () => {
        expect.assertions(2);

        const result = await tryAsync(() => Promise.resolve(42));

        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
    });

    it("tryAsync captures a thrown error as a failure result", async () => {
        expect.assertions(2);

        const error = new Error("async-boom");
        const result = await tryAsync(() => Promise.reject(error));

        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
    });
});
