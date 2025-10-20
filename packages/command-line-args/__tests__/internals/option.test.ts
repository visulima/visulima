import { describe, expect, it } from "vitest";

import Option from "../../src/lib/option.js";

describe("option", () => {
    it("simple set string", () => {
        expect.assertions(4);

        const option = Option.create({ name: "two" });

        expect(option.get()).toBeNull();
        expect(option.state).toBe("default");

        option.set("zwei");

        expect(option.get()).toBe("zwei");
        expect(option.state).toBe("set");
    });

    it("simple set boolean", () => {
        expect.assertions(4);

        const option = Option.create({ name: "two", type: Boolean });

        expect(option.get()).toBeNull();
        expect(option.state).toBe("default");

        option.set();

        expect(option.get()).toBe(true);
        expect(option.state).toBe("set");
    });

    it("simple set string twice", () => {
        expect.assertions(5);

        const option = Option.create({ name: "two" });

        expect(option.get()).toBeNull();
        expect(option.state).toBe("default");

        option.set("zwei");

        expect(option.get()).toBe("zwei");
        expect(option.state).toBe("set");
        expect(
            () => () => option.set("drei"),
            (error) => error.name === "ALREADY_SET",
        );
    });

    it("simple set boolean twice", () => {
        expect.assertions(5);

        const option = Option.create({ name: "two", type: Boolean });

        expect(option.get()).toBeNull();
        expect(option.state).toBe("default");

        option.set();

        expect(option.get()).toBe(true);
        expect(option.state).toBe("set");
        expect(
            () => () => option.set(),
            (error) => error.name === "ALREADY_SET",
        );
    });

    it("string multiple", () => {
        expect.assertions(6);

        const option = Option.create({ multiple: true, name: "two" });

        expect(option.get()).toStrictEqual([]);
        expect(option.state).toBe("default");

        option.set("1");

        expect(option.get()).toStrictEqual(["1"]);
        expect(option.state).toBe("set");

        option.set("2");

        expect(option.get()).toStrictEqual(["1", "2"]);
        expect(option.state).toBe("set");
    });

    it("option.set: lazyMultiple", () => {
        expect.assertions(6);

        const option = Option.create({ lazyMultiple: true, name: "one" });

        expect(option.get()).toStrictEqual([]);
        expect(option.state).toBe("default");

        option.set("1");

        expect(option.get()).toStrictEqual(["1"]);
        expect(option.state).toBe("set");

        option.set("2");

        expect(option.get()).toStrictEqual(["1", "2"]);
        expect(option.state).toBe("set");
    });

    it("string multiple defaultOption", () => {
        expect.assertions(6);

        const option = Option.create({ defaultOption: true, multiple: true, name: "two" });

        expect(option.get()).toStrictEqual([]);
        expect(option.state).toBe("default");

        option.set("1");

        expect(option.get()).toStrictEqual(["1"]);
        expect(option.state).toBe("set");

        option.set("2");

        expect(option.get()).toStrictEqual(["1", "2"]);
        expect(option.state).toBe("set");
    });

    it("lazyMultiple defaultOption", () => {
        expect.assertions(6);

        const option = Option.create({ defaultOption: true, lazyMultiple: true, name: "one" });

        expect(option.get()).toStrictEqual([]);
        expect(option.state).toBe("default");

        option.set("1");

        expect(option.get()).toStrictEqual(["1"]);
        expect(option.state).toBe("set");

        option.set("2");

        expect(option.get()).toStrictEqual(["1", "2"]);
        expect(option.state).toBe("set");
    });
});
