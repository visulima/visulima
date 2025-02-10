import { bench, describe } from "vitest";
import { splitByCase as sculeSplitByCase } from "scule";
import { splitByCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("splitByCase", () => {
    bench("visulima/string splitByCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            splitByCase(str);
        }
    });

    bench("scule splitByCase", () => {
        for (const str of TEST_STRINGS) {
            sculeSplitByCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                splitByCase(str);
            }
        });

        bench("scule splitByCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeSplitByCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                splitByCase(str);
            }
        });

        bench("scule splitByCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeSplitByCase(str);
            }
        });
    });
});
