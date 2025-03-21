import { upperFirst as sculeUpperFirst } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { upperFirst } from "../../dist/case";

describe("upperFirst", () => {
    bench("visulima/string upperFirst (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            upperFirst(stringValue);
        }
    });

    bench("scule upperFirst", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeUpperFirst(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                upperFirst(stringValue);
            }
        });

        bench("scule upperFirst", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeUpperFirst(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                upperFirst(stringValue);
            }
        });

        bench("scule upperFirst", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeUpperFirst(stringValue);
            }
        });
    });
});
