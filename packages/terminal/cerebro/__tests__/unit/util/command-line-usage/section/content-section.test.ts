import { afterEach, describe, expect, it, vi } from "vitest";

import type { Content as IContent } from "../../../../../src/types/command-line-usage";
import ContentSection from "../../../../../src/util/command-line-usage/section/content-section";

const CONTENT_ARRAY_RE = /one\s[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s+two/;
const CONTENT_NESTED_ARRAY_RE = /one\s+two\s[\t\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s+one\s+two/;

const isWindows = process.platform === "win32";

describe("line-usage/content-section", () => {
    it("should render header only, no content", () => {
        expect.assertions(1);

        const sections = { header: "header" };
        const result = new ContentSection(sections).toString();

        expect(result).toContain("header");
    });

    it("should render content: array of strings", () => {
        expect.assertions(1);

        const sections = {
            content: ["one", "two"],
        };

        const result = new ContentSection(sections).toString();

        expect(CONTENT_ARRAY_RE.test(result)).toBe(true);
    });

    it("should render content: array of string array", () => {
        expect.assertions(1);

        const sections = {
            content: [
                ["one", "two"],
                ["one", "two"],
            ],
        };

        const result = new ContentSection(sections).toString();

        expect(CONTENT_NESTED_ARRAY_RE.test(result)).toBe(true);
    });

    it("should render content: { options: object, data: string[][]|string[] }", () => {
        expect.assertions(1);

        const sections = {
            content: {
                data: [["one", "two"], ["one", "two"], "foo"],
                options: {
                    chars: {
                        left: "test",
                    },
                },
            },
        };

        const result = new ContentSection(sections as IContent);

        expect(result.toString()).toMatchSnapshot();
    });

    it("should render content: raw", () => {
        expect.assertions(1);

        const sections = {
            content: "user-defined\nnew\nlines",
            raw: true,
        };

        const result = new ContentSection(sections);

        expect(result.toString()).toBe(`user-defined\nnew\nlines${isWindows ? "\r\n" : "\n"}`);
    });

    it("should throw a error with content: { options: object, data: section[] }, invalid", () => {
        expect.assertions(1);

        const sections = {
            content: {
                broken: true,
            },
        };

        // @ts-expect-error - test error
        expect(() => new ContentSection(sections).toString()).toThrow(`Must have an "options" or "data" property\n{"broken":true}`);
    });

    it("should throw a error with content: invalid", () => {
        expect.assertions(1);

        const sections = {
            content: true,
        };

        // @ts-expect-error - test error
        expect(() => new ContentSection(sections).toString()).toThrow("invalid input");
    });

    it("should render raw content given as an array of strings", () => {
        expect.assertions(1);

        const sections = {
            content: ["first raw line", "second raw line"],
            raw: true,
        };

        const result = new ContentSection(sections).toString();

        expect(result).toBe(`first raw line${isWindows ? "\r\n" : "\n"}second raw line${isWindows ? "\r\n" : "\n"}`);
    });

    it("should throw for raw content that is neither a string nor an array of strings", () => {
        expect.assertions(1);

        const sections = {
            content: { not: "valid" },
            raw: true,
        };

        // @ts-expect-error - test error
        expect(() => new ContentSection(sections).toString()).toThrow("Invalid raw content, must be a string or array of strings.");
    });

    it("falls back to automatic layout when the widest name column is empty", () => {
        expect.assertions(1);

        // Two-column rows whose first column is an empty string make `widest` 0,
        // so computeColumnWidths returns undefined and tabular auto-sizes.
        const sections = {
            content: [
                ["", "first description"],
                ["", "second description"],
            ],
        };

        const result = new ContentSection(sections).toString();

        expect(result).toContain("first description");
    });

    describe("with no CEREBRO_TERMINAL_WIDTH override", () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it("falls back to terminal-size when no width override is present", () => {
            expect.assertions(1);

            vi.stubEnv("CEREBRO_TERMINAL_WIDTH", "");

            const sections = {
                content: [
                    ["short", "a description"],
                    ["longer-name", "another description"],
                ],
            };

            const result = new ContentSection(sections).toString();

            expect(result).toContain("a description");
        });

        it("uses automatic layout when the name column would crush the description in a narrow terminal", () => {
            expect.assertions(1);

            // Pin a tiny terminal width so the widest name + minimum description
            // exceeds it, forcing computeColumnWidths to return undefined.
            vi.stubEnv("CEREBRO_TERMINAL_WIDTH", "10");

            const sections = {
                content: [
                    ["a-very-long-command-name", "description text"],
                    ["another-long-command", "more description"],
                ],
            };

            const result = new ContentSection(sections).toString();

            expect(result).toContain("a-very-long-command-name");
        });
    });
});
