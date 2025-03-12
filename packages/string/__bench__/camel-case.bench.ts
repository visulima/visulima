import { camelCase as caseAnythingCamelCase } from "case-anything";
import { camelCase as changeCaseCamel } from "change-case";
import { camelCase as lodashCamelCase } from "lodash";
import { camelCase as sculeCamelCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { camelCase } from "../dist/case";

describe("camelCase", () => {
    bench("visulima/string camelCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            camelCase(string_);
        }
    });

    bench("visulima/string camelCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            camelCase(string_, { cache: true });
        }
    });

    bench("lodash camelCase", () => {
        for (const string_ of TEST_STRINGS) {
            lodashCamelCase(string_);
        }
    });

    bench("case-anything camelCase", () => {
        for (const string_ of TEST_STRINGS) {
            caseAnythingCamelCase(string_);
        }
    });

    bench("scule camelCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeCamelCase(string_);
        }
    });

    bench("change-case camelCase", () => {
        for (const string_ of TEST_STRINGS) {
            changeCaseCamel(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                camelCase(string_);
            }
        });

        bench("lodash camelCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                lodashCamelCase(string_);
            }
        });

        bench("case-anything camelCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                caseAnythingCamelCase(string_);
            }
        });

        bench("scule camelCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeCamelCase(string_);
            }
        });

        bench("change-case camelCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                changeCaseCamel(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string camelCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                camelCase(string_);
            }
        });

        bench("lodash camelCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                lodashCamelCase(string_);
            }
        });

        bench("case-anything camelCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                caseAnythingCamelCase(string_);
            }
        });

        bench("scule camelCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeCamelCase(string_);
            }
        });

        bench("change-case camelCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                changeCaseCamel(string_);
            }
        });
    });
});
