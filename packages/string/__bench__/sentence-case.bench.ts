import { bench, describe } from "vitest";
import { sentenceCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("sentenceCase", () => {
    bench("visulima/string sentenceCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            sentenceCase(str);
        }
    });

    bench("visulima/string sentenceCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            sentenceCase(str, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                sentenceCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string sentenceCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                sentenceCase(str);
            }
        });
    });
});
