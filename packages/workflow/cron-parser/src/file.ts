/* eslint-disable @typescript-eslint/no-extraneous-class, e18e/prefer-static-regex, jsdoc/match-description -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { CronExpression } from "./cron-expression";
import { CronExpressionParser } from "./cron-expression-parser";

type CronFileParserResult = {
    errors: { [key: string]: unknown };
    expressions: CronExpression[];
    variables: { [key: string]: string };
};

/** A shell-style variable name. */
const VARIABLE_NAME = /^[A-Z_]\w*$/i;

/**
 * Parser for crontab files that handles both synchronous and asynchronous operations.
 */
class CronFileParser {
    /**
     * Parse a crontab file asynchronously
     * @param filePath Path to crontab file
     * @returns Promise resolving to parse results
     * @throws If file cannot be read
     */
    public static async parseFile(filePath: string): Promise<CronFileParserResult> {
        const data = await readFile(filePath, "utf8");

        return CronFileParser.#parseContent(data);
    }

    /**
     * Parse a crontab file synchronously
     * @param filePath Path to crontab file
     * @returns Parse results
     * @throws If file cannot be read
     */
    public static parseFileSync(filePath: string): CronFileParserResult {
        const data = readFileSync(filePath, "utf8");

        return CronFileParser.#parseContent(data);
    }

    /**
     * Internal method to parse crontab file content
     * @private
     */
    static #parseContent(data: string): CronFileParserResult {
        const blocks = data.split("\n");
        // Without a prototype, so a line such as `__proto__` is an ordinary key.
        const result: CronFileParserResult = {
            errors: Object.create(null) as CronFileParserResult["errors"],
            expressions: [],
            variables: Object.create(null) as CronFileParserResult["variables"],
        };

        for (const block of blocks) {
            const entry = block.trim();

            if (entry.length === 0 || entry.startsWith("#")) {
                continue;
            }

            // `NAME=value` sets a variable. Anything else that merely contains an `=`, such as
            // `0 * * * * curl "https://example.com?a=b"`, is a job and must stay one.
            const equals = entry.indexOf("=");
            const name = entry.slice(0, equals).trimEnd();

            if (equals !== -1 && VARIABLE_NAME.test(name)) {
                const value = entry.slice(equals + 1).trimStart();

                result.variables[name] = value.replaceAll(/["']/g, ""); // Remove quotes
                continue;
            }

            try {
                result.expressions.push(CronFileParser.#parseEntry(entry));
            } catch (error: unknown) {
                result.errors[entry] = error;
            }
        }

        return result;
    }

    /**
     * Parse the schedule of a single crontab entry, leaving the command that follows it.
     * @private
     */
    static #parseEntry(entry: string): CronExpression {
        const atoms = entry.split(/\s+/);
        // A nickname such as `@daily` stands for all five fields.
        const fieldCount = atoms[0]?.startsWith("@") ? 1 : 5;

        return CronExpressionParser.parse(atoms.slice(0, fieldCount).join(" "));
    }
}

export { CronFileParser };
export type { CronFileParserResult };
