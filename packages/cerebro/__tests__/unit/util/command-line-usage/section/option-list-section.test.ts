import { describe, expect, it } from "vitest";

import type { OptionList as IOptionList } from "../../../../../src/types/command-line-usage";
import OptionListSection from "../../../../../src/util/command-line-usage/section/option-list-section";

describe("command-line-usage/option-list-section", () => {
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

        const section = {
            header: "Option list",
            optionList: definitions,
        };

        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should render the out put in the reverse name order", () => {
        expect.assertions(1);

        const section = {
            header: "Option list",
            optionList: [
                {
                    alias: "t",
                    description: "Timeout value in ms",
                    name: "timeout",
                    type: Number,
                },
            ],
            reverseNameOrder: true,
        };

        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should render the output with no description", () => {
        expect.assertions(1);

        const result = new OptionListSection({
            optionList: [{ name: "one" }],
        });

        expect(result.toString()).toMatchSnapshot();
    });

    it("should throw a error if the definition has no name", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new
            new OptionListSection({
                // @ts-expect-error - test error
                optionList: [{ description: "something" }],
            });
        }).toThrow("Invalid option definition, name is required.");
    });

    it("should omit String, correct typeLabel", () => {
        expect.assertions(1);

        const definitions = [
            {
                description: "The input files to process",
                name: "src",
            },
        ];

        const section = {
            header: "Option list",
            optionList: definitions,
        };

        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should omit String, correct typeLabel, multiple", () => {
        expect.assertions(1);

        const definitions = [
            {
                description: "The input files to process",
                multiple: true,
                name: "src",
            },
        ];

        const section = {
            header: "Option list",
            optionList: definitions,
        };

        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should omit String, correct typeLabel, lazyMultiple", () => {
        expect.assertions(1);

        const definitions = [
            {
                description: "The input files to process",
                lazyMultiple: true,
                name: "src",
            },
        ];

        const section = {
            header: "Option list",
            optionList: definitions,
        };
        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should output with correct type Number, correct typeLabel and lazyMultiple", () => {
        expect.assertions(1);

        const definitions = [
            {
                description: "The input files to process",
                lazyMultiple: true,
                name: "src",
                type: Number,
            },
        ];

        const section = {
            header: "Option list",
            optionList: definitions,
        };

        const result = new OptionListSection(section as IOptionList);

        expect(result.toString()).toMatchSnapshot();
    });
});
