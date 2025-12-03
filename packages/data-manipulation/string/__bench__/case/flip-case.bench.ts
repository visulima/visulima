import { flipCase } from "@visulima/string/dist/case/case";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("flipCase", () => {
    bench("visulima/string flipCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            flipCase(stringValue);
        }
    });

    bench("visulima/string flipCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            flipCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                flipCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                flipCase(stringValue);
            }
        });
    });
});
