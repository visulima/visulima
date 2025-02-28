import { bench, describe } from "vitest";
import { capitalCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("capitalCase", () => {
    bench("visulima/string capitalCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            capitalCase(str);
        }
    });

    bench("visulima/string capitalCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            capitalCase(str, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                capitalCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string capitalCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                capitalCase(str);
            }
        });
    });
});
