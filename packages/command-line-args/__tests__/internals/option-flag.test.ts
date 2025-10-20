import { describe, expect, it } from "vitest";

import FlagOption from "../../src/lib/option-flag.js";

describe("option flag", () => {
    it("single set", () => {
        expect.assertions(1);

        const option = new FlagOption({ name: "one", type: Boolean });

        option.set(undefined);

        expect(option.get()).toBe(true);
    });

    it("single set 2", () => {
        expect.assertions(1);

        const option = new FlagOption({ name: "one", type: Boolean });

        option.set("true");

        expect(option.get()).toBe(true);
    });

    it("set twice", () => {
        expect.assertions(2);

        const option = new FlagOption({ name: "one", type: Boolean });

        option.set(undefined);

        expect(option.get()).toBe(true);
        expect(
            () => () => option.set("true"),
            (error) => error.name === "ALREADY_SET",
        );
    });

    const origBoolean = Boolean;

    /* test in contexts which override the standard global Boolean constructor */
    it("global Boolean overridden", () => {
        expect.assertions(1);

        function Boolean() {
            return origBoolean.apply(origBoolean, arguments);
        }

        const option = new FlagOption({ name: "one", type: Boolean });

        option.set();

        expect(option.get()).toBe(true);
    });

    it("type-boolean-multiple: 1", () => {
        expect.assertions(1);

        const option = new FlagOption({ multiple: true, name: "one", type: Boolean });

        option.set(undefined);
        option.set(undefined);
        option.set(undefined);

        expect(option.get()).toStrictEqual([true, true, true]);
    });
});
