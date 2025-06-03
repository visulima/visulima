import { pascalCase } from "@visulima/string/dist/case/case";
import { pascalCase as stringTsPascalCase } from "string-ts";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

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

    bench("string-ts pascalCase", () => {
        for (const stringValue of TEST_STRINGS) {
            stringTsPascalCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                pascalCase(stringValue);
            }
        });

        bench("string-ts pascalCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                stringTsPascalCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                pascalCase(stringValue);
            }
        });

        bench("string-ts pascalCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                stringTsPascalCase(stringValue);
            }
        });
    });
});
