import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { constantCase } from "../dist/case";

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

    describe("Special characters handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                constantCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                constantCase(stringValue);
            }
        });
    });
});
