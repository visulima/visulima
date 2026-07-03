import { beforeEach, describe, expect, it, vi } from "vitest";

import { CounterManager } from "../../src/counter-manager";

describe(CounterManager, () => {
    let emit: ReturnType<typeof vi.fn>;
    let manager: CounterManager;

    beforeEach(() => {
        emit = vi.fn();
        manager = new CounterManager(emit);
    });

    describe("count", () => {
        it("should emit the incremented count", () => {
            expect.assertions(2);

            manager.count("hits");

            expect(emit).toHaveBeenCalledTimes(1);
            expect(emit).toHaveBeenCalledWith("log", false, false, { message: "hits: 1", prefix: "hits" });
        });

        it("should default label to \"default\"", () => {
            expect.assertions(1);

            manager.count();

            expect(emit).toHaveBeenCalledWith("log", false, false, { message: "default: 1", prefix: "default" });
        });

        it("should increment the counter on successive calls", () => {
            expect.assertions(3);

            manager.count("req");
            manager.count("req");
            manager.count("req");

            expect(emit).toHaveBeenNthCalledWith(1, "log", false, false, { message: "req: 1", prefix: "req" });
            expect(emit).toHaveBeenNthCalledWith(2, "log", false, false, { message: "req: 2", prefix: "req" });
            expect(emit).toHaveBeenNthCalledWith(3, "log", false, false, { message: "req: 3", prefix: "req" });
        });

        it("should maintain independent counters per label", () => {
            expect.assertions(2);

            manager.count("a");
            manager.count("b");
            manager.count("a");

            expect(emit).toHaveBeenNthCalledWith(1, "log", false, false, { message: "a: 1", prefix: "a" });
            expect(emit).toHaveBeenNthCalledWith(3, "log", false, false, { message: "a: 2", prefix: "a" });
        });
    });

    describe("countReset", () => {
        it("should reset an existing counter so the next count starts at 1", () => {
            expect.assertions(2);

            manager.count("c");
            manager.count("c");
            manager.countReset("c");
            emit.mockClear();
            manager.count("c");

            expect(emit).toHaveBeenCalledTimes(1);
            expect(emit).toHaveBeenCalledWith("log", false, false, { message: "c: 1", prefix: "c" });
        });

        it("should default label to \"default\"", () => {
            expect.assertions(1);

            manager.count();
            manager.countReset();
            emit.mockClear();
            manager.count();

            expect(emit).toHaveBeenCalledWith("log", false, false, { message: "default: 1", prefix: "default" });
        });

        it("should emit a warning when the label has no active counter", () => {
            expect.assertions(1);

            manager.countReset("missing");

            expect(emit).toHaveBeenCalledWith("warn", false, false, { message: "Count for missing does not exist", prefix: "missing" });
        });

        it("should emit a warning for a second reset on the same label", () => {
            expect.assertions(1);

            manager.count("once");
            manager.countReset("once");
            emit.mockClear();
            manager.countReset("once");

            expect(emit).toHaveBeenCalledWith("warn", false, false, { message: "Count for once does not exist", prefix: "once" });
        });
    });
});
