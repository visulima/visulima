import { upperFirst } from "@visulima/string/case";
import { upperFirst as sculeUpperFirst } from "scule";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("upperFirst", () => {
    test("visulima/string upperFirst (no cache)", async ({ bench }) => {
        await bench("visulima/string upperFirst (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                upperFirst(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule upperFirst", async ({ bench }) => {
        await bench("scule upperFirst", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeUpperFirst(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string upperFirst (no cache)", async ({ bench }) => {
            await bench("visulima/string upperFirst (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    upperFirst(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule upperFirst", async ({ bench }) => {
            await bench("scule upperFirst", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeUpperFirst(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string upperFirst (no cache)", async ({ bench }) => {
            await bench("visulima/string upperFirst (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    upperFirst(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule upperFirst", async ({ bench }) => {
            await bench("scule upperFirst", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeUpperFirst(stringValue);
                }
            }).run();
        });
    });
});
