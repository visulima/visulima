/* eslint-disable e18e/ban-dependencies */
import { kebabCase } from "@visulima/string/case";
import { kebabCase as caseAnythingKebabCase } from "case-anything";
import { kebabCase as changeCaseKebab } from "change-case";
import { kebabCase as lodashKebabCase } from "lodash";
import { kebabCase as sculeKebabCase } from "scule";
import { kebabCase as stringTsKebabCase } from "string-ts";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

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

    bench.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            lodashKebabCase(stringValue);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            caseAnythingKebabCase(stringValue);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            stringTsKebabCase(stringValue);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeKebabCase(stringValue);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", () => {
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

        bench.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                lodashKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                caseAnythingKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                changeCaseKebab(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                stringTsKebabCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string kebabCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                kebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                lodashKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                caseAnythingKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeKebabCase(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                changeCaseKebab(stringValue);
            }
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                stringTsKebabCase(stringValue);
            }
        });
    });
});
