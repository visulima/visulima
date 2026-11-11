import { titleCase } from "@visulima/string/case";
import { titleCase as sculeTitleCase } from "scule";
import { titleCase as stringTsTitleCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("titleCase", () => {
    test("visulima/string titleCase (no cache)", async ({ bench }) => {
        await bench("visulima/string titleCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                titleCase(stringValue);
            }
        }).run();
    });

    test("visulima/string titleCase (with cache)", async ({ bench }) => {
        await bench("visulima/string titleCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                titleCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule titleCase", async ({ bench }) => {
        await bench("scule titleCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeTitleCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts titleCase", async ({ bench }) => {
        await bench("string-ts titleCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsTitleCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string titleCase (no cache)", async ({ bench }) => {
            await bench("visulima/string titleCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    titleCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule titleCase", async ({ bench }) => {
            await bench("scule titleCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeTitleCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts titleCase", async ({ bench }) => {
            await bench("string-ts titleCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsTitleCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string titleCase (no cache)", async ({ bench }) => {
            await bench("visulima/string titleCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    titleCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule titleCase", async ({ bench }) => {
            await bench("scule titleCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeTitleCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts titleCase", async ({ bench }) => {
            await bench("string-ts titleCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsTitleCase(stringValue);
                }
            }).run();
        });
    });
});
