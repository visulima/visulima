import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ErrorCodes } from "../../../src/errors/error-codes";

const ERRORS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "../../../src/errors");

/**
 * Every code an error class actually passes to `CerebroError`.
 *
 * `ErrorCodes` is a hand-maintained table sitting beside the classes with
 * nothing forcing the two into sync, and `USER_FACING_ERROR_CODES` is keyed
 * off it. `InvalidChoiceError` passed the literal `"INVALID_CHOICE"`, which
 * was never added to the table — so the most textbook user-typed-it-wrong
 * error there is (`--format=bogus`) kept printing a full stack trace.
 */
const codesUsedByErrorClasses = (): Set<string> => {
    const used = new Set<string>();

    for (const file of readdirSync(ERRORS_DIRECTORY)) {
        if (!file.endsWith("-error.ts")) {
            continue;
        }

        const source = readFileSync(join(ERRORS_DIRECTORY, file), "utf8");

        // The code is the second argument to `super(...)`, written either
        // inline or on its own line depending on how long the message is.
        for (const [, code] of source.matchAll(/,\s*"([A-Z][\dA-Z_]{2,})"\s*,/g)) {
            used.add(code as string);
        }
    }

    return used;
};

describe("errorCodes", () => {
    it("declares every code the error classes pass to CerebroError", () => {
        expect.assertions(1);

        const declared = new Set<string>(Object.values(ErrorCodes));
        const undeclared = [...codesUsedByErrorClasses()].filter((code) => !declared.has(code)).toSorted((a, b) => a.localeCompare(b));

        expect(undeclared).toStrictEqual([]);
    });
});
