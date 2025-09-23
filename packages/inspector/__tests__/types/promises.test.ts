import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

const isNode = typeof process === "object" && process.version;
// @ts-expect-error - not all versions of Node have this
// eslint-disable-next-line n/no-deprecated-api
const canInspectPromises = isNode && "getPromiseDetails" in process.binding("util");

describe.skipIf(isNode && canInspectPromises)("inspect with Promises", () => {
    describe("default behavior", () => {
        it("should inspect a resolved Promise", () => {
            expect.assertions(1);

            expect(inspect(Promise.resolve())).toBe("Promise {…}");
        });

        it("should inspect a rejected Promise", () => {
            expect.assertions(1);

            const prom = Promise.reject(new Error("Foo!"));

            expect(inspect(prom)).toBe("Promise {…}");

            // catch the promise to prevent warnings
            prom.catch(() => {});
        });

        describe("maxStringLength option", () => {
            it("should return the full string representation regardless of maxStringLength", () => {
                expect.assertions(9);

                expect(inspect(Promise.resolve(), { maxStringLength: 9 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 8 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 7 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 6 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 5 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 4 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 3 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 2 })).toBe("Promise {…}");
                expect(inspect(Promise.resolve(), { maxStringLength: 1 })).toBe("Promise {…}");
            });
        });
    });
});
