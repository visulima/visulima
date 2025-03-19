import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { pascalCase } from "../../dist/case";

describe("pascalCase", () => {
    bench("visulima/string pascalCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            pascalCase(stringValue);
        }
    });

    bench("visulima/string pascalCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            pascalCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                pascalCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                pascalCase(stringValue);
            }
        });
    });
});
