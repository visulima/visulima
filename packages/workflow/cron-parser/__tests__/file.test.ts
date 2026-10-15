/* eslint-disable vitest/no-conditional-in-test, vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import fs from "node:fs";
import fsPromises from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CronDate } from "../src/cron-date";
import type { CronExpression } from "../src/cron-expression";
import { parseFile, parseFileSync } from "../src/file";

vi.mock(import("node:fs/promises"));
vi.mock(import("node:fs"));

const mockInvalidFileContent = `
  FOO=bar
  */5 * * * * valid-command
  invalid expression here
  * * * * * another-valid
`;

const mockCrontabExampleContent = `
  # Comment line (ignore)
  ENV1="test1"
  ENV2="test2"

  */10 * * * * /path/to/exe
  */10 * * * * /path/to/exe
  0 09-18 * * 1-5 /path/to/exe
`;

describe("the crontab reader", () => {
    beforeEach(() => {
        // Mock fs/promises
        vi.mocked(fsPromises.readFile).mockImplementation(((path: string) => {
            if (path === "tests/crontab.example") {
                return Promise.resolve(mockCrontabExampleContent);
            }

            return Promise.reject(new Error("File not found"));
        }) as never);

        // Mock fs
        vi.mocked(fs.readFileSync).mockImplementation(((path: string) => {
            if (path === "tests/crontab.example") {
                return mockCrontabExampleContent;
            }

            if (path === "./temp-invalid.txt") {
                return mockInvalidFileContent;
            }

            throw new Error("File not found");
        }) as never);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe.each(["parseFile", "parseFileSync"] as const)("%s field separators", (method) => {
        it.each([
            { name: "repeated spaces", separator: "   " },
            { name: "tabs", separator: "\t" },
            { name: "mixed spaces and tabs", separator: " \t " },
        ])("preserves a weekday schedule with $name", async ({ separator }) => {
            const content = ` \t${["15", "9", "*", "*", "1-5", "/usr/bin/report"].join(separator)}\t \r\n`;

            if (method === "parseFile") {
                vi.mocked(fsPromises.readFile).mockResolvedValueOnce(content);
            } else {
                vi.mocked(fs.readFileSync).mockReturnValueOnce(content);
            }

            const result = await { parseFile, parseFileSync }[method]("tests/crontab.example");

            expect(result.errors).toEqual({});
            expect(result.variables).toEqual({});
            expect(result.expressions).toHaveLength(1);

            const [expression] = result.expressions as [CronExpression];

            expect(expression.stringify()).toBe("15 9 * * 1-5");

            expression.reset(new Date("2026-09-25T09:15:00.000Z"));

            expect(expression.next().toISOString()).toBe("2026-09-28T09:15:00.000Z");
        });
    });

    describe(parseFile, () => {
        it("reads and parses a valid crontab file", async () => {
            const result = await parseFile("tests/crontab.example");

            expect(Object.keys(result.variables)).toHaveLength(2);
            expect(Object.keys(result.errors)).toHaveLength(0);
            expect(result.expressions).toHaveLength(3);
            expect(fsPromises.readFile).toHaveBeenCalledWith("tests/crontab.example", "utf8");

            // Verify expressions are valid
            for (const expr of result.expressions) {
                expect(expr.hasNext()).toBe(true);

                const next = expr.next();

                expect(next).toBeInstanceOf(CronDate);
            }
        });

        it("throws error for non-existing file", async () => {
            await expect(parseFile("./nonexistent.txt")).rejects.toThrow("File not found");
            expect(fsPromises.readFile).toHaveBeenCalledWith("./nonexistent.txt", "utf8");
        });
    });

    describe(parseFileSync, () => {
        it("reads and parses a valid crontab file synchronously", () => {
            const result = parseFileSync("tests/crontab.example");

            expect(Object.keys(result.variables)).toHaveLength(2);
            expect(Object.keys(result.errors)).toHaveLength(0);
            expect(result.expressions).toHaveLength(3);
            expect(fs.readFileSync).toHaveBeenCalledWith("tests/crontab.example", "utf8");

            // Verify expressions are valid
            for (const expr of result.expressions) {
                expect(expr.hasNext()).toBe(true);

                const next = expr.next();

                expect(next).toBeInstanceOf(CronDate);
            }
        });

        it("throws error for non-existing file", () => {
            expect(() => parseFileSync("./nonexistent.txt")).toThrow("File not found");
            expect(fs.readFileSync).toHaveBeenCalledWith("./nonexistent.txt", "utf8");
        });

        it("keeps a job whose command contains an equals sign", () => {
            const lines = ["MAILTO=ops@example.com", `*/5 * * * * curl "https://example.com/ping?a=b"`, "0 2 * * * backup --target=/srv"];

            vi.mocked(fs.readFileSync).mockReturnValueOnce(lines.join("\n"));

            const result = parseFileSync("tests/crontab.example");

            expect(result.variables).toEqual({ MAILTO: "ops@example.com" });
            expect(result.expressions).toHaveLength(2);
            expect(result.errors).toEqual({});
        });

        it("splits a variable at its first equals sign", () => {
            vi.mocked(fs.readFileSync).mockReturnValueOnce("QUERY=a=b");

            expect(parseFileSync("tests/crontab.example").variables).toEqual({ QUERY: "a=b" });
        });

        it("reads nickname schedules and reports the ones that cannot be scheduled", () => {
            vi.mocked(fs.readFileSync).mockReturnValueOnce(["@daily /usr/bin/report", "@reboot /usr/bin/start"].join("\n"));

            const result = parseFileSync("tests/crontab.example");

            expect(result.expressions).toHaveLength(1);
            expect(result.expressions[0]?.stringify()).toBe("0 0 * * *");
            expect(Object.keys(result.errors)).toStrictEqual(["@reboot /usr/bin/start"]);
        });

        it("keeps lines named like Object.prototype members as ordinary entries", () => {
            vi.mocked(fs.readFileSync).mockReturnValueOnce(["__proto__", "__proto__=evil", "constructor=x"].join("\n"));

            const result = parseFileSync("tests/crontab.example");

            expect(Object.keys(result.errors)).toStrictEqual(["__proto__"]);
            expect(Object.keys(result.variables)).toStrictEqual(["__proto__", "constructor"]);
            expect(Reflect.get(result.variables, "__proto__")).toBe("evil");
            expect(Object.getPrototypeOf(result.variables)).toBeNull();
        });

        it("handles invalid expressions", () => {
            const result = parseFileSync("./temp-invalid.txt");

            expect(result.variables).toEqual({ FOO: "bar" });
            expect(result.expressions).toHaveLength(2);
            expect(Object.keys(result.errors)).toHaveLength(1);
            expect(result.errors).toHaveProperty("invalid expression here");
            expect(fs.readFileSync).toHaveBeenCalledWith("./temp-invalid.txt", "utf8");
        });
    });
});
