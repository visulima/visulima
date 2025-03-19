import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { capitalCase } from "../../dist/case";

describe("capitalCase", () => {
    bench("visulima/string capitalCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            capitalCase(stringValue);
        }
    });

    bench("visulima/string capitalCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            capitalCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                capitalCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                capitalCase(stringValue);
            }
        });
    });
});
