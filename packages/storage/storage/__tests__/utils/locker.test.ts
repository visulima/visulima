import { describe, expect, expectTypeOf, it } from "vitest";

import Locker from "../../src/utils/locker";

describe("utils", () => {
    describe(Locker, () => {
        it("should successfully lock a key and return a unique token", async () => {
            expect.assertions(1);

            const locker = new Locker();

            const token = locker.lock("key");

            expectTypeOf(token).toBeString();

            expect(token.length).toBeGreaterThan(0);
        });

        it("should successfully unlock a previously locked key with its token", async () => {
            expect.assertions(1);

            const locker = new Locker();

            const token = locker.lock("key");

            expect(locker.unlock("key", token)).toBe(true);
        });

        it("should refuse to unlock with a wrong token", async () => {
            expect.assertions(2);

            const locker = new Locker();

            locker.lock("key");

            expect(locker.unlock("key", "bogus-token")).toBe(false);
            // Lock is still held.
            expect(() => locker.lock("key")).toThrow("key is locked");
        });

        it("should throw error when attempting to lock an already locked key", async () => {
            expect.assertions(1);

            const locker = new Locker();

            locker.lock("key");

            expect(() => locker.lock("key")).toThrow("key is locked");
        });
    });
});
