import { bench, describe } from "vitest";
import { dotCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("dotCase", () => {
    bench("visulima/string dotCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            dotCase(str);
        }
    });

    bench("visulima/string dotCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            dotCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                dotCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                dotCase(str);
            }
        });
    });
});
