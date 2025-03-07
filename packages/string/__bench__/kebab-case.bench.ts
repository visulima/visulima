import { bench, describe } from "vitest";
import { kebabCase as lodashKebabCase } from "lodash";
import { kebabCase as caseAnythingKebabCase } from "case-anything";
import { kebabCase as sculeKebabCase } from "scule";
import { kebabCase as changeCaseKebab } from "change-case";
import { kebabCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("kebabCase", () => {
    bench("visulima/string kebabCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            kebabCase(str);
        }
    });

    bench("visulima/string kebabCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            kebabCase(str, { cache: true });
        }
    });

    bench("lodash kebabCase", () => {
        for (const str of TEST_STRINGS) {
            lodashKebabCase(str);
        }
    });

    bench("case-anything kebabCase", () => {
        for (const str of TEST_STRINGS) {
            caseAnythingKebabCase(str);
        }
    });

    bench("scule kebabCase", () => {
        for (const str of TEST_STRINGS) {
            sculeKebabCase(str);
        }
    });

    bench("change-case kebabCase", () => {
        for (const str of TEST_STRINGS) {
            changeCaseKebab(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                kebabCase(str);
            }
        });

        bench("lodash kebabCase", () => {
            for (const str of SPECIAL_STRINGS) {
                lodashKebabCase(str);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const str of SPECIAL_STRINGS) {
                caseAnythingKebabCase(str);
            }
        });

        bench("scule kebabCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeKebabCase(str);
            }
        });

        bench("change-case kebabCase", () => {
            for (const str of SPECIAL_STRINGS) {
                changeCaseKebab(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                kebabCase(str);
            }
        });

        bench("lodash kebabCase", () => {
            for (const str of ACRONYM_STRINGS) {
                lodashKebabCase(str);
            }
        });

        bench("case-anything kebabCase", () => {
            for (const str of ACRONYM_STRINGS) {
                caseAnythingKebabCase(str);
            }
        });

        bench("scule kebabCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeKebabCase(str);
            }
        });

        bench("change-case kebabCase", () => {
            for (const str of ACRONYM_STRINGS) {
                changeCaseKebab(str);
            }
        });
    });
});
