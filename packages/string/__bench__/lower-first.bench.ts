import { lowerFirst as sculeLowerFirst } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { lowerFirst } from "../dist/case";

describe("lowerFirst", () => {
    bench("visulima/string lowerFirst (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            lowerFirst(stringValue);
        }
    });

    bench("visulima/string lowerFirst (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            lowerFirst(stringValue, { cache: true });
        }
    });

    bench("scule lowerFirst", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeLowerFirst(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                lowerFirst(stringValue);
            }
        });

        bench("scule lowerFirst", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeLowerFirst(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                lowerFirst(stringValue);
            }
        });

        bench("scule lowerFirst", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeLowerFirst(stringValue);
            }
        });
    });
});
