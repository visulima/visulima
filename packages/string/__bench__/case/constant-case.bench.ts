import { constantCase } from "@visulima/string/dist/case/case";
import { constantCase as stringTsConstantCase } from "string-ts";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("constantCase", () => {
    bench("visulima/string constantCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            constantCase(stringValue);
        }
    });

    bench("visulima/string constantCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            constantCase(stringValue, { cache: true });
        }
    });

    bench("string-ts constantCase", () => {
        for (const stringValue of TEST_STRINGS) {
            stringTsConstantCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                constantCase(stringValue);
            }
        });

        bench("visulima/string constantCase (with cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                constantCase(stringValue, { cache: true });
            }
        });

        bench("string-ts constantCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                stringTsConstantCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                constantCase(stringValue);
            }
        });

        bench("visulima/string constantCase (with cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                constantCase(stringValue, { cache: true });
            }
        });

        bench("string-ts constantCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                stringTsConstantCase(stringValue);
            }
        });
    });
});
