import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { F_OK, R_OK, W_OK, X_OK } from "../../src/constants";
import isAccessible from "../../src/is-accessible";
import isAccessibleSync from "../../src/is-accessible-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const file = join(__dirname, "..", "..", "tsconfig.json");
const directory = __dirname;

describe.each([
    ["isAccessible", isAccessible],
    ["isAccessibleSync", isAccessibleSync],
])("%s", (name, function_) => {
    it.each([
        [file, undefined, true, "file is accessible via default"],
        [file, F_OK, true, "file is accessible"],
        [file, R_OK, true, "file is readable"],
        [file, W_OK, true, "file is writable"],
        [file, X_OK, false, "file is not executable"],

        [directory, undefined, true, "dir is accessible via default"],
        [directory, F_OK, true, "dir is accessible"],
        [directory, R_OK, true, "dir is readable"],
        [directory, W_OK, true, "dir is writable"],
        [directory, X_OK, true, "dir is executable"],

        ["missing", undefined, false, "missing is not accessible via default"],
        ["missing", F_OK, false, "missing is not accessible"],
        ["missing", R_OK, false, "missing is not readable"],
        ["missing", W_OK, false, "missing is not writable"],
        ["missing", X_OK, false, "missing is not executable"],

        [[file, directory, "missing"], undefined, [true, true, false], "accessible via default combination is as expected"],
        [[file, directory, "missing"], F_OK, [true, true, false], "accessible combination is as expected"],
        [[file, directory, "missing"], R_OK, [true, true, false], "readable combination is as expected"],
        [[file, directory, "missing"], W_OK, [true, true, false], "writable combination is as expected"],
        [[file, directory, "missing"], X_OK, [false, true, false], "executable combination is as expected"],
    ])(
        "should should support different mods %s %s",
        async (input: string[] | string, mode: number | undefined, expected: boolean[] | boolean, message: string) => {
            expect.assertions(1);

            // @ts-expect-error - ts cant figure out the type
            let result = function_(input, mode);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "isAccessible") {
                // @ts-expect-error - we are testing the promise
                result = await result;
            }

            expect(result, message).toStrictEqual(expected);
        },
    );
});
