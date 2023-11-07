import { env, platform } from "node:process";

import chalk from "chalk";
import { describe, expect, it, vi } from "vitest";

import codeFrame from "../src/code-frame";

const POINTER = platform === "win32" && !env["WT_SESSION"] ? ">" : "❯";

vi.mock("./utils", () => {
    return {
        normalizeLF: (string_: string) => string_,
    };
});

describe("code-frame", () => {
    it("should return an empty string if line or column is undefined", () => {
        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: undefined, line: undefined };
        const result = codeFrame(source, loc);

        expect(result).toBe("");
    });

    it("should return the correct code frame for a given location", () => {
        const source = "const x = 10;\nconst error = x.y;\n";
        const loc = { column: 16, line: 2 };
        const result = codeFrame(source, loc);

        expect(result).toBe(`   1 | const x = 10;
${POINTER}  2 | const error = x.y;
     |                ^
`);
    });

    it("should handle tabs correctly by replacing them with two spaces", () => {
        const source = "const x = 10;\n\tconst error = x.y;\n";
        const loc = { column: 18, line: 2 };
        const result = codeFrame(source, loc);

        expect(result).toBe(`   1 | const x = 10;
${POINTER}  2 |   const error = x.y;
     |                  ^
`);
    });

    it("should handle long result", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(source, loc);

        expect(result).toBe(`   6 |     'We tried looking for using inside the "users" table',
   7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
${POINTER}  8 |    ]
     |     ^
  10 |     throw error
  11 | }
`);
    });

    it("should be possible to change the visible lines", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(source, loc, {
            linesAbove: 1,
            linesBelow: 1,
        });

        expect(result).toBe(`   7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
${POINTER}  8 |    ]
     |     ^
  10 |     throw error
`);
    });

    it("should colorize the error line", () => {
        const source =
            "function getUser () {\n    const error = new Error('Unable to find user', {\n        cause: new Error('foo')\n    })\n    error.help = [\n    'We tried looking for using inside the \"users\" table',\n    'The search was performed using the where (email = user.email) and (is_active = true)'\n   ]\n\n    throw error\n}";
        const loc = { column: 5, line: 8 };
        const result = codeFrame(source, loc, {
            focusLineColor: chalk.blue,
        });

        expect(result).toBe(`   6 |     'We tried looking for using inside the "users" table',
   7 |     'The search was performed using the where (email = user.email) and (is_active = true)'
${chalk.blue(`${POINTER}  8 |    ]`)}
${chalk.blue(`     |     ^`)}
  10 |     throw error
  11 | }
`);
    });
});
