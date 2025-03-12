import { lowerFirst as sculeLowerFirst } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { lowerFirst } from "../dist/case";

describe("lowerFirst", () => {
    bench("visulima/string lowerFirst (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            lowerFirst(string_);
        }
    });

    bench("visulima/string lowerFirst (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            lowerFirst(string_, { cache: true });
        }
    });

    bench("scule lowerFirst", () => {
        for (const string_ of TEST_STRINGS) {
            sculeLowerFirst(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                lowerFirst(string_);
            }
        });

        bench("scule lowerFirst", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeLowerFirst(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                lowerFirst(string_);
            }
        });

        bench("scule lowerFirst", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeLowerFirst(string_);
            }
        });
    });
});
