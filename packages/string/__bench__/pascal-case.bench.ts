import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { pascalCase } from "../dist/case";

describe("pascalCase", () => {
    bench("visulima/string pascalCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            pascalCase(string_);
        }
    });

    bench("visulima/string pascalCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            pascalCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                pascalCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                pascalCase(string_);
            }
        });
    });
});
