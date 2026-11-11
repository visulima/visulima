import { constantCase } from "@visulima/string/case";
import { constantCase as stringTsConstantCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("constantCase", () => {
    test("visulima/string constantCase (no cache)", async ({ bench }) => {
        await bench("visulima/string constantCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                constantCase(stringValue);
            }
        }).run();
    });

    test("visulima/string constantCase (with cache)", async ({ bench }) => {
        await bench("visulima/string constantCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                constantCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts constantCase", async ({ bench }) => {
        await bench("string-ts constantCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsConstantCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string constantCase (no cache)", async ({ bench }) => {
            await bench("visulima/string constantCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    constantCase(stringValue);
                }
            }).run();
        });

        test("visulima/string constantCase (with cache)", async ({ bench }) => {
            await bench("visulima/string constantCase (with cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    constantCase(stringValue, { cache: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts constantCase", async ({ bench }) => {
            await bench("string-ts constantCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsConstantCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string constantCase (no cache)", async ({ bench }) => {
            await bench("visulima/string constantCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    constantCase(stringValue);
                }
            }).run();
        });

        test("visulima/string constantCase (with cache)", async ({ bench }) => {
            await bench("visulima/string constantCase (with cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    constantCase(stringValue, { cache: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts constantCase", async ({ bench }) => {
            await bench("string-ts constantCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsConstantCase(stringValue);
                }
            }).run();
        });
    });
});
