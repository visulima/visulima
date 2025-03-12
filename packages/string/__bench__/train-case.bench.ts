import { trainCase as caseAnythingTrainCase } from "case-anything";
import { trainCase as sculeTrainCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { trainCase } from "../dist/case";

describe("trainCase", () => {
    bench("visulima/string trainCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            trainCase(string_);
        }
    });

    bench("visulima/string trainCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            trainCase(string_, { cache: true });
        }
    });

    bench("case-anything trainCase", () => {
        for (const string_ of TEST_STRINGS) {
            caseAnythingTrainCase(string_);
        }
    });

    bench("scule trainCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeTrainCase(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                trainCase(string_);
            }
        });

        bench("case-anything trainCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                caseAnythingTrainCase(string_);
            }
        });

        bench("scule trainCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeTrainCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                trainCase(string_);
            }
        });

        bench("case-anything trainCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                caseAnythingTrainCase(string_);
            }
        });

        bench("scule trainCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeTrainCase(string_);
            }
        });
    });
});
