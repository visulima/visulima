import { bench, describe } from "vitest";
import { flatCase as sculeFlatCase } from "scule";
import { flatCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("flatCase", () => {
    bench("visulima/string flatCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            flatCase(str);
        }
    });

    bench("visulima/string flatCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            flatCase(str);
        }
    });

    bench("scule flatCase", () => {
        for (const str of TEST_STRINGS) {
            sculeFlatCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                flatCase(str);
            }
        });

        bench("scule flatCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeFlatCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string flatCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                flatCase(str);
            }
        });

        bench("scule flatCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeFlatCase(str);
            }
        });
    });
});
