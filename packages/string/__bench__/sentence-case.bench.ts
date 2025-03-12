import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { sentenceCase } from "../dist/case";

describe("sentenceCase", () => {
    bench("visulima/string sentenceCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            sentenceCase(string_);
        }
    });

    bench("visulima/string sentenceCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            sentenceCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sentenceCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sentenceCase(string_);
            }
        });
    });
});
