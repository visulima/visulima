import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { flipCase } from "../dist/case";

describe("flipCase", () => {
    bench("visulima/string flipCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            flipCase(string_);
        }
    });

    bench("visulima/string flipCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            flipCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                flipCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                flipCase(string_);
            }
        });
    });
});
