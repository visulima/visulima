import { inspect } from "node:util";

import { describe, expect, it, vi } from "vitest";

import getErrorCauses from "../../src/error/get-error-causes";

describe("get-error-causes", () => {
    it("should return empty array if no cause", () => {
        expect.assertions(1);

        const error = new Error("test");

        expect(getErrorCauses(error)).toStrictEqual([error]);
    });

    it("should return array with causes", () => {
        expect.assertions(1);

        const error = new Error("test");
        const error2 = new Error("test2");
        const error3 = new Error("test3");

        error.cause = error2;
        error2.cause = error3;
        error3.cause = { moreData: "test mee too" };

        expect(getErrorCauses(error)).toStrictEqual([error, error2, error3, { moreData: "test mee too" }]);
    });

    it("should ignore deep nesting", () => {
        expect.assertions(2);

        const error = new Error("test");
        const error2 = new Error("test2");
        const error3 = new Error("test3");

        error.cause = error2;
        error2.cause = error3;
        error3.cause = error;

        const consoleLogMock = vi.spyOn(console, "error");

        expect(getErrorCauses(error)).toStrictEqual([error, error2, error3]);

        expect(consoleLogMock).toHaveBeenCalledExactlyOnceWith(`Circular reference detected in error causes: ${inspect(error)}`);
    });
});
