/**
 * This is a copy of the codeFrameColumns tests from Babel
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/test/index.js#L316-L565
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/test/index.js#L71-L139
 *
 * MIT License
 *
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors
 */

import { describe, expect, it, vi } from "vitest";

import { codeFrame } from "../../src/code-frame";
import process from "../../src/util/process";

const POINTER = process.platform === "win32" && !process.env?.WT_SESSION ? ">" : "❯";

vi.mock(import("./utils"), () => {
    return {
        normalizeLF: (string_: string) => string_,
    };
});

describe("code-frame", () => {
    it("should return an empty string if line or column is undefined", () => {
        expect.assertions(1);

        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: undefined, line: undefined };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe("");
    });

    it("should return the correct code frame for a given location", () => {
        expect.assertions(1);

        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: 16, line: 2 };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe(`  1 | const x = 10;
${POINTER} 2 | const error = x.y;
    |                ^
  3 |`);
    });

    it("should handle long result", () => {
        expect.assertions(1);

        const source
            = "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
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
        expect.assertions(1);

        const source
            = "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
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

    it("should colorize the code frame with only one function", () => {
        expect.assertions(1);

        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: 16, line: 2 };
        const result = codeFrame(
            source,
            { start: loc },
            {
                color: {
                    gutter: (v) => `gutter-${v}`,
                },
            },
        );

        expect(result).toBe(` gutter- 1 | const x = 10;
${POINTER}gutter- 2 | const error = x.y;
 gutter-   |                ^
 gutter- 3 |`);
    });

    it("should colorize the code frame with only two function", () => {
        expect.assertions(1);

        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: 16, line: 2 };
        const result = codeFrame(
            source,
            { start: loc },
            {
                color: {
                    gutter: (v) => `gutter-${v}`,
                    marker: (v) => `marker-${v}`,
                },
            },
        );

        expect(result).toBe(` gutter- 1 | const x = 10;
marker-${POINTER}gutter- 2 | const error = x.y;
 gutter-   |                marker-^
 gutter- 3 |`);
    });

    it("should colorize the error line", () => {
        expect.assertions(1);

        const source
            = "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(
            source,
            { start: loc },
            {
                color: {
                    gutter: (v) => `gutter-${v}`,
                    marker: (v) => `marker-${v}`,
                    message: (v) => `message-${v}`,
                },
                message: "foo",
            },
        );

        expect(result).toBe(` gutter-  6 |     'We tried looking for using inside the "users" table',
 gutter-  7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
marker-${POINTER}gutter-  8 |    ]
 gutter-    |     marker-^ message-foo
 gutter-  9 |
 gutter- 10 |     throw error
 gutter- 11 | }`);
    });

    it("should show no lines above", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesAbove: 0 })).toStrictEqual(
            [`${POINTER} 2 |   constructor() {`, "  3 |     console.log(arguments);", "  4 |   }", "  5 | };"].join("\n"),
        );
    });

    it("should show no lines below", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesBelow: 0 })).toStrictEqual(
            ["  1 | class Foo {", `${POINTER} 2 |   constructor() {`].join("\n"),
        );
    });

    it("should show single line", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { start: { line: 2 } }, { linesAbove: 0, linesBelow: 0 })).toStrictEqual([`${POINTER} 2 |   constructor() {`].join("\n"));
    });

    it("should mark multiple columns across lines", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "  }", "};"].join("\n");

        expect(
            codeFrame(rawLines, {
                end: { column: 3, line: 3 },
                start: { column: 17, line: 2 },
            }),
        ).toStrictEqual(
            ["  1 | class Foo {", `${POINTER} 2 |   constructor() {`, "    |                 ^", `${POINTER} 3 |   }`, "    | ^^^", "  4 | };"].join("\n"),
        );
    });

    it("should mark multiple columns across multiple lines", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(rawLines, {
                end: { column: 3, line: 4 },
                start: { column: 17, line: 2 },
            }),
        ).toStrictEqual(
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

    it("should mark across multiple lines without columns", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(codeFrame(rawLines, { end: { line: 4 }, start: { line: 2 } })).toStrictEqual(
            ["  1 | class Foo {", `${POINTER} 2 |   constructor() {`, `${POINTER} 3 |     console.log(arguments);`, `${POINTER} 4 |   }`, "  5 | };"].join(
                "\n",
            ),
        );
    });

    it("should show message", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor()", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { start: { column: 16, line: 2 } },
                {
                    message: "Missing {",
                },
            ),
        ).toStrictEqual(["  1 | class Foo {", `${POINTER} 2 |   constructor()`, "    |                ^ Missing {", "  3 | };"].join("\n"));
    });

    it("should show message without column", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor()", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { start: { line: 2 } },
                {
                    message: "Missing {",
                },
            ),
        ).toStrictEqual(["  Missing {", "  1 | class Foo {", `${POINTER} 2 |   constructor()`, "  3 | };"].join("\n"));
    });

    it("should show message with multiple lines", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                {
                    end: { column: 3, line: 4 },
                    start: { column: 17, line: 2 },
                },
                {
                    message: "something about the constructor body",
                },
            ),
        ).toStrictEqual(
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

    it("should show message with multiple lines without columns", () => {
        expect.assertions(1);

        const rawLines = ["class Foo {", "  constructor() {", "    console.log(arguments);", "  }", "};"].join("\n");

        expect(
            codeFrame(
                rawLines,
                { end: { line: 4 }, start: { line: 2 } },
                {
                    message: "something about the constructor body",
                },
            ),
        ).toStrictEqual(
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

    it("should maximum context lines and padding", () => {
        expect.assertions(1);

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

        expect(codeFrame(rawLines, { start: { column: 2, line: 7 } })).toStrictEqual(
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

    it("should no unnecessary padding due to one-off errors", () => {
        expect.assertions(1);

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

        expect(codeFrame(rawLines, { start: { column: 2, line: 6 } })).toStrictEqual(
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
        expect.assertions(1);

        const source = "const x = 10;\n\tconst error = x.y;\n";
        const loc = { column: 20, line: 2 };
        const result = codeFrame(source, { start: loc });

        expect(result).toBe(`  1 | const x = 10;
${POINTER} 2 |     const error = x.y;
    |                    ^
  3 |`);
    });

    it("should handle tabs", () => {
        expect.assertions(1);

        const rawLines = ["\tclass Foo {", "\t  \t\t    constructor\t(\t)", "\t};"].join("\n");

        expect(codeFrame(rawLines, { start: { column: 25, line: 2 } })).toStrictEqual(
            ["  1 |     class Foo {", `${POINTER} 2 |                   constructor    (    )`, "    |                         ^", "  3 |     };"].join("\n"),
        );
    });

    it("should correctly marks lines containing tab characters", () => {
        expect.assertions(2);

        expect(
            codeFrame(" * @name        Foo#a", {
                end: { column: 19, line: 1 },
                start: { column: 17, line: 1 },
            }),
        ).toBe(`${POINTER} 1 |  * @name        Foo#a
    |                 ^^`);

        expect(
            codeFrame(" * @name\t\tFoo#a", {
                end: { column: 19, line: 1 },
                start: { column: 17, line: 1 },
            }),
        ).toBe(`${POINTER} 1 |  * @name        Foo#a
    |                 ^^`);
    });

    it("should render tabs if tabWidth option is disabled", () => {
        expect.assertions(1);

        expect(
            codeFrame(
                " * @name\t\tFoo#a",
                {
                    end: { column: 19, line: 1 },
                    start: { column: 17, line: 1 },
                },
                {
                    tabWidth: false,
                },
            ),
        ).toBe(`${POINTER} 1 |  * @name\t\tFoo#a
    |         \t\t     ^^`);
    });
});
