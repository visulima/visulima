import { bench, describe } from "vitest";
import { trainCase as caseAnythingTrainCase } from "case-anything";
import { trainCase as sculeTrainCase } from "scule";
import { trainCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("trainCase", () => {
    bench("visulima/string trainCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            trainCase(str);
        }
    });

    bench("visulima/string trainCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            trainCase(str);
        }
    });

    bench("case-anything trainCase", () => {
        for (const str of TEST_STRINGS) {
            caseAnythingTrainCase(str);
        }
    });

    bench("scule trainCase", () => {
        for (const str of TEST_STRINGS) {
            sculeTrainCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                trainCase(str);
            }
        });

        bench("case-anything trainCase", () => {
            for (const str of SPECIAL_STRINGS) {
                caseAnythingTrainCase(str);
            }
        });

        bench("scule trainCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeTrainCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string trainCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                trainCase(str);
            }
        });

        bench("case-anything trainCase", () => {
            for (const str of ACRONYM_STRINGS) {
                caseAnythingTrainCase(str);
            }
        });

        bench("scule trainCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeTrainCase(str);
            }
        });
    });
});
