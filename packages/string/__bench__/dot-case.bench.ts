import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { dotCase } from "../dist/case";

describe("dotCase", () => {
    bench("visulima/string dotCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            dotCase(string_);
        }
    });

    bench("visulima/string dotCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            dotCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                dotCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                dotCase(string_);
            }
        });
    });
});
