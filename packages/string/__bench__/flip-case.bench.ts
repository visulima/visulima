import { bench, describe } from "vitest";
import { flipCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("flipCase", () => {
    bench("visulima/string flipCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            flipCase(str);
        }
    });

    bench("visulima/string flipCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            flipCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                flipCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flipCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                flipCase(str);
            }
        });
    });
});
