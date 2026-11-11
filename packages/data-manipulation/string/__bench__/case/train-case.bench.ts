import { trainCase } from "@visulima/string/case";
import { trainCase as caseAnythingTrainCase } from "case-anything";
import { trainCase as sculeTrainCase } from "scule";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("trainCase", () => {
    test("visulima/string trainCase (no cache)", async ({ bench }) => {
        await bench("visulima/string trainCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                trainCase(stringValue);
            }
        }).run();
    });

    test("visulima/string trainCase (with cache)", async ({ bench }) => {
        await bench("visulima/string trainCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                trainCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("case-anything trainCase", async ({ bench }) => {
        await bench("case-anything trainCase", () => {
            for (const stringValue of TEST_STRINGS) {
                caseAnythingTrainCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule trainCase", async ({ bench }) => {
        await bench("scule trainCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeTrainCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string trainCase (no cache)", async ({ bench }) => {
            await bench("visulima/string trainCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    trainCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything trainCase", async ({ bench }) => {
            await bench("case-anything trainCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    caseAnythingTrainCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule trainCase", async ({ bench }) => {
            await bench("scule trainCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeTrainCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string trainCase (no cache)", async ({ bench }) => {
            await bench("visulima/string trainCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    trainCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything trainCase", async ({ bench }) => {
            await bench("case-anything trainCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    caseAnythingTrainCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule trainCase", async ({ bench }) => {
            await bench("scule trainCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeTrainCase(stringValue);
                }
            }).run();
        });
    });
});
