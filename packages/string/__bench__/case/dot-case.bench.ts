import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { dotCase } from "../../dist/case";

describe("dotCase", () => {
    bench("visulima/string dotCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            dotCase(stringValue);
        }
    });

    bench("visulima/string dotCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            dotCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                dotCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string dotCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                dotCase(stringValue);
            }
        });
    });
});
