import { camelCase } from "@visulima/string/dist/case/case";
import { camelCase as caseAnythingCamelCase } from "case-anything";
import { camelCase as changeCaseCamel } from "change-case";
import { camelCase as lodashCamelCase } from "lodash";
import { camelCase as sculeCamelCase } from "scule";
import { camelCase as stringTsCamelCase } from "string-ts";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("camelCase", () => {
    bench("visulima/string camelCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            camelCase(stringValue);
        }
    });

    bench("visulima/string camelCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            camelCase(stringValue, { cache: true });
        }
    });

    bench("lodash camelCase", () => {
        for (const stringValue of TEST_STRINGS) {
            lodashCamelCase(stringValue);
        }
    });

    bench("case-anything camelCase", () => {
        for (const stringValue of TEST_STRINGS) {
            caseAnythingCamelCase(stringValue);
        }
    });

    bench("string-ts camelCase", () => {
        for (const stringValue of TEST_STRINGS) {
            stringTsCamelCase(stringValue);
        }
    });

    bench("scule camelCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeCamelCase(stringValue);
        }
    });

    bench("change-case camelCase", () => {
        for (const stringValue of TEST_STRINGS) {
            changeCaseCamel(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                camelCase(stringValue);
            }
        });

        bench("visulima/string camelCase (with cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                camelCase(stringValue, { cache: true });
            }
        });

        bench("lodash camelCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                lodashCamelCase(stringValue);
            }
        });

        bench("case-anything camelCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                caseAnythingCamelCase(stringValue);
            }
        });

        bench("scule camelCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeCamelCase(stringValue);
            }
        });

        bench("change-case camelCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                changeCaseCamel(stringValue);
            }
        });

        bench("string-ts camelCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                stringTsCamelCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                camelCase(stringValue);
            }
        });

        bench("visulima/string camelCase (with cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                camelCase(stringValue, { cache: true });
            }
        });

        bench("lodash camelCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                lodashCamelCase(stringValue);
            }
        });

        bench("case-anything camelCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                caseAnythingCamelCase(stringValue);
            }
        });

        bench("scule camelCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeCamelCase(stringValue);
            }
        });

        bench("change-case camelCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                changeCaseCamel(stringValue);
            }
        });

        bench("string-ts camelCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                stringTsCamelCase(stringValue);
            }
        });
    });
});
