import { noCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("noCase", () => {
    test("visulima/string noCase (no cache)", async ({ bench }) => {
        await bench("visulima/string noCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                noCase(stringValue);
            }
        }).run();
    });

    test("visulima/string noCase (with cache)", async ({ bench }) => {
        await bench("visulima/string noCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                noCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string noCase (no cache)", async ({ bench }) => {
            await bench("visulima/string noCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    noCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string noCase (no cache)", async ({ bench }) => {
            await bench("visulima/string noCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    noCase(stringValue);
                }
            }).run();
        });
    });
});
