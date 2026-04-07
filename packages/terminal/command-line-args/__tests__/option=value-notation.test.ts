import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("option=value notation", () => {
    it("two plus a regular notation", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "one" }, { name: "two" }, { name: "three" }];

        const argv = ["--one=1", "--two", "2", "--three=3"];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result.one).toBe("1");
        expect(result.two).toBe("2");
        expect(result.three).toBe("3");
    });

    it("value contains \"=\"", () => {
        expect.assertions(5);

        const optionDefinitions = [{ name: "url" }, { name: "two" }, { name: "three" }];

        let result = commandLineArgs(optionDefinitions, { argv: ["--url=my-url?q=123", "--two", "2", "--three=3"] });

        expect(result.url).toBe("my-url?q=123");
        expect(result.two).toBe("2");
        expect(result.three).toBe("3");

        result = commandLineArgs(optionDefinitions, { argv: ["--url=my-url?q=123=1"] });

        expect(result.url).toBe("my-url?q=123=1");

        result = commandLineArgs({ name: "my-url" }, { argv: ["--my-url=my-url?q=123=1"] });

        expect(result["my-url"]).toBe("my-url?q=123=1");
    });

    it("long option with empty value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "option", type: String }];
        const argv = ["--option="];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            option: "",
        });
    });

    it("short option with empty inline value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ alias: "o", name: "option", type: String }];
        const argv = ["-o="];
        const result = commandLineArgs(optionDefinitions, { argv });

        expect(result).toStrictEqual({
            option: "",
        });
    });
});
