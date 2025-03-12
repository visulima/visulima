import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { constantCase } from "../dist/case";

describe("constantCase", () => {
    bench("visulima/string constantCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            constantCase(string_);
        }
    });

    bench("visulima/string constantCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            constantCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                constantCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                constantCase(string_);
            }
        });
    });
});
