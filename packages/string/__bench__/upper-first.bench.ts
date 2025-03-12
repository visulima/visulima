import { upperFirst as sculeUpperFirst } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { upperFirst } from "../dist/case";

describe("upperFirst", () => {
    bench("visulima/string upperFirst (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            upperFirst(string_);
        }
    });

    bench("scule upperFirst", () => {
        for (const string_ of TEST_STRINGS) {
            sculeUpperFirst(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                upperFirst(string_);
            }
        });

        bench("scule upperFirst", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeUpperFirst(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                upperFirst(string_);
            }
        });

        bench("scule upperFirst", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeUpperFirst(string_);
            }
        });
    });
});
