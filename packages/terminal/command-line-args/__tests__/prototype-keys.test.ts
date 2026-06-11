import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";

describe("prototype-colliding option names", () => {
    it("does not throw a false AlreadySetError for an option named toString on first use", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "toString", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--toString", "hello"] })).toStrictEqual({ toString: "hello" });
    });

    it("keeps values for an option literally named __proto__", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "__proto__", type: String }];
        const result = commandLineArgs(optionDefinitions, { argv: ["--__proto__", "danger"] });

        // The value must survive and be an own data property, not pollute the prototype.
        expect(Object.hasOwn(result, "__proto__")).toBe(true);
        expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toBe("danger");
    });

    it("does not pollute Object.prototype via an unknown --__proto__ argv in partial mode", () => {
        expect.assertions(2);

        const optionDefinitions = [{ name: "file", type: String }];
        const result = commandLineArgs(optionDefinitions, { argv: ["--__proto__.polluted", "true"], partial: true });

        const probe: Record<string, unknown> = {};

        expect(probe.polluted).toBeUndefined();
        expect(result).toStrictEqual({ _unknown: ["--__proto__.polluted", "true"] });
    });

    it("handles an option named constructor as plain data", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "constructor", type: String }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--constructor", "x"] })).toStrictEqual({ constructor: "x" });
    });

    it("returns a result with the standard Object prototype", () => {
        expect.assertions(1);

        const result = commandLineArgs([{ name: "file", type: String }], { argv: ["--file", "a"] });

        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    });
});
