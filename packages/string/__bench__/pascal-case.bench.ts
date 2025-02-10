import { bench, describe } from "vitest";
import { pascalCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("pascalCase", () => {
    bench("visulima/string pascalCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            pascalCase(str);
        }
    });

    bench("visulima/string pascalCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            pascalCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                pascalCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                pascalCase(str);
            }
        });
    });
});
