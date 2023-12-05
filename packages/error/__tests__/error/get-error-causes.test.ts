import { describe, expect, it } from "vitest";

import getErrorCauses from "../../src/error/get-error-causes";

describe("get-error-causes", () => {
    it("should return empty array if no cause", () => {
        const error = new Error("test");

        expect(getErrorCauses(error)).toStrictEqual([error]);
    });

    it("should return array with causes", () => {
        const error = new Error("test");
        const error2 = new Error("test2");
        const error3 = new Error("test3");

        error.cause = error2;
        error2.cause = error3;
        error3.cause = { moreData: "test mee too" };

        expect(getErrorCauses(error)).toStrictEqual([error, error2, error3, { moreData: "test mee too" }]);
    });
});
