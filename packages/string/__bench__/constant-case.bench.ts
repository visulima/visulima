import { bench, describe } from "vitest";
import { constantCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("constantCase", () => {
    bench("visulima/string constantCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            constantCase(str);
        }
    });

    bench("visulima/string constantCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            constantCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                constantCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string constantCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                constantCase(str);
            }
        });
    });
});
