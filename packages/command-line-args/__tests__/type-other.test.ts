import { describe, expect, it } from "vitest";

import commandLineArgs from "../src";

describe("type other", () => {
    it("different values", () => {
        expect.assertions(2);

        const definitions = [
            {
                name: "file",
                type: (file) => file,
            },
        ];

        expect(commandLineArgs(definitions, { argv: ["--file", "one.js"] }), { file: "one.js" });
        expect(commandLineArgs(definitions, { argv: ["--file"] }), { file: null });
    });

    it("broken custom type function", () => {
        expect.assertions(1);

        const definitions = [
            {
                name: "file",
                type: (file) => {
                    throw new Error("broken");
                },
            },
        ];

        expect(() => () => {
            commandLineArgs(definitions, { argv: ["--file", "one.js"] });
        });
    });

    it("multiple: different values", () => {
        expect.assertions(3);

        const definitions = [
            {
                multiple: true,
                name: "file",
                type: (file) => file,
            },
        ];

        expect(commandLineArgs(definitions, { argv: ["--file", "one.js"] }), { file: ["one.js"] });
        expect(commandLineArgs(definitions, { argv: ["--file", "one.js", "two.js"] }), { file: ["one.js", "two.js"] });
        expect(commandLineArgs(definitions, { argv: ["--file"] }), { file: [] });
    });
});
