import { describe, expect, it } from "vitest";

import Locker from "../../src/utils/locker";

describe("utils", () => {
    describe("locker", () => {
        it("should lock", async () => {
            const locker = new Locker();

            const key = locker.lock("key");

            expect(key).toBe("key");
        });

        it("should unlock", async () => {
            const locker = new Locker();

            locker.lock("key");
            locker.unlock("key");
        });

        it("should throw", async () => {
            const locker = new Locker();

            locker.lock("key");

            expect(() => locker.lock("key")).toThrowError("key is locked");
        });
    });
});
