import { capitalCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("capitalCase", () => {
    test("visulima/string capitalCase (no cache)", async ({ bench }) => {
        await bench("visulima/string capitalCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                capitalCase(stringValue);
            }
        }).run();
    });

    test("visulima/string capitalCase (with cache)", async ({ bench }) => {
        await bench("visulima/string capitalCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                capitalCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string capitalCase (no cache)", async ({ bench }) => {
            await bench("visulima/string capitalCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    capitalCase(stringValue);
                }
            }).run();
        });

        test("visulima/string capitalCase (with cache)", async ({ bench }) => {
            await bench("visulima/string capitalCase (with cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    capitalCase(stringValue, { cache: true });
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string capitalCase (no cache)", async ({ bench }) => {
            await bench("visulima/string capitalCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    capitalCase(stringValue);
                }
            }).run();
        });

        test("visulima/string capitalCase (with cache)", async ({ bench }) => {
            await bench("visulima/string capitalCase (with cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    capitalCase(stringValue, { cache: true });
                }
            }).run();
        });
    });
});
