import { describe, expect, it } from "vitest";

import Locker from "../../src/utils/locker";

describe("utils", () => {
    describe(Locker, () => {
        it("should successfully lock a key and return it", async () => {
            expect.assertions(1);

            const locker = new Locker();

            const key = locker.lock("key");

            expect(key).toBe("key");
        });

        it("should successfully unlock a previously locked key", async () => {
            expect.assertions(0);

            const locker = new Locker();

            locker.lock("key");
            locker.unlock("key");
        });

        it("should throw error when attempting to lock an already locked key", async () => {
            expect.assertions(1);

            const locker = new Locker();

            locker.lock("key");

            expect(() => locker.lock("key")).toThrow("key is locked");
        });
    });
});
