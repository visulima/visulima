import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { capitalCase } from "../dist/case";

describe("capitalCase", () => {
    bench("visulima/string capitalCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            capitalCase(string_);
        }
    });

    bench("visulima/string capitalCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            capitalCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                capitalCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                capitalCase(string_);
            }
        });
    });
});
