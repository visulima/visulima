import { describe, expect, it } from "vitest";

import type { Result } from "../../src/types";
import { isErr as isError, isOk, mapOk, tryAsync, unwrap, unwrapOr } from "../../src/utils/result";

const okResult: Result<number> = { data: 5, success: true };
const errorResult: Result<number> = { error: new Error("boom"), success: false };

describe("result helpers", () => {
    it("isOk / isErr narrow correctly", () => {
        expect.assertions(4);
        expect(isOk(okResult)).toBe(true);
        expect(isOk(errorResult)).toBe(false);
        expect(isError(errorResult)).toBe(true);
        expect(isError(okResult)).toBe(false);
    });

    it("unwrap returns data or throws the error", () => {
        expect.assertions(2);
        expect(unwrap(okResult)).toBe(5);
        expect(() => unwrap(errorResult)).toThrow("boom");
    });

    it("unwrapOr returns the fallback on failure", () => {
        expect.assertions(2);
        expect(unwrapOr(okResult, 0)).toBe(5);
        expect(unwrapOr(errorResult, 99)).toBe(99);
    });

    it("mapOk transforms data and passes failures through", () => {
        expect.assertions(2);
        expect(mapOk(okResult, (value) => value * 2)).toStrictEqual({ data: 10, success: true });
        expect(mapOk(errorResult, (value) => value * 2).success).toBe(false);
    });

    describe(tryAsync, () => {
        it("captures success and failure without throwing", async () => {
            expect.assertions(2);

            await expect(tryAsync(() => Promise.resolve(7))).resolves.toStrictEqual({ data: 7, success: true });

            const failed = await tryAsync(() => Promise.reject(new Error("nope")));

            expect(failed.success).toBe(false);
        });
    });
});
