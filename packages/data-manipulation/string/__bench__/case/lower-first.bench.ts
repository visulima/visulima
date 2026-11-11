import { lowerFirst } from "@visulima/string/case";
import { lowerFirst as sculeLowerFirst } from "scule";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("lowerFirst", () => {
    test("visulima/string lowerFirst (no cache)", async ({ bench }) => {
        await bench("visulima/string lowerFirst (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                lowerFirst(stringValue);
            }
        }).run();
    });

    test("visulima/string lowerFirst (with cache)", async ({ bench }) => {
        await bench("visulima/string lowerFirst (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                lowerFirst(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule lowerFirst", async ({ bench }) => {
        await bench("scule lowerFirst", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeLowerFirst(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string lowerFirst (no cache)", async ({ bench }) => {
            await bench("visulima/string lowerFirst (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    lowerFirst(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule lowerFirst", async ({ bench }) => {
            await bench("scule lowerFirst", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeLowerFirst(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string lowerFirst (no cache)", async ({ bench }) => {
            await bench("visulima/string lowerFirst (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    lowerFirst(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule lowerFirst", async ({ bench }) => {
            await bench("scule lowerFirst", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeLowerFirst(stringValue);
                }
            }).run();
        });
    });
});
