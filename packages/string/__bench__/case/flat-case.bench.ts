import { flatCase } from "@visulima/string/dist/case/case";
import { flatCase as sculeFlatCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("flatCase", () => {
    bench("visulima/string flatCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            flatCase(stringValue);
        }
    });

    bench("visulima/string flatCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            flatCase(stringValue, { cache: true });
        }
    });

    bench("scule flatCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeFlatCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                flatCase(stringValue);
            }
        });

        bench("scule flatCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeFlatCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                flatCase(stringValue);
            }
        });

        bench("scule flatCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeFlatCase(stringValue);
            }
        });
    });
});
