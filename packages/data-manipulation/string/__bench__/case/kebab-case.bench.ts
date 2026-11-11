/* eslint-disable e18e/ban-dependencies */
import { kebabCase } from "@visulima/string/case";
import { kebabCase as caseAnythingKebabCase } from "case-anything";
import { kebabCase as changeCaseKebab } from "change-case";
import { kebabCase as lodashKebabCase } from "lodash";
import { kebabCase as sculeKebabCase } from "scule";
import { kebabCase as stringTsKebabCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("kebabCase", () => {
    test("visulima/string kebabCase (no cache)", async ({ bench }) => {
        await bench("visulima/string kebabCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                kebabCase(stringValue);
            }
        }).run();
    });

    test("visulima/string kebabCase (with cache)", async ({ bench }) => {
        await bench("visulima/string kebabCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                kebabCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", async ({ bench }) => {
        await bench("lodash kebabCase", () => {
            for (const stringValue of TEST_STRINGS) {
                lodashKebabCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", async ({ bench }) => {
        await bench("case-anything kebabCase", () => {
            for (const stringValue of TEST_STRINGS) {
                caseAnythingKebabCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", async ({ bench }) => {
        await bench("string-ts kebabCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsKebabCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", async ({ bench }) => {
        await bench("scule kebabCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeKebabCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", async ({ bench }) => {
        await bench("change-case kebabCase", () => {
            for (const stringValue of TEST_STRINGS) {
                changeCaseKebab(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string kebabCase (no cache)", async ({ bench }) => {
            await bench("visulima/string kebabCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    kebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", async ({ bench }) => {
            await bench("lodash kebabCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    lodashKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", async ({ bench }) => {
            await bench("case-anything kebabCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    caseAnythingKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", async ({ bench }) => {
            await bench("scule kebabCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", async ({ bench }) => {
            await bench("change-case kebabCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    changeCaseKebab(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", async ({ bench }) => {
            await bench("string-ts kebabCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsKebabCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string kebabCase (no cache)", async ({ bench }) => {
            await bench("visulima/string kebabCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    kebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash kebabCase", async ({ bench }) => {
            await bench("lodash kebabCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    lodashKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything kebabCase", async ({ bench }) => {
            await bench("case-anything kebabCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    caseAnythingKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule kebabCase", async ({ bench }) => {
            await bench("scule kebabCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeKebabCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case kebabCase", async ({ bench }) => {
            await bench("change-case kebabCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    changeCaseKebab(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts kebabCase", async ({ bench }) => {
            await bench("string-ts kebabCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsKebabCase(stringValue);
                }
            }).run();
        });
    });
});
