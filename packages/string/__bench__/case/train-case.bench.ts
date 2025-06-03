import { trainCase } from "@visulima/string/dist/case/case";
import { trainCase as caseAnythingTrainCase } from "case-anything";
import { trainCase as sculeTrainCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("trainCase", () => {
    bench("visulima/string trainCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            trainCase(stringValue);
        }
    });

    bench("visulima/string trainCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            trainCase(stringValue, { cache: true });
        }
    });

    bench("case-anything trainCase", () => {
        for (const stringValue of TEST_STRINGS) {
            caseAnythingTrainCase(stringValue);
        }
    });

    bench("scule trainCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeTrainCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                trainCase(stringValue);
            }
        });

        bench("case-anything trainCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                caseAnythingTrainCase(stringValue);
            }
        });

        bench("scule trainCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeTrainCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                trainCase(stringValue);
            }
        });

        bench("case-anything trainCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                caseAnythingTrainCase(stringValue);
            }
        });

        bench("scule trainCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeTrainCase(stringValue);
            }
        });
    });
});
