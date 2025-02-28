import { bench, describe } from "vitest";
import { titleCase as sculeTitleCase } from "scule";
import { titleCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("titleCase", () => {
    bench("visulima/string titleCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            titleCase(str);
        }
    });

    bench("visulima/string titleCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            titleCase(str);
        }
    });

    bench("scule titleCase", () => {
        for (const str of TEST_STRINGS) {
            sculeTitleCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                titleCase(str);
            }
        });

        bench("scule titleCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeTitleCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                titleCase(str);
            }
        });

        bench("scule titleCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeTitleCase(str);
            }
        });
    });
});
