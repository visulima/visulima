import { flatCase as sculeFlatCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { flatCase } from "../dist/case";

describe("flatCase", () => {
    bench("visulima/string flatCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            flatCase(string_);
        }
    });

    bench("visulima/string flatCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            flatCase(string_, { cache: true });
        }
    });

    bench("scule flatCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeFlatCase(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                flatCase(string_);
            }
        });

        bench("scule flatCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeFlatCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                flatCase(string_);
            }
        });

        bench("scule flatCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeFlatCase(string_);
            }
        });
    });
});
