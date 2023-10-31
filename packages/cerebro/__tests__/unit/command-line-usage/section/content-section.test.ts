import type { Content as IContent } from "../../../../src/@types/command-line-usage";
import { describe, expect, it } from "vitest";

import ContentSection from "../../../../src/utils/command-line-usage/section/content-section";

describe("line-usage/content-section", () => {
    it("should render header only, no content", () => {
        const sections = { header: "header" };
        const result = new ContentSection(sections as IContent).toString();

        expect(result.includes("header")).toBeTruthy();
    });

    it("should render content: array of strings", () => {
        const sections = {
            content: ["one", "two"],
        };

        const result = new ContentSection(sections as IContent).toString();

        // eslint-disable-next-line require-unicode-regexp
        expect(/one\s[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s+two/.test(result)).toBeTruthy();
    });

    it("should render content: array of string array", () => {
        const sections = {
            content: [
                ["one", "two"],
                ["one", "two"],
            ],
        };

        const result = new ContentSection(sections as IContent).toString();

        // eslint-disable-next-line require-unicode-regexp
        expect(/one\s+two\s[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s+one\s+two/.test(result)).toBeTruthy();
    });

    it("should render content: { options: object, data: string[][]|string[] }", () => {
        const sections = {
            content: {
                data: [["one", "two"], ["one", "two"], "foo"],
                options: {
                    chars: {
                        "left": "test",
                    },
                },
            },
        };

        const result = new ContentSection(sections as IContent);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should render content: raw", () => {
        const sections = {
            content: "user-defined\nnew\nlines",
            raw: true,
        };

        const result = new ContentSection(sections as IContent);

        expect(result.toString()).toBe("user-defined\nnew\nlines\n");
    });

    it("should throw a error with content: { options: object, data: section[] }, invalid", () => {
        const sections = {
            content: {
                broken: true,
            },
        };

        // @ts-expect-error - test error
        expect(() => new ContentSection(sections).toString()).toThrow(`Must have an "options" or "data" property\n{"broken":true}`);
    });

    it("should throw a error with content: invalid", () => {
        const sections = {
            content: true,
        };

        // @ts-expect-error - test error
        expect(() => new ContentSection(sections).toString()).toThrow("invalid input");
    });
});
