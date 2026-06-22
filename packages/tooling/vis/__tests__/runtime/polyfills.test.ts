/* eslint-disable n/no-unsupported-features/node-builtins, prefer-destructuring, vitest/no-conditional-expect, vitest/no-conditional-in-test -- this suite exercises the experimental-global shims (navigator.locks, Float16Array, …) via dynamic property access, and guards a few assertions on the host Node version. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installPolyfills } from "../../src/runtime/polyfills";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const globalRecord = globalThis as Record<string, unknown>;

describe(installPolyfills, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = createTemporaryDirectory("vis-polyfill-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspace);
        vi.restoreAllMocks();
    });

    it("is a no-op when the global is already native (URLPattern on modern Node)", async () => {
        expect.hasAssertions();

        // URLPattern is native on the supported floor — feature-detect should skip
        // it entirely: no resolution attempt, no warning.
        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        await installPolyfills("urlpattern", workspace);

        expect(warn).not.toHaveBeenCalled();
    });

    it("warns (does not throw) when an opt-in polyfill package can't be resolved from cwd", async () => {
        expect.hasAssertions();

        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        // Temporal isn't native and @js-temporal/polyfill isn't installed in the
        // temp project → graceful warning, no throw, global stays absent.
        await expect(installPolyfills("temporal", workspace)).resolves.toBeUndefined();

        expect(globalRecord["Temporal"]).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String((warn.mock.calls[0] as unknown[])[0])).toContain("@js-temporal/polyfill");
    });

    it("ignores unknown polyfill names", async () => {
        expect.hasAssertions();

        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        await installPolyfills("doesnotexist", workspace);

        expect(warn).not.toHaveBeenCalled();
    });
});

/**
 * Helper for the inline-shim tests: temporarily remove a global so the installer's
 * feature-detect sees it as absent, run the body, then restore the original. This
 * lets us assert "installs when absent" even on a Node that ships the API natively.
 */
const withTargetAbsent = async (owner: Record<string, unknown>, key: string, body: () => Promise<void> | void): Promise<void> => {
    const had = Object.hasOwn(owner, key);
    const original = owner[key];

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete owner[key];

    try {
        await body();
    } finally {
        if (had) {
            owner[key] = original;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete owner[key];
        }
    }
};

describe("inline shims", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("reportError", () => {
        it("installs a stderr-writing reportError when the global is absent", async () => {
            expect.hasAssertions();

            await withTargetAbsent(globalRecord, "reportError", async () => {
                const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);

                await installPolyfills("reporterror");

                expect(globalRecord["reportError"]).toBeTypeOf("function");

                (globalRecord["reportError"] as (error: unknown) => void)(new Error("boom"));

                expect(write).toHaveBeenCalledTimes(1);
                expect(String((write.mock.calls[0] as unknown[])[0])).toContain("boom");
            });
        });

        it("does not overwrite a present reportError", async () => {
            expect.hasAssertions();

            const sentinel = (): void => undefined;

            globalRecord["reportError"] = sentinel;

            try {
                await installPolyfills("reporterror");

                expect(globalRecord["reportError"]).toBe(sentinel);
            } finally {
                delete globalRecord["reportError"];
            }
        });
    });

    describe("regExp.escape", () => {
        it("installs an escaper when absent and escapes syntax + leading alphanumerics", async () => {
            expect.hasAssertions();

            await withTargetAbsent(RegExp as unknown as Record<string, unknown>, "escape", async () => {
                await installPolyfills("regexp-escape");

                const escape = (RegExp as unknown as Record<string, (input: string) => string>)["escape"];

                expect(escape).toBeTypeOf("function");
                // Syntax chars escaped; the escaped form still matches the literal.
                expect(new RegExp(`^${escape("a.b*c")}$`, "u").test("a.b*c")).toBe(true);
                expect(new RegExp(`^${escape("a.b*c")}$`, "u").test("axbyyc")).toBe(false);
                // Leading alphanumerics are hex-escaped, not left bare.
                expect(escape("1")).not.toBe("1");
            });
        });

        it("does not overwrite a present RegExp.escape", async () => {
            expect.hasAssertions();

            const sentinel = (input: string): string => input;

            (RegExp as unknown as Record<string, unknown>)["escape"] = sentinel;

            try {
                await installPolyfills("regexp-escape");

                expect((RegExp as unknown as Record<string, unknown>)["escape"]).toBe(sentinel);
            } finally {
                delete (RegExp as unknown as Record<string, unknown>)["escape"];
            }
        });
    });

    describe("promise.try", () => {
        it("installs Promise.try when absent and wraps sync return/throw/thenable", async () => {
            expect.hasAssertions();

            await withTargetAbsent(Promise as unknown as Record<string, unknown>, "try", async () => {
                await installPolyfills("promise-try");

                const tryFunction = (Promise as unknown as Record<string, (...arguments_: unknown[]) => Promise<unknown>>)["try"];

                expect(tryFunction).toBeTypeOf("function");
                await expect(tryFunction(() => 42)).resolves.toBe(42);
                await expect(
                    tryFunction(() => {
                        throw new Error("sync-throw");
                    }),
                ).rejects.toThrow("sync-throw");
                await expect(tryFunction((value: unknown) => Promise.resolve(value), "thenable")).resolves.toBe("thenable");
            });
        });

        it("does not overwrite a present Promise.try", async () => {
            expect.hasAssertions();

            const sentinel = (): Promise<void> => Promise.resolve();

            (Promise as unknown as Record<string, unknown>)["try"] = sentinel;

            try {
                await installPolyfills("promise-try");

                expect((Promise as unknown as Record<string, unknown>)["try"]).toBe(sentinel);
            } finally {
                delete (Promise as unknown as Record<string, unknown>)["try"];
            }
        });
    });

    describe("float16", () => {
        it("installs Math.f16round + DataView companions with a correct, rounding codec", async () => {
            expect.hasAssertions();

            const math = Math as unknown as Record<string, unknown>;
            const view = DataView.prototype as unknown as Record<string, unknown>;

            await withTargetAbsent(math, "f16round", async () => {
                await withTargetAbsent(view, "getFloat16", async () => {
                    await withTargetAbsent(view, "setFloat16", async () => {
                        await installPolyfills("float16array");

                        const f16round = math["f16round"] as (value: number) => number;

                        expect(f16round).toBeTypeOf("function");
                        // Exactly representable.
                        expect(f16round(1)).toBe(1);
                        expect(f16round(0.5)).toBe(0.5);
                        // Finite overflow rounds to ±Infinity (regression: used to be NaN).
                        expect(f16round(70_000)).toBe(Number.POSITIVE_INFINITY);
                        expect(f16round(-70_000)).toBe(Number.NEGATIVE_INFINITY);
                        // NaN/Infinity preserved.
                        expect(Number.isNaN(f16round(Number.NaN))).toBe(true);
                        expect(f16round(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
                        // Round-to-nearest-even (regression: used to truncate to 1).
                        expect(f16round(1.0006)).toBe(1.000_976_562_5);

                        // DataView half-float round-trip.
                        const buffer = new DataView(new ArrayBuffer(2));
                        const setFloat16 = view["setFloat16"] as (this: DataView, offset: number, value: number, littleEndian?: boolean) => void;
                        const getFloat16 = view["getFloat16"] as (this: DataView, offset: number, littleEndian?: boolean) => number;

                        setFloat16.call(buffer, 0, 1.5, true);

                        expect(getFloat16.call(buffer, 0, true)).toBe(1.5);
                    });
                });
            });
        });

        it("does not overwrite a present Math.f16round", async () => {
            expect.hasAssertions();

            const math = Math as unknown as Record<string, unknown>;
            const sentinel = (value: number): number => value;
            const had = "f16round" in math;
            const previous = math["f16round"];

            math["f16round"] = sentinel;

            try {
                await installPolyfills("float16array");

                expect(math["f16round"]).toBe(sentinel);
            } finally {
                if (had) {
                    math["f16round"] = previous;
                } else {
                    delete math["f16round"];
                }
            }
        });
    });

    describe("error.isError", () => {
        it("installs Error.isError when absent and brand-checks error objects", async () => {
            expect.hasAssertions();

            await withTargetAbsent(Error as unknown as Record<string, unknown>, "isError", async () => {
                await installPolyfills("error-iserror");

                const isError = (Error as unknown as Record<string, (value: unknown) => boolean>)["isError"];

                expect(isError).toBeTypeOf("function");
                expect(isError(new Error("x"))).toBe(true);
                expect(isError(new TypeError("x"))).toBe(true);
                expect(isError({ message: "fake" })).toBe(false);
                expect(isError(null)).toBe(false);
            });
        });

        it("does not overwrite a present Error.isError", async () => {
            expect.hasAssertions();

            const sentinel = (): boolean => false;

            (Error as unknown as Record<string, unknown>)["isError"] = sentinel;

            try {
                await installPolyfills("error-iserror");

                expect((Error as unknown as Record<string, unknown>)["isError"]).toBe(sentinel);
            } finally {
                delete (Error as unknown as Record<string, unknown>)["isError"];
            }
        });
    });

    describe("navigator.locks", () => {
        it("installs an in-process lock manager when navigator.locks is absent and serializes", async () => {
            expect.hasAssertions();

            const navigatorValue = globalRecord["navigator"] as { locks?: unknown } | undefined;
            const hadLocks = navigatorValue !== undefined && Object.hasOwn(navigatorValue, "locks");
            const originalLocks = navigatorValue?.locks;

            if (navigatorValue?.locks !== undefined) {
                delete (navigatorValue as Record<string, unknown>)["locks"];
            }

            try {
                await installPolyfills("navigator-locks");

                const { locks } = globalRecord["navigator"] as { locks: { request: (name: string, callback: () => unknown) => Promise<unknown> } };

                expect(locks.request).toBeTypeOf("function");

                const order: string[] = [];

                await Promise.all([
                    locks.request("resource", async () => {
                        order.push("first-start");
                        await Promise.resolve();
                        order.push("first-end");
                    }),
                    locks.request("resource", () => {
                        order.push("second");
                    }),
                ]);

                // Second waiter must not interleave inside the first.
                expect(order).toStrictEqual(["first-start", "first-end", "second"]);
            } finally {
                if (navigatorValue !== undefined) {
                    if (hadLocks) {
                        Object.defineProperty(navigatorValue, "locks", { configurable: true, enumerable: true, value: originalLocks });
                    } else if (Object.hasOwn(navigatorValue, "locks")) {
                        delete (navigatorValue as Record<string, unknown>)["locks"];
                    }
                }
            }
        });

        it("does not overwrite a present navigator.locks", async () => {
            expect.hasAssertions();

            // `navigator` may be a getter-only global, so we can't reassign it; instead
            // install a sentinel `locks` on the existing navigator object and assert the
            // feature-detect leaves it untouched.
            const sentinel = { request: (): Promise<void> => Promise.resolve() };
            const navigatorValue = globalRecord["navigator"] as Record<string, unknown> | undefined;

            if (navigatorValue === undefined) {
                // No native navigator to attach to — exercise the create branch instead and
                // assert a lock manager is present.
                await installPolyfills("navigator-locks");

                expect((globalRecord["navigator"] as { locks: { request: unknown } }).locks.request).toBeTypeOf("function");

                return;
            }

            const hadLocks = Object.hasOwn(navigatorValue, "locks");
            const originalLocks = navigatorValue["locks"];

            Object.defineProperty(navigatorValue, "locks", { configurable: true, enumerable: true, value: sentinel });

            try {
                await installPolyfills("navigator-locks");

                expect(navigatorValue["locks"]).toBe(sentinel);
            } finally {
                if (hadLocks) {
                    Object.defineProperty(navigatorValue, "locks", { configurable: true, enumerable: true, value: originalLocks });
                } else {
                    delete navigatorValue["locks"];
                }
            }
        });
    });
});
