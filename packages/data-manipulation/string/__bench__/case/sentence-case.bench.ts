import { sentenceCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("sentenceCase", () => {
    test("visulima/string sentenceCase (no cache)", async ({ bench }) => {
        await bench("visulima/string sentenceCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                sentenceCase(stringValue);
            }
        }).run();
    });

    test("visulima/string sentenceCase (with cache)", async ({ bench }) => {
        await bench("visulima/string sentenceCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                sentenceCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string sentenceCase (no cache)", async ({ bench }) => {
            await bench("visulima/string sentenceCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sentenceCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string sentenceCase (no cache)", async ({ bench }) => {
            await bench("visulima/string sentenceCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sentenceCase(stringValue);
                }
            }).run();
        });
    });
});
