import { bench, describe } from "vitest";
import { lowerFirst as sculeLowerFirst } from "scule";
import { lowerFirst } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("lowerFirst", () => {
    bench("visulima/string lowerFirst (no cache)", () => {
        for (const str of TEST_STRINGS) {
            lowerFirst(str);
        }
    });

    bench("visulima/string lowerFirst (with cache)", () => {
        for (const str of TEST_STRINGS) {
            lowerFirst(str);
        }
    });

    bench("scule lowerFirst", () => {
        for (const str of TEST_STRINGS) {
            sculeLowerFirst(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                lowerFirst(str);
            }
        });

        bench("scule lowerFirst", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeLowerFirst(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string lowerFirst (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                lowerFirst(str);
            }
        });

        bench("scule lowerFirst", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeLowerFirst(str);
            }
        });
    });
});
