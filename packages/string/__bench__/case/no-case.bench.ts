import { noCase } from "@visulima/string/dist/case/case";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("noCase", () => {
    bench("visulima/string noCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            noCase(stringValue);
        }
    });

    bench("visulima/string noCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            noCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                noCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                noCase(stringValue);
            }
        });
    });
});
