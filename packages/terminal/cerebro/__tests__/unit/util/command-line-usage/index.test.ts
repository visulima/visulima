import { describe, expect, it } from "vitest";

import commandLineUsage from "../../../../src/util/command-line-usage";

describe("line-usage", () => {
    it("should render a typical output", () => {
        expect.assertions(1);

        const definitions = [
            {
                alias: "h",
                description: "Display this usage guide.",
                group: "one",
                name: "help",
                type: Boolean,
            },
            {
                defaultOption: true,
                description: "The input files to process",
                group: "one",
                multiple: true,
                name: "src",
                type: String,
            },
            {
                alias: "t",
                description: "Timeout value in ms",
                name: "timeout",
                type: Number,
            },
        ];

        const sections = [
            {
                content: "Generates something very important.",
                header: "a typical app",
            },
            {
                header: "Option list",
                optionList: definitions,
            },
        ];

        expect(commandLineUsage(sections)).toMatchSnapshot();
    });

    it("should render a empty out if empty sections are provided", () => {
        expect.assertions(1);

        expect(commandLineUsage([])).toBe("");
    });
});
