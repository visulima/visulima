import { describe, expect, it } from "vitest";

import { commandLineArgs } from "../src";
import { InvalidValueError } from "../src/errors";

describe("strictTypes", () => {
    it("throws InvalidValueError for a non-numeric Number value", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "port", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--port", "abc"], strictTypes: true })).toThrow(InvalidValueError);
    });

    it("includes the option name and bad value on the error", () => {
        expect.assertions(3);

        const optionDefinitions = [{ name: "port", type: Number }];

        let caught: unknown;

        try {
            commandLineArgs(optionDefinitions, { argv: ["--port", "abc"], strictTypes: true });
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(InvalidValueError);
        expect((caught as InvalidValueError).optionName).toBe("port");
        expect((caught as InvalidValueError).value).toBe("abc");
    });

    it("still parses valid Number values", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "port", type: Number }];

        expect(commandLineArgs(optionDefinitions, { argv: ["--port", "8080"], strictTypes: true })).toStrictEqual({ port: 8080 });
    });

    it("throws for an invalid value inside a multiple Number option", () => {
        expect.assertions(1);

        const optionDefinitions = [{ multiple: true, name: "ports", type: Number }];

        expect(() => commandLineArgs(optionDefinitions, { argv: ["--ports", "1", "x", "3"], strictTypes: true })).toThrow(InvalidValueError);
    });

    it("propagates NaN silently when strictTypes is disabled (default parity)", () => {
        expect.assertions(1);

        const optionDefinitions = [{ name: "port", type: Number }];
        const result = commandLineArgs(optionDefinitions, { argv: ["--port", "abc"] });

        expect(Number.isNaN(result.port)).toBe(true);
    });
});
