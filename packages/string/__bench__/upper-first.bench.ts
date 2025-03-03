import { bench, describe } from "vitest";
import { upperFirst as sculeUpperFirst } from "scule";
import { upperFirst } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("upperFirst", () => {
    bench("visulima/string upperFirst (no cache)", () => {
        for (const str of TEST_STRINGS) {
            upperFirst(str);
        }
    });

    bench("scule upperFirst", () => {
        for (const str of TEST_STRINGS) {
            sculeUpperFirst(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                upperFirst(str);
            }
        });

        bench("scule upperFirst", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeUpperFirst(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string upperFirst (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                upperFirst(str);
            }
        });

        bench("scule upperFirst", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeUpperFirst(str);
            }
        });
    });
});
