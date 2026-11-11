import { pascalCase } from "@visulima/string/case";
import { pascalCase as stringTsPascalCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("pascalCase", () => {
    test("visulima/string pascalCase (no cache)", async ({ bench }) => {
        await bench("visulima/string pascalCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                pascalCase(stringValue);
            }
        }).run();
    });

    test("visulima/string pascalCase (with cache)", async ({ bench }) => {
        await bench("visulima/string pascalCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                pascalCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts pascalCase", async ({ bench }) => {
        await bench("string-ts pascalCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsPascalCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string pascalCase (no cache)", async ({ bench }) => {
            await bench("visulima/string pascalCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    pascalCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts pascalCase", async ({ bench }) => {
            await bench("string-ts pascalCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsPascalCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string pascalCase (no cache)", async ({ bench }) => {
            await bench("visulima/string pascalCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    pascalCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts pascalCase", async ({ bench }) => {
            await bench("string-ts pascalCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsPascalCase(stringValue);
                }
            }).run();
        });
    });
});
