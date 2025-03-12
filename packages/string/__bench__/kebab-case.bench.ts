import { kebabCase as caseAnythingKebabCase } from "case-anything";
import { kebabCase as changeCaseKebab } from "change-case";
import { kebabCase as lodashKebabCase } from "lodash";
import { kebabCase as sculeKebabCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { kebabCase } from "../dist/case";

describe("kebabCase", () => {
    bench("visulima/string kebabCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            kebabCase(string_);
        }
    });

    bench("visulima/string kebabCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            kebabCase(string_, { cache: true });
        }
    });

    bench("lodash kebabCase", () => {
        for (const string_ of TEST_STRINGS) {
            lodashKebabCase(string_);
        }
    });

    bench("case-anything kebabCase", () => {
        for (const string_ of TEST_STRINGS) {
            caseAnythingKebabCase(string_);
        }
    });

    bench("scule kebabCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeKebabCase(string_);
        }
    });

    bench("change-case kebabCase", () => {
        for (const string_ of TEST_STRINGS) {
            changeCaseKebab(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                kebabCase(string_);
            }
        });

        bench("lodash kebabCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                lodashKebabCase(string_);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                caseAnythingKebabCase(string_);
            }
        });

        bench("scule kebabCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeKebabCase(string_);
            }
        });

        bench("change-case kebabCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                changeCaseKebab(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                kebabCase(string_);
            }
        });

        bench("lodash kebabCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                lodashKebabCase(string_);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                caseAnythingKebabCase(string_);
            }
        });

        bench("scule kebabCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeKebabCase(string_);
            }
        });

        bench("change-case kebabCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                changeCaseKebab(string_);
            }
        });
    });
});
