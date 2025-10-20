import { describe, expect, it } from "vitest";

import Option from "../../src/lib/option.js";

describe("option default", () => {
    it("defaultValue", () => {
        expect.assertions(2);

        const option = new Option({ defaultValue: "two", name: "two" });

        expect(option.get()).toBe("two");

        option.set("zwei");

        expect(option.get()).toBe("zwei");
    });

    it("multiple defaultValue", () => {
        expect.assertions(2);

        const option = new Option({ defaultValue: ["two", "zwei"], multiple: true, name: "two" });

        expect(option.get()).toStrictEqual(["two", "zwei"]);

        option.set("duo");

        expect(option.get()).toStrictEqual(["duo"]);
    });

    it("falsy defaultValue", () => {
        expect.assertions(1);

        const option = new Option({ defaultValue: 0, name: "one" });

        expect(option.get()).toBe(0);
    });

    it("falsy defaultValue 2", () => {
        expect.assertions(1);

        const option = new Option({ defaultValue: false, name: "two" });

        expect(option.get()).toBe(false);
    });

    it("falsy defaultValue multiple", () => {
        expect.assertions(1);

        const option = new Option({ defaultValue: 0, multiple: true, name: "one" });

        expect(option.get()).toStrictEqual([0]);
    });
});
