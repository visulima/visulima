import { dotCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("dotCase", () => {
    test("visulima/string dotCase (no cache)", async ({ bench }) => {
        await bench("visulima/string dotCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                dotCase(stringValue);
            }
        }).run();
    });

    test("visulima/string dotCase (with cache)", async ({ bench }) => {
        await bench("visulima/string dotCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                dotCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string dotCase (no cache)", async ({ bench }) => {
            await bench("visulima/string dotCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    dotCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string dotCase (no cache)", async ({ bench }) => {
            await bench("visulima/string dotCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    dotCase(stringValue);
                }
            }).run();
        });
    });
});
