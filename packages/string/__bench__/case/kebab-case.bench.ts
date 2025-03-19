import { kebabCase as caseAnythingKebabCase } from "case-anything";
import { kebabCase as changeCaseKebab } from "change-case";
import { kebabCase as lodashKebabCase } from "lodash";
import { kebabCase as sculeKebabCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { kebabCase } from "../../dist/case";

describe("kebabCase", () => {
    bench("visulima/string kebabCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            kebabCase(stringValue);
        }
    });

    bench("visulima/string kebabCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            kebabCase(stringValue, { cache: true });
        }
    });

    bench("lodash kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            lodashKebabCase(stringValue);
        }
    });

    bench("case-anything kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            caseAnythingKebabCase(stringValue);
        }
    });

    bench("scule kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeKebabCase(stringValue);
        }
    });

    bench("change-case kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            changeCaseKebab(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                kebabCase(stringValue);
            }
        });

        bench("lodash kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                lodashKebabCase(stringValue);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                caseAnythingKebabCase(stringValue);
            }
        });

        bench("scule kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeKebabCase(stringValue);
            }
        });

        bench("change-case kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                changeCaseKebab(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                kebabCase(stringValue);
            }
        });

        bench("lodash kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                lodashKebabCase(stringValue);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                caseAnythingKebabCase(stringValue);
            }
        });

        bench("scule kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeKebabCase(stringValue);
            }
        });

        bench("change-case kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                changeCaseKebab(stringValue);
            }
        });
    });
});
