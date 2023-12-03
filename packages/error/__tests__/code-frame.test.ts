/**
 * This is a copy of the codeFrameColumns tests from Babel
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/test/index.js#L316-L565
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/test/index.js#L71-L139
 *
 * MIT License
 *
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors
 */

import chalk from "chalk";
import { describe, expect, it, vi } from "vitest";

import process from "../src/util/process";
import { codeFrame } from "../src/code-frame";

const POINTER = process.platform === "win32" && !process.env?.["WT_SESSION"] ? ">" : "❯";

vi.mock("./utils", () => {
    return {
        normalizeLF: (string_: string) => string_,
    };
});

describe("code-frame", () => {
    it("should return an empty string if line or column is undefined", () => {
        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: undefined, line: undefined };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe("");
    });

    it("should return the correct code frame for a given location", () => {
        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: 16, line: 2 };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe(`  1 | const x = 10;
${POINTER} 2 | const error = x.y;
    |                ^
  3 |`);
    });

    it("should handle long result", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe(`   6 |     'We tried looking for using inside the "users" table',
   7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
${POINTER}  8 |    ]
     |     ^
   9 |
  10 |     throw error
  11 | }`);
    });

    it("should be possible to change the visible lines", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(
            source,
            { start: loc },
            {
                linesAbove: 1,
                linesBelow: 2,
            },
        );

        expect(result).toBe(`   7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
${POINTER}  8 |    ]
     |     ^
   9 |
  10 |     throw error`);
    });

    it("should colorize the error line", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(
            source,
            { start: loc },
            {
                color: {
                    gutter: chalk.grey,
                    marker: chalk.red.bold,
                    message: chalk.red.bold,
                },
            },
        );

        expect(result).toMatchSnapshot();
    });

    it("should show no lines above", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesAbove: 0 })).toEqual(
            [`${POINTER} 2 |   constructor() {`, "  3 |     console.log(arguments);", "  4 |   }", "  5 | };"].join("\n"),
        );
    });

    it("should show no lines below", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesBelow: 0 })).toEqual(["  1 | class Foo {", `${POINTER} 2 |   constructor() {`].join("\n"));
    });

    it("should show single line", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesAbove: 0, linesBelow: 0 })).toEqual([`${POINTER} 2 |   constructor() {`].join("\n"));
    });

    it("should mark multiple columns across lines", function () {
        const rawLines = ["class Foo {", "  constructor() {", "  }", "};"].join("\n");

        expect(
            codeFrame(rawLines, {
                start: { line: 2, column: 17 },
                end: { line: 3, column: 3 },
            }),
        ).toEqual(
            ["  1 | class Foo {", `${POINTER} 2 |   constructor() {`, "    |                 ^", `${POINTER} 3 |   }`, "    | ^^^", "  4 | };"].join("\n"),
        );
    });

    it("should mark multiple columns across multiple lines", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(rawLines, {
                start: { line: 2, column: 17 },
                end: { line: 4, column: 3 },
            }),
        ).toEqual(
            [
                "  1 | class Foo {",
                `${POINTER} 2 |   constructor() {`,
                "    |                 ^",
                `${POINTER} 3 |     console.log(arguments);`,
                "    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^",
                `${POINTER} 4 |   }`,
                "    | ^^^",
                "  5 | };",
            ].join("\n"),
        );
    });

    it("should mark across multiple lines without columns", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 }, end: { line: 4 } })).toEqual(
            ["  1 | class Foo {", `${POINTER} 2 |   constructor() {`, `${POINTER} 3 |     console.log(arguments);`, `${POINTER} 4 |   }`, "  5 | };"].join(
                "\n",
            ),
        );
    });

    it("should show message", function () {
        const rawLines = ["class Foo {", "  constructor()", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { start: { line: 2, column: 16 } },
                {
                    message: "Missing {",
                },
            ),
        ).toEqual(["  1 | class Foo {", `${POINTER} 2 |   constructor()`, "    |                ^ Missing {", "  3 | };"].join("\n"));
    });

    it("should show message without column", function () {
        const rawLines = ["class Foo {", "  constructor()", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { start: { line: 2 } },
                {
                    message: "Missing {",
                },
            ),
        ).toEqual(["  Missing {", "  1 | class Foo {", `${POINTER} 2 |   constructor()`, "  3 | };"].join("\n"));
    });

    it("should show message with multiple lines", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                {
                    start: { line: 2, column: 17 },
                    end: { line: 4, column: 3 },
                },
                {
                    message: "something about the constructor body",
                },
            ),
        ).toEqual(
            [
                "  1 | class Foo {",
                `${POINTER} 2 |   constructor() {`,
                "    |                 ^",
                `${POINTER} 3 |     console.log(arguments);`,
                "    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^",
                `${POINTER} 4 |   }`,
                "    | ^^^ something about the constructor body",
                "  5 | };",
            ].join("\n"),
        );
    });

    it("should show message with multiple lines without columns", function () {
        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { start: { line: 2 }, end: { line: 4 } },
                {
                    message: "something about the constructor body",
                },
            ),
        ).toEqual(
            [
                "  something about the constructor body",
                "  1 | class Foo {",
                `${POINTER} 2 |   constructor() {`,
                `${POINTER} 3 |     console.log(arguments);`,
                `${POINTER} 4 |   }`,
                "  5 | };",
            ].join("\n"),
        );
    });

    it("should maximum context lines and padding", function () {
        const rawLines = [
            "/**",
            " * Sums two numbers.",
            " *",
            " * @param a Number",
            " * @param b Number",
            " * @returns Number",
            " */",
            "",
            "function sum(a, b) {",
            "  return a + b",
            "}",
        ].join("\n");

        expect(codeFrame(rawLines, { start: { line: 7, column: 2 } })).toEqual(
            [
                "   5 |  * @param b Number",
                "   6 |  * @returns Number",
                `${POINTER}  7 |  */`,
                "     |  ^",
                "   8 |",
                "   9 | function sum(a, b) {",
                "  10 |   return a + b",
            ].join("\n"),
        );
    });

    it("should no unnecessary padding due to one-off errors", function () {
        const rawLines = [
            "/**",
            " * Sums two numbers.",
            " *",
            " * @param a Number",
            " * @param b Number",
            " * @returns Number",
            " */",
            "",
            "function sum(a, b) {",
            "  return a + b",
            "}",
        ].join("\n");

        expect(codeFrame(rawLines, { start: { line: 6, column: 2 } })).toEqual(
            [
                "  4 |  * @param a Number",
                "  5 |  * @param b Number",
                `${POINTER} 6 |  * @returns Number`,
                "    |  ^",
                "  7 |  */",
                "  8 |",
                "  9 | function sum(a, b) {",
            ].join("\n"),
        );
    });

    it("should handle tabs correctly by replacing them with 4 spaces", () => {
        const source = "const x = 10;\n\tconst error = x.y;\n";
        const loc = { column: 20, line: 2 };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe(`  1 | const x = 10;
${POINTER} 2 |     const error = x.y;
    |                    ^
  3 |`);
    });

    it("should handle tabs", () => {
        const rawLines = ["\tclass Foo {", "\t  \t\t    constructor\t(\t)", "\t};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2, column: 25 } })).toEqual(
            ["  1 |     class Foo {", `${POINTER} 2 |                   constructor    (    )`, "    |                         ^", "  3 |     };"].join("\n"),
        );
    });

    it("should correctly marks lines containing tab characters", () => {
        expect(
            codeFrame(" * @name        Foo#a", {
                start: { line: 1, column: 17 },
                end: { line: 1, column: 19 },
            }),
        ).toEqual(`${POINTER} 1 |  * @name        Foo#a
    |                 ^^`);

        expect(
            codeFrame(" * @name\t\tFoo#a", {
                start: { line: 1, column: 17 },
                end: { line: 1, column: 19 },
            }),
        ).toEqual(`${POINTER} 1 |  * @name        Foo#a
    |                 ^^`);
    });
});
