import { titleCase as sculeTitleCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { titleCase } from "../dist/case";

describe("titleCase", () => {
    bench("visulima/string titleCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            titleCase(string_);
        }
    });

    bench("visulima/string titleCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            titleCase(string_, { cache: true });
        }
    });

    bench("scule titleCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeTitleCase(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                titleCase(string_);
            }
        });

        bench("scule titleCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeTitleCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                titleCase(string_);
            }
        });

        bench("scule titleCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeTitleCase(string_);
            }
        });
    });
});
