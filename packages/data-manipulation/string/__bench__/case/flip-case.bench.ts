import { flipCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("flipCase", () => {
    test("visulima/string flipCase (no cache)", async ({ bench }) => {
        await bench("visulima/string flipCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                flipCase(stringValue);
            }
        }).run();
    });

    test("visulima/string flipCase (with cache)", async ({ bench }) => {
        await bench("visulima/string flipCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                flipCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string flipCase (no cache)", async ({ bench }) => {
            await bench("visulima/string flipCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    flipCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string flipCase (no cache)", async ({ bench }) => {
            await bench("visulima/string flipCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    flipCase(stringValue);
                }
            }).run();
        });
    });
});
