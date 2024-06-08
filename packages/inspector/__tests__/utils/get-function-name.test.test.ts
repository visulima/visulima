import { describe, expect, it } from "vitest";

import getFunctionName from "../../src/utils/get-function-name";

describe("getFunctionName", () => {
    it("should get the function name", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-style
        function normalFunction() {
            return 1;
        }

        expect(getFunctionName(normalFunction) === "normalFunction").toBeTruthy();
    });

    it("should get correct name when function is surrounded by comments", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-style
        function /* one */ correctName /* two */() {

            return 0;
        }

        expect(getFunctionName(correctName) === "correctName").toBeTruthy();
    });

    it("should return empty string for anonymous functions", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names
        const anonymousFunction = (function () {
            // eslint-disable-next-line func-names
            return function () {

                return 2;
            };
        })();

        expect(getFunctionName(anonymousFunction) === "").toBeTruthy();
    });

    it("should return an empty string for overly large function names", () => {
        expect.assertions(1);

        const longFunction =
            function aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa() {};
        Object.defineProperty(longFunction, "name", { value: undefined });
        // Temporarily disable the Function.prototype.name getter
        const realFPName = Object.getOwnPropertyDescriptor(Function.prototype, "name");
        // eslint-disable-next-line no-extend-native
        Object.defineProperty(Function.prototype, "name", { value: undefined });

        expect(getFunctionName(longFunction) === "").toBeTruthy();

        // eslint-disable-next-line no-extend-native
        Object.defineProperty(Function.prototype, "name", realFPName as PropertyDescriptor);
    });

    it("should return `null` when passed a String as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName("") === null).toBeTruthy();
    });

    it("should return `null` when passed a Number as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName(1) === null).toBeTruthy();
    });

    it("should return `null` when passed a Boolean as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName(true) === null).toBeTruthy();
    });

    it("should return `null` when passed `null` as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName(null) === null).toBeTruthy();
    });

    it("should return `null` when passed `undefined` as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName(undefined) === null).toBeTruthy();
    });

    it("should return `null` when passed a Symbol as argument", () => {
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (typeof Symbol !== "undefined") {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect.assertions(1);

            // @ts-expect-error - Testing invalid input
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(getFunctionName(Symbol("symbol")) === null).toBeTruthy();
        }
    });

    it("should return `null` when passed an Object as argument", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(getFunctionName({}) === null).toBeTruthy();
    });
});
