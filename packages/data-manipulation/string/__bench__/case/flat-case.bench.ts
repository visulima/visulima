import { flatCase } from "@visulima/string/case";
import { flatCase as sculeFlatCase } from "scule";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("flatCase", () => {
    test("visulima/string flatCase (no cache)", async ({ bench }) => {
        await bench("visulima/string flatCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                flatCase(stringValue);
            }
        }).run();
    });

    test("visulima/string flatCase (with cache)", async ({ bench }) => {
        await bench("visulima/string flatCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                flatCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule flatCase", async ({ bench }) => {
        await bench("scule flatCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeFlatCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string flatCase (no cache)", async ({ bench }) => {
            await bench("visulima/string flatCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    flatCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule flatCase", async ({ bench }) => {
            await bench("scule flatCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeFlatCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string flatCase (no cache)", async ({ bench }) => {
            await bench("visulima/string flatCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    flatCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule flatCase", async ({ bench }) => {
            await bench("scule flatCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeFlatCase(stringValue);
                }
            }).run();
        });
    });
});
