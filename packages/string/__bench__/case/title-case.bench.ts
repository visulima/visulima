import { titleCase as sculeTitleCase } from "scule";
import { titleCase as stringTsTitleCase } from "string-ts";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { titleCase } from "../../dist/case";

describe("titleCase", () => {
    bench("visulima/string titleCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            titleCase(stringValue);
        }
    });

    bench("visulima/string titleCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            titleCase(stringValue, { cache: true });
        }
    });

    bench("scule titleCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeTitleCase(stringValue);
        }
    });

    bench("string-ts titleCase", () => {
        for (const stringValue of TEST_STRINGS) {
            stringTsTitleCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                titleCase(stringValue);
            }
        });

        bench("scule titleCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeTitleCase(stringValue);
            }
        });

        bench("string-ts titleCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                stringTsTitleCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string titleCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                titleCase(stringValue);
            }
        });

        bench("scule titleCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeTitleCase(stringValue);
            }
        });

        bench("string-ts titleCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                stringTsTitleCase(stringValue);
            }
        });
    });
});
