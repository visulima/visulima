import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { sentenceCase } from "../../dist/case";

describe("sentenceCase", () => {
    bench("visulima/string sentenceCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            sentenceCase(stringValue);
        }
    });

    bench("visulima/string sentenceCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            sentenceCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sentenceCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sentenceCase(stringValue);
            }
        });
    });
});
