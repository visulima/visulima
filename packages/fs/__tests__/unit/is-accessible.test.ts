import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { F_OK, R_OK, W_OK, X_OK } from "../../src/constants";
import isAccessible from "../../src/is-accessible";
import isAccessibleSync from "../../src/is-accessible-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const file = join(__dirname, "..", "..", "tsconfig.json");
const directory = __dirname;

const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe.each([
    ["isAccessible", isAccessible],
    ["isAccessibleSync", isAccessibleSync],
])("%s", (name, function_) => {
    it.each([
        [file, undefined, true, "file is accessible via default"],
        [file, F_OK, true, "file is accessible"],
        [file, R_OK, true, "file is readable"],
        [file, W_OK, true, "file is writable"],

        [directory, undefined, true, "dir is accessible via default"],
        [directory, F_OK, true, "dir is accessible"],
        [directory, R_OK, true, "dir is readable"],
        [directory, W_OK, true, "dir is writable"],

        ["missing", undefined, false, "missing is not accessible via default"],
        ["missing", F_OK, false, "missing is not accessible"],
        ["missing", R_OK, false, "missing is not readable"],
        ["missing", W_OK, false, "missing is not writable"],
    ])(
        "should should support different mods %s %s",
        async (input: string[] | string, mode: number | undefined, expected: boolean[] | boolean, message: string) => {
            expect.assertions(1);

            // @ts-expect-error - ts cant figure out the type
            let result = function_(input, mode);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "isAccessible") {
                result = await result;
            }

            expect(result, message).toStrictEqual(expected);
        },
    );

    // on windows, the file is always executable
    it.runIf(!isWindows).each([
        [file, X_OK, false, "file is not executable"],

        [directory, X_OK, true, "dir is executable"],

        ["missing", X_OK, false, "missing is not executable"],
    ])(
        "should should support different mods %s %s",
        async (input: string[] | string, mode: number | undefined, expected: boolean[] | boolean, message: string) => {
            expect.assertions(1);

            // @ts-expect-error - ts cant figure out the type
            let result = function_(input, mode);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "isAccessible") {
                result = await result;
            }

            expect(result, message).toStrictEqual(expected);
        },
    );

    it("should handle path as URL or string", async () => {
        expect.assertions(1);

        const path = new URL(`file:///${file as string}`);

        let result = function_(path, F_OK);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "isAccessible") {
            result = await result;
        }

        expect(result).toBe(true);
    });
});
