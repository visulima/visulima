import { bench, describe } from "vitest";
import { camelCase as lodashCamelCase } from "lodash";
import { camelCase as caseAnythingCamelCase } from "case-anything";
import { camelCase as sculeCamelCase } from "scule";
import { camelCase as changeCaseCamel } from "change-case";
import { camelCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("camelCase", () => {
    bench("visulima/string camelCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            camelCase(str);
        }
    });

    bench("visulima/string camelCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            camelCase(str);
        }
    });

    bench("lodash camelCase", () => {
        for (const str of TEST_STRINGS) {
            lodashCamelCase(str);
        }
    });

    bench("case-anything camelCase", () => {
        for (const str of TEST_STRINGS) {
            caseAnythingCamelCase(str);
        }
    });

    bench("scule camelCase", () => {
        for (const str of TEST_STRINGS) {
            sculeCamelCase(str);
        }
    });

    bench("change-case camelCase", () => {
        for (const str of TEST_STRINGS) {
            changeCaseCamel(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                camelCase(str);
            }
        });

        bench("lodash camelCase", () => {
            for (const str of SPECIAL_STRINGS) {
                lodashCamelCase(str);
            }
        });

        bench("case-anything camelCase", () => {
            for (const str of SPECIAL_STRINGS) {
                caseAnythingCamelCase(str);
            }
        });

        bench("scule camelCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeCamelCase(str);
            }
        });

        bench("change-case camelCase", () => {
            for (const str of SPECIAL_STRINGS) {
                changeCaseCamel(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                camelCase(str);
            }
        });

        bench("lodash camelCase", () => {
            for (const str of ACRONYM_STRINGS) {
                lodashCamelCase(str);
            }
        });

        bench("case-anything camelCase", () => {
            for (const str of ACRONYM_STRINGS) {
                caseAnythingCamelCase(str);
            }
        });

        bench("scule camelCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeCamelCase(str);
            }
        });

        bench("change-case camelCase", () => {
            for (const str of ACRONYM_STRINGS) {
                changeCaseCamel(str);
            }
        });
    });
});
