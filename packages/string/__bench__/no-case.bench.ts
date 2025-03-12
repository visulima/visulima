import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { noCase } from "../dist/case";

describe("noCase", () => {
    bench("visulima/string noCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            noCase(string_);
        }
    });

    bench("visulima/string noCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            noCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                noCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                noCase(string_);
            }
        });
    });
});
