import { bench, describe } from "vitest";
import { noCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("noCase", () => {
    bench("visulima/string noCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            noCase(str);
        }
    });

    bench("visulima/string noCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            noCase(str, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                noCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string noCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                noCase(str);
            }
        });
    });
});
