import { readFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { BuiltinContext } from "./types";

/**
 * Minimal tokeniser that walks already-valid JSON source and throws
 * with a message compatible with the Python hook when a duplicate key
 * appears at any object level.
 */
const detectDuplicateJsonKeys = (source: string): void => {
    let i = 0;
    const length = source.length;

    const skipWs = (): void => {
        while (i < length && /\s/.test(source[i]!)) {
            i += 1;
        }
    };

    const parseString = (): string => {
        if (source[i] !== "\"") {
            throw new Error(`expected string at ${i}`);
        }

        i += 1;
        const start = i;

        while (i < length && source[i] !== "\"") {
            if (source[i] === "\\") {
                i += 2;
            } else {
                i += 1;
            }
        }

        const raw = source.slice(start, i);
        i += 1;

        return JSON.parse(`"${raw}"`) as string;
    };

    const parseValue = (): void => {
        skipWs();
        const ch = source[i];

        if (ch === "{") {
            parseObject();
        } else if (ch === "[") {
            parseArray();
        } else if (ch === "\"") {
            parseString();
        } else {
            while (i < length && ",}]".indexOf(source[i]!) === -1 && !/\s/.test(source[i]!)) {
                i += 1;
            }
        }
    };

    const parseArray = (): void => {
        i += 1;
        skipWs();

        if (source[i] === "]") {
            i += 1;

            return;
        }

        while (i < length) {
            parseValue();
            skipWs();

            if (source[i] === ",") {
                i += 1;
                skipWs();
            } else if (source[i] === "]") {
                i += 1;

                return;
            }
        }
    };

    const parseObject = (): void => {
        i += 1;
        skipWs();
        const seen = new Set<string>();

        if (source[i] === "}") {
            i += 1;

            return;
        }

        while (i < length) {
            skipWs();
            const key = parseString();

            if (seen.has(key)) {
                throw new Error(`Duplicate key: ${key}`);
            }

            seen.add(key);
            skipWs();

            if (source[i] !== ":") {
                throw new Error(`expected colon at ${i}`);
            }

            i += 1;
            parseValue();
            skipWs();

            if (source[i] === ",") {
                i += 1;
                skipWs();
            } else if (source[i] === "}") {
                i += 1;

                return;
            }
        }
    };

    skipWs();
    parseValue();
};

/**
 * Mirrors `pre-commit/pre-commit-hooks/check_json.py`: parse each file
 * and additionally reject duplicate keys.
 */
const runCheckJson = (files: ReadonlyArray<string>, _args: ReadonlyArray<string>, context: BuiltinContext): number => {
    let rc = 0;

    for (const file of files) {
        const content = readFileSync(join(context.root, file), "utf8");

        try {
            JSON.parse(content);
            detectDuplicateJsonKeys(content);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            context.logger.info(`${file}: Failed to json decode (${message})`);
            rc = 1;
        }
    }

    return rc;
};

export { runCheckJson };
