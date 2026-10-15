import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { CronExpression } from "./cron-expression";
import { parse } from "./cron-expression-parser";

type CronFileParserResult = {
    errors: { [key: string]: unknown };
    expressions: CronExpression[];
    variables: { [key: string]: string };
};

/** A shell-style variable name. */
const VARIABLE_NAME = /^[A-Z_]\w*$/i;

/** Splits an entry on the whitespace between its fields. */
const WHITESPACE = /\s+/;

/**
 * Parse the schedule of a single crontab entry, leaving the command that follows it.
 * @param entry One line of a crontab file.
 * @returns The parsed expression.
 */
const parseEntry = (entry: string): CronExpression => {
    const atoms = entry.split(WHITESPACE);
    // A nickname such as `@daily` stands for all five fields.
    const fieldCount = atoms[0]?.startsWith("@") ? 1 : 5;

    return parse(atoms.slice(0, fieldCount).join(" "));
};

/**
 * Parse the content of a crontab file.
 * @param data The whole file.
 * @returns The expressions, the variables and the entries that failed.
 */
const parseContent = (data: string): CronFileParserResult => {
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
            result.expressions.push(parseEntry(entry));
        } catch (error: unknown) {
            result.errors[entry] = error;
        }
    }

    return result;
};

/**
 * Parse a crontab file asynchronously.
 * @param filePath Path to crontab file
 * @returns Promise resolving to parse results
 * @throws If file cannot be read
 */
const parseFile = async (filePath: string): Promise<CronFileParserResult> => {
    const data = await readFile(filePath, "utf8");

    return parseContent(data);
};

/**
 * Parse a crontab file synchronously.
 * @param filePath Path to crontab file
 * @returns Parse results
 * @throws If file cannot be read
 */
const parseFileSync = (filePath: string): CronFileParserResult => {
    const data = readFileSync(filePath, "utf8");

    return parseContent(data);
};

export { parseFile, parseFileSync };
export type { CronFileParserResult };
